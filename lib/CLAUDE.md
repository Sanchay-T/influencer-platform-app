# 🛠️ Library Documentation - Influencer Platform

## Overview

The `/lib` directory contains the core business logic, services, and utilities that power the multi-platform influencer discovery system. This documentation covers the database layer, platform integrations, authentication services, billing system, background job processing, and utility functions.

## 📁 Directory Structure

```
lib/
├── auth/                    # Authentication utilities
├── config/                  # System configuration management
├── db/                      # Database layer (Drizzle ORM)
├── email/                   # Email services and templates
├── events/                  # Event sourcing system
├── hooks/                   # React hooks for frontend
├── jobs/                    # Background job processing
├── loggers/                 # Logging services
├── migrations/              # Database migration scripts
├── platforms/               # Platform-specific integrations
├── queue/                   # QStash integration
├── services/                # Core business services
├── stripe/                  # Payment processing
├── trial/                   # Trial system management
└── utils/                   # Utility functions
```

---

## 🗄️ Database Layer

### Core Schema (`/lib/db/schema.ts`)

The platform uses **Drizzle ORM** with PostgreSQL, featuring 10 core tables supporting campaigns, scraping jobs, user management, billing, and event sourcing.

#### Key Tables:

**Campaigns & Jobs:**
```typescript
// Campaign management
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  searchType: varchar('search_type', { length: 20 }).notNull(), // 'keyword' | 'similar'
  status: varchar('status', { length: 20 }).default('draft')
});

// Background scraping jobs
export const scrapingJobs = pgTable('scraping_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: varchar('platform', { length: 50 }).notNull(), // 'TikTok' | 'Instagram' | 'YouTube'
  status: varchar('status', { length: 20 }).default('pending'),
  keywords: jsonb('keywords'),           // For keyword search
  targetUsername: text('target_username'), // For similar search
  processedRuns: integer('processed_runs').default(0),
  processedResults: integer('processed_results').default(0),
  targetResults: integer('target_results').default(1000),
  progress: numeric('progress').default('0'),
  cursor: integer('cursor').default(0)
});

// Search results storage
export const scrapingResults = pgTable('scraping_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => scrapingJobs.id),
  creators: jsonb('creators').notNull() // Platform-specific creator data
});
```

**User & Billing System:**
```typescript
// User profiles with billing integration
export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').unique(), // Clerk user ID
  // Trial system
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),
  trialStatus: varchar('trial_status').default('pending'),
  // Subscription management
  currentPlan: varchar('current_plan').default('free'),
  subscriptionStatus: varchar('subscription_status').default('none'),
  stripeCustomerId: text('stripe_customer_id'),
  // Usage tracking
  usageCampaignsCurrent: integer('usage_campaigns_current').default(0),
  usageCreatorsCurrentMonth: integer('usage_creators_current_month').default(0),
  // Admin system
  isAdmin: boolean('is_admin').default(false)
});

// Subscription plan definitions
export const subscriptionPlans = pgTable('subscription_plans', {
  planKey: varchar('plan_key').unique(), // 'glow_up' | 'viral_surge' | 'fame_flex'
  campaignsLimit: integer('campaigns_limit').notNull(),
  creatorsLimit: integer('creators_limit').notNull(),
  monthlyPrice: integer('monthly_price').notNull(), // in cents
  features: jsonb('features').default('{}')
});
```

**System Configuration:**
```typescript
// Dynamic system configuration
export const systemConfigurations = pgTable('system_configurations', {
  category: varchar('category', { length: 50 }).notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value').notNull(),
  valueType: varchar('value_type', { length: 20 }).notNull(), // 'number' | 'duration' | 'boolean'
  isHotReloadable: varchar('is_hot_reloadable').default('true')
});
```

### Database Connection (`/lib/db/index.ts`)

