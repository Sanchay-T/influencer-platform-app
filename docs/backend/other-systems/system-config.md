# ⚙️ System Configuration - Dynamic App-Wide Settings

## Overview
Comprehensive system configuration management with database-backed settings, in-memory caching, hot-reloading capabilities, and type-safe value validation for all platform limits, timeouts, and operational parameters.

## 🏗️ System Configuration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 SYSTEM CONFIGURATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Application Request                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │ SystemConfig.   │                                           │
│  │ get(category,   │                                           │
│  │     key)        │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Check Cache   │                                           │
│  │                 │                                           │
│  │ In-Memory Cache │                                           │
│  │ TTL: 30 seconds │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│    ┌────┴────┐                                                 │
│    ▼         ▼                                                 │
│ ┌─────┐  ┌─────────────────┐                                   │
│ │Cache│  │   Database      │                                   │
│ │ Hit │  │   Query         │                                   │
│ └─────┘  │                 │                                   │
│    │     │ SELECT * FROM   │                                   │
│    │     │ system_configs  │                                   │
│    │     │ WHERE category  │                                   │
│    │     │ AND key         │                                   │
│    │     └─────────────────┘                                   │
│    │              │                                            │
│    │              ▼                                            │
│    │     ┌─────────────────┐                                   │
│    │     │   Value Found   │                                   │
│    │     │   in Database   │                                   │
│    │     └─────────────────┘                                   │
│    │              │                                            │
│    │              ▼                                            │
│    │     ┌─────────────────┐                                   │
│    │     │   Validate &    │                                   │
│    │     │   Type Convert  │                                   │
│    │     │                 │                                   │
│    │     │ number → int    │                                   │
│    │     │ duration → ms   │                                   │
│    │     │ boolean → bool  │                                   │
│    │     └─────────────────┘                                   │
│    │              │                                            │
│    ▼              ▼                                            │
│  ┌─────────────────────────────────────────┐                    │
│  │         FALLBACK TO DEFAULTS            │                    │
│  │                                         │                    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐ │                    │
│  │  │Database │  │ Default │  │  Cache  │ │                    │
│  │  │ Value   │  │Constants│  │ & Return│ │                    │
│  │  └─────────┘  └─────────┘  └─────────┘ │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🗃️ Database Schema

### System Configurations Table

#### **File: `lib/db/schema.ts`**

```sql
CREATE TABLE system_configurations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         VARCHAR(50) NOT NULL,              -- Config category
  key              VARCHAR(100) NOT NULL,             -- Config key
  value            TEXT NOT NULL,                     -- Config value (as string)
  value_type       VARCHAR(20) NOT NULL,              -- 'number', 'duration', 'boolean'
  description      TEXT,                              -- Human-readable description
  is_hot_reloadable VARCHAR(5) NOT NULL DEFAULT 'true', -- Can be changed without restart
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_category_key UNIQUE(category, key)
);
```

#### **Configuration Categories**:

| Category | Purpose | Examples |
|----------|---------|----------|
| `api_limits` | API call restrictions | `max_api_calls_tiktok: 1` |
| `qstash_delays` | Background job delays | `tiktok_continuation_delay: 2s` |
| `timeouts` | Job timeout settings | `standard_job_timeout: 60m` |
| `polling` | Frontend polling intervals | `status_check_interval: 5000` |
| `cache` | Cache duration settings | `image_cache_duration: 3600` |
| `processing` | Processing parameters | `batch_size: 5` |
| `cleanup` | Data retention rules | `completed_jobs_retention_days: 30` |

## 🔧 Core Implementation

### File: `lib/config/system-config.ts`

