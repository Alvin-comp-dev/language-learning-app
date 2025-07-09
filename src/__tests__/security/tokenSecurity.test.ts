import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';

// Mock modules
jest.mock('../../services/securityMonitoringService');
jest.mock('../../config/supabase');
jest.mock('../../config/monitoring');

import TokenSecurity from '../../services/tokenSecurity';
import securityMonitoring from '../../services/securityMonitoringService';
import { supabase } from '../../config/supabase';
import monitoring from '../../config/monitoring';

describe('TokenSecurity', () => {
  let tokenSecurity: TokenSecurity;
  const mockUserId = 'test-user-id';
  const mockToken = 'valid.jwt.token';
  const mockRefreshToken = 'valid.refresh.token';

  beforeEach(() => {
    jest.clearAllMocks();
    tokenSecurity = new TokenSecurity();

    // Mock Supabase auth responses
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          email: 'test@example.com',
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        }
      },
      error: null
    });
  });

  describe('Token Blacklisting', () => {
    test('should blacklist a token', async () => {
      const reason = 'user_logout';
      await tokenSecurity.blacklistToken(mockToken, reason);

      expect(supabase.from).toHaveBeenCalledWith('blacklisted_tokens');
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_blacklisted',
          severity: 'medium',
          details: expect.objectContaining({
            reason
          })
        })
      );
    });

    test('should detect blacklisted token', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { token: mockToken },
              error: null
            })
          })
        })
      });

      const isBlacklisted = await tokenSecurity.isTokenBlacklisted(mockToken);
      expect(isBlacklisted).toBe(true);
    });

    test('should clean up expired blacklisted tokens', async () => {
      await tokenSecurity.cleanupBlacklistedTokens();

      expect(supabase.from).toHaveBeenCalledWith('blacklisted_tokens');
      expect(monitoring.logMetric).toHaveBeenCalledWith(
        'blacklist_cleanup',
        expect.any(Object)
      );
    });
  });

  describe('Token Rotation', () => {
    test('should rotate token when approaching expiration', async () => {
      // Mock token approaching expiration
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: mockUserId,
            exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
          }
        },
        error: null
      });

      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'new.jwt.token',
            refresh_token: 'new.refresh.token'
          }
        },
        error: null
      });

      const result = await tokenSecurity.rotateTokenIfNeeded(mockToken);
      expect(result.rotated).toBe(true);
      expect(result.newToken).toBe('new.jwt.token');
    });

    test('should not rotate valid tokens', async () => {
      // Mock token with plenty of time left
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: mockUserId,
            exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
          }
        },
        error: null
      });

      const result = await tokenSecurity.rotateTokenIfNeeded(mockToken);
      expect(result.rotated).toBe(false);
      expect(result.newToken).toBeNull();
    });

    test('should handle rotation failures', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Refresh failed')
      });

      const result = await tokenSecurity.rotateTokenIfNeeded(mockToken);
      expect(result.rotated).toBe(false);
      expect(result.error).toBeTruthy();
      expect(monitoring.logError).toHaveBeenCalled();
    });
  });

  describe('Refresh Token Management', () => {
    test('should refresh token with valid refresh token', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'new.jwt.token',
            refresh_token: 'new.refresh.token'
          }
        },
        error: null
      });

      const result = await tokenSecurity.refreshToken(mockRefreshToken);
      expect(result.success).toBe(true);
      expect(result.tokens?.accessToken).toBe('new.jwt.token');
      expect(result.tokens?.refreshToken).toBe('new.refresh.token');
    });

    test('should handle invalid refresh tokens', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Invalid refresh token')
      });

      const result = await tokenSecurity.refreshToken('invalid.refresh.token');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invalid_refresh_token',
          severity: 'high'
        })
      );
    });

    test('should blacklist compromised refresh tokens', async () => {
      const compromisedToken = 'compromised.refresh.token';
      await tokenSecurity.handleCompromisedRefreshToken(compromisedToken, mockUserId);

      expect(supabase.from).toHaveBeenCalledWith('blacklisted_tokens');
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'refresh_token_compromised',
          severity: 'high',
          details: expect.objectContaining({
            userId: mockUserId
          })
        })
      );
    });
  });

  describe('Token Security Patterns', () => {
    test('should detect multiple refresh attempts', async () => {
      // Simulate multiple refresh attempts
      for (let i = 0; i < 5; i++) {
        await tokenSecurity.refreshToken(mockRefreshToken);
      }

      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'suspicious_refresh_attempts',
          severity: 'high'
        })
      );
    });

    test('should detect concurrent token usage', async () => {
      // Simulate concurrent token usage from different IPs
      await Promise.all([
        tokenSecurity.validateToken(mockToken, '192.168.1.1'),
        tokenSecurity.validateToken(mockToken, '192.168.1.2'),
        tokenSecurity.validateToken(mockToken, '192.168.1.3')
      ]);

      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'concurrent_token_usage',
          severity: 'high'
        })
      );
    });

    test('should handle token reuse after rotation', async () => {
      // First, rotate the token
      await tokenSecurity.rotateTokenIfNeeded(mockToken);

      // Then try to use the old token
      const result = await tokenSecurity.validateToken(mockToken, '192.168.1.1');
      expect(result.valid).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_reuse_attempt',
          severity: 'high'
        })
      );
    });
  });
}); 