**Optimized for Serverless:**
```typescript
// Global connection pooling for Vercel serverless functions
const queryClient = global.__queryClient ?? postgres(connectionString, {
  idle_timeout: isLocal ? 120 : 30,
  max_lifetime: isLocal ? 60 * 60 * 2 : 60 * 60,
  max: isLocal ? 10 : 5,
  connect_timeout: isLocal ? 30 : 10
});

export const db = global.__db ?? drizzle(queryClient, { schema });
```

**Features:**
- ✅ Connection pooling with global caching
- ✅ Environment-specific settings (local vs production)
- ✅ Automatic connection reuse across serverless invocations
- ✅ Built-in diagnostics and connection analysis

---

## 🌐 Platform Integrations

### Architecture Overview

Each platform follows a consistent modular structure:

```
lib/platforms/{platform}/
├── types.ts       # TypeScript interfaces
├── api.ts         # External API calls
├── transformer.ts # Data transformation
└── handler.ts     # Background processing logic
```

### Supported Platforms:

| Platform | Keyword Search | Similar Search | API Client |
|----------|---------------|----------------|------------|
| **TikTok** | ✅ | ✅ | ScrapeCreators API |
| **Instagram** | ✅ (Reels) | ✅ | ScrapeCreators + RapidAPI |
| **YouTube** | ✅ | ✅ | ScrapeCreators API |

### TikTok Similar Search (`/lib/platforms/tiktok-similar/`)

**API Integration (`api.ts`):**
```typescript
export async function getTikTokProfile(handle: string): Promise<TikTokProfileResponse> {
  const url = `${BASE_URL}/v1/tiktok/profile?handle=${encodeURIComponent(handle)}`;
  
  const response = await fetch(url, {
    headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! },
    signal: AbortSignal.timeout(30000)
  });
  
  // Enhanced bio & email extraction
  const bio = jsonData.user.signature || '';
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  const extractedEmails = bio.match(emailRegex) || [];
  
  return jsonData;
}

export async function searchTikTokUsers(keyword: string, cursor: number = 0): Promise<TikTokUserSearchResponse> {
  const url = `${BASE_URL}/v1/tiktok/search/users?query=${encodeURIComponent(keyword)}&cursor=${cursor}`;
  // ... API call implementation
}
```

**Data Transformation (`transformer.ts`):**
```typescript
export async function transformTikTokUserWithEnhancedBio(userItem: any, searchKeyword: string) {
  let bio = userInfo.search_user_desc || '';
  
  // Enhanced profile fetching with timeout
  try {
    const profileData = await Promise.race([
      getTikTokProfile(userInfo.unique_id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
    
    bio = profileData.user?.signature || bio;
  } catch (profileError) {
    console.log(`⚠️ [ENHANCED-BIO] Failed to fetch profile: ${profileError.message}`);
  }
  
  // Email extraction
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  const extractedEmails = bio.match(emailRegex) || [];
  
  return {
    id: userInfo.uid,
    username: userInfo.unique_id,
    full_name: userInfo.nickname,
    bio: bio,
    emails: extractedEmails,
    platform: 'TikTok'
  };
}
```

**Background Processing (`handler.ts`):**
```typescript
export async function processTikTokSimilarJob(job: any, jobId: string) {
  // Step 1: Get target user profile
  const profileData = await getTikTokProfile(job.targetUsername);
  
  // Step 2: Extract search keywords from profile
  const keywords = extractSearchKeywords(profileData);
  
  // Step 3: Search for similar users
  const searchResults = await searchTikTokUsers(keywords[0]);
  
  // Step 4: Transform with enhanced bio/email extraction
  const creators = await Promise.all(
    searchResults.users.map(user => transformTikTokUserWithEnhancedBio(user, keyword))
  );
  
  return creators;
}
```

### Platform-Specific Features:

**TikTok:**
- ✅ HEIC image conversion
- ✅ Enhanced bio fetching for email extraction
- ✅ CDN bypass strategies
- ✅ Rate limiting with delays

