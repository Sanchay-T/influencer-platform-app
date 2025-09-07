# 🗄️ Database Documentation - Influencer Platform

## Overview

The influencer platform uses a **PostgreSQL database** hosted on **Supabase** with **Drizzle ORM** for type-safe database operations. The architecture follows modern patterns including event sourcing, background job processing, and comprehensive user management with trial systems.

### Technology Stack
- **Database**: PostgreSQL 15+ (Supabase hosted)
- **ORM**: Drizzle ORM with TypeScript
- **Migrations**: Custom SQL migrations in `/supabase/migrations/`
- **Connection Management**: Postgres.js with connection pooling for Vercel serverless
- **Authentication**: Clerk (external) with database user profiles

### Environment Support
- **Development**: Local PostgreSQL via Docker (optional)
- **Production**: Supabase hosted PostgreSQL
- **Connection Pooling**: Optimized for Vercel serverless functions

## Schema Overview

The database consists of **9 core tables** organized into these domains:

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│    Campaign Domain  │    User Domain      │   System Domain     │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ campaigns           │ user_profiles       │ system_config       │
│ scraping_jobs       │ subscription_plans  │ events              │
│ scraping_results    │                     │ background_jobs     │
│ search_jobs*        │                     │                     │
│ search_results*     │                     │                     │
└─────────────────────┴─────────────────────┴─────────────────────┘
* Legacy tables for alternative job processing
```

### Entity Relationship Diagram (ASCII)

```
user_profiles (1) ──< (M) campaigns ──< (1) scraping_jobs ──< (M) scraping_results
     │                     │                    │
     │                     │                    │
     └── subscription_plans │                    └── background_jobs
                            │
                            └── search_jobs ──< search_results (legacy)

system_configurations (singleton config store)
events (event sourcing audit trail)
```

## Core Tables

### 1. **campaigns** - Campaign Management
```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,                     -- Clerk user ID
    name TEXT NOT NULL,
    description TEXT,
    search_type VARCHAR(20) NOT NULL,          -- 'keyword' | 'similar'
    status VARCHAR(20) DEFAULT 'draft' NOT NULL, -- 'draft' | 'active' | 'completed' | 'archived'
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Purpose**: Top-level campaign containers for organizing influencer searches

**Key Fields**:
- `search_type`: Determines if searching by keywords or similar profiles
- `status`: Campaign lifecycle state
- `user_id`: Links to Clerk authentication system

### 2. **scraping_jobs** - Background Job Processing
```sql
CREATE TABLE scraping_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    campaign_id UUID REFERENCES campaigns(id),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- Job Configuration
    keywords JSONB,                           -- Array of search keywords
    target_username TEXT,                     -- For similar search
    platform VARCHAR(50) DEFAULT 'Tiktok' NOT NULL, -- 'TikTok' | 'Instagram' | 'YouTube'
    search_params JSONB,                      -- Platform-specific parameters
    -- Progress Tracking
    processed_runs INTEGER DEFAULT 0 NOT NULL,
    processed_results INTEGER DEFAULT 0 NOT NULL,
    target_results INTEGER DEFAULT 1000 NOT NULL,
    cursor INTEGER DEFAULT 0,                 -- Pagination cursor
    progress NUMERIC DEFAULT '0',             -- 0-100 percentage
    -- QStash Integration
    qstash_message_id TEXT,                   -- External job tracking
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    timeout_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    error TEXT
);
```

**Purpose**: Manages async background processing of influencer searches across platforms

**Key Features**:
- **Multi-platform Support**: TikTok, Instagram, YouTube
- **Progress Tracking**: Real-time progress updates for frontend
- **QStash Integration**: Serverless background job processing
- **Flexible Search**: Keywords or similar user search types

**Status Flow**:
```
pending → processing → completed
                   ↘ error
                   ↘ timeout
```

