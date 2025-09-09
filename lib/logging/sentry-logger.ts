/**
 * Sentry Integration Logger
 * 
 * Provides seamless integration with the existing Sentry setup while adding
 * structured logging capabilities, breadcrumb management, and performance tracking.
 * Works with the core logger to send appropriate logs to Sentry for monitoring.
 */

import * as Sentry from '@sentry/nextjs';
import { 
  LogLevel, 
  LogCategory, 
  LogEntry, 
  LogContext,
  SentryLogContext 
} from './types';
import { 
  shouldSendToSentry, 
  SENTRY_CONFIG,
  getSentryDSN 
} from './constants';

/**
 * Sentry Logger Class
 * 
 * Handles all Sentry-specific logging operations including error capture,
 * breadcrumb management, user context setting, and performance monitoring.
 */
export class SentryLogger {
  private static isInitialized = false;
  private static breadcrumbBuffer: Array<{ category: string; message: string; level: string; timestamp: Date }> = [];
  private static maxBreadcrumbs = SENTRY_CONFIG.BREADCRUMB_CONFIG.maxBreadcrumbs;

  /**
   * Initialize Sentry logger (called automatically)
   */
  private static initialize(): void {
    if (this.isInitialized) return;

    try {
      // Sentry is already initialized in instrumentation files
      // This just ensures we have the configuration we need
      const dsn = getSentryDSN();
      
      if (dsn && typeof window === 'undefined') {
        // Server-side additional configuration
        Sentry.setTag('component', 'logging-system');
        Sentry.setTag('environment', process.env.NODE_ENV || 'development');
        
        // Set up global error handlers
        process.on('unhandledRejection', (reason, promise) => {
          this.captureException(reason, {
            tags: { 
              errorType: 'unhandledRejection',
              source: 'process' 
            },
            extra: { promise }
          });
        });

        process.on('uncaughtException', (error) => {
          this.captureException(error, {
            tags: { 
              errorType: 'uncaughtException',
              source: 'process' 
            }
          });
        });
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to initialize:', error);
    }
  }

  /**
   * Convert LogLevel to Sentry severity level
   */
  private static mapLogLevelToSentryLevel(level: LogLevel): Sentry.SeverityLevel {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warning';
      case LogLevel.ERROR:
        return 'error';
      case LogLevel.CRITICAL:
        return 'fatal';
      default:
        return 'info';
    }
  }

  /**
   * Convert LogCategory to Sentry breadcrumb category
   */
  private static mapCategoryToBreadcrumbType(category: LogCategory): string {
    const mapping = SENTRY_CONFIG.BREADCRUMB_CONFIG.categories;
    return mapping[category] || 'default';
  }

  /**
   * Set user context in Sentry from log context
   */
  public static setUserContext(context: LogContext): void {
    try {
      if (context.userId || context.userEmail) {
        Sentry.setUser({
          id: context.userId,
          email: context.userEmail,
          ip_address: context.ip,
        });
      }
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to set user context:', error);
    }
  }

  /**
   * Set transaction context for performance monitoring
   */
  public static setTransactionContext(
    name: string, 
    operation: string, 
    context?: LogContext
  ): Sentry.Transaction | undefined {
    try {
      // startTransaction is deprecated - using alternative approach
      const transaction = null; // Deprecated API - would need Sentry.startSpan in newer versions

      if (context && transaction) {
        transaction.setTag('requestId', context.requestId || 'unknown');
        transaction.setTag('sessionId', context.sessionId || 'unknown');
        
        if (context.campaignId) {
          transaction.setTag('campaignId', context.campaignId);
        }
        
        if (context.platform) {
          transaction.setTag('platform', context.platform);
        }
      }

      return transaction;
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to set transaction context:', error);
      return undefined;
    }
  }

