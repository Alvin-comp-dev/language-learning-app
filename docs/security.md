# Security Features Documentation

## Overview

This document outlines the security features implemented in the language learning application. The security system is designed to protect against common web vulnerabilities and provide robust access control.

## Core Components

### 1. API Security (ApiSecurity)

The `ApiSecurity` class provides comprehensive security features for API endpoints:

#### Input Validation and Sanitization
- Type checking and validation
- Length restrictions
- Pattern matching
- Custom validation rules
- HTML entity encoding
- XSS prevention
- SQL injection detection

```typescript
// Example usage
const validation = await apiSecurity.validateRequest(
  '/api/users',
  'POST',
  {
    username: '<script>alert("xss")</script>',
    email: 'user@example.com'
  },
  {
    username: { type: 'string', required: true, minLength: 3 },
    email: { type: 'string', required: true, pattern: /^[^@]+@[^@]+\.[^@]+$/ }
  }
);
```

#### Access Control
- Token validation and blacklist checking
- Role-based access control (RBAC)
- Nested role hierarchies
- Token expiration handling

```typescript
// Example role check
const canAccess = await apiSecurity.checkApiAccess(
  '/api/admin/users',
  userToken,
  'admin'
);
```

### 2. Security Monitoring (SecurityMonitoringService)

The `SecurityMonitoringService` handles security event logging and rate limiting:

#### Rate Limiting
- IP-based rate limiting
- User-based rate limiting
- Combined limits
- Custom rules per endpoint
- Distributed attack detection

```typescript
// Configure custom rate limits
securityMonitoring.setRateLimitRule('/api/auth', {
  windowMs: 60000,    // 1 minute
  maxRequests: 5      // 5 login attempts per minute
});
```

#### Security Event Logging
- Suspicious activity detection
- Access pattern monitoring
- Error logging
- Audit trail

```typescript
// Log security event
await securityMonitoring.logSecurityEvent({
  type: 'suspicious_activity',
  severity: 'high',
  details: {
    endpoint: '/api/auth',
    reason: 'multiple_failed_attempts'
  }
});
```

## Security Features

### 1. XSS Prevention
- HTML entity encoding
- Script tag detection
- Event handler sanitization
- URL scheme validation

### 2. SQL Injection Prevention
- Pattern detection
- Input sanitization
- Parameterized queries
- Escape character handling

### 3. Rate Limiting
- Sliding window algorithm
- IP-based limits
- User-based limits
- Burst traffic handling
- Custom rules per endpoint

### 4. Access Control
- Token-based authentication
- Role-based authorization
- Permission hierarchies
- Token expiration
- Blacklist management

### 5. Security Monitoring
- Real-time event logging
- Pattern detection
- Anomaly detection
- Audit logging
- Error tracking

## Best Practices

1. **Input Validation**
   - Always validate and sanitize user input
   - Use strict type checking
   - Apply appropriate length limits
   - Validate against expected patterns

2. **Access Control**
   - Use principle of least privilege
   - Implement role-based access control
   - Validate tokens on every request
   - Handle token expiration properly

3. **Rate Limiting**
   - Set appropriate limits per endpoint
   - Monitor for abuse patterns
   - Implement graduated response
   - Log excessive attempts

4. **Error Handling**
   - Log security-related errors
   - Don't expose sensitive information
   - Fail securely
   - Maintain audit trail

5. **Security Monitoring**
   - Monitor access patterns
   - Track security events
   - Detect anomalies
   - Maintain logs for auditing

## Testing

The security features are thoroughly tested using Jest:

1. **API Security Tests** (`apiSecurity.test.ts`)
   - Input validation
   - XSS prevention
   - SQL injection detection
   - Role-based access control
   - Token validation
   - Error handling

2. **Rate Limiting Tests** (`rateLimiting.test.ts`)
   - IP-based limits
   - User-based limits
   - Combined limits
   - Burst traffic handling
   - Bypass attempt detection

## Configuration

Security settings can be configured through environment variables:

```env
# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Token Settings
TOKEN_EXPIRATION_TIME=3600
REFRESH_TOKEN_WINDOW=300

# Security Monitoring
SECURITY_LOG_LEVEL=info
AUDIT_LOG_RETENTION_DAYS=30
```

## Error Codes

| Code | Description | Severity |
|------|-------------|----------|
| SEC001 | Invalid input detected | Medium |
| SEC002 | XSS attempt blocked | High |
| SEC003 | SQL injection attempt | High |
| SEC004 | Rate limit exceeded | Medium |
| SEC005 | Invalid token | Medium |
| SEC006 | Insufficient permissions | Medium |
| SEC007 | Suspicious activity | High |

## Logging

Security events are logged in the following format:

```json
{
  "type": "security_event",
  "severity": "high",
  "details": {
    "endpoint": "/api/users",
    "method": "POST",
    "userId": "user123",
    "reason": "xss_attempt"
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
``` 