### 3. **scraping_results** - Search Results Storage
```sql
CREATE TABLE scraping_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES scraping_jobs(id),
    creators JSONB NOT NULL,                  -- Array of creator objects
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Purpose**: Stores processed influencer data from API calls

**JSONB Structure** (`creators` field):
```json
[
  {
    "creator": {
      "name": "Creator Name",
      "uniqueId": "username",
      "followers": 125000,
      "avatarUrl": "https://...",
      "bio": "Creator bio text",
      "emails": ["email@domain.com"],
      "verified": true
    },
    "video": {
      "description": "Video content",
      "url": "https://...",
      "statistics": {
        "likes": 1234,
        "comments": 56,
        "views": 12500,
        "shares": 89
      }
    },
    "hashtags": ["#trending", "#viral"],
    "platform": "TikTok",
    "enhancementStatus": "completed"
  }
]
```

### 4. **user_profiles** - User Management & Billing
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,            -- Clerk user ID
    -- Basic Info
    name TEXT,
    company_name TEXT,
    industry TEXT,
    email TEXT,
    -- Onboarding System
    signup_timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
    onboarding_step VARCHAR(50) DEFAULT 'pending' NOT NULL,
    full_name TEXT,
    business_name TEXT,
    brand_description TEXT,
    email_schedule_status JSONB DEFAULT '{}',
    -- Trial System
    trial_start_date TIMESTAMP,
    trial_end_date TIMESTAMP,
    trial_status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'active' | 'expired' | 'cancelled' | 'converted'
    -- Subscription Management
    current_plan VARCHAR(50) DEFAULT 'free',   -- 'free' | 'glow_up' | 'viral_surge' | 'fame_flex'
    intended_plan VARCHAR(50),                 -- Plan selected before checkout
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status VARCHAR(20) DEFAULT 'none',
    -- Payment Info
    payment_method_id TEXT,
    card_last_4 VARCHAR(4),
    card_brand VARCHAR(20),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    billing_address_city TEXT,
    billing_address_country VARCHAR(2),
    billing_address_postal_code VARCHAR(20),
    -- Usage Tracking
    plan_campaigns_limit INTEGER,
    plan_creators_limit INTEGER,
    plan_features JSONB,
    usage_campaigns_current INTEGER DEFAULT 0,
    usage_creators_current_month INTEGER DEFAULT 0,
    usage_reset_date TIMESTAMP DEFAULT NOW(),
    -- Billing Webhooks
    last_webhook_event VARCHAR(100),
    last_webhook_timestamp TIMESTAMP,
    billing_sync_status VARCHAR(20) DEFAULT 'pending',
    trial_conversion_date TIMESTAMP,
    subscription_cancel_date TIMESTAMP,
    subscription_renewal_date TIMESTAMP,
    -- Admin System
    is_admin BOOLEAN DEFAULT FALSE,           -- Database-based admin role
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Purpose**: Comprehensive user management including trials, billing, and admin permissions

**Key Features**:
- **Dual Authentication**: Integrates with Clerk while maintaining database user records
- **Trial Management**: 7-day trial system with automated email sequences
- **Usage Tracking**: Monitor plan limits and current usage
- **Admin System**: Database-level admin permissions

### 5. **system_configurations** - Dynamic Settings
```sql
CREATE TABLE system_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,            -- 'api_limits', 'timeouts', 'email'
    key VARCHAR(100) NOT NULL,                -- 'max_api_calls_tiktok'
    value TEXT NOT NULL,                      -- '1000'
    value_type VARCHAR(20) NOT NULL,          -- 'number' | 'duration' | 'boolean'
    description TEXT,
    is_hot_reloadable VARCHAR(5) DEFAULT 'true' NOT NULL, -- 'true' | 'false'
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    CONSTRAINT system_configurations_category_key_unique UNIQUE (category, key)
);
```

**Purpose**: Runtime configuration management without code deployments

**Configuration Categories**:
- `api_limits`: API call limits and rate limiting
- `timeouts`: Request timeout settings
- `job_processing`: Background job settings
- `email`: Email system configuration
- `feature_flags`: Feature toggles

### 6. **events** - Event Sourcing (Industry Standard)
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id TEXT NOT NULL,              -- User ID, Job ID, etc.
    aggregate_type VARCHAR(50) NOT NULL,     -- 'user', 'subscription', 'onboarding'
    event_type VARCHAR(100) NOT NULL,        -- 'subscription_created', 'onboarding_completed'
    event_version INTEGER DEFAULT 1 NOT NULL,
    event_data JSONB NOT NULL,               -- Full event payload
    metadata JSONB,                          -- Request ID, source, user agent, etc.
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
    processed_at TIMESTAMP,                  -- When background job processed this event
    processing_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    error TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,   -- Prevent duplicate processing
    source_system VARCHAR(50) NOT NULL,     -- 'stripe_webhook', 'admin_action', 'user_action'
    correlation_id TEXT,                     -- Track related events
    causation_id TEXT                        -- What caused this event
);
```

**Purpose**: Complete audit trail and event sourcing for critical business events

