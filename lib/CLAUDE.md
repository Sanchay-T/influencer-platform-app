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

The platform uses **Drizzle ORM** with PostgreSQL, featuring 15+ tables supporting campaigns, scraping jobs, **normalized user management**, billing, event sourcing, and background job processing.

#### **🔄 MAJOR UPDATE: Database Normalization**

The monolithic `user_profiles` table has been **replaced with 5 normalized tables** for better data integrity, performance, and maintainability:

**NEW Normalized User System:**
```typescript
// 1. USERS - Core identity and profile information
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').unique().notNull(), // External auth ID (Clerk)
  email: text('email'),
  fullName: text('full_name'),
  businessName: text('business_name'),
  brandDescription: text('brand_description'),
  industry: text('industry'),
  onboardingStep: varchar('onboarding_step', { length: 50 }).default('pending').notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
});

// 2. USER_SUBSCRIPTIONS - Trial and subscription management
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currentPlan: varchar('current_plan', { length: 50 }).default('free').notNull(),
  intendedPlan: varchar('intended_plan', { length: 50 }), // ✨ NEW: Plan selected before checkout
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('none').notNull(),
  trialStatus: varchar('trial_status', { length: 20 }).default('pending').notNull(),
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),
  trialConversionDate: timestamp('trial_conversion_date'), // ✨ NEW: Conversion tracking
  subscriptionCancelDate: timestamp('subscription_cancel_date'),
  subscriptionRenewalDate: timestamp('subscription_renewal_date'),
  billingSyncStatus: varchar('billing_sync_status', { length: 20 }).default('pending').notNull(),
});

// 3. USER_BILLING - Stripe payment data (Clerk artifacts removed)
export const userBilling = pgTable('user_billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  paymentMethodId: text('payment_method_id'),
  cardLast4: varchar('card_last_4', { length: 4 }),
  cardBrand: varchar('card_brand', { length: 20 }),
  cardExpMonth: integer('card_exp_month'),
  cardExpYear: integer('card_exp_year'),
  billingAddressCity: text('billing_address_city'),
  billingAddressCountry: varchar('billing_address_country', { length: 2 }),
  billingAddressPostalCode: varchar('billing_address_postal_code', { length: 20 }),
});

// 4. USER_USAGE - Usage tracking and plan limits
export const userUsage = pgTable('user_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planCampaignsLimit: integer('plan_campaigns_limit'),
  planCreatorsLimit: integer('plan_creators_limit'),
  planFeatures: jsonb('plan_features').default('{}').notNull(),
  usageCampaignsCurrent: integer('usage_campaigns_current').default(0).notNull(),
  usageCreatorsCurrentMonth: integer('usage_creators_current_month').default(0).notNull(),
  usageResetDate: timestamp('usage_reset_date').defaultNow().notNull(),
});

// 5. USER_SYSTEM_DATA - System metadata and webhook tracking
export const userSystemData = pgTable('user_system_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  signupTimestamp: timestamp('signup_timestamp').defaultNow().notNull(),
  emailScheduleStatus: jsonb('email_schedule_status').default('{}').notNull(),
  lastWebhookEvent: varchar('last_webhook_event', { length: 100 }),
  lastWebhookTimestamp: timestamp('last_webhook_timestamp'),
});
```

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

