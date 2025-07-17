import { db } from '@/lib/db';
import { systemConfigurations, type SystemConfiguration } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Default configuration values (fallback)
const DEFAULT_CONFIGS = {
  // API Limits
  'api_limits.max_api_calls_for_testing': { value: '5', type: 'number' },
  'api_limits.max_api_calls_tiktok': { value: '1', type: 'number' },
  'api_limits.max_api_calls_tiktok_similar': { value: '1', type: 'number' },
  
  // QStash Delays
  'qstash_delays.tiktok_continuation_delay': { value: '2s', type: 'duration' },
  'qstash_delays.instagram_reels_delay': { value: '30s', type: 'duration' },
  
  // Job Timeouts
  'timeouts.standard_job_timeout': { value: '60m', type: 'duration' },
  'timeouts.instagram_job_timeout': { value: '300s', type: 'duration' },
  'timeouts.cleanup_timeout_hours': { value: '24h', type: 'duration' },
  
  // Polling Intervals
  'polling.frontend_status_check_interval': { value: '5000', type: 'number' },
  'polling.campaign_status_interval': { value: '3000', type: 'number' },
  'polling.ui_refresh_delay': { value: '2000', type: 'number' },
  
  // Cache Settings
  'cache.image_cache_success_duration': { value: '3600', type: 'number' },
  'cache.image_cache_placeholder_duration': { value: '300', type: 'number' },
  
  // Processing Settings
  'processing.batch_processing_delay': { value: '50', type: 'number' },
  'processing.batch_size': { value: '5', type: 'number' },
  
  // Cleanup Rules
  'cleanup.completed_jobs_retention_days': { value: '30', type: 'number' },
  'cleanup.error_jobs_retention_days': { value: '7', type: 'number' },
  'cleanup.cancelled_jobs_retention_days': { value: '7', type: 'number' },
  'cleanup.timeout_jobs_retention_days': { value: '7', type: 'number' },
} as const;

type ConfigKey = keyof typeof DEFAULT_CONFIGS;

// In-memory cache
interface CacheItem {
  value: any;
  timestamp: number;
  ttl: number;
}

class ConfigCache {
  private cache = new Map<string, CacheItem>();
  private readonly TTL_MS = 30 * 1000; // 30 seconds

