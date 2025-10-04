/**
 * Centralized logging configuration management for Phase 5
 * Integrates with existing SystemConfig and provides environment-specific logging settings
 */

import SystemConfig from './system-config';
import { LogLevel, LogCategory } from '../logging/types';

/**
 * Environment-specific logging configuration
 * Extends the existing constants with database-backed configuration
 */
export interface LoggingConfig {
  // Core logging settings
  minLevel: LogLevel;
  enableConsole: boolean;
  enableSentry: boolean;
  enableFile: boolean;
  environment: string;
  
  // Performance tracking
  enablePerformanceTracking: boolean;
  slowOperationThreshold: number;
  enableAutoContext: boolean;
  
  // Sentry specific settings
  sentryTracesSampleRate: number;
  sentrySessionSampleRate: number;
  sentryErrorSampleRate: number;
  sentryEnableProfiler: boolean;
  
  // Rate limiting
  enableRateLimiting: boolean;
  rateLimitPerMinute: number;
  
  // File logging settings (production)
  logRetentionDays: number;
  maxLogFileSize: string;
  maxLogFiles: number;
  
  // Debug settings
  enableVerboseErrors: boolean;
  enableStackTraces: boolean;
  enableSourceMaps: boolean;
}

/**
 * Default configurations for each environment
 */
const DEFAULT_CONFIGS: Record<string, LoggingConfig> = {
  development: {
    minLevel: LogLevel.DEBUG,
    enableConsole: true,
    enableSentry: true,
    enableFile: false,
    environment: 'development',
    enablePerformanceTracking: true,
    slowOperationThreshold: 100,
    enableAutoContext: true,
    sentryTracesSampleRate: 1.0, // 100% in development for debugging
    sentrySessionSampleRate: 1.0,
    sentryErrorSampleRate: 1.0,
    sentryEnableProfiler: true,
    enableRateLimiting: false,
    rateLimitPerMinute: 1000,
    logRetentionDays: 7,
    maxLogFileSize: '10MB',
    maxLogFiles: 5,
    enableVerboseErrors: true,
    enableStackTraces: true,
    enableSourceMaps: true,
  },
  
  test: {
    minLevel: LogLevel.ERROR,
    enableConsole: false,
    enableSentry: false,
    enableFile: false,
    environment: 'test',
    enablePerformanceTracking: false,
    slowOperationThreshold: 1000,
    enableAutoContext: false,
    sentryTracesSampleRate: 0,
    sentrySessionSampleRate: 0,
    sentryErrorSampleRate: 0,
    sentryEnableProfiler: false,
    enableRateLimiting: false,
    rateLimitPerMinute: 100,
    logRetentionDays: 1,
    maxLogFileSize: '1MB',
    maxLogFiles: 1,
    enableVerboseErrors: false,
    enableStackTraces: false,
    enableSourceMaps: false,
  },
  
  production: {
    minLevel: LogLevel.INFO,
    enableConsole: false,
    enableSentry: true,
    enableFile: true,
    environment: 'production',
    enablePerformanceTracking: true,
    slowOperationThreshold: 500,
    enableAutoContext: true,
    sentryTracesSampleRate: 0.1, // 10% sampling in production
    sentrySessionSampleRate: 0.1, // 10% session replay
    sentryErrorSampleRate: 1.0, // 100% error capture
    sentryEnableProfiler: true,
    enableRateLimiting: true,
    rateLimitPerMinute: 100,
    logRetentionDays: 30,
    maxLogFileSize: '50MB',
    maxLogFiles: 30,
    enableVerboseErrors: false,
    enableStackTraces: false,
    enableSourceMaps: false,
  },
  
  staging: {
    minLevel: LogLevel.DEBUG,
    enableConsole: true,
    enableSentry: true,
    enableFile: true,
    environment: 'staging',
    enablePerformanceTracking: true,
    slowOperationThreshold: 200,
    enableAutoContext: true,
    sentryTracesSampleRate: 0.5, // 50% sampling in staging
    sentrySessionSampleRate: 0.3, // 30% session replay
    sentryErrorSampleRate: 1.0, // 100% error capture
    sentryEnableProfiler: true,
    enableRateLimiting: true,
    rateLimitPerMinute: 500,
    logRetentionDays: 14,
    maxLogFileSize: '25MB',
    maxLogFiles: 14,
    enableVerboseErrors: true,
    enableStackTraces: true,
    enableSourceMaps: true,
  }
};