**Enhanced System Tables:**
```typescript
// Event Sourcing table for tracking all state changes (Industry Standard)
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  aggregateId: text('aggregate_id').notNull(), // User ID, Job ID, etc.
  aggregateType: varchar('aggregate_type', { length: 50 }).notNull(), // 'user', 'subscription', 'onboarding'
  eventType: varchar('event_type', { length: 100 }).notNull(), // 'subscription_created', 'onboarding_completed'
  eventData: jsonb('event_data').notNull(), // Full event payload
  idempotencyKey: text('idempotency_key').notNull().unique(), // Prevent duplicate processing
  sourceSystem: varchar('source_system', { length: 50 }).notNull(), // 'stripe_webhook', 'admin_action', 'user_action'
});

// Background Jobs table for QStash job tracking (Industry Standard)
export const backgroundJobs = pgTable('background_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobType: varchar('job_type', { length: 100 }).notNull(), // 'complete_onboarding', 'send_trial_email'
  payload: jsonb('payload').notNull(), // Job data
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  qstashMessageId: text('qstash_message_id'), // QStash message ID for tracking
  priority: integer('priority').notNull().default(100),
  maxRetries: integer('max_retries').notNull().default(3),
});

// Subscription Plans table - Plan configuration and limits
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  planKey: varchar('plan_key', { length: 50 }).notNull().unique(), // 'glow_up' | 'viral_surge' | 'fame_flex'
  displayName: text('display_name').notNull(), // 'Glow Up Plan'
  monthlyPrice: integer('monthly_price').notNull(), // Price in cents (9900 = $99.00)
  stripeMonthlaPriceId: text('stripe_monthly_price_id').notNull(),
  campaignsLimit: integer('campaigns_limit').notNull(),
  creatorsLimit: integer('creators_limit').notNull(),
  features: jsonb('features').default('{}'),
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

### Creator List Query Layer (`/lib/db/queries/list-queries.ts`)

This module encapsulates all CRUD operations for the creator list system used across search results and the dedicated list views.

```ts
// Public helpers
getListsForUser(clerkUserId)
getListDetail(clerkUserId, listId)
createList(clerkUserId, input)
updateList(clerkUserId, listId, updates)
deleteList(clerkUserId, listId)
addCreatorsToList(clerkUserId, listId, creators)
updateListItems(clerkUserId, listId, updates)
removeListItems(clerkUserId, listId, itemIds)
duplicateList(clerkUserId, listId, name?)
recordExport(clerkUserId, listId, format)
```

### **🆕 Dashboard Query Layer (`/lib/db/queries/dashboard-queries.ts`)**

**Specialized Dashboard Data Access:**

Provides optimized queries for dashboard functionality with proper data transformations:

```typescript
// Main dashboard queries
export async function getFavoriteInfluencersForDashboard(
  clerkUserId: string,
  limit = 10
): Promise<DashboardFavoriteInfluencer[]>

export async function getSearchTelemetryForDashboard(
  clerkUserId: string,
  lookbackDays = 30
): Promise<SearchTelemetrySummary>

// Internal utilities
resolveInternalUserId(clerkUserId: string): Promise<string>
nonArchivedFavoritesFilter(userId: string): SQLWrapper
resolveProfileUrl(storedUrl, handle, platform, metadata): string | null
```

**Key Features:**
- ✅ **Favorite Influencers**: Queries pinned/favorite creators from lists with proper filtering
- ✅ **Search Telemetry**: Aggregates job performance metrics for dashboard insights
- ✅ **Profile URL Resolution**: Smart fallback system for creator profile links
- ✅ **Platform Normalization**: Consistent platform naming and URL generation
- ✅ **User ID Translation**: Handles Clerk → internal user ID mapping
- ✅ **Complex Filtering**: Supports archived/favorite status, collaborator access, and pinning

**Highlights**
- ♻️ **Profile Upserts** – `addCreatorsToList` reuses or refreshes `creator_profiles` records so lists share canonical creator metadata.
- 📦 **Bulk Actions** – APIs accept arrays, enabling multi-select/multi-drag flows from the UI.
- 🔄 **Ordering & Buckets** – Drag-and-drop state persists via `updateListItems`, normalizing positions per bucket.
- 🔐 **Role Checks** – Access is constrained to owners/editors; privacy flags were removed in favor of collaborator roles.
- 🗑️ **Clean Deletes** – List deletion now relies on cascading FKs only (activity logging removed) to avoid post-delete FK violations.

### **🆕 User Query Layer (`/lib/db/queries/user-queries.ts`)**

**Comprehensive User Data Access System:**

The new query layer provides **backward compatibility** for the normalized user tables while offering optimized queries for specific use cases:

```typescript
/**
 * Get complete user profile (replaces old userProfiles queries)
 * Joins all 5 normalized tables into a single UserProfileComplete object
 */
