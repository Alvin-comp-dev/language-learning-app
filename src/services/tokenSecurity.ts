import { supabase } from '../config/supabase';
import securityMonitoring from './securityMonitoringService';
import monitoring from '../config/monitoring';

interface TokenRotationResult {
  rotated: boolean;
  newToken: string | null;
  error?: Error;
}

interface TokenRefreshResult {
  success: boolean;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  error?: Error;
}

interface TokenValidationResult {
  valid: boolean;
  error?: Error;
}

/**
 * TokenSecurity class handles token management, including:
 * - Token blacklisting
 * - Token rotation
 * - Refresh token management
 * - Security pattern detection
 */
class TokenSecurity {
  private readonly REFRESH_THRESHOLD = 5 * 60; // 5 minutes before expiration
  private readonly MAX_REFRESH_ATTEMPTS = 3;
  private readonly CONCURRENT_IP_LIMIT = 2;
  private refreshAttempts: Map<string, number>;
  private tokenUsage: Map<string, Set<string>>;

  constructor() {
    this.refreshAttempts = new Map();
    this.tokenUsage = new Map();
  }

  /**
   * Blacklist a token
   * @param token - Token to blacklist
   * @param reason - Reason for blacklisting
   */
  public async blacklistToken(token: string, reason: string): Promise<void> {
    try {
      await supabase.from('blacklisted_tokens').insert({
        token,
        reason,
        blacklisted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });

      await securityMonitoring.logSecurityEvent({
        type: 'token_blacklisted',
        severity: 'medium',
        details: { reason }
      });
    } catch (error) {
      await monitoring.logError({
        type: 'token_blacklist_failed',
        error
      });
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted
   * @param token - Token to check
   */
  public async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('blacklisted_tokens')
        .select('token')
        .eq('token', token)
        .single();

      if (error) {
        throw error;
      }

      return !!data;
    } catch (error) {
      await monitoring.logError({
        type: 'blacklist_check_failed',
        error
      });
      return true; // Fail secure
    }
  }

  /**
   * Clean up expired blacklisted tokens
   */
  public async cleanupBlacklistedTokens(): Promise<void> {
    try {
      const now = new Date().toISOString();
      await supabase
        .from('blacklisted_tokens')
        .delete()
        .lt('expires_at', now);

      await monitoring.logMetric('blacklist_cleanup', {
        timestamp: now
      });
    } catch (error) {
      await monitoring.logError({
        type: 'blacklist_cleanup_failed',
        error
      });
    }
  }

  /**
   * Rotate token if it's approaching expiration
   * @param token - Current token
   */
  public async rotateTokenIfNeeded(token: string): Promise<TokenRotationResult> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        throw error || new Error('User not found');
      }

      // Check if token needs rotation
      const timeUntilExpiry = (user.exp || 0) - Math.floor(Date.now() / 1000);
      if (timeUntilExpiry > this.REFRESH_THRESHOLD) {
        return { rotated: false, newToken: null };
      }

      // Rotate token
      const { data: session, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !session) {
        throw refreshError || new Error('Token refresh failed');
      }

      // Blacklist old token
      await this.blacklistToken(token, 'rotated');

      return {
        rotated: true,
        newToken: session.session?.access_token || null
      };
    } catch (error) {
      await monitoring.logError({
        type: 'token_rotation_failed',
        error
      });
      return {
        rotated: false,
        newToken: null,
        error: error as Error
      };
    }
  }

  /**
   * Refresh token using refresh token
   * @param refreshToken - Refresh token
   */
  public async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    try {
      // Check refresh attempt count
      const attempts = this.refreshAttempts.get(refreshToken) || 0;
      if (attempts >= this.MAX_REFRESH_ATTEMPTS) {
        await securityMonitoring.logSecurityEvent({
          type: 'suspicious_refresh_attempts',
          severity: 'high',
          details: { attempts }
        });
        return { success: false, error: new Error('Too many refresh attempts') };
      }

      // Increment attempt counter
      this.refreshAttempts.set(refreshToken, attempts + 1);

      const { data: session, error } = await supabase.auth.refreshSession();
      
      if (error || !session) {
        await securityMonitoring.logSecurityEvent({
          type: 'invalid_refresh_token',
          severity: 'high',
          details: { error: error?.message }
        });
        return { success: false, error };
      }

      return {
        success: true,
        tokens: {
          accessToken: session.session?.access_token || '',
          refreshToken: session.session?.refresh_token || ''
        }
      };
    } catch (error) {
      await monitoring.logError({
        type: 'token_refresh_failed',
        error
      });
      return { success: false, error: error as Error };
    }
  }

  /**
   * Handle compromised refresh token
   * @param refreshToken - Compromised refresh token
   * @param userId - Associated user ID
   */
  public async handleCompromisedRefreshToken(
    refreshToken: string,
    userId: string
  ): Promise<void> {
    try {
      // Blacklist the compromised token
      await this.blacklistToken(refreshToken, 'compromised');

      // Log security event
      await securityMonitoring.logSecurityEvent({
        type: 'refresh_token_compromised',
        severity: 'high',
        details: {
          userId,
          action: 'token_invalidated'
        }
      });

      // Clear refresh attempts
      this.refreshAttempts.delete(refreshToken);
    } catch (error) {
      await monitoring.logError({
        type: 'compromised_token_handling_failed',
        error
      });
      throw error;
    }
  }

  /**
   * Validate token and check for security patterns
   * @param token - Token to validate
   * @param ipAddress - IP address using the token
   */
  public async validateToken(
    token: string,
    ipAddress: string
  ): Promise<TokenValidationResult> {
    try {
      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(token)) {
        return { valid: false };
      }

      // Track token usage by IP
      let tokenIPs = this.tokenUsage.get(token) || new Set();
      tokenIPs.add(ipAddress);
      this.tokenUsage.set(token, tokenIPs);

      // Check for concurrent usage from multiple IPs
      if (tokenIPs.size > this.CONCURRENT_IP_LIMIT) {
        await securityMonitoring.logSecurityEvent({
          type: 'concurrent_token_usage',
          severity: 'high',
          details: {
            token,
            ipCount: tokenIPs.size
          }
        });
        return { valid: false };
      }

      // Validate token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        if (error?.message?.includes('expired')) {
          await securityMonitoring.logSecurityEvent({
            type: 'token_reuse_attempt',
            severity: 'high',
            details: { token }
          });
        }
        return { valid: false, error };
      }

      return { valid: true };
    } catch (error) {
      await monitoring.logError({
        type: 'token_validation_failed',
        error
      });
      return { valid: false, error: error as Error };
    }
  }
}

export default TokenSecurity; 