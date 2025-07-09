import { supabase } from '../config/supabase';
import securityMonitoring from './securityMonitoringService';
import monitoring from '../config/monitoring';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

interface SessionMetadata {
  deviceId: string;
  platform: string;
  lastActivity: string;
  ipAddress: string;
  userAgent: string;
}

class SessionManagementService {
  private static instance: SessionManagementService;
  private readonly SESSION_METADATA_PREFIX = 'session_metadata:';
  private readonly MAX_SESSIONS_PER_USER = 3;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly ROTATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    this.initializeSessionManagement();
  }

  static getInstance(): SessionManagementService {
    if (!SessionManagementService.instance) {
      SessionManagementService.instance = new SessionManagementService();
    }
    return SessionManagementService.instance;
  }

  private async initializeSessionManagement(): Promise<void> {
    try {
      // Start session cleanup interval
      setInterval(() => {
        this.cleanupInactiveSessions().catch(error => {
          console.error('Failed to cleanup sessions:', error);
          monitoring.trackError(error as Error, { context: 'cleanupInactiveSessions' });
        });
      }, 5 * 60 * 1000); // Every 5 minutes

      // Subscribe to auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await this.initializeSession(session);
        } else if (event === 'SIGNED_OUT') {
          await this.terminateSession(session);
        }
      });
    } catch (error) {
      console.error('Failed to initialize session management:', error);
      monitoring.trackError(error as Error, { context: 'initializeSessionManagement' });
    }
  }

  private async initializeSession(session: any): Promise<void> {
    try {
      const userId = session.user.id;
      const sessionId = session.access_token;

      // Generate session token
      const sessionToken = await this.generateSessionToken();

      // Get device and platform info
      const metadata: SessionMetadata = {
        deviceId: await this.getDeviceId(),
        platform: await this.getPlatform(),
        lastActivity: new Date().toISOString(),
        ipAddress: await securityMonitoring.getCurrentIp(),
        userAgent: await this.getUserAgent(),
      };

      // Store session metadata
      await AsyncStorage.setItem(
        `${this.SESSION_METADATA_PREFIX}${sessionId}`,
        JSON.stringify({
          userId,
          sessionToken,
          metadata,
          created: new Date().toISOString(),
        })
      );

      // Store in database for cross-device tracking
      await supabase
        .from('active_sessions')
        .insert({
          user_id: userId,
          session_id: sessionId,
          session_token: sessionToken,
          metadata,
        });

      // Check and enforce session limit
      await this.enforceSessionLimit(userId);

      // Schedule token rotation
      this.scheduleTokenRotation(sessionId);
    } catch (error) {
      console.error('Failed to initialize session:', error);
      monitoring.trackError(error as Error, { context: 'initializeSession' });
    }
  }

  private async generateSessionToken(): Promise<string> {
    const buffer = await Crypto.getRandomValues(new Uint8Array(32));
    return Buffer.from(buffer).toString('base64');
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    try {
      const { data: sessions } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessions && sessions.length > this.MAX_SESSIONS_PER_USER) {
        // Get sessions to terminate
        const sessionsToTerminate = sessions.slice(this.MAX_SESSIONS_PER_USER);

        // Terminate old sessions
        for (const session of sessionsToTerminate) {
          await this.terminateSession(session);
        }

        // Log security event
        await securityMonitoring.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'medium',
          details: { reason: 'max_sessions_exceeded', terminatedCount: sessionsToTerminate.length },
          timestamp: new Date().toISOString(),
          userId,
        });
      }
    } catch (error) {
      console.error('Failed to enforce session limit:', error);
      monitoring.trackError(error as Error, { context: 'enforceSessionLimit' });
    }
  }

  private async terminateSession(session: any): Promise<void> {
    try {
      if (!session) return;

      const sessionId = session.access_token || session.session_id;
      const userId = session.user?.id || session.user_id;

      // Remove from local storage
      await AsyncStorage.removeItem(`${this.SESSION_METADATA_PREFIX}${sessionId}`);

      // Remove from database
      await supabase
        .from('active_sessions')
        .delete()
        .eq('session_id', sessionId);

      // Blacklist the session token
      if (session.access_token) {
        await securityMonitoring.blacklistToken(
          session.access_token,
          'session_terminated'
        );
      }

      // Log security event
      await securityMonitoring.logSecurityEvent({
        type: 'session_terminated',
        severity: 'low',
        details: { sessionId },
        timestamp: new Date().toISOString(),
        userId,
      });
    } catch (error) {
      console.error('Failed to terminate session:', error);
      monitoring.trackError(error as Error, { context: 'terminateSession' });
    }
  }

  private async cleanupInactiveSessions(): Promise<void> {
    try {
      const now = new Date();
      const { data: sessions } = await supabase
        .from('active_sessions')
        .select('*');

      if (!sessions) return;

      for (const session of sessions) {
        const lastActivity = new Date(session.metadata.lastActivity);
        if (now.getTime() - lastActivity.getTime() > this.SESSION_TIMEOUT) {
          await this.terminateSession(session);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup inactive sessions:', error);
      monitoring.trackError(error as Error, { context: 'cleanupInactiveSessions' });
    }
  }

  private scheduleTokenRotation(sessionId: string): void {
    setInterval(async () => {
      try {
        await this.rotateSessionToken(sessionId);
      } catch (error) {
        console.error('Failed to rotate session token:', error);
        monitoring.trackError(error as Error, { context: 'rotateSessionToken' });
      }
    }, this.ROTATION_INTERVAL);
  }

  private async rotateSessionToken(sessionId: string): Promise<void> {
    try {
      // Generate new token
      const newToken = await this.generateSessionToken();

      // Update in database
      const { error } = await supabase
        .from('active_sessions')
        .update({ session_token: newToken })
        .eq('session_id', sessionId);

      if (error) throw error;

      // Update local storage
      const storedData = await AsyncStorage.getItem(`${this.SESSION_METADATA_PREFIX}${sessionId}`);
      if (storedData) {
        const data = JSON.parse(storedData);
        data.sessionToken = newToken;
        await AsyncStorage.setItem(`${this.SESSION_METADATA_PREFIX}${sessionId}`, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to rotate session token:', error);
      monitoring.trackError(error as Error, { context: 'rotateSessionToken' });
    }
  }

  async validateSession(sessionId: string, sessionToken: string): Promise<boolean> {
    try {
      // Get session from database
      const { data: session } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (!session) return false;

      // Validate session token
      if (session.session_token !== sessionToken) {
        await securityMonitoring.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'high',
          details: { reason: 'invalid_session_token', sessionId },
          timestamp: new Date().toISOString(),
          userId: session.user_id,
        });
        return false;
      }

      // Check session timeout
      const lastActivity = new Date(session.metadata.lastActivity);
      if (Date.now() - lastActivity.getTime() > this.SESSION_TIMEOUT) {
        await this.terminateSession(session);
        return false;
      }

      // Update last activity
      await this.updateSessionActivity(sessionId);

      return true;
    } catch (error) {
      console.error('Failed to validate session:', error);
      monitoring.trackError(error as Error, { context: 'validateSession' });
      return false;
    }
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const now = new Date().toISOString();

      // Update in database
      await supabase
        .from('active_sessions')
        .update({
          'metadata.lastActivity': now,
        })
        .eq('session_id', sessionId);

      // Update in local storage
      const storedData = await AsyncStorage.getItem(`${this.SESSION_METADATA_PREFIX}${sessionId}`);
      if (storedData) {
        const data = JSON.parse(storedData);
        data.metadata.lastActivity = now;
        await AsyncStorage.setItem(`${this.SESSION_METADATA_PREFIX}${sessionId}`, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to update session activity:', error);
      monitoring.trackError(error as Error, { context: 'updateSessionActivity' });
    }
  }

  private async getDeviceId(): Promise<string> {
    // Implement device ID generation based on your needs
    return 'device-id';
  }

  private async getPlatform(): Promise<string> {
    // Implement platform detection
    return 'platform-info';
  }

  private async getUserAgent(): Promise<string> {
    // Implement user agent detection
    return 'user-agent';
  }
}

export default SessionManagementService.getInstance(); 