export async function getUserProfile(userId: string): Promise<UserProfileComplete | null> {
  const result = await db
    .select({
      // Core user data
      id: users.id,
      userId: users.userId,
      email: users.email,
      fullName: users.fullName,
      businessName: users.businessName,
      // ... all fields from all 5 tables
    })
    .from(users)
    .leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
    .leftJoin(userBilling, eq(users.id, userBilling.userId))
    .leftJoin(userUsage, eq(users.id, userUsage.userId))
    .leftJoin(userSystemData, eq(users.id, userSystemData.userId))
    .where(eq(users.userId, userId));
    
  // Transform and return with proper defaults
  return transformToUserProfileComplete(result[0]);
}

/**
 * Create new user with all related records
 * Replaces user_profiles INSERT operations with transaction across 4 tables
 */
export async function createUser(userData: {
  userId: string;
  email?: string;
  // ... other fields
}): Promise<UserProfileComplete> {
  return db.transaction(async (tx) => {
    // 1. Insert core user data
    const [newUser] = await tx.insert(users).values({...}).returning();
    
    // 2. Insert subscription data
    const [newSubscription] = await tx.insert(userSubscriptions).values({...}).returning();
    
    // 3. Insert usage tracking
    const [newUsage] = await tx.insert(userUsage).values({...}).returning();
    
    // 4. Insert system data
    const [newSystemData] = await tx.insert(userSystemData).values({...}).returning();
    
    return combineUserProfile(newUser, newSubscription, newUsage, newSystemData);
  });
}

/**
 * Update user profile across normalized tables
 * Intelligently routes updates to appropriate tables
 */
export async function updateUserProfile(userId: string, updates: {
  // Core user updates
  email?: string;
  fullName?: string;
  // Subscription updates
  currentPlan?: string;
  intendedPlan?: string;
  // Billing updates
  stripeCustomerId?: string;
  // Usage updates
  usageCampaignsCurrent?: number;
  // System updates
  lastWebhookEvent?: string;
}): Promise<void> {
  return db.transaction(async (tx) => {
    // Split updates by table and apply to appropriate normalized tables
  });
}

/**
 * Optimized queries for specific use cases:
 */

// Get only billing info (for Stripe webhooks)
export async function getUserBilling(userId: string): Promise<UserBilling | null>

// Get only usage info (for plan validation)
export async function getUserUsage(userId: string): Promise<UserUsage | null>

// Increment usage counters (optimized for high-frequency operations)
export async function incrementUsage(userId: string, type: 'campaigns' | 'creators', amount: number): Promise<void>

// Find user by Stripe customer ID (for webhook processing)
export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<UserProfileComplete | null>
```

**Key Benefits of the New Query Layer:**
- ✅ **Backward Compatibility**: Existing code continues to work
- ✅ **Performance Optimization**: Specific queries only join necessary tables
- ✅ **Data Integrity**: All updates use transactions
- ✅ **Type Safety**: Full TypeScript support with proper types
- ✅ **Specialized Functions**: Optimized queries for common use cases (billing, usage, webhooks)
- ✅ **Error Handling**: Comprehensive error handling and graceful degradation

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

### **🔄 UPDATED: Plan Validation (`/lib/services/plan-validator.ts`)**

**Enhanced Plan Management with Database Integration:**

The plan validator now integrates with the **normalized user tables** and **database-driven subscription plans**:

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

// Legacy defaults kept as fallback for features only; limits now come from DB subscription_plans
export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  'free': { campaignsLimit: 0, creatorsLimit: 0 },
  'glow_up': { campaignsLimit: 3, creatorsLimit: 1000 },
  'viral_surge': { campaignsLimit: 10, creatorsLimit: 10000 },
  'fame_flex': { campaignsLimit: -1, creatorsLimit: -1 } // Unlimited
};
```

