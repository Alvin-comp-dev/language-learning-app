const securityMonitoring = {
  logSecurityEvent: jest.fn(),
  isTokenBlacklisted: jest.fn(),
  checkRateLimit: jest.fn(),
  checkIpRateLimit: jest.fn(),
  checkUserRateLimit: jest.fn(),
  checkCombinedRateLimit: jest.fn(),
  monitorDataAccess: jest.fn(),
  storage: new Map()
};

export default securityMonitoring; 