**Instagram:**
- ✅ Reels search integration
- ✅ Parallel bio enhancement processing
- ✅ Live intermediate results
- ✅ RapidAPI integration

**YouTube:**
- ✅ Channel-based similarity matching
- ✅ Social media links extraction
- ✅ Subscriber count and engagement metrics

---

## 🔐 Authentication & Admin System

### Admin Utilities (`/lib/auth/admin-utils.ts`)

**Dual Admin System:**
```typescript
// Environment-based admin check
export function isEnvironmentAdmin(email: string): boolean {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(email);
}

// Database-based admin check
export async function isDatabaseAdmin(userId: string): boolean {
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId)
  });
  return userProfile?.isAdmin === true;
}

// Combined admin verification
export async function isAdmin(user: { id: string; emailAddresses?: { emailAddress: string }[] }): Promise<boolean> {
  if (!user?.emailAddresses?.[0]) return false;
  
  const email = user.emailAddresses[0].emailAddress;
  const isEnvAdmin = isEnvironmentAdmin(email);
  const isDbAdmin = await isDatabaseAdmin(user.id);
  
  return isEnvAdmin || isDbAdmin;
}
```

**Admin Features:**
- ✅ Environment and database-based admin roles
- ✅ Admin user promotion capabilities
- ✅ System configuration management
- ✅ User management and audit logging

---

## 💳 Billing & Subscription System

### Plan Validation (`/lib/services/plan-validator.ts`)

**Comprehensive Plan Management:**
```typescript
export interface PlanConfig {
  id: string;
  name: string;
  campaignsLimit: number; // -1 for unlimited
  creatorsLimit: number;  // -1 for unlimited
  features: {
    analytics: 'basic' | 'advanced';
    support: 'email' | 'priority';
    api: boolean;
    exports: boolean;
    realtime: boolean;
  };
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  'free': { campaignsLimit: 0, creatorsLimit: 0 },
  'glow_up': { campaignsLimit: 3, creatorsLimit: 1000 },
  'viral_surge': { campaignsLimit: 10, creatorsLimit: 10000 },
  'fame_flex': { campaignsLimit: -1, creatorsLimit: -1 } // Unlimited
};
```

**Validation Methods:**
```typescript
// Campaign creation validation
static async validateCampaignCreation(userId: string): Promise<ValidationResult> {
  const planStatus = await this.getUserPlanStatus(userId);
  
  if (!planStatus.isActive) {
    return {
      allowed: false,
      reason: 'Please upgrade to create campaigns.',
      upgradeRequired: true
    };
  }
  
  if (planStatus.campaignsUsed >= planStatus.planConfig.campaignsLimit) {
    return {
      allowed: false,
      reason: `You've reached your campaign limit (${planStatus.planConfig.campaignsLimit})`,
      recommendedPlan: this.getRecommendedPlan('campaigns', planStatus.campaignsUsed + 1)
    };
  }
  
  return { allowed: true };
}

// Creator search validation
static async validateCreatorSearch(userId: string, estimatedResults: number): Promise<ValidationResult> {
  // Similar validation logic for creator searches
}
```

### Trial System (`/lib/trial/trial-service.ts`)

**7-Day Trial Management:**
```typescript
export interface TrialData {
  userId: string;
  trialStatus: 'pending' | 'active' | 'expired' | 'cancelled' | 'converted';
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  progressPercentage: number;
  currentPlan: 'free' | 'glow_up' | 'viral_surge' | 'fame_flex';
}

// Start trial with billing integration
export async function startTrial(userId: string): Promise<TrialData> {
  const trialStartDate = new Date();
  const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  await db.update(userProfiles).set({
    trialStartDate,
    trialEndDate,
    trialStatus: 'active',
    subscriptionStatus: 'trialing'
  }).where(eq(userProfiles.userId, userId));
  
  return calculateTrialData(userId, trialStartDate, trialEndDate);
}

