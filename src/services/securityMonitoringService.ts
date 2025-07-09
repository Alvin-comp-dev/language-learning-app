import { supabase } from '../config/supabase';
import monitoring from '../config/monitoring';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit' | 'suspicious_activity' | 'data_access' | 'permission_change' | 'token_blacklisted' | 'forced_token_refresh';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  timestamp: string;
  userId?: string;
  ip?: string;
}

interface RateLimitConfig {
  endpoint: string;
  limit: number;
  windowMs: number;
  ipLimit?: number; // Limit per IP address
}

interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private readonly IP_RATE_LIMIT_PREFIX = 'ip_rate_limit:';
  private readonly FAILED_AUTH_PREFIX = 'failed_auth:';
  private readonly SUSPICIOUS_IP_PREFIX = 'suspicious_ip:';
  private readonly BLACKLISTED_TOKEN_PREFIX = 'blacklisted_token:';
  private readonly TOKEN_BLACKLIST_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  private storage: Map<string, RateLimitEntry>;
  private rateLimitRules: Map<string, RateLimitRule>;
  private readonly defaultRule: RateLimitRule = {
    windowMs: 60000, // 1 minute
    maxRequests: 60  // 60 requests per minute
  };
  
  // Rate limiting configurations
  private rateLimitConfigs: RateLimitConfig[] = [
    { 
      endpoint: 'auth',
      limit: 5,
      windowMs: 5 * 60 * 1000, // 5 attempts per 5 minutes
      ipLimit: 10 // 10 attempts per IP
    },
    { 
      endpoint: 'api',
      limit: 100,
      windowMs: 60 * 1000, // 100 requests per minute
      ipLimit: 200 // 200 requests per IP
    },
    { 
      endpoint: 'conversation',
      limit: 50,
      windowMs: 60 * 1000, // 50 requests per minute
      ipLimit: 100 // 100 requests per IP
    }
  ];

  private constructor() {
    this.storage = new Map();
    this.rateLimitRules = new Map();

    // Set default rules for different endpoints
    this.setRateLimitRule('/api/auth', {
      windowMs: 60000,    // 1 minute
      maxRequests: 5      // 5 login attempts per minute
    });

    this.setRateLimitRule('/api/public', {
      windowMs: 60000,    // 1 minute
      maxRequests: 120    // 120 requests per minute
    });

    this.initializeSecurityMonitoring();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  private async initializeSecurityMonitoring() {
    try {
      // Subscribe to auth events
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          this.monitorUserSession(session);
        }
      });

      // Initialize real-time monitoring for critical tables
      this.initializeRealtimeMonitoring();
    } catch (error) {
      console.error('Failed to initialize security monitoring:', error);
      monitoring.trackError(error as Error, { context: 'initializeSecurityMonitoring' });
    }
  }

  private initializeRealtimeMonitoring() {
    // Monitor user permission changes
    supabase
      .channel('security_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_roles',
      }, async (payload) => {
        await this.logSecurityEvent({
          type: 'permission_change',
          severity: 'high',
          details: payload,
          timestamp: new Date().toISOString(),
          userId: payload.new?.user_id,
        });
      })
      .subscribe();
  }

  private async monitorUserSession(session: any) {
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const currentIp = await this.getCurrentIp();

    // Check for suspicious IP
    if (await this.isIpSuspicious(currentIp)) {
      await this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'high',
        details: { reason: 'suspicious_ip', ip: currentIp },
        timestamp: new Date().toISOString(),
        userId,
        ip: currentIp,
      });
    }

    // Check for concurrent sessions
    const activeSessions = await this.getActiveSessions(userId);
    if (activeSessions.length > 3) { // Allow up to 3 concurrent sessions
      await this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'medium',
        details: { reason: 'concurrent_sessions', count: activeSessions.length },
        timestamp: new Date().toISOString(),
        userId,
        ip: currentIp,
      });
    }
  }

  private async getCurrentIp(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get IP:', error);
      return 'unknown';
    }
  }

  private async isIpSuspicious(ip: string): Promise<boolean> {
    try {
      // Check if IP is in our suspicious list
      const key = `${this.SUSPICIOUS_IP_PREFIX}${ip}`;
      const suspicious = await AsyncStorage.getItem(key);
      if (suspicious) return true;

      // Check against known bad IP list (you would integrate with a security service here)
      // For now, we'll just check if it's been involved in failed auth attempts
      const failedAttempts = await this.getFailedAuthAttempts(ip);
      return failedAttempts > 10;
    } catch (error) {
      console.error('Failed to check IP:', error);
      return false;
    }
  }

  private async getActiveSessions(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  }

  async checkRateLimit(endpoint: string, userId?: string): Promise<boolean> {
    try {
      const config = this.rateLimitConfigs.find(c => c.endpoint === endpoint);
      if (!config) return true;

      const currentIp = await this.getCurrentIp();
      
      // Check IP-based rate limit first
      if (config.ipLimit) {
        const ipKey = `${this.IP_RATE_LIMIT_PREFIX}${endpoint}:${currentIp}`;
        const ipLimitExceeded = await this.checkLimitExceeded(
          ipKey,
          config.ipLimit,
          config.windowMs
        );

        if (ipLimitExceeded) {
          await this.logSecurityEvent({
            type: 'rate_limit',
            severity: 'high',
            details: { endpoint, ip: currentIp, reason: 'ip_limit_exceeded' },
            timestamp: new Date().toISOString(),
            ip: currentIp,
          });
          return false;
        }
      }

      // Then check user-based rate limit
      if (userId) {
        const userKey = `${this.RATE_LIMIT_PREFIX}${endpoint}:${userId}`;
        const userLimitExceeded = await this.checkLimitExceeded(
          userKey,
          config.limit,
          config.windowMs
        );

        if (userLimitExceeded) {
          await this.logSecurityEvent({
            type: 'rate_limit',
            severity: 'medium',
            details: { endpoint, userId, reason: 'user_limit_exceeded' },
            timestamp: new Date().toISOString(),
            userId,
            ip: currentIp,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      monitoring.trackError(error as Error, { context: 'checkRateLimit' });
      return true; // Fail open to prevent blocking legitimate traffic
    }
  }

  private async checkLimitExceeded(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    try {
      const current = await AsyncStorage.getItem(key);
      const attempts = current ? JSON.parse(current) : [];

      // Clean old attempts
      const now = Date.now();
      const validAttempts = attempts.filter((timestamp: number) => 
        now - timestamp < windowMs
      );

      if (validAttempts.length >= limit) {
        return true;
      }

      // Add new attempt
      validAttempts.push(now);
      await AsyncStorage.setItem(key, JSON.stringify(validAttempts));
      return false;
    } catch (error) {
      console.error('Failed to check limit:', error);
      return false; // Fail open
    }
  }

  async logFailedAuth(userId: string, ip: string): Promise<void> {
    try {
      const key = `${this.FAILED_AUTH_PREFIX}${ip}`;
      const current = await AsyncStorage.getItem(key);
      const attempts = current ? JSON.parse(current) : [];
      attempts.push(Date.now());

      // Keep only last 24 hours
      const validAttempts = attempts.filter(
        (timestamp: number) => Date.now() - timestamp < 24 * 60 * 60 * 1000
      );

      await AsyncStorage.setItem(key, JSON.stringify(validAttempts));

      if (validAttempts.length >= 5) {
        await this.logSecurityEvent({
          type: 'auth_failure',
          severity: 'high',
          details: { attempts: validAttempts.length },
          timestamp: new Date().toISOString(),
          userId,
          ip,
        });
      }
    } catch (error) {
      console.error('Failed to log auth failure:', error);
    }
  }

  private async getFailedAuthAttempts(ip: string): Promise<number> {
    try {
      const key = `${this.FAILED_AUTH_PREFIX}${ip}`;
      const current = await AsyncStorage.getItem(key);
      if (!current) return 0;

      const attempts = JSON.parse(current);
      return attempts.filter(
        (timestamp: number) => Date.now() - timestamp < 24 * 60 * 60 * 1000
      ).length;
    } catch (error) {
      console.error('Failed to get auth attempts:', error);
      return 0;
    }
  }

  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Log to Supabase
      const { error } = await supabase
        .from('security_events')
        .insert(event);

      if (error) throw error;

      // Log to monitoring service
      monitoring.trackEvent('security_event', {
        type: event.type,
        severity: event.severity,
        userId: event.userId,
      });

      // Send critical alerts
      if (event.severity === 'critical' || event.severity === 'high') {
        await this.sendSecurityAlert(event);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      monitoring.trackError(error as Error, { context: 'logSecurityEvent' });
    }
  }

  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      // Here you would integrate with your alert system (e.g., email, Slack, etc.)
      // For now, we'll just log to monitoring
      monitoring.trackEvent('security_alert', {
        type: event.type,
        severity: event.severity,
        userId: event.userId,
        details: event.details,
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
      monitoring.trackError(error as Error, { context: 'sendSecurityAlert' });
    }
  }

  async monitorDataAccess(
    table: string,
    operation: 'read' | 'write' | 'delete',
    userId?: string
  ): Promise<void> {
    try {
      // Log data access event
      await this.logSecurityEvent({
        type: 'data_access',
        severity: 'low',
        details: { table, operation },
        timestamp: new Date().toISOString(),
        userId,
      });

      // Check for suspicious patterns
      const recentAccess = await this.getRecentDataAccess(userId);
      if (this.isAnomalousAccess(recentAccess)) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'high',
          details: { reason: 'anomalous_data_access', recentAccess },
          timestamp: new Date().toISOString(),
          userId,
        });
      }
    } catch (error) {
      console.error('Failed to monitor data access:', error);
      monitoring.trackError(error as Error, { context: 'monitorDataAccess' });
    }
  }

  private async getRecentDataAccess(userId?: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('type', 'data_access')
        .eq('userId', userId)
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get recent data access:', error);
      return [];
    }
  }

  private isAnomalousAccess(recentAccess: any[]): boolean {
    // Implement anomaly detection logic here
    // For now, we'll use a simple threshold
    return recentAccess.length > 100; // More than 100 access events in an hour
  }

  async blacklistToken(token: string, reason: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      
      // Store in blacklist with TTL
      await AsyncStorage.setItem(
        `${this.BLACKLISTED_TOKEN_PREFIX}${token}`,
        JSON.stringify({
          timestamp: Date.now(),
          reason,
          userId: user?.id,
        })
      );

      // Log security event
      await this.logSecurityEvent({
        type: 'token_blacklisted',
        severity: 'high',
        details: { reason, userId: user?.id },
        timestamp: new Date().toISOString(),
        userId: user?.id,
      });

      // Force token refresh for user's other sessions
      if (user?.id) {
        await this.forceTokenRefresh(user.id);
      }
    } catch (error) {
      console.error('Failed to blacklist token:', error);
      monitoring.trackError(error as Error, { context: 'blacklistToken' });
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistData = await AsyncStorage.getItem(
        `${this.BLACKLISTED_TOKEN_PREFIX}${token}`
      );

      if (!blacklistData) {
        return false;
      }

      const { timestamp } = JSON.parse(blacklistData);
      
      // Check if blacklist entry has expired
      if (Date.now() - timestamp > this.TOKEN_BLACKLIST_TTL) {
        await AsyncStorage.removeItem(`${this.BLACKLISTED_TOKEN_PREFIX}${token}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to check token blacklist:', error);
      monitoring.trackError(error as Error, { context: 'isTokenBlacklisted' });
      return false;
    }
  }

  private async forceTokenRefresh(userId: string): Promise<void> {
    try {
      // Get all active sessions for user
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId);

      if (!sessions) return;

      // Invalidate all sessions except the current one
      await Promise.all(
        sessions.map(async (session) => {
          try {
            await supabase.auth.admin.signOut(session.id);
          } catch (error) {
            console.error('Failed to invalidate session:', error);
          }
        })
      );

      // Log security event
      await this.logSecurityEvent({
        type: 'forced_token_refresh',
        severity: 'medium',
        details: { userId },
        timestamp: new Date().toISOString(),
        userId,
      });
    } catch (error) {
      console.error('Failed to force token refresh:', error);
      monitoring.trackError(error as Error, { context: 'forceTokenRefresh' });
    }
  }

  async trackSuspiciousIP(ip: string, reason: string): Promise<void> {
    try {
      const key = `${this.SUSPICIOUS_IP_PREFIX}${ip}`;
      const current = await AsyncStorage.getItem(key);
      const incidents = current ? JSON.parse(current) : [];

      incidents.push({
        timestamp: Date.now(),
        reason,
      });

      // Keep only last 24 hours
      const recentIncidents = incidents.filter(
        (incident: any) => Date.now() - incident.timestamp < 24 * 60 * 60 * 1000
      );

      await AsyncStorage.setItem(key, JSON.stringify(recentIncidents));

      // Log if multiple incidents
      if (recentIncidents.length >= 3) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'high',
          details: { ip, incidents: recentIncidents },
          timestamp: new Date().toISOString(),
          ip,
        });
      }
    } catch (error) {
      console.error('Failed to track suspicious IP:', error);
      monitoring.trackError(error as Error, { context: 'trackSuspiciousIP' });
    }
  }

  /**
   * Set custom rate limit rule for an endpoint
   */
  public setRateLimitRule(endpoint: string, rule: RateLimitRule): void {
    this.rateLimitRules.set(endpoint, rule);
  }

  private async checkRateLimitInternal(key: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.storage.get(key) || { count: 0, resetTime: now + this.defaultRule.windowMs };

    // Reset if window expired
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + this.defaultRule.windowMs;
    }

    // Check limit
    if (entry.count >= this.defaultRule.maxRequests) {
      await this.logSecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        details: { key }
      });
      return false;
    }

    // Increment counter
    entry.count++;
    this.storage.set(key, entry);

    // Log metric
    await monitoring.logMetric('rate_limit_check', {
      key,
      count: entry.count,
      limit: this.defaultRule.maxRequests
    });

    return true;
  }
}

export default SecurityMonitoringService.getInstance(); 