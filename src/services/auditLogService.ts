import { supabase } from '../config/supabase';
import monitoring from '../config/monitoring';
import { encode } from 'html-entities';
import { createHash } from 'crypto';

interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  changes?: any;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failure';
  error?: string;
  timestamp: string;
  request_details?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response_details?: {
    status: number;
    headers: Record<string, string>;
    body?: any;
  };
  correlation_id?: string;
  session_id?: string;
}

interface RequestLogOptions {
  excludeHeaders?: string[];
  excludeBody?: boolean;
  maskFields?: string[];
}

interface AuditLogParams {
  userId: string;
  action: string;
  ipAddress: string;
  metadata?: Record<string, any>;
  data?: Record<string, any>;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  ipAddress: string;
  metadata?: Record<string, any>;
  data?: Record<string, any>;
  timestamp: string;
  hash?: string;
}

interface ExportData {
  logs: AuditLog[];
  metadata: {
    exportDate: string;
    dateRange: {
      start: string;
      end: string;
    };
    totalLogs: number;
  };
}

class AuditLogService {
  private static instance: AuditLogService;
  private readonly SENSITIVE_FIELDS = [
    'password',
    'token',
    'secret',
    'apiKey',
    'credit_card',
    'ssn',
    'email',
    'phone',
  ];

  private readonly HIGH_IMPACT_ACTIONS = [
    'user_create',
    'user_delete',
    'role_change',
    'permission_change',
    'payment_process',
    'data_export',
    'security_setting_change',
  ];

  private readonly SENSITIVE_PATTERNS = {
    email: /^[^@]+/,
    password: /.+/,
    creditCard: /^.+(?=.{4})/,
    phoneNumber: /^.+(?=.{4})/,
    ssn: /^.+(?=.{4})/,
    apiKey: /.+/,
    token: /.+/
  };

  private constructor() {}