**Event Types**:
- `user_registered`, `onboarding_completed`
- `trial_started`, `trial_converted`, `trial_expired`
- `subscription_created`, `subscription_canceled`
- `admin_action`, `billing_webhook_received`

### 7. **background_jobs** - Job Queue Management
```sql
CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL,          -- 'complete_onboarding', 'send_trial_email'
    payload JSONB NOT NULL,                  -- Job data
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    qstash_message_id TEXT,                  -- QStash message ID
    priority INTEGER DEFAULT 100 NOT NULL,   -- Lower = higher priority
    max_retries INTEGER DEFAULT 3 NOT NULL,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    scheduled_for TIMESTAMP DEFAULT NOW() NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error TEXT,
    result JSONB,                            -- Job execution result
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Purpose**: QStash-integrated job queue for background processing

### 8. **subscription_plans** - Plan Configuration
```sql
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key VARCHAR(50) NOT NULL UNIQUE,   -- 'glow_up', 'viral_surge', 'fame_flex'
    display_name TEXT NOT NULL,             -- 'Glow Up Plan'
    description TEXT,
    -- Pricing (in cents)
    monthly_price INTEGER NOT NULL,         -- 9900 = $99.00
    yearly_price INTEGER,
    -- Stripe Integration
    stripe_monthly_price_id TEXT NOT NULL,
    stripe_yearly_price_id TEXT,
    -- Plan Limits
    campaigns_limit INTEGER NOT NULL,
    creators_limit INTEGER NOT NULL,
    -- Features
    features JSONB DEFAULT '{}',            -- Feature flags
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Purpose**: Centralized plan configuration and pricing

### 9. Legacy Tables (Alternative Processing)

#### **search_jobs** & **search_results**
Alternative job processing tables with different data structure:
- More granular per-creator storage
- Alternative to JSONB bulk storage
- Currently used for specific workflow patterns

## Migration History

The database has evolved through **23 migrations** (as of current state):

### Key Migration Milestones

#### **0000_sleepy_moira_mactaggert.sql** - Foundation
- Created initial `scraping_jobs` and `scraping_results` tables
- Established core job processing architecture

#### **0002_lively_cable.sql** - Campaign System
- Added `campaigns` table for organizing searches
- Linked scraping jobs to campaigns via foreign key

#### **0004_qstash_fields.sql** - Background Processing
- Added QStash integration fields to scraping_jobs
- Enabled serverless background job processing

#### **0009_trial_system.sql** - Trial Management
- Enhanced user_profiles with trial system fields
- Added billing and subscription management
- Created performance indexes for trial queries

#### **0010_search_indexes.sql** - Performance Optimization
```sql
-- Text search indexes using trigrams
CREATE INDEX idx_user_profiles_full_name_search 
ON user_profiles USING gin (full_name gin_trgm_ops);

-- Admin panel search optimization
CREATE INDEX idx_user_profiles_admin_search 
ON user_profiles (created_at DESC, onboarding_step, trial_status);
```

#### **0011_industry_standard_event_sourcing.sql** - Enterprise Architecture
- Added `events` table for complete audit trail
- Added `background_jobs` table for job queue management
- Implemented Row Level Security (RLS) policies
- Added comprehensive indexing strategy

#### **0013_safe_plans_and_intended_plan.sql** - Subscription Enhancement
- Created `subscription_plans` table
- Added `intended_plan` tracking for checkout flows

### Migration Patterns

**Naming Convention**: `NNNN_descriptive_name.sql`
- Sequential numbering for proper ordering
- Descriptive names for easy identification

**Safe Migration Practices**:
- Use `IF NOT EXISTS` for table/index creation
- Add columns with `ADD COLUMN IF NOT EXISTS`
- Backward compatible changes only
- Performance indexes created separately

## Relationships & Foreign Keys

### Primary Relationships

```sql
-- Campaign -> Jobs (One-to-Many)
scraping_jobs.campaign_id → campaigns.id

-- Job -> Results (One-to-Many)  
scraping_results.job_id → scraping_jobs.id

-- Alternative: Job -> Results (One-to-Many)
search_results.job_id → search_jobs.id
search_jobs.campaign_id → campaigns.id

-- User -> Plans (Many-to-One, conceptual)
user_profiles.current_plan ↔ subscription_plans.plan_key
```

### Relationship Patterns

#### **Campaign Management**
```
User (Clerk) → [user_profiles] → campaigns → scraping_jobs → scraping_results
                     ↓
               subscription_plans (via current_plan)
```