// Real-time countdown calculation
export function calculateCountdown(trialStartDate: Date, trialEndDate: Date): CountdownData {
  const now = new Date();
  const timeDiff = trialEndDate.getTime() - now.getTime();
  
  if (timeDiff <= 0) {
    return { daysRemaining: 0, isExpired: true };
  }
  
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { daysRemaining: days, hoursRemaining: hours, minutesRemaining: minutes };
}
```

### Performance-Optimized Billing Hook (`/lib/hooks/use-billing-cached.ts`)

**localStorage Caching:**
```typescript
export function useBillingCached(): BillingStatus & { isLoading: boolean } {
  // Load cached data immediately
  useEffect(() => {
    const cached = localStorage.getItem(BILLING_CACHE_KEY);
    if (cached && isValidCache(cached, userId)) {
      setBillingStatus(cachedData);
      setIsLoading(false);
    }
  }, [userId]);
  
  // Fetch fresh data in background
  useEffect(() => {
    fetchBillingStatus(); // Updates cache and state
  }, [isLoaded, userId]);
  
  return { ...billingStatus, isLoading };
}
```

**Features:**
- ✅ 2-minute cache duration with graceful fallbacks
- ✅ Background data updates
- ✅ Performance monitoring integration
- ✅ Instant loading experience

---

## ⚙️ System Configuration

### Dynamic Configuration (`/lib/config/system-config.ts`)

**Hot-Reloadable Settings:**
```typescript
const DEFAULT_CONFIGS = {
  'api_limits.max_api_calls_tiktok': { value: '1', type: 'number' },
  'qstash_delays.tiktok_continuation_delay': { value: '2s', type: 'duration' },
  'timeouts.standard_job_timeout': { value: '60m', type: 'duration' },
  'polling.frontend_status_check_interval': { value: '5000', type: 'number' }
};

export class SystemConfig {
  static async get(category: string, key: string): Promise<any> {
    // Check in-memory cache first
    const cached = cache.get(`${category}.${key}`);
    if (cached !== null) return cached;
    
    // Load from database
    const config = await db.query.systemConfigurations.findFirst({
      where: and(
        eq(systemConfigurations.category, category),
        eq(systemConfigurations.key, key)
      )
    });
    
    if (config) {
      const validatedValue = validateValue(config.value, config.valueType);
      cache.set(`${category}.${key}`, validatedValue);
      return validatedValue;
    }
    
    // Fallback to defaults
    const defaultConfig = DEFAULT_CONFIGS[`${category}.${key}`];
    return validateValue(defaultConfig.value, defaultConfig.type);
  }
}
```

**Configuration Categories:**
- **API Limits:** `max_api_calls_tiktok`, `max_api_calls_instagram`
- **QStash Delays:** `tiktok_continuation_delay`, `instagram_reels_delay`
- **Timeouts:** `standard_job_timeout`, `cleanup_timeout_hours`
- **Polling:** `frontend_status_check_interval`, `campaign_status_interval`
- **Cache:** `image_cache_success_duration`

---

## 🖼️ Image Processing & Caching

### Universal Image Cache (`/lib/services/image-cache.ts`)

**Vercel Blob Storage Integration:**
```typescript
export class ImageCache {
  async getCachedImageUrl(originalUrl: string, platform: string, userId?: string): Promise<string> {
    const cacheKey = await this.generateCacheKey(originalUrl, platform, userId);
    
    // Check if already cached
    const { blobs } = await list({ prefix: cacheKey.split('/')[0] + '/' });
    const existing = blobs.find(blob => blob.pathname === cacheKey);
    if (existing) return existing.url;
    
    // Download and cache
    return await this.downloadAndCache(originalUrl, cacheKey, platform);
  }
  
