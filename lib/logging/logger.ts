/**
 * Core Logger Implementation
 * 
 * Centralized logging system with automatic context enrichment, performance tracking,
 * and integration with Sentry. Follows singleton pattern for consistent usage across
 * the application while providing zero-overhead performance for filtered logs.
 */

// Auth functionality disabled to avoid client/server import issues
// TODO: Re-enable with proper server-only wrapper
// let auth: any = null;
import { 
  LogLevel, 
  LogCategory, 
  LogEntry, 
  LogContext, 
  LoggerConfig, 
  PerformanceTimer,
  DataSanitizer
} from './types';
import {
  getLoggerConfig,
  getMinLogLevel,
  SENSITIVE_FIELDS,
  CONSOLE_CONFIG,
  PERFORMANCE_CONFIG,
  generateRequestId,
  getCategoryIcon,
  isSensitiveField,
  CONTEXT_ENRICHMENT
} from './constants';

/**
 * Core Logger Class
 * 
 * Provides structured logging with automatic context enrichment, performance tracking,
 * and environment-aware filtering. Integrates seamlessly with existing Sentry setup.
 */
class Logger {
  private static instance: Logger;
  private config: Partial<LoggerConfig>;
  private minLevel: LogLevel;
  private requestIdMap: Map<string, string> = new Map();
  private performanceTimers: Map<string, PerformanceTimer> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.config = getLoggerConfig();
    this.minLevel = getMinLogLevel();
    this.initializeLogger();
  }

  /**
   * Get the singleton logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Initialize logger configuration and setup
   */
  private initializeLogger(): void {
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceMonitoring();
    }

    // Log system initialization
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug('Logger initialized', {
        environment: this.config.environment,
        minLevel: LogLevel[this.minLevel],
        enableConsole: this.config.enableConsole,
        enableSentry: this.config.enableSentry,
        enablePerformanceTracking: this.config.enablePerformanceTracking
      }, LogCategory.SYSTEM);
    }
  }

  /**
   * Setup performance monitoring if enabled
   */
  private setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      // Server-side memory monitoring
      setInterval(() => {
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > (PERFORMANCE_CONFIG.MEMORY_MONITORING.warningThreshold || 0)) {
          this.warn('High memory usage detected', {
            memoryUsage: {
              heapUsed: memUsage.heapUsed,
              heapTotal: memUsage.heapTotal,
              external: memUsage.external,
              rss: memUsage.rss
            }
          }, LogCategory.PERFORMANCE);
        }
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Check if a log should be processed based on current configuration
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  /**
   * Get enriched context information
   * Automatically gathers context from environment, request, and user session
   */
  private async getEnrichedContext(providedContext?: LogContext): Promise<LogContext> {
    const context: LogContext = {
      ...providedContext,
      timestamp: new Date().toISOString(),
      environment: this.config.environment || process.env.NODE_ENV
    };

    // Add automatic context if enabled
    if (this.config.enableAutoContext) {
      try {
        // Get user context from Clerk (server-side) - DISABLED
        // TODO: Re-enable with proper server-only wrapper
        // if (typeof window === 'undefined' && auth) {
        //   try {
        //     const { userId, user } = await auth();
        //     if (userId) {
        //       context.userId = userId;
        //       context.userEmail = user?.emailAddresses?.[0]?.emailAddress;
        //     }
        //   } catch (error) {
        //     // Silently fail if auth context is not available
        //   }
        // }

        // Add build and version info
        context.buildId = process.env.NEXT_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA;
        context.version = process.env.npm_package_version;

        // Generate request ID if not provided
        if (!context.requestId) {
          context.requestId = generateRequestId();
        }

        // Add memory usage in development
        if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
          const memUsage = process.memoryUsage();
          context.memoryUsage = memUsage.heapUsed;
        }

      } catch (error) {
        // Don't let context enrichment errors break logging
      }
    }

    return context;
  }

  /**
   * Sanitize sensitive data from log context and metadata
   */
  private sanitizeData(data: any, sanitizer?: DataSanitizer): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    // Use custom sanitizer if provided
    if (sanitizer?.sanitize) {
      return sanitizer.sanitize(sanitized);
    }

    // Remove sensitive fields
    const fieldsToRemove = sanitizer?.removeFields || [];
    const fieldsToMask = sanitizer?.maskFields || SENSITIVE_FIELDS;

    Object.keys(sanitized).forEach(key => {
      if (fieldsToRemove.includes(key)) {
        delete sanitized[key];
      } else if (fieldsToMask.some(field => isSensitiveField(key))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key], sanitizer);
      }
    });

    return sanitized;
  }

  /**
   * Format log entry for console output
   */
  private formatConsoleLog(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const level = LogLevel[entry.level];
    const color = CONSOLE_CONFIG.COLORS[entry.level] || '';
    const resetColor = CONSOLE_CONFIG.RESET_COLOR;
    const icon = getCategoryIcon(entry.category);
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    if (CONSOLE_CONFIG.USE_JSON_FORMAT) {
      console.log(JSON.stringify(entry, null, 2));
      return;
    }

    // Structured console output for development
    const logArgs = [
      `${color}${icon} [${level}]${resetColor} ${timestamp} ${color}[${entry.category}]${resetColor}`,
      entry.message
    ];

    // Add context if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      logArgs.push('\n📋 Context:', this.sanitizeData(entry.context));
    }

    // Add performance info
    if (entry.performance) {
      logArgs.push('\n⚡ Performance:', entry.performance);
    }

    // Add error details for errors
    if (entry.error) {
      logArgs.push('\n💥 Error:', entry.error);
      
      if (entry.error.stack && CONSOLE_CONFIG.INCLUDE_STACK_TRACES) {
        logArgs.push('\n📚 Stack:', entry.error.stack);
      }
    }

    // Use appropriate console method based on level
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(...logArgs);
        break;
      case LogLevel.INFO:
        console.info(...logArgs);
        break;
      case LogLevel.WARN:
        console.warn(...logArgs);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(...logArgs);
        break;
      default:
        console.log(...logArgs);
    }
  }

  /**
   * Core logging method that handles all log processing
   */
  private async logEntry(
    level: LogLevel, 
    message: string, 
    context?: LogContext, 
    category: LogCategory = LogCategory.SYSTEM,
    error?: Error
  ): Promise<void> {
    // Early return if log level is filtered out (zero overhead)
    if (!this.shouldLog(level)) {
      return;
    }

    try {
      // Get enriched context
      const enrichedContext = await this.getEnrichedContext(context);

      // Create log entry
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
        context: this.sanitizeData(enrichedContext)
      };

      // Add error information if provided
      if (error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        };
      }

      // Add performance information if available
      if (enrichedContext?.executionTime) {
        logEntry.performance = {
          duration: enrichedContext.executionTime,
          memoryDelta: enrichedContext.memoryUsage
        };
      }

      // Format for console output
      this.formatConsoleLog(logEntry);

      // Send to Sentry (handled by sentry-logger.ts)
      if (this.config.enableSentry && level >= LogLevel.WARN) {
        // Dynamic import to avoid circular dependencies
        const { SentryLogger } = await import('./sentry-logger');
        SentryLogger.logToSentry(logEntry);
      }

      // File logging in production (if enabled)
      if (this.config.enableFile && this.config.environment === 'production') {
        // Could be implemented later for file-based logging
      }

    } catch (error) {
      // Fallback to basic console.error if logging system fails
      console.error('🚨 [LOGGER-ERROR] Failed to process log:', {
        originalMessage: message,
        originalContext: context,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Create a performance timer for measuring execution time
   */
  public startTimer(label?: string): PerformanceTimer {
    const timer: PerformanceTimer = {
      startTime: Date.now(),
      label,
      end: function() {
        const duration = Date.now() - this.startTime;
        return duration;
      },
      elapsed: function() {
        return Date.now() - this.startTime;
      }
    };

    if (label) {
      this.performanceTimers.set(label, timer);
    }

    return timer;
  }

  /**
   * End a named timer and log the result if it exceeds threshold
   */
  public endTimer(label: string, context?: LogContext, category?: LogCategory): number {
    const timer = this.performanceTimers.get(label);
    if (!timer) {
      this.warn(`Timer '${label}' not found`, context, LogCategory.PERFORMANCE);
      return 0;
    }

    const duration = timer.end();
    this.performanceTimers.delete(label);

    // Log slow operations
    const threshold = this.config.slowOperationThreshold || 1000;
    if (duration > threshold) {
      this.warn(`Slow operation detected: ${label}`, {
        ...context,
        executionTime: duration,
        threshold
      }, category || LogCategory.PERFORMANCE);
    } else if (this.config.enablePerformanceTracking) {
      this.debug(`Operation completed: ${label}`, {
        ...context,
        executionTime: duration
      }, category || LogCategory.PERFORMANCE);
    }

    return duration;
  }

  /**
   * Debug level logging
   * Used for detailed debugging information in development
   */
  public debug(message: string, context?: LogContext, category?: LogCategory): void {
    this.logEntry(LogLevel.DEBUG, message, context, category || LogCategory.SYSTEM);
  }

  /**
   * Info level logging
   * Used for general information about system operation
   */
  public info(message: string, context?: LogContext, category?: LogCategory): void {
    this.logEntry(LogLevel.INFO, message, context, category || LogCategory.SYSTEM);
  }

  /**
   * Warning level logging
   * Used for potentially harmful situations that should be monitored
   */
  public warn(message: string, context?: LogContext, category?: LogCategory): void {
    this.logEntry(LogLevel.WARN, message, context, category || LogCategory.SYSTEM);
  }

  /**
   * Error level logging
   * Used for error events that allow the application to continue
   */
  public error(message: string, error?: Error, context?: LogContext, category?: LogCategory): void {
    this.logEntry(LogLevel.ERROR, message, context, category || LogCategory.SYSTEM, error);
  }

  /**
   * Critical level logging
   * Used for critical errors that might cause the application to abort
   */
  public critical(message: string, error?: Error, context?: LogContext, category?: LogCategory): void {
    this.logEntry(LogLevel.CRITICAL, message, context, category || LogCategory.SYSTEM, error);
  }

  /**
   * Convenience method for API-related logging
   */
  public api(level: LogLevel, message: string, context?: LogContext): void {
    this.logEntry(level, message, context, LogCategory.API);
  }

  /**
   * Convenience method for database-related logging
   */
  public database(level: LogLevel, message: string, context?: LogContext): void {
    this.logEntry(level, message, context, LogCategory.DATABASE);
  }

  /**
   * Convenience method for payment-related logging
   */
  public payment(level: LogLevel, message: string, context?: LogContext): void {
    this.logEntry(level, message, context, LogCategory.PAYMENT);
  }

  /**
   * Convenience method for scraping-related logging
   */
  public scraping(level: LogLevel, message: string, context?: LogContext): void {
    this.logEntry(level, message, context, LogCategory.SCRAPING);
  }

  /**
   * Convenience method for performance logging with automatic timing
   */
  public async withTiming<T>(
    label: string, 
    operation: () => Promise<T>, 
    context?: LogContext,
    category?: LogCategory
  ): Promise<T> {
    const timer = this.startTimer(label);
    
    try {
      const result = await operation();
      const duration = timer.end();
      
      this.info(`${label} completed successfully`, {
        ...context,
        executionTime: duration
      }, category || LogCategory.PERFORMANCE);
      
      return result;
    } catch (error) {
      const duration = timer.end();
      
      this.error(`${label} failed`, error as Error, {
        ...context,
        executionTime: duration
      }, category || LogCategory.PERFORMANCE);
      
      throw error;
    }
  }

  /**
   * Flush any pending logs (for graceful shutdown)
   */
  public async flush(): Promise<void> {
    // Clear performance timers
    this.performanceTimers.clear();
    
    // Could implement file log flushing here if needed
  }

  /**
   * Update logger configuration at runtime
   */
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.minLevel = newConfig.minLevel || this.minLevel;
    
    this.info('Logger configuration updated', {
      newConfig: this.sanitizeData(newConfig)
    }, LogCategory.CONFIG);
  }

  /**
   * Get current logger configuration
   */
  public getConfig(): Partial<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Check if a specific log level would be processed
   */
  public wouldLog(level: LogLevel): boolean {
    return this.shouldLog(level);
  }
}

/**
 * Export singleton instance for global use
 */
export const logger = Logger.getInstance();

/**
 * Export Logger class for testing and advanced usage
 */
export { Logger };

/**
 * Export convenience functions for common logging patterns
 */
export const log = {
  debug: (message: string, context?: LogContext, category?: LogCategory) => 
    logger.debug(message, context, category),
  
  info: (message: string, context?: LogContext, category?: LogCategory) => 
    logger.info(message, context, category),
  
  warn: (message: string, context?: LogContext, category?: LogCategory) => 
    logger.warn(message, context, category),
  
  error: (message: string, error?: Error, context?: LogContext, category?: LogCategory) => 
    logger.error(message, error, context, category),
  
  critical: (message: string, error?: Error, context?: LogContext, category?: LogCategory) => 
    logger.critical(message, error, context, category),

  // Performance logging shortcuts
  time: (label: string) => logger.startTimer(label),
  timeEnd: (label: string, context?: LogContext, category?: LogCategory) => 
    logger.endTimer(label, context, category),
};