  set(key: string, value: any, ttl = this.TTL_MS): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

const cache = new ConfigCache();

// Duration parser - converts "2s", "30s", "60m", "24h" to milliseconds
function parseDuration(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|ms)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${value}. Use format like "2s", "30s", "60m", "24h"`);
  }
  
  const [, num, unit] = match;
  const number = parseInt(num, 10);
  
  switch (unit) {
    case 'ms': return number;
    case 's': return number * 1000;
    case 'm': return number * 60 * 1000;
    case 'h': return number * 60 * 60 * 1000;
    default: throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

// Validation functions
function validateValue(value: string, type: string): any {
  switch (type) {
    case 'number':
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`Invalid number value: ${value}`);
      }
      return num;
    
    case 'duration':
      return parseDuration(value);
    
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        throw new Error(`Invalid boolean value: ${value}. Must be "true" or "false"`);
      }
      return value === 'true';
    
    default:
      throw new Error(`Unsupported value type: ${type}`);
  }
}

// Main configuration service
export class SystemConfig {
  /**
   * Get a configuration value by category and key
   */
  static async get(category: string, key: string): Promise<any> {
    const cacheKey = `${category}.${key}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached !== null) {
      console.log(`🔧 [CONFIG-CACHE] Using cached value for ${cacheKey}:`, cached);
      return cached;
    }
    
    console.log(`🔧 [CONFIG-DB] Loading from database: ${cacheKey}`);
    
    try {
      // Try to load from database
      const config = await db.query.systemConfigurations.findFirst({
        where: and(
          eq(systemConfigurations.category, category),
          eq(systemConfigurations.key, key)
        )
      });
      
      if (config) {
        const validatedValue = validateValue(config.value, config.valueType);
        console.log(`🔧 [CONFIG-DB] Found in database: ${cacheKey} = ${config.value} (type: ${config.valueType})`);
        cache.set(cacheKey, validatedValue);
        return validatedValue;
      }
      
      // Fall back to default if not found in database
      console.log(`🔧 [CONFIG-DEFAULT] Not found in database, using default for: ${cacheKey}`);
      const defaultConfig = DEFAULT_CONFIGS[cacheKey as ConfigKey];
      if (defaultConfig) {
        const validatedValue = validateValue(defaultConfig.value, defaultConfig.type);
        console.log(`🔧 [CONFIG-DEFAULT] Using default value: ${cacheKey} = ${defaultConfig.value}`);
        cache.set(cacheKey, validatedValue);
        return validatedValue;
      }
      
      throw new Error(`Configuration not found: ${category}.${key}`);
      
    } catch (error) {
      console.error(`[CONFIG] Error loading config ${category}.${key}:`, error);
      
      // Emergency fallback to defaults
      const defaultConfig = DEFAULT_CONFIGS[cacheKey as ConfigKey];
      if (defaultConfig) {
        const validatedValue = validateValue(defaultConfig.value, defaultConfig.type);
        return validatedValue;
      }
      
      throw error;
    }
  }
  
  /**
   * Get all configurations grouped by category
   */
  static async getAll(): Promise<Record<string, SystemConfiguration[]>> {
    try {
      const configs = await db.select().from(systemConfigurations)
        .orderBy(systemConfigurations.category, systemConfigurations.key);
      
      // Group by category
      const grouped: Record<string, SystemConfiguration[]> = {};
      configs.forEach((config: SystemConfiguration) => {
        if (!grouped[config.category]) {
          grouped[config.category] = [];
        }
        grouped[config.category].push(config);
      });
      
      return grouped;
    } catch (error) {
      console.error('[CONFIG] Error loading all configurations:', error);
      throw error;
    }
  }
  
  /**
   * Set a configuration value
   */
  static async set(category: string, key: string, value: string, valueType: string, description?: string): Promise<void> {
    try {
      // Validate the value first
      validateValue(value, valueType);
      
      // Update or insert in database
      await db.insert(systemConfigurations)
        .values({
          category,
          key,
          value,
          valueType,
          description,
          isHotReloadable: 'true', // Default to hot-reloadable
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [systemConfigurations.category, systemConfigurations.key],
          set: {
            value,
            valueType,
            description,
            updatedAt: new Date()
          }
        });
      
      // Invalidate cache
      cache.invalidate(`${category}.${key}`);
      
      console.log(`[CONFIG] Updated configuration: ${category}.${key} = ${value}`);
    } catch (error) {
      console.error(`[CONFIG] Error setting config ${category}.${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a configuration (will fall back to default)
   */
  static async delete(category: string, key: string): Promise<void> {
    try {
      await db.delete(systemConfigurations)
        .where(and(
          eq(systemConfigurations.category, category),
          eq(systemConfigurations.key, key)
        ));
      
      // Invalidate cache
      cache.invalidate(`${category}.${key}`);
      
      console.log(`[CONFIG] Deleted configuration: ${category}.${key}`);
    } catch (error) {
      console.error(`[CONFIG] Error deleting config ${category}.${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Initialize default configurations in database
   */
  static async initializeDefaults(): Promise<void> {
    try {
      const defaultEntries = Object.entries(DEFAULT_CONFIGS).map(([key, config]) => {
        const [category, configKey] = key.split('.');
        return {
          category,
          key: configKey,
          value: config.value,
          valueType: config.type,
          description: `Default configuration for ${key}`,
          isHotReloadable: 'true'
        };
      });
      
      // Insert defaults (ignore conflicts)
      for (const entry of defaultEntries) {
        await db.insert(systemConfigurations)
          .values(entry)
          .onConflictDoNothing();
      }
      
      console.log('[CONFIG] Default configurations initialized');
    } catch (error) {
      console.error('[CONFIG] Error initializing defaults:', error);
      throw error;
    }
  }
  
  /**
   * Clear all caches
   */
  static clearCache(): void {
    cache.clear();
    console.log('[CONFIG] Configuration cache cleared');
  }
  
  /**
   * Get available configuration categories
   */
  static getCategories(): string[] {
    const categories = new Set<string>();
    Object.keys(DEFAULT_CONFIGS).forEach(key => {
      const [category] = key.split('.');
      categories.add(category);
    });
    return Array.from(categories).sort();
  }
}

// Convenience functions for common configurations
export const getApiLimit = (platform: string) => 
  SystemConfig.get('api_limits', `max_api_calls_${platform.toLowerCase()}`);

export const getQStashDelay = (type: string) => 
  SystemConfig.get('qstash_delays', `${type}_delay`);

export const getJobTimeout = (type: string) => 
  SystemConfig.get('timeouts', `${type}_timeout`);

export const getPollingInterval = (type: string) => 
  SystemConfig.get('polling', `${type}_interval`);

export const getCacheDuration = (type: string) => 
  SystemConfig.get('cache', `${type}_duration`);

export const getProcessingSetting = (type: string) => 
  SystemConfig.get('processing', type);

export const getCleanupSetting = (type: string) => 
  SystemConfig.get('cleanup', `${type}_retention_days`);

export default SystemConfig;