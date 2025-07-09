import { jest, beforeAll } from '@jest/globals';

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock Supabase configuration
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

// Mock monitoring configuration
jest.mock('../../config/monitoring', () => ({
  logMetric: jest.fn(),
  logError: jest.fn(),
  logEvent: jest.fn()
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

// Set up global mocks
global.AsyncStorage = mockAsyncStorage;

// Reset all mocks before each test
beforeAll(() => {
  jest.clearAllMocks();
}); 