**🆕 Database-Driven Plan Resolution:**
```typescript
/**
 * Get comprehensive user plan status from database
 * Now uses normalized user tables and database subscription plans
 */
static async getUserPlanStatus(userId: string, requestId?: string): Promise<UserPlanStatus | null> {
  // Get user profile using NEW normalized tables
  const userProfile = await getUserProfile(userId);
  
  // Get plan config: resolve limits from subscription_plans (DB), fallback features from legacy map
  const currentPlan = userProfile.currentPlan || 'free';
  const planDefaults = PLAN_CONFIGS[currentPlan] || PLAN_CONFIGS['free'];

  let campaignsLimit = planDefaults.campaignsLimit;
  let creatorsLimit = planDefaults.creatorsLimit;
  
  // 🆕 ENHANCED: Load limits from database subscription_plans table
  try {
    const planRow = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.planKey, currentPlan)
    });
    if (planRow) {
      campaignsLimit = planRow.campaignsLimit ?? campaignsLimit;
      creatorsLimit = planRow.creatorsLimit ?? creatorsLimit;
    }
  } catch (e) {
    // keep defaults if DB lookup fails
  }
  
  // 🔒 SECURITY: Enhanced onboarding verification for paid plans
  const onboardingComplete = userProfile.onboardingStep === 'completed';
  const isPaidPlan = currentPlan !== 'free';
  
  // 🚨 CRITICAL: Paid plans require BOTH valid subscription AND completed onboarding
  const isActive = isPaidPlan 
    ? ((hasActiveSubscription || hasTrialingSubscription) && onboardingComplete)
    : (hasActiveSubscription || isTrialing);
    
  return {
    userId,
    currentPlan,
    planConfig: { id: currentPlan, name: planDefaults.name, campaignsLimit, creatorsLimit, features: planDefaults.features },
    isActive,
    campaignsUsed: userProfile.usageCampaignsCurrent || 0,
    creatorsUsed: userProfile.usageCreatorsCurrentMonth || 0,
    // ... other status fields
  };
}
```

**🆕 Enhanced Security & Onboarding Integration:**
```typescript
// Campaign creation validation with enhanced security
static async validateCampaignCreation(userId: string, requestId?: string): Promise<ValidationResult> {
  const planStatus = await this.getUserPlanStatus(userId, requestId);
  
  if (!planStatus.isActive) {
    // 🔒 SECURITY: Special handling for paid plans without completed onboarding
    const isPaidPlan = planStatus.currentPlan !== 'free';
    const hasPayment = /* check for active/trialing subscription */;
    const onboardingComplete = /* check onboarding status */;
    
    if (isPaidPlan && hasPayment && !onboardingComplete) {
      return {
        allowed: false,
        reason: 'Please complete your onboarding process to access paid plan features.',
        upgradeRequired: false, // They already paid!
      };
    }
    
    return {
      allowed: false,
      reason: 'Please upgrade to create campaigns.',
      upgradeRequired: true,
      recommendedPlan: this.getRecommendedPlan('campaigns', 1)
    };
  }
  
  // Check campaign limits (now from database)
  if (planStatus.planConfig.campaignsLimit > 0 && planStatus.campaignsUsed >= planStatus.planConfig.campaignsLimit) {
    return {
      allowed: false,
      reason: `You've reached your campaign limit (${planStatus.planConfig.campaignsLimit})`,
      recommendedPlan: this.getRecommendedPlan('campaigns', planStatus.campaignsUsed + 1)
    };
  }
  
  return { allowed: true };
}

/**
 * 🆕 Enhanced usage increment with normalized tables
 */
static async incrementUsage(userId: string, type: 'campaigns' | 'creators', amount: number = 1): Promise<void> {
  // Use the new helper function for normalized tables
  await incrementUsage(userId, type, amount);
}
```

**Key Enhancements:**
- ✅ **Database-Driven Plans**: Limits now loaded from `subscription_plans` table
- ✅ **Normalized Table Integration**: Uses new `getUserProfile()` function
- ✅ **Enhanced Security**: Paid plan + onboarding completion verification
- ✅ **Intended Plan Tracking**: Support for `intendedPlan` field for checkout flows
- ✅ **Improved Logging**: Comprehensive billing logger integration
- ✅ **Performance Optimization**: Uses specialized query functions when possible

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

## 🔧 Enhanced System Validation

### **🆕 Startup Validation (`/lib/startup-validation.js`)**

**Environment Validation on Application Startup:**

Prevents environment mismatches and configuration errors during deployment:

```javascript
export function validateEnvironmentOnStartup() {
  // Validate Stripe configuration
  const stripeValidation = StripeEnvironmentValidator.validate();

  // Prevent production deployment with invalid config
  if (!stripeValidation.isValid && process.env.NODE_ENV === 'production') {
    throw new Error('Invalid environment configuration - cannot start in production');
  }

  // Run database cleanup in production
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    cleanTestSubscriptionsInProduction();
  }
}