#### **Event Sourcing**
```
All domain events → events table
Background processing → background_jobs table
System configuration → system_configurations table
```

### Drizzle ORM Relations

```typescript
// Campaign Relations
export const campaignRelations = relations(campaigns, ({ many }) => ({
  scrapingJobs: many(scrapingJobs),
  searchJobs: many(searchJobs),
}));

// Scraping Job Relations
export const scrapingJobsRelations = relations(scrapingJobs, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [scrapingJobs.campaignId],
    references: [campaigns.id],
  }),
  results: many(scrapingResults),
}));

// Results Relations
export const scrapingResultsRelations = relations(scrapingResults, ({ one }) => ({
  job: one(scrapingJobs, {
    fields: [scrapingResults.jobId],
    references: [scrapingJobs.id],
  }),
}));
```

## Query Patterns

### Common Query Operations

#### 1. **User Job Status Lookup**
```typescript
// Get user's active jobs with results
const userJobs = await db.query.scrapingJobs.findMany({
  where: eq(scrapingJobs.userId, clerkUserId),
  with: {
    results: true,
    campaign: true
  },
  orderBy: desc(scrapingJobs.createdAt)
});
```

#### 2. **Campaign Results Aggregation**
```typescript
// Get all results for a campaign
const campaignResults = await db.query.campaigns.findFirst({
  where: eq(campaigns.id, campaignId),
  with: {
    scrapingJobs: {
      with: {
        results: true
      }
    }
  }
});
```

#### 3. **Admin User Search**
```sql
-- Fast user search using trigram indexes
SELECT * FROM user_profiles 
WHERE full_name ILIKE '%john%'
ORDER BY created_at DESC
LIMIT 50;
```

#### 4. **Trial System Queries**
```typescript
// Find expiring trials
const expiringTrials = await db.select()
  .from(userProfiles)
  .where(
    and(
      eq(userProfiles.trialStatus, 'active'),
      lte(userProfiles.trialEndDate, new Date(Date.now() + 24 * 60 * 60 * 1000))
    )
  );
```

#### 5. **Event Sourcing Patterns**
```typescript
// Get user's event history
const userEvents = await db.select()
  .from(events)
  .where(
    and(
      eq(events.aggregateType, 'user'),
      eq(events.aggregateId, userId)
    )
  )
  .orderBy(desc(events.timestamp));
```

#### 6. **System Configuration Lookup**
```typescript
// Get hot-reloadable config values
const apiLimits = await db.select()
  .from(systemConfigurations)
  .where(
    and(
      eq(systemConfigurations.category, 'api_limits'),
      eq(systemConfigurations.isHotReloadable, 'true')
    )
  );
```

### Performance Optimization Queries

#### **Index Usage Examples**
```sql
-- Uses idx_user_profiles_trial_info
EXPLAIN SELECT * FROM user_profiles 
WHERE trial_status = 'active' 
AND trial_end_date < NOW();

-- Uses idx_events_aggregate_type_timestamp  
EXPLAIN SELECT * FROM events 
WHERE aggregate_id = 'user_123' 
AND aggregate_type = 'user' 
ORDER BY timestamp DESC;

-- Uses idx_background_jobs_pending
EXPLAIN SELECT * FROM background_jobs 
WHERE status = 'pending' 
ORDER BY priority, scheduled_for;
```

## Data Flow

### 1. **User Registration & Onboarding**
```
Clerk Auth → Webhook → user_profiles INSERT → events INSERT
     ↓
Onboarding Flow → user_profiles UPDATE → events INSERT
     ↓  
Trial Start → user_profiles UPDATE → background_jobs INSERT (email scheduling)
```

### 2. **Campaign Creation & Execution**
```
Frontend Form → campaigns INSERT → scraping_jobs INSERT
     ↓
QStash Trigger → scraping_jobs UPDATE (status='processing')
     ↓
API Calls → scraping_results INSERT (incremental)
     ↓
Job Complete → scraping_jobs UPDATE (status='completed')
```

### 3. **Background Job Processing**
```
Event Trigger → background_jobs INSERT
     ↓
QStash Processing → background_jobs UPDATE (status='processing')
     ↓
Job Execution → background_jobs UPDATE (result, completed_at)
     ↓
Event Recording → events INSERT (audit trail)
```