  /**
   * Add breadcrumb to Sentry
   */
  public static addBreadcrumb(
    message: string,
    category: LogCategory,
    level: LogLevel,
    data?: Record<string, any>
  ): void {
    try {
      const breadcrumb: Sentry.Breadcrumb = {
        message,
        category: this.mapCategoryToBreadcrumbType(category),
        level: this.mapLogLevelToSentryLevel(level),
        timestamp: Date.now() / 1000,
        data: data ? { ...data } : undefined
      };

      Sentry.addBreadcrumb(breadcrumb);

      // Also maintain internal breadcrumb buffer for debugging
      this.breadcrumbBuffer.push({
        category: category.toString(),
        message,
        level: LogLevel[level],
        timestamp: new Date()
      });

      // Trim buffer if it gets too large
      if (this.breadcrumbBuffer.length > this.maxBreadcrumbs) {
        this.breadcrumbBuffer = this.breadcrumbBuffer.slice(-this.maxBreadcrumbs);
      }

    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to add breadcrumb:', error);
    }
  }

  /**
   * Capture exception with rich context
   */
  public static captureException(
    error: unknown,
    sentryContext?: {
      tags?: Record<string, string>;
      extra?: Record<string, any>;
      user?: Sentry.User;
      level?: Sentry.SeverityLevel;
      fingerprint?: string[];
    }
  ): string {
    try {
      this.initialize();

      return Sentry.captureException(error, {
        tags: {
          source: 'logging-system',
          timestamp: new Date().toISOString(),
          ...sentryContext?.tags
        },
        extra: {
          breadcrumbs: this.breadcrumbBuffer.slice(-10), // Last 10 breadcrumbs
          ...sentryContext?.extra
        },
        user: sentryContext?.user,
        level: sentryContext?.level || 'error',
        fingerprint: sentryContext?.fingerprint
      });
    } catch (err) {
      console.error('🚨 [SENTRY-LOGGER] Failed to capture exception:', err);
      return '';
    }
  }

