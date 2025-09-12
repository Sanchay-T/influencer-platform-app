/**
 * Configuration constants for the centralized logging system
 * Defines environment-specific settings, log levels, and integration parameters
 */

import { LogLevel, LogCategory, LoggerConfig } from './types';

/**
 * Environment-based log level thresholds
 * Determines minimum log level for each environment to control verbosity
 */
export const LOG_LEVEL_CONFIG = {
  development: LogLevel.DEBUG,  // Show all logs in development
  test: LogLevel.WARN,          // Only warnings and errors in tests
  production: LogLevel.INFO,    // Info and above in production
} as const;

/**
 * Default logger configuration based on environment
 */
export const DEFAULT_LOGGER_CONFIG: Record<string, Partial<LoggerConfig>> = {
  development: {
    minLevel: LogLevel.DEBUG,
    enableConsole: true,
    enableSentry: true,
    enableFile: false,
    environment: 'development',
    enablePerformanceTracking: true,
    slowOperationThreshold: 100, // 100ms threshold in dev
    enableAutoContext: true,
  },
  
  test: {
    minLevel: LogLevel.WARN,
    enableConsole: false,
    enableSentry: false,
    enableFile: false,
    environment: 'test',
    enablePerformanceTracking: false,
    enableAutoContext: false,
  },
  
  production: {
    minLevel: LogLevel.INFO,
    enableConsole: false,
    enableSentry: true,
    enableFile: true,
    environment: 'production',
    enablePerformanceTracking: true,
    slowOperationThreshold: 500, // 500ms threshold in prod
    enableAutoContext: true,
  }
} as const;

/**
 * Sentry configuration constants
 * Integrates with existing Sentry setup from instrumentation files
 */
export const SENTRY_CONFIG = {
  // Log levels that should be sent to Sentry
  SENTRY_LOG_LEVELS: [LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL],
  
  // Categories that should always be sent to Sentry
  CRITICAL_CATEGORIES: [
    LogCategory.AUTH,
    LogCategory.PAYMENT,
    LogCategory.BILLING,
    LogCategory.STRIPE,
    LogCategory.SECURITY,
    LogCategory.DATABASE
  ],
  
  // Sentry breadcrumb configuration
  BREADCRUMB_CONFIG: {
    maxBreadcrumbs: 50,
    enableAutoBreadcrumbs: true,
    categories: {
      [LogCategory.API]: 'http',
      [LogCategory.DATABASE]: 'query',
      [LogCategory.AUTH]: 'auth',
      [LogCategory.PAYMENT]: 'transaction',
      [LogCategory.UI]: 'ui',
      [LogCategory.WEBHOOK]: 'http',
    }
  },
  
  // Transaction sampling
  TRACES_SAMPLE_RATE: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Performance monitoring
  PERFORMANCE_CONFIG: {
    enableInstrumentation: true,
    trackComponents: true,
    trackRoutes: true,
    slowTransactionThreshold: 2000, // 2 seconds
  }
} as const;

/**
 * File logging configuration
 * For production environments where file logging is enabled
 */
export const FILE_LOGGING_CONFIG = {
  LOG_DIRECTORY: process.cwd() + '/logs',
  
  // File rotation settings
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 30, // Keep 30 days of logs
  ROTATION_PATTERN: 'YYYY-MM-DD', // Daily rotation
  
  // File naming patterns
  FILE_PATTERNS: {
    [LogCategory.API]: 'api-%DATE%.log',
    [LogCategory.ERROR]: 'error-%DATE%.log',
    [LogCategory.PAYMENT]: 'payment-%DATE%.log',
    [LogCategory.SCRAPING]: 'scraping-%DATE%.log',
    default: 'application-%DATE%.log'
  }
} as const;

/**
 * Performance monitoring constants
 */
export const PERFORMANCE_CONFIG = {
  // Thresholds for different operations (in milliseconds)
  THRESHOLDS: {
    DATABASE_QUERY: 100,
    API_REQUEST: 500,
    SCRAPING_OPERATION: 5000,
    EMAIL_SEND: 1000,
    IMAGE_PROCESSING: 2000,
    STRIPE_OPERATION: 3000,
  },
  
  // Memory usage monitoring
  MEMORY_MONITORING: {
    enableTracking: process.env.NODE_ENV === 'production',
    warningThreshold: 100 * 1024 * 1024, // 100MB
    criticalThreshold: 200 * 1024 * 1024, // 200MB
  }
} as const;

/**
 * Data sanitization configuration
 * Defines sensitive fields that should be redacted from logs
 */
export const SENSITIVE_FIELDS = [
  // Authentication & security
  'password', 'token', 'secret', 'key', 'signature', 'hash',
  'authorization', 'cookie', 'session',
  
  // Personal information
  'email', 'phone', 'address', 'ssn', 'creditCard',
  'cardNumber', 'cvv', 'expiry',
  
  // API keys and tokens
  'apiKey', 'api_key', 'accessToken', 'access_token',
  'refreshToken', 'refresh_token', 'bearer',
  
  // Stripe specific
  'stripeKey', 'stripe_key', 'paymentMethodId', 'customerId',
  
  // Database credentials
  'DATABASE_URL', 'db_password', 'connection_string',
  
  // Third-party service keys
  'APIFY_TOKEN', 'QSTASH_TOKEN', 'RESEND_API_KEY',
  'CLERK_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'
] as const;

