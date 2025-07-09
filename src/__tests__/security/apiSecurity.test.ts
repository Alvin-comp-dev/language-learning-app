import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn()
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn()
        })
      })
    })
  }
}));

// Mock security monitoring service
jest.mock('../../services/securityMonitoringService', () => ({
  logSecurityEvent: jest.fn(),
  isTokenBlacklisted: jest.fn(),
  checkRateLimit: jest.fn(),
  checkIpRateLimit: jest.fn(),
  checkUserRateLimit: jest.fn(),
  checkCombinedRateLimit: jest.fn(),
  monitorDataAccess: jest.fn()
}));

// Mock monitoring configuration
jest.mock('../../config/monitoring', () => ({
  logMetric: jest.fn(),
  logError: jest.fn(),
  logEvent: jest.fn()
}));

// Import mocked modules
jest.mock('../../middleware/apiSecurity');
jest.mock('../../services/securityMonitoringService');
jest.mock('../../config/supabase');
jest.mock('../../config/monitoring');

import ApiSecurity from '../../middleware/apiSecurity';
import securityMonitoring from '../../services/securityMonitoringService';
import { supabase } from '../../config/supabase';
import monitoring from '../../config/monitoring';

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Set up global mocks
global.AsyncStorage = mockAsyncStorage;