#### **Main Configuration Service**:
```typescript
export class SystemConfig {
  /**
   * Get a configuration value by category and key
   */
  static async get(category: string, key: string): Promise<any> {
    const cacheKey = `${category}.${key}`;
    
    // Step 1: Check in-memory cache
    const cached = cache.get(cacheKey);
    if (cached !== null) {
      console.log(`🔧 [CONFIG-CACHE] Using cached value for ${cacheKey}:`, cached);
      return cached;
    }
    
    console.log(`🔧 [CONFIG-DB] Loading from database: ${cacheKey}`);
    
    try {
      // Step 2: Query database
      const config = await db.query.systemConfigurations.findFirst({
        where: and(
          eq(systemConfigurations.category, category),
          eq(systemConfigurations.key, key)
        )
      });
      
      if (config) {
        // Step 3: Validate and convert value
        const validatedValue = validateValue(config.value, config.valueType);
        console.log(`🔧 [CONFIG-DB] Found in database: ${cacheKey} = ${config.value}`);
        
        // Step 4: Cache the result
        cache.set(cacheKey, validatedValue);
        return validatedValue;
      }
      
      // Step 5: Fall back to defaults
      console.log(`🔧 [CONFIG-DEFAULT] Using default for: ${cacheKey}`);
      const defaultConfig = DEFAULT_CONFIGS[cacheKey as ConfigKey];
      if (defaultConfig) {
        const validatedValue = validateValue(defaultConfig.value, defaultConfig.type);
        cache.set(cacheKey, validatedValue);
        return validatedValue;
      }
      
      throw new Error(`Configuration not found: ${category}.${key}`);
      
    } catch (error) {
      console.error(`[CONFIG] Error loading config ${category}.${key}:`, error);
      
      // Emergency fallback to defaults
      const defaultConfig = DEFAULT_CONFIGS[cacheKey as ConfigKey];
      if (defaultConfig) {
        return validateValue(defaultConfig.value, defaultConfig.type);
      }
      
      throw error;
    }
  }
}
```

### Default Configurations

#### **Built-in Default Values**:
```typescript
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
```

## 🔄 Value Processing & Validation

### Type Conversion System

#### **Duration Parser**:
```typescript
function parseDuration(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|ms)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${value}. Use format like "2s", "30s", "60m", "24h"`);
  }
  
  const [, num, unit] = match;
  const number = parseInt(num, 10);
  
  switch (unit) {
    case 'ms': return number;                    // milliseconds
    case 's': return number * 1000;             // seconds → ms
    case 'm': return number * 60 * 1000;        // minutes → ms
    case 'h': return number * 60 * 60 * 1000;   // hours → ms
    default: throw new Error(`Unsupported duration unit: ${unit}`);
  }
}
```

#### **Value Validation**:
```typescript
function validateValue(value: string, type: string): any {
  switch (type) {
    case 'number':
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`Invalid number value: ${value}`);
      }
      return num;
    
    case 'duration':
      return parseDuration(value); // Returns milliseconds
    
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        throw new Error(`Invalid boolean value: ${value}. Must be "true" or "false"`);
      }
      return value === 'true';
    
    default:
      throw new Error(`Unsupported value type: ${type}`);
  }
}
```

#### **Supported Value Types**:

| Type | Format | Examples | Converted To |
|------|--------|----------|--------------|
| `number` | Integer string | `"5"`, `"1000"` | `number` |
| `duration` | Time string | `"2s"`, `"60m"`, `"24h"` | `number` (milliseconds) |
| `boolean` | Boolean string | `"true"`, `"false"` | `boolean` |

## 💾 Caching System

### In-Memory Cache Implementation

#### **Cache Class**:
```typescript
class ConfigCache {
  private cache = new Map<string, CacheItem>();
  private readonly TTL_MS = 30 * 1000; // 30 seconds TTL

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
    