// Auto-run validation on import (server-side only)
if (typeof window === 'undefined') {
  validateEnvironmentOnStartup();
}
```

**Key Features:**
- ✅ **Automatic Validation**: Runs on server startup to catch config issues early
- ✅ **Production Safety**: Prevents deployment with invalid configurations
- ✅ **Environment Detection**: Proper NODE_ENV and VERCEL_ENV handling
- ✅ **Database Cleanup**: Automatic test data removal in production
- ✅ **Configuration Logging**: Detailed environment status for debugging

### **🔄 ENHANCED: Stripe Environment Validator (`/lib/stripe/stripe-env-validator.js`)**

**Advanced Stripe Configuration Validation:**

Enhanced validation system preventing test/live key mismatches with auto-cleanup capabilities:

```javascript
export class StripeEnvironmentValidator {
  // Main validation with comprehensive error checking
  static validate(): ValidationResult

  // Prevent database operations with wrong environment
  static async validateSubscriptionAccess(subscriptionId: string): Promise<boolean>

  // Auto-clean test subscriptions when detected
  static async autoCleanTestSubscription(subscriptionId: string): Promise<void>
}
```

**🆕 Enhanced Features:**
- ✅ **Environment Detection**: Distinguishes production vs preview vs development
- ✅ **Key Mismatch Prevention**: Validates secret/publishable key consistency
- ✅ **Production Safety**: Blocks production deployment with test keys
- ✅ **Auto-Cleanup**: Automatically removes test subscriptions in live environment
- ✅ **Subscription Validation**: Prevents operations on mismatched subscription IDs
- ✅ **Comprehensive Logging**: Detailed validation results and fix instructions
- ✅ **Exit Protection**: Prevents app startup with critical configuration errors

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

### **🆕 Dashboard Formatters (`/lib/dashboard/formatters.ts`)**

**Shared Dashboard Display Utilities:**

Formatting utilities shared across dashboard components for consistent data presentation:

```typescript
// Follower count formatting for compact display
export function formatFollowerCount(value: number | null | undefined): string {
  // Formats numbers like 1.2M, 543K, 10.5B with intelligent rounding
  // Handles null/undefined gracefully with '--' fallback
}

// Relative time formatting for recency indicators
export function formatRelativeTime(
  value: string | Date | null | undefined,
  referenceDate: Date = new Date()
): string {
  // Returns "2 hours ago", "yesterday", "3 weeks ago" etc.
  // Uses Intl.RelativeTimeFormat for proper internationalization
}
```

**Key Features:**
- ✅ **Follower Count Formatting**: Converts large numbers to readable format (1.2M, 543K)
- ✅ **Intelligent Rounding**: Proper decimal handling based on magnitude
- ✅ **Relative Time Display**: Human-readable time differences with i18n support
- ✅ **Null Safety**: Graceful handling of missing/invalid data
- ✅ **Consistent Branding**: Shared formatting across favorite grids and recent lists

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

### **🔄 ENHANCED: Frontend Logger (`/lib/utils/frontend-logger.ts`)**

**Comprehensive User Flow Tracking System:**

Significantly enhanced logging utility providing "insane logging" for production debugging with 290+ lines of structured logging capabilities:

```typescript
export class FrontendLogger {
  // Session tracking
  private static sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  private static startTime = Date.now();

  // Major step tracking with visual separators
  static logStepHeader(step: string, description: string, context?: LogContext)

  // User action tracking
  static logUserAction(action: string, details: any, context?: LogContext)

  // Form interaction logging
  static logFormAction(formName: string, action: 'submit' | 'validation' | 'error', data: any)

  // API call logging with comprehensive tracking
  static async loggedApiCall(url: string, options: ApiCallOptions = {}, context?: LogContext): Promise<any>

  // Navigation tracking
  static logNavigation(from: string, to: string, reason: string, context?: LogContext)

  // Authentication event logging
  static logAuth(event: 'login' | 'logout' | 'session_check' | 'user_loaded', data: any)

  // Success/error state logging
  static logSuccess(operation: string, result: any, context?: LogContext)
  static logError(operation: string, error: any, context?: LogContext)

