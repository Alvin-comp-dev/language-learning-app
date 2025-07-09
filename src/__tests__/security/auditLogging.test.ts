import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';

// Mock modules
jest.mock('../../services/securityMonitoringService');
jest.mock('../../config/supabase');
jest.mock('../../config/monitoring');

import AuditLogger from '../../services/auditLogService';
import securityMonitoring from '../../services/securityMonitoringService';
import { supabase } from '../../config/supabase';
import monitoring from '../../config/monitoring';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  const mockUserId = 'test-user-id';
  const mockAction = 'user_login';
  const mockIp = '192.168.1.1';
  const mockSensitiveData = {
    email: 'user@example.com',
    password: 'hashedPassword123',
    creditCard: '4111-1111-1111-1111',
    phoneNumber: '+1234567890'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger = new AuditLogger();

    // Mock Supabase responses
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockResolvedValue({
        data: { id: 'test-log-id' },
        error: null
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
    });
  });

  describe('Audit Log Creation', () => {
    test('should create audit log with required fields', async () => {
      const log = await auditLogger.logAction({
        userId: mockUserId,
        action: mockAction,
        ipAddress: mockIp
      });

      expect(log.id).toBeTruthy();
      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audit_log_created',
          severity: 'low'
        })
      );
    });

    test('should include additional metadata in audit log', async () => {
      const metadata = {
        browser: 'Chrome',
        platform: 'Windows',
        location: 'US'
      };

      const log = await auditLogger.logAction({
        userId: mockUserId,
        action: mockAction,
        ipAddress: mockIp,
        metadata
      });

      expect(log.metadata).toEqual(metadata);
    });

    test('should handle failed log creation', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      });

      await expect(auditLogger.logAction({
        userId: mockUserId,
        action: mockAction,
        ipAddress: mockIp
      })).rejects.toThrow('Failed to create audit log');

      expect(monitoring.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audit_log_creation_failed'
        })
      );
    });
  });

  describe('Data Redaction', () => {
    test('should redact sensitive data in audit logs', async () => {
      const log = await auditLogger.logAction({
        userId: mockUserId,
        action: 'update_profile',
        ipAddress: mockIp,
        data: mockSensitiveData
      });

      // Verify sensitive data is redacted
      expect(log.data).toEqual({
        email: expect.stringMatching(/^\*+@example\.com$/),
        password: expect.stringMatching(/^\*+$/),
        creditCard: expect.stringMatching(/^\*+1111$/),
        phoneNumber: expect.stringMatching(/^\*+7890$/)
      });
    });

    test('should preserve non-sensitive data', async () => {
      const nonSensitiveData = {
        username: 'testuser',
        language: 'en',
        timezone: 'UTC'
      };

      const log = await auditLogger.logAction({
        userId: mockUserId,
        action: 'update_preferences',
        ipAddress: mockIp,
        data: nonSensitiveData
      });

      expect(log.data).toEqual(nonSensitiveData);
    });

    test('should handle nested sensitive data', async () => {
      const nestedData = {
        user: {
          profile: {
            email: 'user@example.com',
            phone: '+1234567890'
          }
        },
        settings: {
          notifications: true
        }
      };

      const log = await auditLogger.logAction({
        userId: mockUserId,
        action: 'update_profile',
        ipAddress: mockIp,
        data: nestedData
      });

      expect(log.data.user.profile.email).toMatch(/^\*+@example\.com$/);
      expect(log.data.user.profile.phone).toMatch(/^\*+7890$/);
      expect(log.data.settings.notifications).toBe(true);
    });
  });

  describe('Audit Log Retrieval', () => {
    test('should retrieve redacted audit logs', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'log-1',
                  userId: mockUserId,
                  action: 'update_profile',
                  data: mockSensitiveData,
                  timestamp: new Date().toISOString()
                }],
                error: null
              })
            })
          })
        })
      });

      const logs = await auditLogger.getUserLogs(mockUserId, 10);
      
      expect(logs[0].data).toEqual({
        email: expect.stringMatching(/^\*+@example\.com$/),
        password: expect.stringMatching(/^\*+$/),
        creditCard: expect.stringMatching(/^\*+1111$/),
        phoneNumber: expect.stringMatching(/^\*+7890$/)
      });
    });

    test('should handle log retrieval errors', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error')
              })
            })
          })
        })
      });

      await expect(auditLogger.getUserLogs(mockUserId, 10))
        .rejects.toThrow('Failed to retrieve audit logs');

      expect(monitoring.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audit_log_retrieval_failed'
        })
      );
    });
  });

  describe('Compliance Features', () => {
    test('should enforce log retention policy', async () => {
      await auditLogger.enforceRetentionPolicy(90); // 90 days retention

      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(monitoring.logMetric).toHaveBeenCalledWith(
        'retention_policy_enforced',
        expect.any(Object)
      );
    });

    test('should export audit logs in compliance format', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const exportData = await auditLogger.exportLogs(startDate, endDate);

      expect(exportData).toHaveProperty('logs');
      expect(exportData).toHaveProperty('metadata');
      expect(exportData.metadata).toHaveProperty('exportDate');
      expect(exportData.metadata).toHaveProperty('dateRange');
    });

    test('should verify log integrity', async () => {
      const log = await auditLogger.logAction({
        userId: mockUserId,
        action: mockAction,
        ipAddress: mockIp
      });

      const isValid = await auditLogger.verifyLogIntegrity(log.id);
      expect(isValid).toBe(true);
    });
  });
}); 