    // Check if expired
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
```

#### **Cache Benefits**:
- ✅ **Performance**: Avoids database queries for frequently accessed configs
- ✅ **Reliability**: Continues working if database is temporarily unavailable
- ✅ **Hot Reloading**: 30-second TTL ensures configs are refreshed regularly
- ✅ **Memory Efficient**: Automatic cleanup of expired entries

## 🎯 Usage Patterns

### Platform-Specific Configuration

#### **API Limits**:
```typescript
// In platform handlers
const MAX_API_CALLS = await SystemConfig.get('api_limits', 'max_api_calls_tiktok');
if (job.processedRuns >= MAX_API_CALLS) {
  console.log(`🚫 Reached API limit: ${MAX_API_CALLS}`);
  return await markJobCompleted(jobId);
}
```

#### **QStash Delays**:
```typescript
// In background job scheduling
const delay = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');
await qstash.publishJSON({
  url: callbackUrl,
  body: { jobId },
  delay: delay, // "2s" format used directly
  retries: 3
});
```

#### **Timeout Configuration**:
```typescript
// In job creation
const TIMEOUT_MS = await SystemConfig.get('timeouts', 'standard_job_timeout');
const timeoutAt = new Date(Date.now() + TIMEOUT_MS);

await db.insert(scrapingJobs).values({
  // ... other fields
  timeoutAt
});
```

### Convenience Functions

#### **Typed Configuration Getters**:
```typescript
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

// Usage examples
const tiktokApiLimit = await getApiLimit('tiktok');          // Returns: 1
const instagramDelay = await getQStashDelay('instagram');    // Returns: 30000 (ms)
const jobTimeout = await getJobTimeout('standard');         // Returns: 3600000 (ms)
```

## 🛠️ Configuration Management

### Setting Configuration Values

#### **Set Configuration**:
```typescript
static async set(
  category: string, 
  key: string, 
  value: string, 
  valueType: string, 
  description?: string
): Promise<void> {
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
        isHotReloadable: 'true',
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
    
    // Invalidate cache for immediate effect
    cache.invalidate(`${category}.${key}`);
    
    console.log(`[CONFIG] Updated configuration: ${category}.${key} = ${value}`);
  } catch (error) {
    console.error(`[CONFIG] Error setting config ${category}.${key}:`, error);
    throw error;
  }
}
```

#### **Usage Example**:
```typescript
// Increase TikTok API limit for production
await SystemConfig.set(
  'api_limits', 
  'max_api_calls_tiktok', 
  '999', 
  'number',
  'Production API call limit for TikTok'
);

// Set longer timeout for complex jobs
await SystemConfig.set(
  'timeouts',
  'instagram_job_timeout',
  '10m',
  'duration',
  'Extended timeout for Instagram jobs'
);
```

### Initialization System

#### **Default Configuration Setup**:
```typescript
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
        .onConflictDoNothing(); // Don't overwrite existing configs
    }
    
    console.log('[CONFIG] Default configurations initialized');
  } catch (error) {
    console.error('[CONFIG] Error initializing defaults:', error);
    throw error;
  }
}
```

## 📊 Admin Configuration Interface

### Configuration Management API

#### **Admin API Routes**:
```typescript
// GET /api/admin/config - List all configurations
export async function GET() {
  const configs = await SystemConfig.getAll();
  return NextResponse.json({ configs });
}

// POST /api/admin/config - Update configuration
export async function POST(request: Request) {
  const { category, key, value, valueType, description } = await request.json();
  
  await SystemConfig.set(category, key, value, valueType, description);
  
  return NextResponse.json({ 
    success: true, 
    message: `Configuration ${category}.${key} updated` 
  });
}