### 4. **Billing & Subscription Flow**
```
Stripe Webhook → events INSERT (raw webhook data)
     ↓
Event Processing → user_profiles UPDATE (subscription details)
     ↓
Usage Tracking → user_profiles UPDATE (usage counters)
     ↓
Plan Validation → subscription_plans JOIN (limits check)
```

## Performance Considerations

### Indexing Strategy

#### **Primary Indexes** (Automatically created)
- All `id` fields (UUID primary keys)
- `user_profiles.user_id` (unique constraint)
- `system_configurations(category, key)` (unique constraint)

#### **Query Performance Indexes**
```sql
-- User profile searches (admin panel)
CREATE INDEX idx_user_profiles_full_name_search 
ON user_profiles USING gin (full_name gin_trgm_ops);

-- Job processing optimization
CREATE INDEX idx_scraping_jobs_status_created 
ON scraping_jobs (status, created_at DESC);

-- Event sourcing performance
CREATE INDEX idx_events_aggregate_type_timestamp 
ON events(aggregate_id, aggregate_type, timestamp DESC);

-- Background job queue
CREATE INDEX idx_background_jobs_pending 
ON background_jobs(status, priority, scheduled_for) 
WHERE status = 'pending';
```

#### **Partial Indexes** (Condition-based)
```sql
-- Only index active trials (reduces index size)
CREATE INDEX idx_user_profiles_trial_info 
ON user_profiles (trial_status, trial_start_date, trial_end_date) 
WHERE trial_status != 'pending';

-- Only index pending events for processing
CREATE INDEX idx_events_processing_pending 
ON events(processing_status, timestamp) 
WHERE processing_status = 'pending';
```

### Connection Management

#### **Vercel Serverless Optimization**
```typescript
// Global connection pooling to prevent exhaustion
declare global {
  var __queryClient: ReturnType<typeof postgres> | undefined;
  var __db: ReturnType<typeof drizzle> | undefined;
}

const queryClient = global.__queryClient ?? postgres(connectionString, {
  idle_timeout: isLocal ? 120 : 30,
  max_lifetime: isLocal ? 60 * 60 * 2 : 60 * 60,
  max: isLocal ? 10 : 5,
  connect_timeout: isLocal ? 30 : 10,
});
```

### JSONB Optimization

#### **Creator Data Storage**
- Uses JSONB for flexible schema evolution
- Indexes can be added to JSONB fields when needed
- Bulk storage reduces table size vs normalized approach

#### **Future JSONB Indexing** (if needed)
```sql
-- Index specific JSONB fields for faster queries
CREATE INDEX idx_scraping_results_platform 
ON scraping_results USING gin ((creators -> 'platform'));

-- Index creator usernames for search
CREATE INDEX idx_scraping_results_usernames 
ON scraping_results USING gin ((creators -> 'creator' -> 'uniqueId'));
```

### Query Optimization Tips

1. **Use WITH clauses** for complex joins to leverage Drizzle relations
2. **Limit result sets** with proper pagination
3. **Use partial indexes** for filtered queries
4. **Monitor slow queries** with `EXPLAIN ANALYZE`
5. **Batch operations** for bulk inserts/updates

### Scaling Considerations

#### **Current Capacity**
- Supabase Free Tier: 500MB storage, 2GB transfer
- Connection limit: 60 concurrent connections
- Row-level security enabled for multi-tenant isolation

#### **Growth Planning**
- **Horizontal scaling**: Consider read replicas for analytics
- **Archival strategy**: Move old events/results to cold storage
- **Partitioning**: Consider table partitioning for events table
- **Caching layer**: Redis for frequently accessed config data

---

## Database Management Commands

### **Local Development**
```bash
# Connect to local database
psql postgresql://postgres:localdev123@localhost:5432/influencer_platform_dev

# Run migrations
node run-migration.js

# Check migration status
node scripts/test-migration-status.js
```

### **Production Operations**
```bash
# Connect to Supabase
psql "postgresql://postgres:[password]@[host]:5432/postgres"

# Monitor query performance
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC;

# Check table sizes
SELECT schemaname,tablename,pg_size_pretty(size) as size_pretty 
FROM (SELECT schemaname,tablename,pg_relation_size(schemaname||'.'||tablename) as size 
      FROM pg_tables WHERE schemaname NOT IN ('information_schema','pg_catalog')) x 
ORDER BY size DESC;
```

This database architecture provides a solid foundation for a multi-platform influencer discovery platform with enterprise-grade features including event sourcing, background job processing, comprehensive user management, and performance optimization.