/**
 * Request ID generation configuration
 */
export const REQUEST_ID_CONFIG = {
  // Request ID format: req_timestamp_random
  PREFIX: 'req_',
  RANDOM_LENGTH: 8,
  
  // Headers to check for existing request IDs
  REQUEST_ID_HEADERS: [
    'x-request-id',
    'x-correlation-id',
    'x-trace-id',
    'request-id'
  ]
} as const;

/**
 * Context enrichment configuration
 * Defines what context information should be automatically added to logs
 */
export const CONTEXT_ENRICHMENT = {
  // Enable automatic context enrichment
  ENABLE_AUTO_CONTEXT: true,
  
  // User context from Clerk
  USER_CONTEXT_FIELDS: [
    'id',
    'emailAddress',
    'firstName',
    'lastName',
    'username'
  ],
  
  // Request context
  REQUEST_CONTEXT_FIELDS: [
    'method',
    'url',
    'userAgent',
    'ip',
    'referer'
  ],
  
  // Environment context
  ENVIRONMENT_CONTEXT: {
    enableBuildInfo: true,
    enableSystemInfo: process.env.NODE_ENV === 'development',
    enableGitInfo: process.env.NODE_ENV === 'development',
  }
} as const;

/**
 * Console output configuration
 * Styling and formatting for development console output
 */
export const CONSOLE_CONFIG = {
  // Color coding for different log levels
  COLORS: {
    [LogLevel.DEBUG]: '\x1b[36m',   // Cyan
    [LogLevel.INFO]: '\x1b[32m',    // Green
    [LogLevel.WARN]: '\x1b[33m',    // Yellow
    [LogLevel.ERROR]: '\x1b[31m',   // Red
    [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
  },
  
  // Reset color
  RESET_COLOR: '\x1b[0m',
  
  // Icons for different categories
  CATEGORY_ICONS: {
    [LogCategory.API]: '🌐',
    [LogCategory.DATABASE]: '🗄️',
    [LogCategory.AUTH]: '🔐',
    [LogCategory.PAYMENT]: '💳',
    [LogCategory.BILLING]: '💰',
    [LogCategory.STRIPE]: '💳',
    [LogCategory.SCRAPING]: '🕷️',
    [LogCategory.EMAIL]: '📧',
    [LogCategory.ERROR]: '❌',
    [LogCategory.PERFORMANCE]: '⚡',
    [LogCategory.SECURITY]: '🛡️',
    [LogCategory.ADMIN]: '👑',
    [LogCategory.WEBHOOK]: '🔗',
    [LogCategory.QSTASH]: '📤',
    default: '📝'
  },
  
  // Enable structured JSON output in development
  USE_JSON_FORMAT: false,
  
  // Include stack traces for errors
  INCLUDE_STACK_TRACES: process.env.NODE_ENV === 'development'
} as const;

/**
 * Rate limiting configuration for logs
 * Prevents log flooding in production
 */
export const RATE_LIMITING = {
  // Enable rate limiting in production
  ENABLED: process.env.NODE_ENV === 'production',
  
  // Rate limits per category (logs per minute)
  LIMITS: {
    [LogCategory.DEBUG]: 100,
    [LogCategory.INFO]: 500,
    [LogCategory.WARN]: 100,
    [LogCategory.ERROR]: 50,
    [LogCategory.CRITICAL]: 10,
  },
  
  // Burst allowance
  BURST_SIZE: 10,
  
  // Window size in milliseconds
  WINDOW_SIZE: 60 * 1000, // 1 minute
} as const;

/**
 * Export current environment's logger configuration
 */
export function getLoggerConfig(): Partial<LoggerConfig> {
  const env = (process.env.NODE_ENV || 'development') as keyof typeof DEFAULT_LOGGER_CONFIG;
  return DEFAULT_LOGGER_CONFIG[env] || DEFAULT_LOGGER_CONFIG.development;
}

/**
 * Get minimum log level for current environment
 */
export function getMinLogLevel(): LogLevel {
  const env = (process.env.NODE_ENV || 'development') as keyof typeof LOG_LEVEL_CONFIG;
  return LOG_LEVEL_CONFIG[env] || LOG_LEVEL_CONFIG.development;
}

/**
 * Check if a log level should be sent to Sentry
 */
export function shouldSendToSentry(level: LogLevel, category?: LogCategory): boolean {
  // Always send critical categories regardless of level
  if (category && SENTRY_CONFIG.CRITICAL_CATEGORIES.includes(category)) {
    return true;
  }
  
  // Send based on log level
  return SENTRY_CONFIG.SENTRY_LOG_LEVELS.includes(level);
}

/**
 * Get Sentry DSN from environment or configuration
 */
export function getSentryDSN(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
}

/**
 * Check if field should be sanitized
 */
export function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => 
    lowerFieldName.includes(sensitive.toLowerCase())
  );
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 2 + REQUEST_ID_CONFIG.RANDOM_LENGTH);
  return `${REQUEST_ID_CONFIG.PREFIX}${timestamp}_${random}`;
}

/**
 * Get console icon for category
 */
export function getCategoryIcon(category: LogCategory): string {
  return CONSOLE_CONFIG.CATEGORY_ICONS[category] || CONSOLE_CONFIG.CATEGORY_ICONS.default;
}

/**
 * Export commonly used constants
 */
export {
  LogLevel,
  LogCategory
} from './types';