// DELETE /api/admin/config - Reset to default
export async function DELETE(request: Request) {
  const { category, key } = await request.json();
  
  await SystemConfig.delete(category, key);
  
  return NextResponse.json({ 
    success: true, 
    message: `Configuration ${category}.${key} reset to default` 
  });
}
```

### Frontend Configuration Panel

#### **Admin Configuration Component**:
```typescript
export function ConfigurationPanel() {
  const [configs, setConfigs] = useState<Record<string, SystemConfiguration[]>>({});
  const [editingConfig, setEditingConfig] = useState<string | null>(null);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    const response = await fetch('/api/admin/config');
    const data = await response.json();
    setConfigs(data.configs);
  };

  const updateConfiguration = async (category: string, key: string, value: string) => {
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, key, value, valueType: 'number' })
    });
    
    await loadConfigurations();
    SystemConfig.clearCache(); // Clear client-side cache
  };

  return (
    <div className="space-y-6">
      {Object.entries(configs).map(([category, categoryConfigs]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="capitalize">{category.replace('_', ' ')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryConfigs.map((config) => (
                <div key={`${config.category}.${config.key}`} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{config.key}</div>
                    <div className="text-sm text-gray-500">{config.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingConfig === `${config.category}.${config.key}` ? (
                      <Input
                        defaultValue={config.value}
                        onBlur={(e) => {
                          updateConfiguration(config.category, config.key, e.target.value);
                          setEditingConfig(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateConfiguration(config.category, config.key, e.currentTarget.value);
                            setEditingConfig(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span 
                        className="cursor-pointer hover:underline"
                        onClick={() => setEditingConfig(`${config.category}.${config.key}`)}
                      >
                        {config.value}
                      </span>
                    )}
                    <Badge variant="outline">{config.valueType}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## 🔍 Debugging & Monitoring

### Configuration Logging

#### **Comprehensive Debug Logs**:
```typescript
console.log(`🔧 [CONFIG-CACHE] Using cached value for ${cacheKey}:`, cached);
console.log(`🔧 [CONFIG-DB] Loading from database: ${cacheKey}`);
console.log(`🔧 [CONFIG-DB] Found in database: ${cacheKey} = ${config.value} (type: ${config.valueType})`);
console.log(`🔧 [CONFIG-DEFAULT] Not found in database, using default for: ${cacheKey}`);
console.log(`🔧 [CONFIG-DEFAULT] Using default value: ${cacheKey} = ${defaultConfig.value}`);
```

#### **Error Tracking**:
```typescript
console.error(`[CONFIG] Error loading config ${category}.${key}:`, error);
console.error(`[CONFIG] Error setting config ${category}.${key}:`, error);
console.error(`[CONFIG] Error deleting config ${category}.${key}:`, error);
```

### Performance Monitoring

#### **Cache Hit Rate Tracking**:
```typescript
class ConfigCache {
  private hits = 0;
  private misses = 0;

  get(key: string): any | null {
    const result = this.getFromCache(key);
    if (result !== null) {
      this.hits++;
      console.log(`📊 [CONFIG-CACHE] Hit rate: ${(this.hits / (this.hits + this.misses) * 100).toFixed(1)}%`);
    } else {
      this.misses++;
    }
    return result;
  }
}
```

## 🎯 Production Considerations

### Environment-Specific Configs

#### **Development vs Production**:
```typescript
// Development settings
await SystemConfig.set('api_limits', 'max_api_calls_tiktok', '1', 'number');
await SystemConfig.set('timeouts', 'standard_job_timeout', '60m', 'duration');

// Production settings  
await SystemConfig.set('api_limits', 'max_api_calls_tiktok', '999', 'number');
await SystemConfig.set('timeouts', 'standard_job_timeout', '24h', 'duration');
```

### Hot Reloading

#### **Live Configuration Updates**:
- ✅ **No Restart Required**: Changes take effect within 30 seconds
- ✅ **Cache Invalidation**: Manual cache clearing for immediate updates
- ✅ **Gradual Rollout**: Update configs in staging first, then production
- ✅ **Rollback Support**: Reset to defaults if issues occur

### Security Considerations

- 🔒 **Admin-Only Access**: Configuration changes restricted to admin users
- 🔒 **Input Validation**: All values validated before storage
- 🔒 **Audit Trail**: Track who changed what configurations
- 🔒 **Safe Defaults**: Always fall back to safe default values

---

**Impact**: The system configuration management enables dynamic operational control without code deployments, allowing real-time adjustment of API limits, timeouts, and performance parameters based on system load and requirements.