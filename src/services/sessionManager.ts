import { supabase } from '../config/supabase';
import securityMonitoring from './securityMonitoringService';
import monitoring from '../config/monitoring';
import { randomBytes } from 'crypto';

interface SessionCreateParams {
  userId: string;
  deviceId: string;
  ipAddress: string;
}

interface Session {
  id: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  antiFixationToken: string;
  lastActivity: string;
  createdAt: string;
}

/**
 * SessionManager handles user session management including:
 * - Session creation and validation
 * - Anti-fixation protection
 * - Session timeout and cleanup
 * - Concurrent session management
 */
class SessionManager {
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
  private readonly MAX_SESSIONS_PER_USER = 5;
  private readonly RAPID_CREATION_THRESHOLD = 5; // Max sessions per minute
  private readonly IP_CHANGE_THRESHOLD = 3; // Max IP changes per session
  private sessionCreationCount: Map<string, number>;
  private ipChangeCount: Map<string, number>;

  constructor() {
    this.sessionCreationCount = new Map();
    this.ipChangeCount = new Map();

    // Start cleanup interval
    setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        monitoring.logError({
          type: 'session_cleanup_failed',
          error
        });
      });
    }, 15 * 60 * 1000); // Run every 15 minutes
  }

  /**
   * Create a new session
   */
  public async createSession(params: SessionCreateParams): Promise<Session> {
    try {
      // Check for rapid session creation
      const creationCount = this.sessionCreationCount.get(params.userId) || 0;
      if (creationCount >= this.RAPID_CREATION_THRESHOLD) {
        await securityMonitoring.logSecurityEvent({
          type: 'rapid_session_creation',
          severity: 'high',
          details: {
            userId: params.userId,
            count: creationCount
          }
        });
        throw new Error('Too many session creation attempts');
      }

      // Increment creation count
      this.sessionCreationCount.set(params.userId, creationCount + 1);
      setTimeout(() => {
        this.sessionCreationCount.set(params.userId, creationCount);
      }, 60000); // Reset after 1 minute

      // Check concurrent sessions
      const activeSessions = await this.getActiveSessions(params.userId);
      if (activeSessions.length >= this.MAX_SESSIONS_PER_USER) {
        await securityMonitoring.logSecurityEvent({
          type: 'max_sessions_exceeded',
          severity: 'medium',
          details: {
            userId: params.userId,
            sessionCount: activeSessions.length
          }
        });
        throw new Error('Maximum sessions limit reached');
      }

      // Check for sessions from different locations
      const uniqueIps = new Set(activeSessions.map(s => s.ipAddress));
      if (uniqueIps.size >= 2 && !uniqueIps.has(params.ipAddress)) {
        await securityMonitoring.logSecurityEvent({
          type: 'concurrent_sessions_detected',
          severity: 'medium',
          details: {
            userId: params.userId,
            ipCount: uniqueIps.size + 1
          }
        });
      }

      // Generate anti-fixation token
      const antiFixationToken = randomBytes(32).toString('hex');

      // Create session
      const { data, error } = await supabase.from('user_sessions').insert({
        userId: params.userId,
        deviceId: params.deviceId,
        ipAddress: params.ipAddress,
        antiFixationToken,
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }).select().single();

      if (error) {
        throw error;
      }

      await securityMonitoring.logSecurityEvent({
        type: 'session_created',
        severity: 'low',
        details: {
          userId: params.userId,
          deviceId: params.deviceId
        }
      });

      return data as Session;
    } catch (error) {
      await monitoring.logError({
        type: 'session_creation_failed',
        error
      });
      throw error;
    }
  }

  /**
   * Validate session and anti-fixation token
   */
  public async validateSession(
    sessionId: string,
    antiFixationToken: string,
    deviceId: string
  ): Promise<boolean> {
    try {
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return false;
      }

      // Check anti-fixation token
      if (session.antiFixationToken !== antiFixationToken) {
        await securityMonitoring.logSecurityEvent({
          type: 'invalid_anti_fixation_token',
          severity: 'high',
          details: { sessionId }
        });
        return false;
      }

      // Check device ID
      if (session.deviceId !== deviceId) {
        await securityMonitoring.logSecurityEvent({
          type: 'session_fixation_attempt',
          severity: 'high',
          details: {
            sessionId,
            expectedDevice: session.deviceId,
            actualDevice: deviceId
          }
        });
        return false;
      }

      // Check session timeout
      const lastActivity = new Date(session.lastActivity).getTime();
      if (Date.now() - lastActivity > this.SESSION_TIMEOUT) {
        await securityMonitoring.logSecurityEvent({
          type: 'session_expired',
          severity: 'low',
          details: { sessionId }
        });
        return false;
      }

      return true;
    } catch (error) {
      await monitoring.logError({
        type: 'session_validation_failed',
        error
      });
      return false;
    }
  }

  /**
   * Extend session timeout
   */
  public async extendSession(sessionId: string): Promise<Session> {
    try {
      const lastActivity = new Date().toISOString();
      const { data, error } = await supabase
        .from('user_sessions')
        .update({ lastActivity })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Session;
    } catch (error) {
      await monitoring.logError({
        type: 'session_extension_failed',
        error
      });
      throw error;
    }
  }

  /**
   * Update session IP address
   */
  public async updateSessionIp(sessionId: string, ipAddress: string): Promise<void> {
    try {
      // Track IP changes
      const changes = this.ipChangeCount.get(sessionId) || 0;
      this.ipChangeCount.set(sessionId, changes + 1);

      if (changes >= this.IP_CHANGE_THRESHOLD) {
        await securityMonitoring.logSecurityEvent({
          type: 'session_hopping_detected',
          severity: 'high',
          details: {
            sessionId,
            ipChangeCount: changes + 1
          }
        });
      }

      await supabase
        .from('user_sessions')
        .update({ ipAddress })
        .eq('id', sessionId);
    } catch (error) {
      await monitoring.logError({
        type: 'session_ip_update_failed',
        error
      });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiryTime = new Date(Date.now() - this.SESSION_TIMEOUT).toISOString();
      
      await supabase
        .from('user_sessions')
        .delete()
        .lt('lastActivity', expiryTime);

      await monitoring.logMetric('session_cleanup', {
        expiryTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await monitoring.logError({
        type: 'session_cleanup_failed',
        error
      });
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   */
  private async getActiveSessions(userId: string): Promise<Session[]> {
    try {
      const expiryTime = new Date(Date.now() - this.SESSION_TIMEOUT).toISOString();
      
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('userId', userId)
        .gt('lastActivity', expiryTime);

      if (error) {
        throw error;
      }

      return data as Session[];
    } catch (error) {
      await monitoring.logError({
        type: 'active_sessions_lookup_failed',
        error
      });
      return [];
    }
  }
}

export default SessionManager; 