/**
 * Category-specific logging configuration
 */
export interface CategoryConfig {
  minLevel: LogLevel;
  enableSentry: boolean;
  enableConsole: boolean;
  enableFile: boolean;
  rateLimitPerMinute?: number;
}

const CATEGORY_CONFIGS: Partial<Record<LogCategory, CategoryConfig>> = {
  [LogCategory.AUTH]: {
    minLevel: LogLevel.INFO,
    enableSentry: true,
    enableConsole: true,
    enableFile: true,
    rateLimitPerMinute: 50, // Lower rate limit for auth events
  },
  
  [LogCategory.PAYMENT]: {
    minLevel: LogLevel.INFO,
    enableSentry: true,
    enableConsole: true,
    enableFile: true,
    rateLimitPerMinute: 30, // Very controlled for payment logs
  },
  
  [LogCategory.BILLING]: {
    minLevel: LogLevel.INFO,
    enableSentry: true,
    enableConsole: true,
    enableFile: true,
    rateLimitPerMinute: 30,
  },
  
  [LogCategory.SECURITY]: {
    minLevel: LogLevel.WARN,
    enableSentry: true,
    enableConsole: true,
    enableFile: true,
    rateLimitPerMinute: 20, // Security events should be limited but captured
  },
  
  [LogCategory.ERROR]: {
    minLevel: LogLevel.ERROR,
    enableSentry: true,
    enableConsole: true,
    enableFile: true,
    rateLimitPerMinute: 100, // Allow more error logs
  },
  
  [LogCategory.PERFORMANCE]: {
    minLevel: LogLevel.WARN,
    enableSentry: true,
    enableConsole: process.env.NODE_ENV === 'development',
    enableFile: true,
    rateLimitPerMinute: 200, // Performance logs can be frequent
  },
  
  [LogCategory.SCRAPING]: {
    minLevel: LogLevel.INFO,
    enableSentry: true,
    enableConsole: process.env.NODE_ENV === 'development',
    enableFile: true,
    rateLimitPerMinute: 500, // Scraping operations are frequent
  }
};

/**
 * Central logging configuration manager
 */
export class LoggingConfigManager {
  private static instance: LoggingConfigManager;
  private cachedConfig: LoggingConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds
  
  private constructor() {}
  
  static getInstance(): LoggingConfigManager {
    if (!LoggingConfigManager.instance) {
      LoggingConfigManager.instance = new LoggingConfigManager();
    }
    return LoggingConfigManager.instance;
  }
  
  /**
   * Get current logging configuration with caching
   */
  async getConfig(): Promise<LoggingConfig> {
    // Check cache
    if (this.cachedConfig && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedConfig;
    }
    
    const environment = this.getCurrentEnvironment();
    const defaultConfig = DEFAULT_CONFIGS[environment] || DEFAULT_CONFIGS.development;
    
    try {
      // Try to load database overrides
      const config = await this.loadConfigFromDatabase(environment, defaultConfig);
      
      // Cache the result
      this.cachedConfig = config;
      this.cacheTimestamp = Date.now();
      
      return config;
    } catch (error) {
      console.warn('[LOGGING-CONFIG] Failed to load from database, using defaults:', error);
      return defaultConfig;
    }
  }
  
