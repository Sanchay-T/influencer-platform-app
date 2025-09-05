import fs from 'fs/promises';
import path from 'path';

interface BillingLogEntry {
  timestamp: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  action: string;
  message: string;
  data?: any;
  metadata?: {
    userAgent?: string;
    ip?: string;
    source?: string;
    planBefore?: string;
    planAfter?: string;
    stripeEventId?: string;
    webhookSignature?: string;
  };
}

export class BillingLogger {
  private static logDirectory = process.cwd() + '/billing-check';
  
  /**
   * Generate a unique session ID for tracking related events
   */
  static generateSessionId(): string {
    return `billing_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate a unique request ID for API tracking
   */
  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get the current date string for log file naming
   */
  private static getDateString(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Get the log file path for the current date
   */
  private static getLogFilePath(): string {
    const dateString = this.getDateString();
    return path.join(this.logDirectory, `billing-${dateString}.log`);
  }

  /**
   * Core logging function
   */
  private static async writeLog(entry: BillingLogEntry): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.logDirectory, { recursive: true });
      
      // Format log entry
      const logLine = JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString(),
      }) + '\n';
      
      // Write to file
      const logPath = this.getLogFilePath();
      await fs.appendFile(logPath, logLine);
      
      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🏦 [BILLING-LOG] ${entry.eventType}:${entry.action}`, entry.message, entry.data || '');
      }
    } catch (error) {
      console.error('❌ [BILLING-LOGGER] Failed to write log:', error);
    }
  }

  // ========================================================================================
  // UI EVENT LOGGING - Track user interactions
  // ========================================================================================

  /**
   * Log UI interactions related to billing
   */
  static async logUIEvent(
    eventType: string,
    message: string,
    userId?: string,
    data?: any,
    sessionId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      userId,
      sessionId,
      eventType: 'UI',
      action: eventType,
      message,
      data
    });
  }

  /**
   * Log plan selection events
   */
  static async logPlanSelection(
    action: 'PLAN_HOVER' | 'PLAN_CLICK' | 'PLAN_SELECT',
    message: string,
    userId?: string,
    data?: {
      planId?: string;
      planName?: string;
      billingCycle?: 'monthly' | 'yearly';
      price?: string;
      fromPage?: string;
    },
    sessionId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      userId,
      sessionId,
      eventType: 'PLAN_SELECTION',
      action,
      message,
      data
    });
  }

  /**
   * Log onboarding events
   */
  static async logOnboarding(
    action: string,
    message: string,
    userId?: string,
    data?: any,
    sessionId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      userId,
      sessionId,
      eventType: 'ONBOARDING',
      action,
      message,
      data
    });
  }

  // ========================================================================================
  // API EVENT LOGGING - Track backend operations
  // ========================================================================================

  /**
   * Log API calls and responses
   */
  static async logAPI(
    action: 'REQUEST_START' | 'REQUEST_SUCCESS' | 'REQUEST_ERROR' | 'RESPONSE',
    message: string,
    userId?: string,
    data?: {
      endpoint?: string;
      method?: string;
      statusCode?: number;
      requestId?: string;
      requestBody?: any;
      responseData?: any;
      executionTime?: number;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      eventType: 'API',
      action,
      message,
      data
    });
  }

  // ========================================================================================
  // STRIPE EVENT LOGGING - Track payment processing
  // ========================================================================================

  /**
   * Log Stripe events and operations
   */
  static async logStripe(
    action: string,
    message: string,
    userId?: string,
    data?: {
      stripeEventId?: string;
      stripeEventType?: string;
      customerId?: string;
      subscriptionId?: string;
      planId?: string;
      amount?: number;
      currency?: string;
      status?: string;
      error?: string;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      eventType: 'STRIPE',
      action,
      message,
      data,
      metadata: {
        stripeEventId: data?.stripeEventId
      }
    });
  }

  /**
   * Log webhook events specifically
   */
  static async logWebhook(
    action: 'RECEIVED' | 'VALIDATED' | 'PROCESSED' | 'ERROR',
    message: string,
    data?: {
      webhookId?: string;
      eventType?: string;
      eventId?: string;
      signature?: string;
      validationResult?: boolean;
      processingResult?: any;
      error?: string;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      eventType: 'WEBHOOK',
      action,
      message,
      data,
      metadata: {
        stripeEventId: data?.eventId,
        webhookSignature: data?.signature?.substring(0, 20) + '...' // Only first 20 chars for security
      }
    });
  }

  // ========================================================================================
  // DATABASE EVENT LOGGING - Track data changes
  // ========================================================================================

  /**
   * Log database operations related to billing
   */
  static async logDatabase(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'QUERY',
    message: string,
    userId?: string,
    data?: {
      table?: string;
      operation?: string;
      recordId?: string;
      before?: any;
      after?: any;
      query?: string;
      affectedRows?: number;
      executionTime?: number;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      eventType: 'DATABASE',
      action,
      message,
      data: {
        ...data,
        // Sanitize sensitive data
        before: data?.before ? this.sanitizeDatabaseData(data.before) : undefined,
        after: data?.after ? this.sanitizeDatabaseData(data.after) : undefined,
      }
    });
  }

  /**
   * Sanitize sensitive database data for logging
   */
  private static sanitizeDatabaseData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'signature'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = sanitized[key].substring(0, 200) + '...';
      }
    });

    return sanitized;
  }

  // ========================================================================================
  // PLAN & USAGE LOGGING - Track plan changes and usage
  // ========================================================================================

  /**
   * Log plan changes and upgrades
   */
  static async logPlanChange(
    action: 'UPGRADE' | 'DOWNGRADE' | 'CANCEL' | 'RENEW',
    message: string,
    userId?: string,
    data?: {
      fromPlan?: string;
      toPlan?: string;
      reason?: string;
      billingCycle?: string;
      effective?: string;
      amount?: number;
      prorationAmount?: number;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      eventType: 'PLAN_CHANGE',
      action,
      message,
      data,
      metadata: {
        planBefore: data?.fromPlan,
        planAfter: data?.toPlan
      }
    });
  }

  /**
   * Log usage tracking events
   */
  static async logUsage(
    action: 'CAMPAIGN_CREATE' | 'CREATOR_SEARCH' | 'LIMIT_CHECK' | 'LIMIT_EXCEEDED',
    message: string,
    userId?: string,
    data?: {
      currentUsage?: number;
      limit?: number;
      usageType?: 'campaigns' | 'creators';
      searchType?: string;
      platform?: string;
      resultCount?: number;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      eventType: 'USAGE',
      action,
      message,
      data
    });
  }

  // ========================================================================================
  // ACCESS CONTROL LOGGING - Track permission checks
  // ========================================================================================

  /**
   * Log access control decisions
   */
  static async logAccess(
    action: 'GRANTED' | 'DENIED' | 'CHECK' | 'OVERRIDE',
    message: string,
    userId?: string,
    data?: {
      resource?: string;
      permission?: string;
      reason?: string;
      currentPlan?: string;
      trialStatus?: string;
      subscriptionStatus?: string;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      eventType: 'ACCESS',
      action,
      message,
      data
    });
  }

  // ========================================================================================
  // ERROR LOGGING - Track billing-related errors
  // ========================================================================================

  /**
   * Log billing-related errors
   */
  static async logError(
    action: string,
    message: string,
    userId?: string,
    data?: {
      errorType?: string;
      errorMessage?: string;
      stack?: string;
      context?: any;
      recoverable?: boolean;
    },
    requestId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      eventType: 'ERROR',
      action,
      message,
      data: {
        ...data,
        // Truncate stack traces for readability
        stack: data?.stack?.substring(0, 500) + (data?.stack && data.stack.length > 500 ? '...' : ''),
      }
    });
  }

  // ========================================================================================
  // SESSION TRACKING - Track billing sessions
  // ========================================================================================

  /**
   * Log billing session events
   */
  static async logSession(
    action: 'START' | 'END' | 'TIMEOUT' | 'CONTINUE',
    message: string,
    userId?: string,
    data?: {
      sessionType?: string;
      duration?: number;
      completionRate?: number;
      exitPoint?: string;
    },
    sessionId?: string
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      sessionId,
      userId,
      eventType: 'SESSION',
      action,
      message,
      data
    });
  }

  // ========================================================================================
  // UTILITY FUNCTIONS
  // ========================================================================================

  /**
   * Get recent billing logs for a user
   */
  static async getRecentLogs(
    userId?: string, 
    hours: number = 24,
    eventType?: string
  ): Promise<BillingLogEntry[]> {
    try {
      const logPath = this.getLogFilePath();
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const logs: BillingLogEntry[] = [];
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      for (const line of lines) {
        try {
          const entry: BillingLogEntry = JSON.parse(line);
          const entryTime = new Date(entry.timestamp);
          
          if (entryTime >= cutoffTime) {
            if (!userId || entry.userId === userId) {
              if (!eventType || entry.eventType === eventType) {
                logs.push(entry);
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }

      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('❌ [BILLING-LOGGER] Error reading logs:', error);
      return [];
    }
  }

  /**
   * Clear old log files (keep last 30 days)
   */
  static async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      for (const file of files) {
        if (file.startsWith('billing-') && file.endsWith('.log')) {
          const dateMatch = file.match(/billing-(\d{4}-\d{2}-\d{2})\.log/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            if (fileDate < cutoffDate) {
              await fs.unlink(path.join(this.logDirectory, file));
              console.log(`🗑️ [BILLING-LOGGER] Cleaned up old log file: ${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ [BILLING-LOGGER] Error cleaning up logs:', error);
    }
  }
}

export default BillingLogger;