describe('ApiSecurity', () => {
  let apiSecurity: typeof ApiSecurity;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    apiSecurity = ApiSecurity.getInstance();
  });

  describe('validateRequest', () => {
    const testCases = [
      {
        name: 'should validate required fields',
        data: { username: 'test' },
        rules: {
          username: { type: 'string', required: true },
          password: { type: 'string', required: true }
        },
        expectedValid: false,
        expectedErrors: ['password is required']
      },
      {
        name: 'should validate string length',
        data: { username: 'a', password: 'test123' },
        rules: {
          username: { type: 'string', required: true, minLength: 3 },
          password: { type: 'string', required: true, minLength: 6 }
        },
        expectedValid: false,
        expectedErrors: ['username must be at least 3 characters']
      },
      {
        name: 'should detect XSS attempts',
        data: { 
          username: '<script>alert("xss")</script>',
          password: 'test123'
        },
        rules: {
          username: { type: 'string', required: true },
          password: { type: 'string', required: true }
        },
        expectedValid: true,
        expectSecurityLog: true
      },
      {
        name: 'should detect SQL injection attempts',
        data: {
          username: "admin' OR '1'='1",
          password: 'test123'
        },
        rules: {
          username: { type: 'string', required: true },
          password: { type: 'string', required: true }
        },
        expectedValid: true,
        expectSecurityLog: true
      }
    ];

    test.each(testCases)('$name', async ({ data, rules, expectedValid, expectedErrors, expectSecurityLog }) => {
      const result = await apiSecurity.validateRequest('test', 'POST', data, rules);
      
      expect(result.isValid).toBe(expectedValid);
      if (expectedErrors) {
        expect(result.errors).toEqual(expect.arrayContaining(expectedErrors));
      }
      
      if (expectSecurityLog) {
        expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'suspicious_activity',
            severity: 'high'
          })
        );
      }
    });
  });

  describe('checkApiAccess', () => {
    const mockToken = 'test-token';
    const mockUserId = 'test-user';

    beforeEach(() => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });
    });

    test('should deny access for blacklisted token', async () => {
      (securityMonitoring.isTokenBlacklisted as jest.Mock).mockResolvedValue(true);

      const result = await apiSecurity.checkApiAccess('test', mockToken);
      
      expect(result).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'suspicious_activity',
          severity: 'high',
          details: expect.objectContaining({
            reason: 'blacklisted_token_used'
          })
        })
      );
    });

    test('should deny access when rate limit exceeded', async () => {
      (securityMonitoring.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (securityMonitoring.checkRateLimit as jest.Mock).mockResolvedValue(false);

      const result = await apiSecurity.checkApiAccess('test', mockToken);
      
      expect(result).toBe(false);
    });

    test('should deny access for invalid role', async () => {
      (securityMonitoring.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (securityMonitoring.checkRateLimit as jest.Mock).mockResolvedValue(true);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      const result = await apiSecurity.checkApiAccess('test', mockToken, 'admin');
      
      expect(result).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'permission_change',
          severity: 'high'
        })
      );
    });

    test('should allow access when all checks pass', async () => {
      (securityMonitoring.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (securityMonitoring.checkRateLimit as jest.Mock).mockResolvedValue(true);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null
            })
          })
        })
      });

      const result = await apiSecurity.checkApiAccess('test', mockToken, 'admin');
      
      expect(result).toBe(true);
      expect(securityMonitoring.monitorDataAccess).toHaveBeenCalled();
    });
  });

  describe('sanitizeInput', () => {
    const testCases = [
      {
        name: 'should sanitize HTML content',
        input: '<script>alert("xss")</script>',
        expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      },
      {
        name: 'should sanitize nested objects',
        input: {
          name: '<b>test</b>',
          details: {
            description: '<img src="x" onerror="alert(1)">'
          }
        },
        expected: {
          name: '&lt;b&gt;test&lt;/b&gt;',
          details: {
            description: '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;'
          }
        }
      },
      {
        name: 'should handle arrays',
        input: ['<script>bad()</script>', '<img src="x">'],
        expected: ['&lt;script&gt;bad()&lt;/script&gt;', '&lt;img src=&quot;x&quot;&gt;']
      },
      {
        name: 'should handle special characters and encodings',
        input: {
          text: '&#60;script&#62;alert(1)&#60;/script&#62;',
          unicode: '\u003Cscript\u003Ealert(2)\u003C/script\u003E'
        },
        expected: {
          text: '&amp;#60;script&amp;#62;alert(1)&amp;#60;/script&amp;#62;',
          unicode: '&lt;script&gt;alert(2)&lt;/script&gt;'
        }
      },
      {
        name: 'should handle null and undefined values',
        input: {
          nullValue: null,
          undefinedValue: undefined,
          text: 'normal text'
        },
        expected: {
          nullValue: null,
          undefinedValue: undefined,
          text: 'normal text'
        }
      }
    ];

    test.each(testCases)('$name', ({ input, expected }) => {
      const result = apiSecurity.sanitizeInput(input);
      expect(result).toEqual(expected);
    });
  });

  describe('role-based access control', () => {
    const mockToken = 'test-token';
    const mockUserId = 'test-user';

    beforeEach(() => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });
    });

    test('should handle nested role hierarchies', async () => {
      // Mock user with multiple roles
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'editor', parentRole: 'user' },
              error: null
            })
          })
        })
      });

      // Should allow access to parent role resources
      let result = await apiSecurity.checkApiAccess('test', mockToken, 'user');
      expect(result).toBe(true);

      // Should allow access to current role resources
      result = await apiSecurity.checkApiAccess('test', mockToken, 'editor');
      expect(result).toBe(true);

      // Should deny access to higher role resources
      result = await apiSecurity.checkApiAccess('test', mockToken, 'admin');
      expect(result).toBe(false);
    });

    test('should handle Supabase role lookup failures', async () => {
      // Mock Supabase error
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error')
            })
          })
        })
      });

      const result = await apiSecurity.checkApiAccess('test', mockToken, 'user');
      
      expect(result).toBe(false);
      expect(monitoring.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'role_lookup_failed',
          error: expect.any(Error)
        })
      );
    });

    test('should handle token expiration', async () => {
      // Mock expired token
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { 
            id: mockUserId,
            exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
          }
        },
        error: null
      });

      const result = await apiSecurity.checkApiAccess('test', mockToken);
      
      expect(result).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expired_token_used',
          severity: 'medium'
        })
      );
    });
  });
}); 