  /**
   * Capture message with context
   */
  public static captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, any>;
      user?: Sentry.User;
    }
  ): string {
    try {
      this.initialize();

      return Sentry.captureMessage(message, {
        level,
        tags: {
          source: 'logging-system',
          timestamp: new Date().toISOString(),
          ...context?.tags
        },
        extra: {
          breadcrumbs: this.breadcrumbBuffer.slice(-10),
          ...context?.extra
        },
        user: context?.user
      });
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to capture message:', error);
      return '';
    }
  }

  /**
   * Main entry point for sending logs to Sentry
   * Called by the main logger when appropriate
   */
  public static logToSentry(logEntry: LogEntry): void {
    try {
      this.initialize();

      // Check if this log should be sent to Sentry
      if (!shouldSendToSentry(logEntry.level, logEntry.category)) {
        return;
      }

      // Set user context if available
      if (logEntry.context) {
        this.setUserContext(logEntry.context);
      }

      // Always add as breadcrumb for context
      this.addBreadcrumb(
        logEntry.message,
        logEntry.category,
        logEntry.level,
        logEntry.context?.metadata
      );

      // Set additional context
      Sentry.setContext('log_entry', {
        timestamp: logEntry.timestamp,
        category: logEntry.category,
        level: LogLevel[logEntry.level],
        requestId: logEntry.context?.requestId,
        sessionId: logEntry.context?.sessionId,
        campaignId: logEntry.context?.campaignId,
        platform: logEntry.context?.platform
      });

      // Set tags for better filtering and grouping
      const tags: Record<string, string> = {
        log_category: logEntry.category,
        log_level: LogLevel[logEntry.level],
        environment: logEntry.context?.environment || process.env.NODE_ENV || 'unknown'
      };

      if (logEntry.context?.userId) {
        tags.user_id = logEntry.context.userId;
      }

      if (logEntry.context?.platform) {
        tags.platform = logEntry.context.platform;
      }

      if (logEntry.context?.requestId) {
        tags.request_id = logEntry.context.requestId;
      }

      // Handle errors specially
      if (logEntry.error) {
        const errorObj = new Error(logEntry.error.message || logEntry.message);
        errorObj.name = logEntry.error.name || 'LoggedError';
        errorObj.stack = logEntry.error.stack;

        // Custom fingerprinting for better error grouping
        const fingerprint = [
          logEntry.category,
          logEntry.error.name || 'unknown',
          logEntry.error.message || logEntry.message
        ];

        this.captureException(errorObj, {
          tags,
          extra: {
            originalMessage: logEntry.message,
            context: logEntry.context,
            performance: logEntry.performance,
            errorCode: logEntry.error.code,
            errorCause: logEntry.error.cause
          },
          level: this.mapLogLevelToSentryLevel(logEntry.level),
          fingerprint
        });
      } 
      // Handle warnings and critical messages
      else if (logEntry.level >= LogLevel.WARN) {
        this.captureMessage(logEntry.message, this.mapLogLevelToSentryLevel(logEntry.level), {
          tags,
          extra: {
            context: logEntry.context,
            performance: logEntry.performance,
            category: logEntry.category
          }
        });
      }

      // Track performance metrics
      if (logEntry.performance?.duration) {
        const threshold = SENTRY_CONFIG.PERFORMANCE_CONFIG.slowTransactionThreshold;
        if (logEntry.performance.duration > threshold) {
          Sentry.addBreadcrumb({
            message: `Slow operation detected: ${logEntry.performance.duration}ms`,
            category: 'performance',
            level: 'warning',
            data: {
              duration: logEntry.performance.duration,
              threshold,
              operation: logEntry.message
            }
          });
        }
      }

    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to log to Sentry:', error);
    }
  }

  /**
   * Start performance tracking for an operation
   */
  public static startTransaction(name: string, operation: string, context?: LogContext): Sentry.Transaction | undefined {
    return this.setTransactionContext(name, operation, context);
  }

  /**
   * Finish performance tracking
   */
  public static finishTransaction(
    transaction: Sentry.Transaction | undefined, 
    status?: Sentry.SpanStatus
  ): void {
    try {
      if (transaction) {
        if (status) {
          transaction.setStatus(status);
        }
        transaction.finish();
      }
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to finish transaction:', error);
    }
  }

  /**
   * Set custom context for debugging
   */
  public static setContext(key: string, context: Record<string, any>): void {
    try {
      Sentry.setContext(key, context);
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to set context:', error);
    }
  }

  /**
   * Set custom tags
   */
  public static setTags(tags: Record<string, string>): void {
    try {
      Sentry.setTags(tags);
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to set tags:', error);
    }
  }

  /**
   * Flush all pending events to Sentry
   */
  public static async flush(timeout: number = 5000): Promise<boolean> {
    try {
      return await Sentry.flush(timeout);
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to flush:', error);
      return false;
    }
  }

  /**
   * Get recent breadcrumbs for debugging
   */
  public static getRecentBreadcrumbs(count: number = 10): Array<any> {
    return this.breadcrumbBuffer.slice(-count);
  }

  /**
   * Clear breadcrumb buffer
   */
  public static clearBreadcrumbs(): void {
    this.breadcrumbBuffer = [];
  }

  /**
   * Create a scoped logger for specific operations
   */
  public static withScope<T>(callback: (scope: Sentry.Scope) => T): T {
    return Sentry.withScope(callback);
  }

  /**
   * Capture user feedback for errors
   */
  public static captureUserFeedback(feedback: {
    event_id: string;
    name: string;
    email: string;
    comments: string;
  }): void {
    try {
      // captureUserFeedback is deprecated in newer Sentry versions
      // Using alternative approach with user context
      Sentry.withScope((scope) => {
        scope.setTag('feedback_type', 'user_feedback');
        scope.setContext('user_feedback', feedback);
        Sentry.captureMessage(`User feedback: ${feedback.comments}`, 'info');
      });
    } catch (error) {
      console.error('🚨 [SENTRY-LOGGER] Failed to capture user feedback:', error);
    }
  }
}

/**
 * Convenience functions for common Sentry operations
 */
export const sentry = {
  // Error capturing
  captureException: SentryLogger.captureException,
  captureMessage: SentryLogger.captureMessage,
  
  // Context management
  setUser: (user: Sentry.User) => Sentry.setUser(user),
  setContext: SentryLogger.setContext,
  setTags: SentryLogger.setTags,
  
  // Performance tracking
  startTransaction: SentryLogger.startTransaction,
  finishTransaction: SentryLogger.finishTransaction,
  
  // Breadcrumbs
  addBreadcrumb: SentryLogger.addBreadcrumb,
  getRecentBreadcrumbs: SentryLogger.getRecentBreadcrumbs,
  
  // Utility
  flush: SentryLogger.flush,
  withScope: SentryLogger.withScope
};

export default SentryLogger;