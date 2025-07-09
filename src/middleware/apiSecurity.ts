import { supabase } from '../config/supabase';
import securityMonitoring from '../services/securityMonitoringService';
import monitoring from '../config/monitoring';
import { encode } from 'html-entities';

interface ValidationRule {
  type: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * ApiSecurity class provides security features for API endpoints including:
 * - Input validation and sanitization
 * - XSS prevention
 * - SQL injection detection
 * - Role-based access control
 * - Token validation and blacklist checking
 */
class ApiSecurity {
  private static instance: ApiSecurity;
  private readonly xssPatterns: RegExp[];
  private readonly sqlInjectionPatterns: RegExp[];
  private readonly TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Initialize security patterns
    this.xssPatterns = [
      /<script\b[^>]*>(.*?)<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:\s*text\/html/i
    ];

    this.sqlInjectionPatterns = [
      /(\b(union|select|insert|update|delete|drop|alter)\b.*\b(from|into|table)\b)/i,
      /'.*(\b(or|and)\b).*'/i,
      /--.*$/m,
      /;\s*$/
    ];
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ApiSecurity {
    if (!ApiSecurity.instance) {
      ApiSecurity.instance = new ApiSecurity();
    }
    return ApiSecurity.instance;
  }

  /**
   * Validate and sanitize request data
   * @param endpoint - API endpoint being accessed
   * @param method - HTTP method
   * @param data - Request data to validate
   * @param rules - Validation rules
   */
  public async validateRequest(
    endpoint: string,
    method: string,
    data: Record<string, any>,
    rules: Record<string, ValidationRule>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    let isValid = true;

    // Check for required fields and apply validation rules
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        isValid = false;
        continue;
      }

      if (value !== undefined && value !== null) {
        // Type validation
        if (rule.type && typeof value !== rule.type) {
          errors.push(`${field} must be of type ${rule.type}`);
          isValid = false;
        }

        // Length validation
        if (typeof value === 'string') {
          if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${field} must be at least ${rule.minLength} characters`);
            isValid = false;
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${field} must not exceed ${rule.maxLength} characters`);
            isValid = false;
          }
        }

        // Pattern validation
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
          errors.push(`${field} has an invalid format`);
          isValid = false;
        }

        // Security checks
        if (typeof value === 'string') {
          // Check for XSS attempts
          if (this.xssPatterns.some(pattern => pattern.test(value))) {
            await securityMonitoring.logSecurityEvent({
              type: 'suspicious_activity',
              severity: 'high',
              details: {
                endpoint,
                method,
                field,
                reason: 'xss_attempt'
              }
            });
          }

          // Check for SQL injection attempts
          if (this.sqlInjectionPatterns.some(pattern => pattern.test(value))) {
            await securityMonitoring.logSecurityEvent({
              type: 'suspicious_activity',
              severity: 'high',
              details: {
                endpoint,
                method,
                field,
                reason: 'sql_injection_attempt'
              }
            });
          }
        }
      }
    }

    return { isValid, errors };
  }

  /**
   * Check API access permissions
   * @param endpoint - API endpoint being accessed
   * @param token - Authentication token
   * @param requiredRole - Required role for access
   */
  public async checkApiAccess(
    endpoint: string,
    token: string,
    requiredRole?: string
  ): Promise<boolean> {
    try {
      // Check token blacklist
      const isBlacklisted = await securityMonitoring.isTokenBlacklisted(token);
      if (isBlacklisted) {
        await securityMonitoring.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'high',
          details: {
            endpoint,
            reason: 'blacklisted_token_used'
          }
        });
        return false;
      }

      // Verify token and get user
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return false;
      }

      // Check token expiration
      if (user.exp && user.exp < Math.floor(Date.now() / 1000)) {
        await securityMonitoring.logSecurityEvent({
          type: 'expired_token_used',
          severity: 'medium',
          details: { endpoint }
        });
        return false;
      }

      // Check rate limits
      const rateLimitPassed = await securityMonitoring.checkRateLimit(endpoint);
      if (!rateLimitPassed) {
        return false;
      }

      // If role check is required
      if (requiredRole) {
        try {
          const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role, parentRole')
            .eq('userId', user.id)
            .single();

          if (roleError || !roleData) {
            await monitoring.logError({
              type: 'role_lookup_failed',
              error: roleError || new Error('Role data not found')
            });
            return false;
          }

          // Check if user has required role or parent role
          const hasAccess = roleData.role === requiredRole || 
                          roleData.parentRole === requiredRole;

          if (!hasAccess) {
            await securityMonitoring.logSecurityEvent({
              type: 'permission_change',
              severity: 'high',
              details: {
                endpoint,
                requiredRole,
                userRole: roleData.role
              }
            });
            return false;
          }
        } catch (error) {
          await monitoring.logError({
            type: 'role_check_failed',
            error
          });
          return false;
        }
      }

      // Monitor data access
      await securityMonitoring.monitorDataAccess({
        userId: user.id,
        endpoint,
        action: 'access'
      });

      return true;
    } catch (error) {
      await monitoring.logError({
        type: 'access_check_failed',
        error
      });
      return false;
    }
  }

  /**
   * Sanitize input data to prevent XSS
   * @param input - Data to sanitize
   */
  public sanitizeInput(input: any): any {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      return encode(input, {
        mode: 'extensive',
        level: 'all'
      });
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  private async refreshTokenIfNeeded(currentToken: string): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        throw error || new Error('No session found');
      }

      const expiresAt = session.expires_at ? new Date(session.expires_at) : null;
      if (expiresAt && expiresAt.getTime() - Date.now() < this.TOKEN_REFRESH_THRESHOLD) {
        const { data: { session: newSession }, error: refreshError } = 
          await supabase.auth.refreshSession();

        if (refreshError || !newSession) {
          throw refreshError || new Error('Failed to refresh session');
        }

        // Check for suspicious refresh patterns
        await this.checkSuspiciousRefresh(session.user.id);

        // Log token refresh
        await monitoring.trackEvent('token_refreshed', {
          userId: newSession.user.id,
        });

        return true;
      }

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      monitoring.trackError(error as Error, { context: 'refreshTokenIfNeeded' });
      return false;
    }
  }

  private async checkSuspiciousRefresh(userId: string): Promise<void> {
    try {
      const { data: refreshes } = await supabase
        .from('token_refreshes')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('created_at', { ascending: false });

      if (refreshes && refreshes.length > 10) { // More than 10 refreshes in an hour
        await securityMonitoring.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'high',
          details: { reason: 'excessive_token_refreshes', count: refreshes.length },
          timestamp: new Date().toISOString(),
          userId,
        });

        // Blacklist the current token
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await securityMonitoring.blacklistToken(
            session.access_token,
            'excessive_token_refreshes'
          );
        }
      }
    } catch (error) {
      console.error('Failed to check suspicious refresh:', error);
      monitoring.trackError(error as Error, { context: 'checkSuspiciousRefresh' });
    }
  }
}

export default ApiSecurity.getInstance(); 