  // Email/notification tracking
  static logEmailEvent(type: 'scheduled' | 'sent' | 'failed', emailType: string, details: any)

  // Performance timing
  static logTiming(operation: string, startTime: number, context?: LogContext)

  // Session debugging info
  static getSessionInfo(): SessionInfo
}

// Convenience exports for direct use
export const logStepHeader, logUserAction, logFormAction, loggedApiCall,
             logNavigation, logAuth, logSuccess, logError, logEmailEvent, logTiming;
```

**🆕 Enhanced Features:**
- ✅ **Session Tracking**: Unique session IDs and timing across user flows
- ✅ **API Call Monitoring**: Full request/response logging with duration tracking
- ✅ **Form Interaction Tracking**: Comprehensive form submission and validation logging
- ✅ **Authentication Flow Logging**: Detailed auth state change tracking
- ✅ **Navigation Monitoring**: Route change tracking with context
- ✅ **Data Sanitization**: Automatic removal of sensitive information (passwords, tokens)
- ✅ **Visual Separators**: Clear step headers for debugging complex flows
- ✅ **Performance Integration**: Built-in timing and duration tracking
- ✅ **Email Event Tracking**: Notification scheduling and delivery monitoring
- ✅ **Error Context Preservation**: Rich error logging with stack traces and context

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

## 🧪 Testing & Quality Assurance

### **🆕 Enhanced Testing Framework**

The library includes a **professional-grade testing infrastructure** with comprehensive test utilities:

### **🧪 Subscription Testing Utils (`/lib/test-utils/subscription-test.ts`)**

**Comprehensive Plan Validation Testing System:**

**🆕 RECENTLY UPDATED** - Enhanced testing utilities for validating subscription plans and limits with **full normalized table integration**:

```typescript
export class SubscriptionTestUtils {
  // Test user management
  static async createTestUsers(): Promise<TestUser[]>
  static async resetUserUsage(userId: string): Promise<void>
  static async switchUserPlan(userId: string, newPlan: 'glow_up' | 'viral_surge' | 'fame_flex'): Promise<void>

  // Plan validation testing
  static async simulateCampaignCreation(userId: string, count: number = 1): Promise<SimulationResult>
  static async simulateCreatorUsage(userId: string, creatorCount: number): Promise<SimulationResult>

  // Status monitoring
  static async getUserStatus(userId: string): Promise<UserStatusSummary | null>

  // Comprehensive test suite
  static async runTestSuite(): Promise<TestSuiteResults>

  // Cleanup utilities
  static async cleanupTestData(): Promise<void>
}

interface TestUser {
  userId: string;
  name: string;
  plan: 'glow_up' | 'viral_surge' | 'fame_flex';
  campaignsUsed: number;
  creatorsUsed: number;
}
```

**🔄 MIGRATION COMPLETED (September 2025):**

The subscription testing utilities have been **successfully migrated** from the deprecated `userProfiles` table to the new normalized schema:

```typescript
// ✅ BEFORE (deprecated userProfiles table):
const existingUser = await db.query.userProfiles.findFirst({
  where: eq(userProfiles.userId, user.userId)
});

