/**
 * Core TypeScript type definitions for the centralized logging system
 * Provides type safety and structure for all logging operations across the application
 */

/**
 * Available log levels in order of severity
 * Used for filtering and routing logs to appropriate handlers
 */
export enum LogLevel {
  DEBUG = 0,    // Detailed debug information
  INFO = 1,     // General information about system operation
  WARN = 2,     // Warning messages about potentially harmful situations
  ERROR = 3,    // Error events that allow the application to continue
  CRITICAL = 4  // Critical errors that might cause the application to abort
}

/**
 * Log categories for organizing logs by functional area
 * Based on the application's architecture and business logic
 */
export enum LogCategory {
  // Core system categories
  API = 'API',
  DATABASE = 'DATABASE', 
  AUTH = 'AUTH',
  CONFIG = 'CONFIG',
  
  // Business logic categories
  CAMPAIGN = 'CAMPAIGN',
  SCRAPING = 'SCRAPING',
  SEARCH = 'SEARCH',
  
  // Payment and billing
  PAYMENT = 'PAYMENT',
  BILLING = 'BILLING',
  STRIPE = 'STRIPE',
  TRIAL = 'TRIAL',
  
  // Platform integrations
  TIKTOK = 'TIKTOK',
  INSTAGRAM = 'INSTAGRAM',
  YOUTUBE = 'YOUTUBE',
  APIFY = 'APIFY',
  
  // Infrastructure
  QSTASH = 'QSTASH',
  EMAIL = 'EMAIL',
  STORAGE = 'STORAGE',
  CACHE = 'CACHE',
  
  // Monitoring and admin
  ADMIN = 'ADMIN',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  ONBOARDING = 'ONBOARDING',
  
  // General categories
  SYSTEM = 'SYSTEM',
  UI = 'UI',
  WEBHOOK = 'WEBHOOK',
  JOB = 'JOB'
}

/**
 * Context information that can be attached to any log entry
 * Provides traceability and debugging capabilities
 */
export interface LogContext {
  // User identification (from Clerk)
  userId?: string;
  userEmail?: string;
  
  // Request tracking
  requestId?: string;
  sessionId?: string;
  traceId?: string;
  
  // Performance tracking
  executionTime?: number;
  memoryUsage?: number;
  
  // Business context
  campaignId?: string;
  jobId?: string;
  platform?: string;
  
  // Technical context
  environment?: string;
  version?: string;
  buildId?: string;
  
  // HTTP context
  method?: string;
  url?: string;
  statusCode?: number;
  userAgent?: string;
  ip?: string;
  
  // Error context
  errorCode?: string;
  stack?: string;
  
  // Custom metadata
  metadata?: Record<string, any>;
}

/**
 * Performance timer interface for measuring execution time
 */
export interface PerformanceTimer {
  /** Start timestamp in milliseconds */
  startTime: number;
  /** Timer label for identification */
  label?: string;
  /** End the timer and return duration in milliseconds */
  end(): number;
  /** Get current elapsed time without ending the timer */
  elapsed(): number;
}

/**
 * Complete log entry structure
 * This is the canonical format for all logs in the system
 */
export interface LogEntry {
  // Core identification
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  
  // Context and metadata
  context?: LogContext;
  
  // Error details (for ERROR and CRITICAL levels)
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
    cause?: any;
  };
  
  // Performance metrics
  performance?: {
    duration?: number;
    memoryDelta?: number;
    cpuUsage?: number;
  };
  
  // Source location
  source?: {
    file?: string;
    function?: string;
    line?: number;
  };
}

/**
 * Configuration options for logger instances
 */
export interface LoggerConfig {
  // Minimum log level to process
  minLevel: LogLevel;
  
  // Enable/disable different outputs
  enableConsole: boolean;
  enableSentry: boolean;
  enableFile: boolean;
  
  // Environment-specific settings
  environment: 'development' | 'test' | 'production';
  prettyConsole?: boolean;
  categoryOverrides?: Partial<Record<LogCategory, LogLevel>>;
  
  // Sentry configuration
  sentryConfig?: {
    dsn?: string;
    environment?: string;
    tracesSampleRate?: number;
    beforeSend?: (event: any) => any;
  };
  
  // File logging configuration
  fileConfig?: {
    logDirectory?: string;
    maxFileSize?: number;
    maxFiles?: number;
    rotationPattern?: string;
  };
  
  // Performance monitoring
  enablePerformanceTracking?: boolean;
  slowOperationThreshold?: number; // milliseconds
  
  // Context enrichment
  enableAutoContext?: boolean;
  sensitiveFields?: string[]; // Fields to redact in logs
}

/**
 * Interface for log transport implementations
 * Allows pluggable logging destinations
 */
export interface LogTransport {
  /** Transport name for identification */
  name: string;
  
  /** Minimum level this transport handles */
  minLevel: LogLevel;
  
  /** Process a log entry */
  log(entry: LogEntry): Promise<void> | void;
  
  /** Flush any buffered logs */
  flush?(): Promise<void> | void;
  
  /** Clean up resources */
  close?(): Promise<void> | void;
}

/**
 * Sentry-specific types and interfaces
 */
export interface SentryLogContext {
  // Sentry user context
  user?: {
    id?: string;
    email?: string;
    username?: string;
    ip_address?: string;
  };
  
  // Sentry tags for filtering and grouping
  tags?: Record<string, string>;
  
  // Sentry extra data
  extra?: Record<string, any>;
  
  // Breadcrumb data
  breadcrumb?: {
    message?: string;
    category?: string;
    level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
    data?: Record<string, any>;
  };
  
  // Transaction context
  transaction?: {
    name: string;
    op: string;
    tags?: Record<string, string>;
  };
}

/**
 * Search and filtering options for log queries
 */
export interface LogQueryOptions {
  // Time range
  startTime?: Date;
  endTime?: Date;
  
  // Filtering
  levels?: LogLevel[];
  categories?: LogCategory[];
  userId?: string;
  requestId?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'timestamp' | 'level' | 'category';
  sortOrder?: 'asc' | 'desc';
  
  // Search
  searchTerm?: string;
  searchFields?: string[];
}

/**
 * Utility type for log method signatures
 * Ensures consistency across all logging methods
 */
export type LogMethod = (
  message: string,
  context?: LogContext,
  category?: LogCategory
) => void;

/**
 * Type guard for checking if a value is a valid LogLevel
 */
export function isValidLogLevel(value: any): value is LogLevel {
  return typeof value === 'number' && value >= 0 && value <= 4 && Number.isInteger(value);
}

/**
 * Type guard for checking if a value is a valid LogCategory
 */
export function isValidLogCategory(value: any): value is LogCategory {
  return typeof value === 'string' && Object.values(LogCategory).includes(value as LogCategory);
}

/**
 * Helper type for extracting sensitive data
 */
export interface DataSanitizer {
  /** Fields to completely remove from logs */
  removeFields?: string[];
  /** Fields to mask/redact in logs */
  maskFields?: string[];
  /** Custom sanitization function */
  sanitize?: (data: any) => any;
}

/**
 * Export all types for convenient importing
 */
export type {
  LogContext,
  LogEntry,
  LoggerConfig,
  LogTransport,
  SentryLogContext,
  LogQueryOptions,
  LogMethod,
  PerformanceTimer,
  DataSanitizer
};