  static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  async logRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any,
    userId: string,
    options: RequestLogOptions = {}
  ): Promise<string> {
    try {
      const correlationId = this.generateCorrelationId();
      const sanitizedHeaders = this.sanitizeHeaders(headers, options.excludeHeaders);
      const sanitizedBody = options.excludeBody ? undefined : this.sanitizeBody(body);

      const logEntry: AuditLogEntry = {
        action: 'api_request',
        entity_type: 'request',
        entity_id: url,
        user_id: userId,
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        request_details: {
          method,
          url,
          headers: sanitizedHeaders,
          body: sanitizedBody,
        },
        status: 'success',
      };

      await this.saveAuditLog(logEntry);
      return correlationId;
    } catch (error) {
      console.error('Failed to log request:', error);
      monitoring.trackError(error as Error, { context: 'logRequest' });
      return this.generateCorrelationId(); // Return new ID even if logging fails
    }
  }

  async logResponse(
    correlationId: string,
    status: number,
    headers: Record<string, string>,
    body: any,
    options: RequestLogOptions = {}
  ): Promise<void> {
    try {
      const sanitizedHeaders = this.sanitizeHeaders(headers, options.excludeHeaders);
      const sanitizedBody = options.excludeBody ? undefined : this.sanitizeBody(body);

      const logEntry: AuditLogEntry = {
        action: 'api_response',
        entity_type: 'response',
        entity_id: correlationId,
        user_id: 'system',
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        response_details: {
          status,
          headers: sanitizedHeaders,
          body: sanitizedBody,
        },
        status: status < 400 ? 'success' : 'failure',
      };

      await this.saveAuditLog(logEntry);
    } catch (error) {
      console.error('Failed to log response:', error);
      monitoring.trackError(error as Error, { context: 'logResponse' });
    }
  }

  private sanitizeHeaders(
    headers: Record<string, string>,
    excludeHeaders: string[] = []
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      ...excludeHeaders,
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (!sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (this.SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(body);
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async logSecurityEvent(
    userId: string,
    eventType: string,
    details: any,
    correlationId?: string
  ): Promise<void> {
    try {
      const sanitizedDetails = this.sanitizeBody(details);

      const logEntry: AuditLogEntry = {
        action: 'security_event',
        entity_type: 'security',
        entity_id: eventType,
        user_id: userId,
        metadata: sanitizedDetails,
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        status: 'success',
      };

      await this.saveAuditLog(logEntry);

      // Log to monitoring service for critical events
      if (this.isCriticalSecurityEvent(eventType)) {
        monitoring.trackEvent('critical_security_event', {
          eventType,
          userId,
          correlationId,
        });
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      monitoring.trackError(error as Error, { context: 'logSecurityEvent' });
    }
  }

  private isCriticalSecurityEvent(eventType: string): boolean {
    const criticalEvents = [
      'authentication_failure',
      'authorization_failure',
      'suspicious_activity',
      'data_breach',
      'configuration_change',
    ];
    return criticalEvents.includes(eventType);
  }

  async logDataAccess(
    userId: string,
    entityType: string,
    entityId: string,
    accessType: 'read' | 'write' | 'delete',
    details: any,
    correlationId?: string
  ): Promise<void> {
    try {
      const sanitizedDetails = this.sanitizeBody(details);

      const logEntry: AuditLogEntry = {
        action: `data_${accessType}`,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
        metadata: sanitizedDetails,
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        status: 'success',
      };

      await this.saveAuditLog(logEntry);

      // Track sensitive data access
      if (this.isSensitiveEntity(entityType)) {
        monitoring.trackEvent('sensitive_data_access', {
          accessType,
          entityType,
          userId,
          correlationId,
        });
      }
    } catch (error) {
      console.error('Failed to log data access:', error);
      monitoring.trackError(error as Error, { context: 'logDataAccess' });
    }
  }

  private isSensitiveEntity(entityType: string): boolean {
    const sensitiveEntities = [
      'user_profile',
      'payment_info',
      'medical_data',
      'personal_info',
    ];
    return sensitiveEntities.includes(entityType);
  }

  private async saveAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      // Ensure all sensitive data is properly sanitized
      const sanitizedEntry = this.sanitizeBody(entry);

      // Add request context if available
      const requestContext = await this.getRequestContext();
      if (requestContext) {
        sanitizedEntry.ip_address = requestContext.ip;
        sanitizedEntry.user_agent = requestContext.userAgent;
        sanitizedEntry.session_id = requestContext.sessionId;
      }

      // Save to database
      const { error } = await supabase
        .from('audit_logs')
        .insert(sanitizedEntry);

      if (error) throw error;

      // Log high-impact actions to monitoring service
      if (this.isHighImpactAction(entry.action)) {
        monitoring.trackEvent('high_impact_action', {
          action: entry.action,
          userId: entry.user_id,
          correlationId: entry.correlation_id,
        });
      }
    } catch (error) {
      console.error('Failed to save audit log:', error);
      monitoring.trackError(error as Error, { context: 'saveAuditLog' });
      throw error;
    }
  }

  private isHighImpactAction(action: string): boolean {
    return this.HIGH_IMPACT_ACTIONS.includes(action);
  }

  private async getRequestContext(): Promise<any> {
    // Implement request context gathering based on your framework
    return null;
  }

  async getAuditTrail(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditLogEntry[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get audit trail:', error);
      monitoring.trackError(error as Error, { context: 'getAuditTrail' });
      return [];
    }
  }

  /**
   * Create a new audit log entry
   */
  public async logAction(params: AuditLogParams): Promise<AuditLog> {
    try {
      // Redact sensitive data if present
      const redactedData = params.data ? this.redactData(params.data) : undefined;

      // Create log entry
      const timestamp = new Date().toISOString();
      const logEntry = {
        userId: params.userId,
        action: params.action,
        ipAddress: params.ipAddress,
        metadata: params.metadata,
        data: redactedData,
        timestamp,
        hash: this.generateLogHash({
          userId: params.userId,
          action: params.action,
          timestamp
        })
      };

      const { data, error } = await supabase
        .from('audit_logs')
        .insert(logEntry)
        .select()
        .single();

      if (error) {
        throw error;
      }

      await securityMonitoring.logSecurityEvent({
        type: 'audit_log_created',
        severity: 'low',
        details: {
          userId: params.userId,
          action: params.action
        }
      });

      return data as AuditLog;
    } catch (error) {
      await monitoring.logError({
        type: 'audit_log_creation_failed',
        error
      });
      throw new Error('Failed to create audit log');
    }
  }

  /**
   * Retrieve audit logs for a user with redacted sensitive data
   */
  public async getUserLogs(userId: string, limit: number): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('userId', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Re-apply redaction on retrieval to ensure consistency
      return (data as AuditLog[]).map(log => ({
        ...log,
        data: log.data ? this.redactData(log.data) : undefined
      }));
    } catch (error) {
      await monitoring.logError({
        type: 'audit_log_retrieval_failed',
        error
      });
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Enforce log retention policy by removing old logs
   */
  public async enforceRetentionPolicy(retentionDays: number): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await supabase
        .from('audit_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      await monitoring.logMetric('retention_policy_enforced', {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await monitoring.logError({
        type: 'retention_policy_failed',
        error
      });
      throw new Error('Failed to enforce retention policy');
    }
  }

  /**
   * Export audit logs in a compliance-friendly format
   */
  public async exportLogs(startDate: Date, endDate: Date): Promise<ExportData> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        throw error;
      }

      // Redact sensitive data in exported logs
      const redactedLogs = (data as AuditLog[]).map(log => ({
        ...log,
        data: log.data ? this.redactData(log.data) : undefined
      }));

      return {
        logs: redactedLogs,
        metadata: {
          exportDate: new Date().toISOString(),
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          },
          totalLogs: redactedLogs.length
        }
      };
    } catch (error) {
      await monitoring.logError({
        type: 'log_export_failed',
        error
      });
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Verify the integrity of a log entry using its hash
   */
  public async verifyLogIntegrity(logId: string): Promise<boolean> {
    try {
      const { data: log, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', logId)
        .single();

      if (error || !log) {
        return false;
      }

      const expectedHash = this.generateLogHash({
        userId: log.userId,
        action: log.action,
        timestamp: log.timestamp
      });

      return log.hash === expectedHash;
    } catch (error) {
      await monitoring.logError({
        type: 'integrity_check_failed',
        error
      });
      return false;
    }
  }

  /**
   * Redact sensitive data in objects
   */
  private redactData(data: Record<string, any>): Record<string, any> {
    const redacted = { ...data };

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        // Recursively redact nested objects
        redacted[key] = this.redactData(value);
      } else if (typeof value === 'string') {
        // Check if field name matches sensitive patterns
        const sensitiveField = this.SENSITIVE_FIELDS.find(field => 
          key.toLowerCase().includes(field.toLowerCase())
        );

        if (sensitiveField) {
          redacted[key] = this.redactValue(value, sensitiveField);
        } else {
          // Check if value matches sensitive patterns
          for (const [pattern, regex] of Object.entries(this.SENSITIVE_PATTERNS)) {
            if (this.isPatternMatch(value, pattern)) {
              redacted[key] = this.redactValue(value, pattern);
              break;
            }
          }
        }
      }
    }

    return redacted;
  }

  /**
   * Check if a value matches a sensitive data pattern
   */
  private isPatternMatch(value: string, pattern: string): boolean {
    switch (pattern) {
      case 'email':
        return /^[^@]+@[^@]+\.[^@]+$/.test(value);
      case 'creditCard':
        return /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/.test(value);
      case 'phoneNumber':
        return /^\+?\d{10,}$/.test(value);
      case 'ssn':
        return /^\d{3}-?\d{2}-?\d{4}$/.test(value);
      default:
        return false;
    }
  }

  /**
   * Redact a sensitive value based on its type
   */
  private redactValue(value: string, type: string): string {
    switch (type) {
      case 'email': {
        const [local, domain] = value.split('@');
        return '*'.repeat(local.length) + '@' + domain;
      }
      case 'creditCard':
        return '*'.repeat(value.length - 4) + value.slice(-4);
      case 'phoneNumber':
        return '*'.repeat(value.length - 4) + value.slice(-4);
      case 'password':
      case 'apiKey':
      case 'token':
      case 'secret':
        return '*'.repeat(value.length);
      default:
        return '*'.repeat(Math.max(value.length - 4, 0)) + value.slice(-4);
    }
  }

  /**
   * Generate a hash for log integrity verification
   */
  private generateLogHash(data: { userId: string; action: string; timestamp: string }): string {
    const hash = createHash('sha256');
    hash.update(`${data.userId}:${data.action}:${data.timestamp}`);
    return hash.digest('hex');
  }
}

export default AuditLogService.getInstance(); 