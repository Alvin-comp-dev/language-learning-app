import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';

// Mock modules
jest.mock('../../services/securityMonitoringService');
jest.mock('../../config/supabase');
jest.mock('../../config/monitoring');

import SessionManager from '../../services/sessionManager';
import securityMonitoring from '../../services/securityMonitoringService';
import { supabase } from '../../config/supabase';
import monitoring from '../../config/monitoring';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const mockUserId = 'test-user-id';
  const mockSessionId = 'test-session-id';
  const mockDeviceId = 'test-device-id';
  const mockIp = '192.168.1.1';

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager();

    // Mock Supabase responses
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      }),
      insert: jest.fn().mockResolvedValue({
        data: { id: mockSessionId },
        error: null
      }),
      update: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
      delete: jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
    });
  });

  describe('Session Creation and Validation', () => {
    test('should create new session with anti-fixation token', async () => {
      const session = await sessionManager.createSession({
        userId: mockUserId,
        deviceId: mockDeviceId,
        ipAddress: mockIp
      });

      expect(session.id).toBeTruthy();
      expect(session.antiFixationToken).toBeTruthy();
      expect(supabase.from).toHaveBeenCalledWith('user_sessions');
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_created',
          severity: 'low'
        })
      );
    });

    test('should validate session with anti-fixation token', async () => {
      // Mock existing session
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                userId: mockUserId,
                antiFixationToken: 'valid-token',
                deviceId: mockDeviceId,
                lastActivity: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      const isValid = await sessionManager.validateSession(
        mockSessionId,
        'valid-token',
        mockDeviceId
      );

      expect(isValid).toBe(true);
    });

    test('should detect session fixation attempts', async () => {
      // Mock existing session with different device ID
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                userId: mockUserId,
                antiFixationToken: 'valid-token',
                deviceId: 'different-device-id',
                lastActivity: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      const isValid = await sessionManager.validateSession(
        mockSessionId,
        'valid-token',
        mockDeviceId
      );

      expect(isValid).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_fixation_attempt',
          severity: 'high'
        })
      );
    });
  });

  describe('Session Cleanup and Timeout', () => {
    test('should cleanup expired sessions', async () => {
      await sessionManager.cleanupExpiredSessions();

      expect(supabase.from).toHaveBeenCalledWith('user_sessions');
      expect(monitoring.logMetric).toHaveBeenCalledWith(
        'session_cleanup',
        expect.any(Object)
      );
    });

    test('should handle session timeout', async () => {
      // Mock expired session
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                userId: mockUserId,
                antiFixationToken: 'valid-token',
                deviceId: mockDeviceId,
                lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
              },
              error: null
            })
          })
        })
      });

      const isValid = await sessionManager.validateSession(
        mockSessionId,
        'valid-token',
        mockDeviceId
      );

      expect(isValid).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_expired',
          severity: 'low'
        })
      );
    });

    test('should extend session on activity', async () => {
      const extendedSession = await sessionManager.extendSession(mockSessionId);
      
      expect(extendedSession.lastActivity).toBeTruthy();
      expect(supabase.from).toHaveBeenCalledWith('user_sessions');
    });
  });

  describe('Concurrent Session Management', () => {
    test('should detect concurrent sessions from different locations', async () => {
      // Mock multiple active sessions
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'session-1',
                  ipAddress: '192.168.1.1',
                  lastActivity: new Date().toISOString()
                },
                {
                  id: 'session-2',
                  ipAddress: '10.0.0.1',
                  lastActivity: new Date().toISOString()
                }
              ],
              error: null
            })
          })
        })
      });

      await sessionManager.createSession({
        userId: mockUserId,
        deviceId: mockDeviceId,
        ipAddress: '172.16.0.1'
      });

      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'concurrent_sessions_detected',
          severity: 'medium'
        })
      );
    });

    test('should enforce maximum session limit', async () => {
      // Mock maximum sessions reached
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue({
              data: Array(5).fill({
                id: 'session-id',
                lastActivity: new Date().toISOString()
              }),
              error: null
            })
          })
        })
      });

      await expect(sessionManager.createSession({
        userId: mockUserId,
        deviceId: mockDeviceId,
        ipAddress: mockIp
      })).rejects.toThrow('Maximum sessions limit reached');

      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'max_sessions_exceeded',
          severity: 'medium'
        })
      );
    });
  });

  describe('Session Security Patterns', () => {
    test('should detect rapid session creation attempts', async () => {
      // Create multiple sessions rapidly
      const attempts = Array(5).fill(null).map(() => 
        sessionManager.createSession({
          userId: mockUserId,
          deviceId: mockDeviceId,
          ipAddress: mockIp
        })
      );

      await Promise.all(attempts);

      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rapid_session_creation',
          severity: 'high'
        })
      );
    });

    test('should handle invalid anti-fixation tokens', async () => {
      const isValid = await sessionManager.validateSession(
        mockSessionId,
        'invalid-token',
        mockDeviceId
      );

      expect(isValid).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invalid_anti_fixation_token',
          severity: 'high'
        })
      );
    });

    test('should detect session hopping attempts', async () => {
      // Mock session with rapidly changing IPs
      const ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1'];
      
      for (const ip of ips) {
        await sessionManager.updateSessionIp(mockSessionId, ip);
      }

      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_hopping_detected',
          severity: 'high'
        })
      );
    });
  });
}); 