  /**
   * Load configuration from database with fallbacks
   */
  private async loadConfigFromDatabase(
    environment: string, 
    defaultConfig: LoggingConfig
  ): Promise<LoggingConfig> {
    const config: LoggingConfig = { ...defaultConfig };
    
    try {
      // Load each configuration value with fallback to defaults
      config.minLevel = await this.getConfigValue(
        'logging', 'min_level', environment, defaultConfig.minLevel
      );
      
      config.enableSentry = await this.getConfigValue(
        'logging', 'enable_sentry', environment, defaultConfig.enableSentry
      );
      
      config.sentryTracesSampleRate = await this.getConfigValue(
        'logging', 'sentry_traces_sample_rate', environment, defaultConfig.sentryTracesSampleRate
      );
      
      config.sentrySessionSampleRate = await this.getConfigValue(
        'logging', 'sentry_session_sample_rate', environment, defaultConfig.sentrySessionSampleRate
      );
      
      config.enablePerformanceTracking = await this.getConfigValue(
        'logging', 'enable_performance_tracking', environment, defaultConfig.enablePerformanceTracking
      );
      
      config.slowOperationThreshold = await this.getConfigValue(
        'logging', 'slow_operation_threshold', environment, defaultConfig.slowOperationThreshold
      );
      
      config.enableRateLimiting = await this.getConfigValue(
        'logging', 'enable_rate_limiting', environment, defaultConfig.enableRateLimiting
      );
      
      config.rateLimitPerMinute = await this.getConfigValue(
        'logging', 'rate_limit_per_minute', environment, defaultConfig.rateLimitPerMinute
      );
      
      config.logRetentionDays = await this.getConfigValue(
        'logging', 'log_retention_days', environment, defaultConfig.logRetentionDays
      );
      
    } catch (error) {
      console.warn('[LOGGING-CONFIG] Error loading specific config values:', error);
      // Return default config if database loading fails
    }
    
    return config;
  }
  
  /**
   * Get a specific configuration value with fallback
   */
  private async getConfigValue<T>(
    category: string, 
    key: string, 
    environment: string, 
    defaultValue: T
  ): Promise<T> {
    try {
      // Try environment-specific key first
      const envKey = `${key}_${environment}`;
      try {
        return await SystemConfig.get(category, envKey) as T;
      } catch {
        // Fall back to general key
        return await SystemConfig.get(category, key) as T;
      }
    } catch {
      // Fall back to default value
      return defaultValue;
    }
  }
  
  /**
   * Get category-specific configuration
   */
  getCategoryConfig(category: LogCategory): CategoryConfig {
    const config = CATEGORY_CONFIGS[category];
    if (!config) {
      // Return default category config
      return {
        minLevel: LogLevel.INFO,
        enableSentry: true,
        enableConsole: process.env.NODE_ENV === 'development',
        enableFile: true,
        rateLimitPerMinute: 100,
      };
    }
    return config;
  }
  
