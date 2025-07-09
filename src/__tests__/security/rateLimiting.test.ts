import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';

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

describe('Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('IP-based rate limiting', () => {
    const mockIp = '192.168.1.1';
    
    test('should allow requests within limit', async () => {
      // Mock storage to track request count
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Simulate 5 requests within window
      for (let i = 0; i < 5; i++) {
        const result = await securityMonitoring.checkIpRateLimit(mockIp);
        expect(result).toBe(true);
      }

      // Verify monitoring was called
      expect(monitoring.logMetric).toHaveBeenCalledWith(
        'rate_limit_check',
        expect.any(Object)
      );
    });

    test('should block requests exceeding limit', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Simulate exceeding request limit
      for (let i = 0; i < 10; i++) {
        const result = await securityMonitoring.checkIpRateLimit(mockIp);
        if (i >= 5) {
          expect(result).toBe(false);
          expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'rate_limit_exceeded',
              severity: 'medium',
              details: expect.objectContaining({
                ip: mockIp
              })
            })
          );
        }
      }
    });

    test('should reset limits after window expires', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        await securityMonitoring.checkIpRateLimit(mockIp);
      }

      // Fast forward past rate limit window
      jest.advanceTimersByTime(60000); // 1 minute

      // Should allow requests again
      const result = await securityMonitoring.checkIpRateLimit(mockIp);
      expect(result).toBe(true);
    });
  });

  describe('User-based rate limiting', () => {
    const mockUserId = 'test-user';

    test('should track limits per user', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Different users should have separate limits
      const user1 = 'user1';
      const user2 = 'user2';

      // Fill user1's limit
      for (let i = 0; i < 10; i++) {
        await securityMonitoring.checkUserRateLimit(user1);
      }

      // User2 should still be allowed
      const result = await securityMonitoring.checkUserRateLimit(user2);
      expect(result).toBe(true);
    });

    test('should handle burst traffic', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Simulate burst of requests
      const promises = Array(20).fill(null).map(() => 
        securityMonitoring.checkUserRateLimit(mockUserId)
      );

      const results = await Promise.all(promises);
      
      // Should have some allowed and some blocked
      expect(results.filter(r => r === true).length).toBeLessThan(20);
      expect(results.filter(r => r === false).length).toBeGreaterThan(0);
    });

    test('should log excessive attempts', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Generate many requests
      for (let i = 0; i < 20; i++) {
        await securityMonitoring.checkUserRateLimit(mockUserId);
      }

      // Verify excessive attempts were logged
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'excessive_requests',
          severity: 'high',
          details: expect.objectContaining({
            userId: mockUserId
          })
        })
      );
    });
  });

  describe('Combined rate limiting', () => {
    test('should block if either limit is exceeded', async () => {
      const mockIp = '192.168.1.1';
      const mockUserId = 'test-user';

      // Mock IP limit exceeded
      (securityMonitoring.checkIpRateLimit as jest.Mock).mockResolvedValue(false);
      (securityMonitoring.checkUserRateLimit as jest.Mock).mockResolvedValue(true);

      let result = await securityMonitoring.checkCombinedRateLimit(mockIp, mockUserId);
      expect(result).toBe(false);

      // Mock user limit exceeded
      (securityMonitoring.checkIpRateLimit as jest.Mock).mockResolvedValue(true);
      (securityMonitoring.checkUserRateLimit as jest.Mock).mockResolvedValue(false);

      result = await securityMonitoring.checkCombinedRateLimit(mockIp, mockUserId);
      expect(result).toBe(false);
    });

    test('should allow if both limits pass', async () => {
      const mockIp = '192.168.1.1';
      const mockUserId = 'test-user';

      (securityMonitoring.checkIpRateLimit as jest.Mock).mockResolvedValue(true);
      (securityMonitoring.checkUserRateLimit as jest.Mock).mockResolvedValue(true);

      const result = await securityMonitoring.checkCombinedRateLimit(mockIp, mockUserId);
      expect(result).toBe(true);
    });

    test('should persist rate limits across restarts', async () => {
      const mockIp = '192.168.1.1';
      const mockUserId = 'test-user';
      const mockStorage = new Map();

      // Simulate storing rate limit data
      await securityMonitoring.checkCombinedRateLimit(mockIp, mockUserId);
      const storedData = mockStorage.get(`${mockIp}:${mockUserId}`);
      
      // Simulate server restart by clearing in-memory data
      (securityMonitoring as any).storage = new Map();
      
      // Restore from persistent storage
      (securityMonitoring as any).storage.set(`${mockIp}:${mockUserId}`, storedData);

      // Rate limit should still be enforced
      const result = await securityMonitoring.checkCombinedRateLimit(mockIp, mockUserId);
      expect(result).toBe(true);
    });
  });

  describe('Dynamic rate limiting', () => {
    const mockIp = '192.168.1.1';
    
    beforeEach(() => {
      // Reset rate limit rules before each test
      (securityMonitoring as any).rateLimitRules = new Map();
    });

    test('should adjust limits based on traffic patterns', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Simulate normal traffic
      for (let i = 0; i < 3; i++) {
        await securityMonitoring.checkIpRateLimit(mockIp);
        jest.advanceTimersByTime(1000); // 1 second between requests
      }

      // Verify normal limits applied
      expect(monitoring.logMetric).toHaveBeenCalledWith(
        'rate_limit_check',
        expect.objectContaining({ ruleType: 'normal' })
      );

      // Simulate burst traffic
      for (let i = 0; i < 10; i++) {
        await securityMonitoring.checkIpRateLimit(mockIp);
      }

      // Verify stricter limits applied
      expect(monitoring.logMetric).toHaveBeenCalledWith(
        'rate_limit_check',
        expect.objectContaining({ ruleType: 'strict' })
      );
    });

    test('should support custom rate limit rules per endpoint', async () => {
      // Set custom rules for specific endpoints
      (securityMonitoring as any).setRateLimitRule('/api/auth', {
        windowMs: 60000,
        maxRequests: 3
      });

      (securityMonitoring as any).setRateLimitRule('/api/public', {
        windowMs: 60000,
        maxRequests: 10
      });

      // Test auth endpoint (stricter limits)
      for (let i = 0; i < 4; i++) {
        const result = await securityMonitoring.checkEndpointRateLimit(mockIp, '/api/auth');
        if (i >= 3) {
          expect(result).toBe(false);
        }
      }

      // Test public endpoint (more lenient limits)
      for (let i = 0; i < 8; i++) {
        const result = await securityMonitoring.checkEndpointRateLimit(mockIp, '/api/public');
        expect(result).toBe(true);
      }
    });
  });

  describe('Rate limit bypass detection', () => {
    test('should detect rotating IPs', async () => {
      const baseIp = '192.168.1.';
      const userId = 'test-user';

      // Simulate requests from different IPs
      for (let i = 1; i <= 5; i++) {
        await securityMonitoring.checkCombinedRateLimit(`${baseIp}${i}`, userId);
      }

      // Verify suspicious pattern detected
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'suspicious_ip_rotation',
          severity: 'high',
          details: expect.objectContaining({
            userId,
            ipCount: 5
          })
        })
      );
    });

    test('should detect distributed rate limit bypass attempts', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Simulate distributed requests
      const requests = [];
      for (let i = 1; i <= 10; i++) {
        requests.push(
          securityMonitoring.checkCombinedRateLimit(
            `192.168.${Math.floor(i/3)}.${i % 3}`, // Different subnets
            `user-${Math.floor(i/2)}` // Different users
          )
        );
      }

      await Promise.all(requests);

      // Verify pattern detection
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'distributed_bypass_attempt',
          severity: 'high'
        })
      );
    });

    test('should handle rate limit key tampering', async () => {
      const mockStorage = new Map();
      (securityMonitoring as any).storage = mockStorage;

      // Simulate tampered rate limit key
      const tamperedKey = Buffer.from('192.168.1.1:user-1').toString('base64');
      mockStorage.set(tamperedKey, {
        count: 0,
        resetTime: Date.now() + 60000
      });

      const result = await securityMonitoring.checkCombinedRateLimit('192.168.1.1', 'user-1');
      
      // Should detect tampering and apply default strict limits
      expect(result).toBe(false);
      expect(securityMonitoring.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit_key_tampering',
          severity: 'high'
        })
      );
    });
  });
}); 