  private async downloadAndCache(url: string, cacheKey: string, platform: string): Promise<string> {
    // Platform-specific headers
    const headers = platform === 'TikTok' ? {
      'User-Agent': 'Mozilla/5.0...',
      'Referer': 'https://www.tiktok.com/'
    } : { 'User-Agent': 'Mozilla/5.0...' };
    
    let buffer = Buffer.from(await response.arrayBuffer());
    
    // Convert HEIC to JPEG if needed
    if (url.includes('.heic')) {
      const convert = require('heic-convert');
      buffer = Buffer.from(await convert({ buffer, format: 'JPEG', quality: 0.85 }));
    }
    
    // Store in Vercel Blob
    const blob = await put(cacheKey, buffer, {
      access: 'public',
      contentType: 'image/jpeg'
    });
    
    return blob.url; // Permanent URL
  }
}
```

**Features:**
- ✅ Permanent storage in Vercel Blob
- ✅ HEIC to JPEG conversion
- ✅ Platform-specific headers for CDN bypass
- ✅ MD5-based cache keys
- ✅ Graceful fallback to proxy system

---

## 🔄 Background Job System

### QStash Integration (`/lib/queue/qstash.ts`)

**Simple QStash Client:**
```typescript
import { Client } from '@upstash/qstash';

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!
});
```

### Job Processing (`/lib/jobs/job-processor.ts`)

**Centralized Job Processing:**
```typescript
export class JobProcessor {
  static async processScrapingJob(jobId: string): Promise<void> {
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId)
    });
    
    if (!job) throw new Error('Job not found');
    
    // Route to platform-specific handler
    switch (job.platform) {
      case 'TikTok':
        if (job.targetUsername) {
          return await processTikTokSimilarJob(job, jobId);
        } else {
          return await processTikTokKeywordJob(job, jobId);
        }
      case 'Instagram':
        return await processInstagramJob(job, jobId);
      case 'YouTube':
        return await processYouTubeJob(job, jobId);
      default:
        throw new Error(`Unsupported platform: ${job.platform}`);
    }
  }
}
```

---

## 📧 Email System

### Email Service (`/lib/email/email-service.ts`)

**Resend Integration:**
```typescript
export class EmailService {
  static async sendTrialWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: userEmail,
      subject: 'Welcome to your 7-day trial!',
      html: generateWelcomeEmailHtml(userName)
    });
  }
  
  static async scheduleTrialEmails(userId: string, userEmail: string): Promise<void> {
    // Schedule day 2 reminder
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/email/trial-reminder`,
      body: { userId, userEmail, type: 'day2' },
      delay: '2d'
    });
    
    // Schedule day 5 reminder
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/email/trial-reminder`,
      body: { userId, userEmail, type: 'day5' },
      delay: '5d'
    });
  }
}
```

---

## 🔧 Utility Functions

### Performance Monitor (`/lib/utils/performance-monitor.ts`)

**Real-time Performance Tracking:**
```typescript
export const perfMonitor = {
  startTimer(operation: string, context?: any): string {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    this.timers.set(timerId, { 
      operation, 
      startTime: performance.now(), 
      context 
    });
    return timerId;
  },
  
  endTimer(timerId: string, result?: any): void {
    const timer = this.timers.get(timerId);
    if (!timer) return;
    
    const duration = performance.now() - timer.startTime;
    console.log(`⚡ [PERF] ${timer.operation}: ${duration.toFixed(2)}ms`, {
      context: timer.context,
      result
    });
    
    this.timers.delete(timerId);
  }
};
```

### Frontend Logger (`/lib/utils/frontend-logger.ts`)

**Structured Logging:**
```typescript
export const frontendLogger = {
  info: (message: string, context?: any) => {
    console.log(`ℹ️ [FRONTEND] ${message}`, context);
  },
  
  error: (message: string, error?: any, context?: any) => {
    console.error(`❌ [FRONTEND] ${message}`, { error, context });
  },
  
  performance: (operation: string, duration: number, context?: any) => {
    console.log(`⚡ [PERF] ${operation}: ${duration}ms`, context);
  }
};
```

---

## 🔍 Common Patterns

### Error Handling Pattern

```typescript
try {
  const result = await performOperation();
  await Logger.logSuccess('OPERATION', 'Operation completed', userId, result);
  return result;
} catch (error) {
  await Logger.logError('OPERATION_FAILED', 'Operation failed', userId, {
    errorMessage: error.message,
    recoverable: true
  });
  throw error;
}
```

### Database Transaction Pattern

```typescript
const result = await db.transaction(async (tx) => {
  // Update user profile
  await tx.update(userProfiles).set(updateData).where(eq(userProfiles.userId, userId));
  
  // Log the change
  await tx.insert(events).values({
    aggregateId: userId,
    eventType: 'profile_updated',
    eventData: updateData
  });
  
  return updatedProfile;
});
```

### Configuration Usage Pattern

```typescript
// Get configuration value with fallback
const apiLimit = await SystemConfig.get('api_limits', 'max_api_calls_tiktok');
const delay = await getQStashDelay('tiktok_continuation');
const timeout = await getJobTimeout('standard_job');
```

---

## 🌟 Key Features & Benefits

### Performance Optimizations
- ✅ **Connection Pooling:** Global database connections for serverless
- ✅ **localStorage Caching:** 2-minute billing cache for instant loading
- ✅ **Image Caching:** Permanent Vercel Blob storage
- ✅ **Hot Configuration:** Dynamic system settings without deployment

### Reliability & Monitoring
- ✅ **Comprehensive Logging:** BillingLogger with request tracking
- ✅ **Performance Monitoring:** Real-time timing and benchmarks
- ✅ **Error Recovery:** Graceful fallbacks and retry mechanisms
- ✅ **Event Sourcing:** Complete audit trail of system events

### Scalability Features
- ✅ **Background Processing:** QStash for async job handling
- ✅ **Platform Modularity:** Easy addition of new social platforms
- ✅ **Rate Limiting:** Configurable API call limits
- ✅ **Usage Tracking:** Real-time billing and limit enforcement

### Developer Experience
- ✅ **TypeScript First:** Full type safety across all modules
- ✅ **Modular Architecture:** Clear separation of concerns
- ✅ **Comprehensive Testing:** Utilities for subscription and billing tests
- ✅ **Rich Logging:** Detailed debugging and monitoring information

---

## 📊 Usage Examples

### Creating a New Scraping Job
```typescript
import { db } from '@/lib/db';
import { scrapingJobs } from '@/lib/db/schema';
import { PlanValidator } from '@/lib/services/plan-validator';