  /**
   * Update configuration in database
   */
  async updateConfig(key: string, value: any, environment?: string): Promise<void> {
    const env = environment || this.getCurrentEnvironment();
    const configKey = environment ? `${key}_${env}` : key;
    
    // Determine value type
    let valueType = 'string';
    if (typeof value === 'number') valueType = 'number';
    if (typeof value === 'boolean') valueType = 'boolean';
    
    await SystemConfig.set('logging', configKey, value.toString(), valueType);
    
    // Clear cache to force reload
    this.clearCache();
  }
  
  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
  }
  
  /**
   * Get current environment
   */
  private getCurrentEnvironment(): string {
    // Check for explicit environment override
    const sentryEnv = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
    if (sentryEnv && sentryEnv !== 'development') {
      return sentryEnv;
    }
    
    // Determine environment from various sources
    if (process.env.NODE_ENV === 'production') {
      // Check if we're in staging based on URL or specific env var
      if (process.env.VERCEL_ENV === 'preview' || 
          process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')) {
        return 'staging';
      }
      return 'production';
    }
    
    if (process.env.NODE_ENV === 'test') {
      return 'test';
    }
    
    return 'development';
  }
  
  /**
   * Initialize default logging configurations in database
   */
  async initializeDefaults(): Promise<void> {
    const environment = this.getCurrentEnvironment();
    const defaultConfig = DEFAULT_CONFIGS[environment];
    
    if (!defaultConfig) {
      throw new Error(`No default configuration found for environment: ${environment}`);
    }
    
    try {
      // Initialize all logging configuration values
      const configEntries = [
        { key: 'min_level', value: defaultConfig.minLevel, type: 'string' },
        { key: 'enable_sentry', value: defaultConfig.enableSentry, type: 'boolean' },
        { key: 'enable_console', value: defaultConfig.enableConsole, type: 'boolean' },
        { key: 'enable_file', value: defaultConfig.enableFile, type: 'boolean' },
        { key: 'sentry_traces_sample_rate', value: defaultConfig.sentryTracesSampleRate, type: 'number' },
        { key: 'sentry_session_sample_rate', value: defaultConfig.sentrySessionSampleRate, type: 'number' },
        { key: 'sentry_error_sample_rate', value: defaultConfig.sentryErrorSampleRate, type: 'number' },
        { key: 'enable_performance_tracking', value: defaultConfig.enablePerformanceTracking, type: 'boolean' },
        { key: 'slow_operation_threshold', value: defaultConfig.slowOperationThreshold, type: 'number' },
        { key: 'enable_rate_limiting', value: defaultConfig.enableRateLimiting, type: 'boolean' },
        { key: 'rate_limit_per_minute', value: defaultConfig.rateLimitPerMinute, type: 'number' },
        { key: 'log_retention_days', value: defaultConfig.logRetentionDays, type: 'number' },
      ];
      
      for (const entry of configEntries) {
        await SystemConfig.set(
          'logging',
          entry.key,
          entry.value.toString(),
          entry.type,
          `Default logging configuration for ${entry.key}`
        );
      }
      
      console.log(`[LOGGING-CONFIG] Initialized default configurations for ${environment}`);
    } catch (error) {
      console.error('[LOGGING-CONFIG] Failed to initialize defaults:', error);
      throw error;
    }
  }
  
  /**
   * Validate current configuration
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const config = await this.getConfig();
      
      // Validate sampling rates
      if (config.sentryTracesSampleRate < 0 || config.sentryTracesSampleRate > 1) {
        errors.push('Sentry traces sample rate must be between 0 and 1');
      }
      
      if (config.sentrySessionSampleRate < 0 || config.sentrySessionSampleRate > 1) {
        errors.push('Sentry session sample rate must be between 0 and 1');
      }
      
      // Validate thresholds
      if (config.slowOperationThreshold <= 0) {
        errors.push('Slow operation threshold must be greater than 0');
      }
      
      if (config.rateLimitPerMinute <= 0) {
        errors.push('Rate limit per minute must be greater than 0');
      }
      
      // Validate retention settings
      if (config.logRetentionDays <= 0) {
        errors.push('Log retention days must be greater than 0');
      }
      
      // Check environment-specific settings
      const env = this.getCurrentEnvironment();
      if (env === 'production' && config.sentryTracesSampleRate > 0.5) {
        errors.push('Production trace sample rate should not exceed 0.5 (50%) for cost control');
      }
      
      if (env === 'development' && !config.enableConsole) {
        errors.push('Console logging should be enabled in development environment');
      }
      
    } catch (error) {
      errors.push(`Failed to load configuration: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Convenience functions for accessing logging configuration
 */

// Singleton instance
const loggingConfig = LoggingConfigManager.getInstance();

// Export convenient functions
export const getLoggingConfig = () => loggingConfig.getConfig();
export const getCategoryConfig = (category: LogCategory) => loggingConfig.getCategoryConfig(category);
export const updateLoggingConfig = (key: string, value: any, environment?: string) => 
  loggingConfig.updateConfig(key, value, environment);
export const initializeLoggingDefaults = () => loggingConfig.initializeDefaults();
export const validateLoggingConfig = () => loggingConfig.validateConfig();
export const clearLoggingConfigCache = () => loggingConfig.clearCache();

export default LoggingConfigManager;