// ✅ AFTER (normalized tables with query layer):
const existingUser = await getUserProfile(user.userId);
```

**🆕 Key Testing Features:**
- ✅ **✨ Normalized Table Migration**: **COMPLETED** - Now uses `getUserProfile()`, `createUser()`, and `updateUserProfile()` functions
- ✅ **Database Compatibility Fix**: Resolves "relation user_profiles does not exist" production errors
- ✅ **Backward Compatibility**: Maintains all existing functionality while using new schema
- ✅ **Plan Limit Validation**: Tests campaign and creator limits for all plans
- ✅ **Edge Case Testing**: Users at limits, exceeded limits, plan transitions
- ✅ **Automated Test Suite**: 4 comprehensive test scenarios with pass/fail tracking
- ✅ **Usage Simulation**: Realistic campaign creation and creator usage testing
- ✅ **Status Monitoring**: Complete user status including limits, usage, and upgrade suggestions
- ✅ **Data Cleanup**: Safe test data removal without affecting real users
- ✅ **Integration Testing**: Works with PlanEnforcementService for realistic validation

The library includes a **professional-grade testing infrastructure** with 1000+ lines of test code across multiple test suites:

**Master Test Runner (`/run-all-tests.js`):**
```javascript
class MasterTestRunner {
  async runAllTests() {
    // Test Suite 1: Database Refactoring Tests
    const dbTester = new DatabaseRefactoringTester();
    await this.runTestSuite('Database Refactoring Tests', dbTester);

    // Test Suite 2: API Integration Tests
    const apiTester = new APIIntegrationTester();
    await this.runTestSuite('API Integration Tests', apiTester);

    // Test Suite 3: Data Integrity and Rollback Safety
    const integrityTester = new DataIntegrityTester();
    await this.runTestSuite('Data Integrity & Rollback Tests', integrityTester);

    this.generateFinalReport();
  }
}
```

**Test Suites Available:**
- **Database Refactoring Tests** (`/tests/database-refactoring-tests.js`): Validates schema normalization
- **API Integration Tests** (`/tests/api-integration-tests.js`): Tests API compatibility with normalized tables
- **Data Integrity Tests** (`/tests/data-integrity-tests.js`): Ensures data consistency during migration
- **MCP Database Verification** (`/tests/mcp-database-verification.js`): Validates MCP integration
- **Platform-Specific Tests** (`/tests/tiktok-similar-search-test.js`): Platform integration testing

**Testing Features:**
- ✅ **Automated Test Discovery**: Runs comprehensive test suites automatically
- ✅ **Deployment Readiness Assessment**: Determines if code is ready for production
- ✅ **Color-coded Output**: Clear visual feedback on test results
- ✅ **Performance Benchmarking**: Tests include performance validation
- ✅ **Rollback Safety**: Validates that changes don't break existing functionality
- ✅ **MCP Integration Testing**: Ensures proper integration with Model Context Protocol

**Usage:**
```bash
# Run all tests
node run-all-tests.js

# Run specific test suite
node tests/database-refactoring-tests.js

# MCP verification
node tests/mcp-database-verification.js
```

---

## 🌟 Key Features & Benefits

### **🆕 Database Architecture Improvements**
- ✅ **Normalized Schema**: 5-table user system replacing monolithic `user_profiles`
- ✅ **Data Integrity**: Foreign key constraints and cascade deletes
- ✅ **Performance Optimization**: Specialized queries for common operations
- ✅ **Event Sourcing**: Industry-standard event tracking with idempotency
- ✅ **Background Job Tracking**: QStash integration with comprehensive job metadata
- ✅ **Intended Plan Support**: Enhanced checkout flow with plan selection tracking

### Performance Optimizations
- ✅ **Connection Pooling:** Global database connections for serverless
- ✅ **localStorage Caching:** 2-minute billing cache for instant loading
- ✅ **Image Caching:** Permanent Vercel Blob storage
- ✅ **Hot Configuration:** Dynamic system settings without deployment
- ✅ **Query Optimization:** Table-specific queries reduce unnecessary joins

### Reliability & Monitoring
- ✅ **Comprehensive Logging:** BillingLogger with request tracking
- ✅ **Performance Monitoring:** Real-time timing and benchmarks
- ✅ **Error Recovery:** Graceful fallbacks and retry mechanisms
- ✅ **Event Sourcing:** Complete audit trail of system events
- ✅ **Data Consistency:** Transaction-based updates across normalized tables

### Scalability Features
- ✅ **Background Processing:** QStash for async job handling
- ✅ **Platform Modularity:** Easy addition of new social platforms
- ✅ **Rate Limiting:** Configurable API call limits
- ✅ **Usage Tracking:** Real-time billing and limit enforcement
- ✅ **Database Normalization:** Better performance and maintainability at scale

### Developer Experience
- ✅ **TypeScript First:** Full type safety across all modules
- ✅ **Modular Architecture:** Clear separation of concerns
- ✅ **Comprehensive Testing:** Professional test suite with 1000+ lines of test code
- ✅ **Rich Logging:** Detailed debugging and monitoring information
- ✅ **Backward Compatibility:** Existing code continues to work during migration
- ✅ **Migration Safety:** Comprehensive testing ensures safe database transitions

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