// Validate user can create campaign
const validation = await PlanValidator.validateCampaignCreation(userId);
if (!validation.allowed) {
  throw new Error(validation.reason);
}

// Create the job
const job = await db.insert(scrapingJobs).values({
  userId,
  platform: 'TikTok',
  keywords: ['fashion', 'style'],
  targetResults: 1000,
  status: 'pending'
}).returning();

// Increment usage
await PlanValidator.incrementUsage(userId, 'campaigns', 1);
```

### Getting User Billing Status
```typescript
import { useBillingCached } from '@/lib/hooks/use-billing-cached';

// In React component
const billing = useBillingCached();

if (billing.hasFeature('csv_export')) {
  // Show export button
}

if (billing.needsUpgrade) {
  // Show upgrade prompt
}
```

### Processing Platform Data
```typescript
import { processTikTokSimilarJob } from '@/lib/platforms/tiktok-similar/handler';
import { SystemConfig } from '@/lib/config/system-config';

// Get configuration
const apiLimit = await SystemConfig.get('api_limits', 'max_api_calls_tiktok');

// Process job with configuration
const results = await processTikTokSimilarJob(job, jobId);
```

---

This library layer provides the foundation for a scalable, maintainable influencer discovery platform with comprehensive business logic, robust error handling, and excellent developer experience.