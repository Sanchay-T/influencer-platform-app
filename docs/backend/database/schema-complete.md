# 🗃️ Complete Database Schema - Drizzle ORM & PostgreSQL

## Overview
Complete database schema documentation covering all tables, relationships, indexes, and data flows for the usegemz platform using Drizzle ORM with PostgreSQL (Supabase).

## 🏗️ Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Application Layer                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Drizzle ORM   │────│   Connection    │                    │
│  │   (Type-Safe)   │    │    Pooling      │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                        │                             │
│         ▼                        ▼                             │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │    PostgreSQL   │    │    Supabase     │                    │
│  │    Database     │    │   (Hosting)     │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │            TABLE STRUCTURE              │                    │
│  │                                         │                    │
│  │  ┌─────────────┐  ┌─────────────┐      │                    │
│  │  │    Users    │  │ Campaigns   │      │                    │
│  │  │   System    │  │   System    │      │                    │
│  │  └─────────────┘  └─────────────┘      │                    │
│  │         │                │             │                    │
│  │         ▼                ▼             │                    │
│  │  ┌─────────────┐  ┌─────────────┐      │                    │
│  │  │   Trial/    │  │  Scraping   │      │                    │
│  │  │   Admin     │  │   Jobs      │      │                    │
│  │  │   System    │  │  & Results  │      │                    │
│  │  └─────────────┘  └─────────────┘      │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Core Tables Overview

### **Table Categories**:
- 🟢 **User Management**: `user_profiles`, admin system, trial tracking
- 🟡 **Campaign System**: `campaigns`, `scraping_jobs`, job processing
- 🔵 **Results Storage**: `scraping_results`, `search_results`, creator data
- 🟣 **System Config**: `system_configurations`, app-wide settings
- 🟤 **Legacy Tables**: `search_jobs`, `search_results` (alternative implementation)

## 🔗 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  ENTITY RELATIONSHIP DIAGRAM                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                           │
│  │  user_profiles  │ (1)                                       │
│  │  ┌───────────┐  │                                           │
│  │  │ userId PK │  │                                           │
│  │  │ email     │  │                                           │
│  │  │ fullName  │  │                                           │
│  │  │ trialData │  │                                           │
│  │  │ isAdmin   │  │                                           │
│  │  └───────────┘  │                                           │
│  └─────────────────┘                                           │
│           │                                                     │
│           │ (1:N)                                               │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │   campaigns     │ (N)                                       │
│  │  ┌───────────┐  │                                           │
│  │  │ id PK     │  │                                           │
│  │  │ userId FK │  │                                           │
│  │  │ name      │  │                                           │
│  │  │ status    │  │                                           │
│  │  └───────────┘  │                                           │
│  └─────────────────┘                                           │
│           │                                                     │
│           │ (1:N)                                               │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ scraping_jobs   │ (N)                                       │
│  │  ┌───────────┐  │                                           │
│  │  │ id PK     │  │                                           │
│  │  │ campaignId│  │                                           │
│  │  │ platform  │  │                                           │
│  │  │ status    │  │                                           │
│  │  │ progress  │  │                                           │
│  │  └───────────┘  │                                           │
│  └─────────────────┘                                           │
│           │                                                     │
│           │ (1:N)                                               │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │scraping_results │ (N)                                       │
│  │  ┌───────────┐  │                                           │
│  │  │ id PK     │  │                                           │
│  │  │ jobId FK  │  │                                           │
│  │  │ creators  │  │ (JSONB - Creator Data)                   │
│  │  └───────────┘  │                                           │
│  └─────────────────┘                                           │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │system_configs   │ (Independent)                             │
│  │  ┌───────────┐  │                                           │
│  │  │ category  │  │                                           │
│  │  │ key       │  │                                           │
│  │  │ value     │  │                                           │
│  │  └───────────┘  │                                           │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Table Schemas - Complete Details

### 1. **User Profiles Table** - `user_profiles`

#### **Purpose**: Central user data including onboarding, trial system, and admin roles

#### **Schema**:
```sql
CREATE TABLE user_profiles (
  -- Primary identification
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT NOT NULL UNIQUE,           -- Clerk user ID (text format)
  email                TEXT,                           -- User email
  
  -- Basic profile info (optional after onboarding changes)
  name                 TEXT,                           -- User name
  company_name         TEXT,                           -- Company name  
  industry             TEXT,                           -- Industry type
  
  -- Onboarding system fields
  signup_timestamp     TIMESTAMP NOT NULL DEFAULT NOW(), -- Account creation
  onboarding_step      VARCHAR(50) NOT NULL DEFAULT 'pending', -- Current step
  full_name            TEXT,                           -- Full name from onboarding
  business_name        TEXT,                           -- Business name from onboarding
  brand_description    TEXT,                           -- Brand description
  email_schedule_status JSONB DEFAULT '{}',            -- Email scheduling status
  
  -- Trial system fields
  trial_start_date     TIMESTAMP,                      -- Trial start timestamp
  trial_end_date       TIMESTAMP,                      -- Trial end timestamp
  trial_status         VARCHAR(20) DEFAULT 'pending',  -- Trial status
  stripe_customer_id   TEXT,                           -- Stripe customer ID
  stripe_subscription_id TEXT,                         -- Stripe subscription ID
  subscription_status  VARCHAR(20) DEFAULT 'none',     -- Subscription status
  
  -- Admin system
  is_admin             BOOLEAN DEFAULT false,          -- Database admin role
  
  -- Timestamps
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### **Field Details**:

**Identification & Profile**:
- `user_id` (TEXT): Clerk user ID in format `user_2xxxxx` (unique constraint)
- `email` (TEXT): User's primary email address
- `name`, `company_name`, `industry`: Original profile fields (now optional)

**Onboarding Fields**:
- `onboarding_step`: `'pending'` | `'info_captured'` | `'intent_captured'` | `'completed'`
- `full_name`: Complete name captured during onboarding
- `business_name`: Business/brand name from onboarding
- `brand_description`: Detailed brand description
- `email_schedule_status`: JSONB tracking email sending status

**Trial System**:
- `trial_status`: `'pending'` | `'active'` | `'expired'` | `'cancelled'` | `'converted'`
- `trial_start_date`, `trial_end_date`: 7-day trial period tracking
- `stripe_customer_id`, `stripe_subscription_id`: Mock Stripe integration
- `subscription_status`: `'none'` | `'trialing'` | `'active'` | `'past_due'` | `'canceled'`

**Admin System**:
- `is_admin`: Database-based admin role (works with environment variables)

#### **Indexes**:
```sql
-- Performance indexes
CREATE INDEX idx_user_profiles_trial_status ON user_profiles(trial_status);
CREATE INDEX idx_user_profiles_trial_dates ON user_profiles(trial_start_date, trial_end_date);
CREATE INDEX idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);
CREATE INDEX idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = true;
CREATE INDEX idx_user_profiles_admin_details ON user_profiles(is_admin, full_name, email, updated_at);
```

### 2. **Campaigns Table** - `campaigns`

#### **Purpose**: High-level campaign container for influencer search operations

#### **Schema**:
```sql
CREATE TABLE campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,                         -- References user_profiles.user_id
  name         TEXT NOT NULL,                         -- Campaign name
  description  TEXT,                                  -- Optional description
  search_type  VARCHAR(20) NOT NULL,                  -- 'keyword' | 'similar'
  status       VARCHAR(20) NOT NULL DEFAULT 'draft',  -- Campaign status
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### **Field Details**:
- `search_type`: Determines search method (`'keyword'` or `'similar'`)
- `status`: `'draft'` | `'active'` | `'completed'` | `'archived'`
- `user_id`: Links to Clerk user ID (no foreign key for flexibility)

### 3. **Scraping Jobs Table** - `scraping_jobs`

#### **Purpose**: Background job processing for platform searches with comprehensive tracking

#### **Schema**:
```sql
CREATE TABLE scraping_jobs (
  -- Primary identification
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT NOT NULL,                   -- Clerk user ID
  campaign_id        UUID REFERENCES campaigns(id),   -- Parent campaign
  
  -- Job configuration
  platform           VARCHAR(50) NOT NULL DEFAULT 'Tiktok', -- Platform name
  keywords           JSONB,                          -- Keywords array for keyword search
  target_username    TEXT,                           -- Username for similar search
  search_params      JSONB,                          -- Additional search parameters
  region             VARCHAR(10) NOT NULL DEFAULT 'US', -- Search region
  
  -- Processing state
  status             VARCHAR(20) NOT NULL DEFAULT 'pending', -- Job status
  run_id             TEXT,                           -- External API run ID
  qstash_message_id  TEXT,                           -- QStash message tracking
  
  -- Progress tracking
  processed_runs     INTEGER NOT NULL DEFAULT 0,     -- Number of API calls made
  processed_results  INTEGER NOT NULL DEFAULT 0,     -- Total creators found
  target_results     INTEGER NOT NULL DEFAULT 1000,  -- Target number of results
  cursor             INTEGER DEFAULT 0,              -- Pagination cursor
  progress           NUMERIC DEFAULT 0,              -- Progress percentage (0-100)
  
  -- Timestamps
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at         TIMESTAMP,                      -- When processing started
  completed_at       TIMESTAMP,                      -- When processing completed
  timeout_at         TIMESTAMP,                      -- Timeout timestamp
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Error handling
  error              TEXT                            -- Error message if failed
);
```

#### **Field Details**:

**Platform Configuration**:
- `platform`: `'TikTok'` | `'Instagram'` | `'YouTube'` (exact casing)
- `keywords`: JSONB array for keyword searches: `["keyword1", "keyword2"]`
- `target_username`: Username for similar searches (e.g., `"@username"`)
- `search_params`: Additional parameters like filters, sorting

**Job Status Flow**:
```
pending → processing → completed
                   ↘ error
                   ↘ timeout
```

**Status Values**:
- `'pending'`: Job created, waiting for processing
- `'processing'`: Currently being processed by QStash
- `'completed'`: Successfully finished
- `'error'`: Failed with error
- `'timeout'`: Exceeded time limit

**Progress Tracking**:
- `processed_runs`: Number of API calls made (limited for testing)
- `processed_results`: Total creators/videos found
- `target_results`: Goal (100 for testing, 1000 for production)
- `progress`: Calculated percentage (0-100)
- `cursor`: Pagination position for continuing searches

### 4. **Scraping Results Table** - `scraping_results`

#### **Purpose**: Stores processed creator/video data from platform APIs

#### **Schema**:
```sql
CREATE TABLE scraping_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID REFERENCES scraping_jobs(id),      -- Parent job
  creators   JSONB NOT NULL,                         -- Platform-specific creator data
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### **Creator Data Structure** (JSONB):

**TikTok Keyword Search**:
```json
[
  {
    "creator": {
      "name": "Creator Name",
      "followers": 150000,
      "avatarUrl": "/api/proxy/image?url=...",
      "profilePicUrl": "/api/proxy/image?url=...",
      "bio": "Creator bio with emails",
      "emails": ["contact@creator.com"],
      "uniqueId": "@creatorhandle",
      "verified": true
    },
    "video": {
      "description": "Video title/description",
      "url": "https://tiktok.com/@creator/video/123",
      "statistics": {
        "likes": 5000,
        "comments": 150,
        "shares": 75,
        "views": 50000
      }
    },
    "hashtags": ["#trending", "#viral"],
    "platform": "TikTok"
  }
]
```

**TikTok Similar Search**:
```json
[
  {
    "creator": {
      "name": "Similar Creator",
      "followers": 75000,
      "avatarUrl": "/api/proxy/image?url=...",
      "bio": "Similar creator bio",
      "emails": ["hello@similarcreator.com"],
      "uniqueId": "@similarcreator"
    },
    "platform": "TikTok",
    "searchType": "similar",
    "targetUsername": "@originalcreator"
  }
]
```

**Instagram Similar Search**:
```json
[
  {
    "id": "instagram_user_id",
    "username": "instagram_handle",
    "full_name": "Display Name",
    "is_private": false,
    "is_verified": true,
    "profile_pic_url": "https://instagram.com/profile.jpg",
    "platform": "Instagram"
  }
]
```

**YouTube Keyword Search**:
```json
[
  {
    "creator": {
      "name": "Channel Name",
      "followers": 0,
      "avatarUrl": "https://youtube.com/channel-avatar.jpg"
    },
    "video": {
      "description": "Video Title",
      "url": "https://youtube.com/watch?v=...",
      "statistics": {
        "views": 100000,
        "likes": 0,
        "comments": 0
      }
    },
    "hashtags": ["#youtube", "#content"],
    "publishedTime": "2024-01-15",
    "lengthSeconds": 300,
    "platform": "YouTube"
  }
]
```

### 5. **System Configurations Table** - `system_configurations`

#### **Purpose**: App-wide configurable settings with hot-reload capability

#### **Schema**:
```sql
CREATE TABLE system_configurations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         VARCHAR(50) NOT NULL,              -- Config category
  key              VARCHAR(100) NOT NULL,             -- Config key
  value            TEXT NOT NULL,                     -- Config value
  value_type       VARCHAR(20) NOT NULL,              -- Value type for parsing
  description      TEXT,                              -- Human-readable description
  is_hot_reloadable VARCHAR(5) NOT NULL DEFAULT 'true', -- Can be changed without restart
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_category_key UNIQUE(category, key)
);
```

#### **Configuration Examples**:

**Email System Config**:
```sql
INSERT INTO system_configurations (category, key, value, value_type, description) VALUES
('email', 'trial_day_2_delay', '2 days', 'duration', 'Delay for day 2 trial email'),
('email', 'trial_day_5_delay', '5 days', 'duration', 'Delay for day 5 trial email'),
('email', 'trial_expiry_delay', '7 days', 'duration', 'Delay for trial expiry email');
```

**API Limits Config**:
```sql
INSERT INTO system_configurations (category, key, value, value_type, description) VALUES
('api', 'max_api_calls_testing', '1', 'number', 'API call limit for testing'),
('api', 'max_api_calls_production', '999', 'number', 'API call limit for production');
```

### 6. **Legacy Tables** - `search_jobs` & `search_results`

#### **Purpose**: Alternative implementation for search processing (currently unused)

#### **Search Jobs Schema**:
```sql
CREATE TABLE search_jobs (
  id             TEXT PRIMARY KEY,                    -- Custom job ID
  campaign_id    UUID REFERENCES campaigns(id),      -- Parent campaign
  platform       VARCHAR(20) NOT NULL,               -- Platform name
  search_type    VARCHAR(20) NOT NULL,               -- Search type
  status         VARCHAR(20) NOT NULL DEFAULT 'queued', -- Job status
  total_count    INTEGER NOT NULL,                   -- Expected results
  completed_count INTEGER NOT NULL DEFAULT 0,        -- Completed results
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMP
);
```

#### **Search Results Schema**:
```sql
CREATE TABLE search_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          TEXT NOT NULL REFERENCES search_jobs(id),
  profile_id      TEXT NOT NULL,                     -- Platform profile ID
  username        TEXT NOT NULL,                     -- Creator username
  display_name    TEXT,                              -- Creator display name
  platform        VARCHAR(20) NOT NULL,              -- Platform name
  profile_url     TEXT,                              -- Profile URL
  post_url        TEXT,                              -- Post URL
  post_description TEXT,                             -- Post description
  avatar_url      TEXT,                              -- Avatar image URL
  followers       INTEGER DEFAULT 0,                 -- Follower count
  is_verified     VARCHAR(10) DEFAULT 'false',       -- Verification status
  email           TEXT,                              -- Contact email
  bio             TEXT,                              -- Creator bio
  raw_data        JSONB,                             -- Original API response
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 🔄 Drizzle ORM Configuration

### Connection Setup - `lib/db/index.ts`

#### **Global Connection Pooling**:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Global caching for Vercel serverless functions
declare global {
  var __queryClient: ReturnType<typeof postgres> | undefined;
  var __db: ReturnType<typeof drizzle> | undefined;
}

const connectionString = process.env.DATABASE_URL!;

// Re-use connection pool across serverless invocations
const queryClient = global.__queryClient ?? postgres(connectionString, {
  idle_timeout: 30,        // Keep idle connections for 30 seconds
  max_lifetime: 60 * 60,   // Close connections after 1 hour
});

if (!global.__queryClient) global.__queryClient = queryClient;

// Drizzle ORM instance with schema relations
export const db = global.__db ?? drizzle(queryClient, {
  schema: {
    ...schema,
    scrapingJobsRelations: schema.scrapingJobsRelations,
    scrapingResultsRelations: schema.scrapingResultsRelations,
  },
});

if (!global.__db) global.__db = db;
```

#### **Key Features**:
- ✅ **Connection Pooling**: Reuses connections across Vercel function calls
- ✅ **Global Caching**: Prevents connection exhaustion in serverless environment
- ✅ **Schema Relations**: Includes Drizzle relations for joins
- ✅ **Performance Optimized**: Configured for Supabase limits

### Schema Relations - `lib/db/schema.ts`

#### **Table Relationships**:
```typescript
import { relations } from 'drizzle-orm';

// Campaign → Scraping Jobs (1:N)
export const campaignRelations = relations(campaigns, ({ many }) => ({
  scrapingJobs: many(scrapingJobs),
  searchJobs: many(searchJobs),         // Legacy support
}));

// Scraping Job → Campaign (N:1) & Results (1:N)
export const scrapingJobsRelations = relations(scrapingJobs, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [scrapingJobs.campaignId],
    references: [campaigns.id],
  }),
  results: many(scrapingResults),
}));

// Scraping Result → Job (N:1)
export const scrapingResultsRelations = relations(scrapingResults, ({ one }) => ({
  job: one(scrapingJobs, {
    fields: [scrapingResults.jobId],
    references: [scrapingJobs.id],
  }),
}));
```

#### **TypeScript Types**:
```typescript
// Inferred types for type safety
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type NewScrapingJob = typeof scrapingJobs.$inferInsert;
export type ScrapingResult = typeof scrapingResults.$inferSelect;
export type NewScrapingResult = typeof scrapingResults.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
```

## 🎯 Common Query Patterns

### 1. **User Profile Operations**

#### **Get User Profile with Trial Data**:
```typescript
const userProfile = await db.query.userProfiles.findFirst({
  where: eq(userProfiles.userId, userId)
});
```

#### **Create User Profile**:
```typescript
const [profile] = await db.insert(userProfiles).values({
  userId: clerkUserId,
  email: userEmail,
  fullName: 'John Doe',
  businessName: 'Acme Corp',
  onboardingStep: 'completed'
}).returning();
```

#### **Update Trial Status**:
```typescript
await db.update(userProfiles)
  .set({
    trialStatus: 'active',
    trialStartDate: new Date(),
    trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date()
  })
  .where(eq(userProfiles.userId, userId));
```

### 2. **Campaign & Job Operations**

#### **Create Campaign with Job**:
```typescript
await db.transaction(async (tx) => {
  // Create campaign
  const [campaign] = await tx.insert(campaigns).values({
    userId,
    name: 'TikTok Keyword Search',
    searchType: 'keyword',
    status: 'active'
  }).returning();

  // Create scraping job
  const [job] = await tx.insert(scrapingJobs).values({
    userId,
    campaignId: campaign.id,
    platform: 'TikTok',
    keywords: ['fitness', 'workout'],
    status: 'pending',
    targetResults: 1000
  }).returning();

  return { campaign, job };
});
```

#### **Get Job with Results**:
```typescript
const job = await db.query.scrapingJobs.findFirst({
  where: eq(scrapingJobs.id, jobId),
  with: {
    results: true,     // Include related results
    campaign: true     // Include parent campaign
  }
});
```

#### **Update Job Progress**:
```typescript
await db.update(scrapingJobs)
  .set({
    processedRuns: job.processedRuns + 1,
    processedResults: job.processedResults + newCreators.length,
    progress: calculateProgress(newProcessedResults, targetResults),
    updatedAt: new Date()
  })
  .where(eq(scrapingJobs.id, jobId));
```

### 3. **Results Operations**

#### **Save Search Results**:
```typescript
await db.insert(scrapingResults).values({
  jobId,
  creators: creatorsData    // JSONB array of creator objects
});
```

#### **Get All Results for Job**:
```typescript
const results = await db.query.scrapingResults.findMany({
  where: eq(scrapingResults.jobId, jobId),
  orderBy: desc(scrapingResults.createdAt)
});

// Flatten all creators from all result records
const allCreators = results.flatMap(result => result.creators);
```

### 4. **Admin Operations**

#### **Check Admin Status**:
```typescript
const userProfile = await db.query.userProfiles.findFirst({
  where: eq(userProfiles.userId, userId),
  columns: { isAdmin: true }
});

const isAdmin = userProfile?.isAdmin || false;
```

#### **Promote User to Admin**:
```typescript
await db.update(userProfiles)
  .set({ 
    isAdmin: true,
    updatedAt: new Date()
  })
  .where(eq(userProfiles.userId, targetUserId));
```

#### **Get All Admin Users**:
```typescript
const adminUsers = await db.query.userProfiles.findMany({
  where: eq(userProfiles.isAdmin, true),
  columns: {
    userId: true,
    fullName: true,
    email: true,
    isAdmin: true,
    updatedAt: true
  }
});
```

## 🚀 Migration Management

### Migration Files Structure

#### **Migration History**:
```
0000_sleepy_moira_mactaggert.sql     # Initial schema
0001_pale_jamie_braddock.sql         # Campaign system
0002_lively_cable.sql                # Job processing
0003_late_ultron.sql                 # Results storage
0004_qstash_fields.sql               # QStash integration
0005_sudden_paibok.sql               # Enhanced job fields
0006_chunky_proteus.sql              # System configurations
0007_melodic_jean_grey.sql           # Legacy tables
0008_nifty_stick.sql                 # Onboarding system
0009_trial_system.sql                # Trial system fields
0010_search_indexes.sql              # Performance indexes
0011_admin_roles.sql                 # Admin system
```

#### **Running Migrations**:
```bash
# Apply all pending migrations
npm run db:migrate

# Generate new migration
npm run db:generate

# Push schema changes (development)
npm run db:push
```

### Index Strategy

#### **Performance Indexes**:
```sql
-- User profile performance
CREATE INDEX idx_user_profiles_trial_status ON user_profiles(trial_status);
CREATE INDEX idx_user_profiles_trial_dates ON user_profiles(trial_start_date, trial_end_date);
CREATE INDEX idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);

-- Admin system performance
CREATE INDEX idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = true;
CREATE INDEX idx_user_profiles_admin_details ON user_profiles(is_admin, full_name, email, updated_at);

-- Job processing performance
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_platform ON scraping_jobs(platform);
CREATE INDEX idx_scraping_jobs_user_campaign ON scraping_jobs(user_id, campaign_id);

-- Results performance
CREATE INDEX idx_scraping_results_job_id ON scraping_results(job_id);
CREATE INDEX idx_scraping_results_created_at ON scraping_results(created_at);
```

## 🔧 Environment Configuration

### Required Database Variables

```bash
# Primary database connection
DATABASE_URL="postgresql://user:password@host:port/database"

# Supabase (hosting only - auth handled by Clerk)
NEXT_PUBLIC_SUPABASE_URL="https://project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="service_role_key"
```

### Connection Pool Settings

#### **Production Configuration**:
```typescript
const queryClient = postgres(connectionString, {
  idle_timeout: 30,           // Keep idle connections for 30 seconds
  max_lifetime: 60 * 60,      // Close connections after 1 hour
  max: 10,                    // Maximum connections in pool
  idle_timeout: 20,           // Idle timeout in seconds
  connect_timeout: 60,        // Connection timeout
});
```

## 🛡️ Security & Best Practices

### 1. **Data Access Patterns**

#### **User Data Isolation**:
```typescript
// Always scope queries by user ID
const userCampaigns = await db.query.campaigns.findMany({
  where: eq(campaigns.userId, authenticatedUserId)  // Always include user filter
});
```

#### **SQL Injection Prevention**:
```typescript
// ✅ Safe: Parameterized queries via Drizzle
await db.select().from(campaigns).where(eq(campaigns.id, campaignId));

// ❌ Unsafe: Never use raw SQL with user input
// await db.execute(sql`SELECT * FROM campaigns WHERE id = ${campaignId}`);
```

### 2. **Transaction Patterns**

#### **Atomic Operations**:
```typescript
await db.transaction(async (tx) => {
  // All operations succeed or all fail
  const campaign = await tx.insert(campaigns).values(campaignData).returning();
  const job = await tx.insert(scrapingJobs).values(jobData).returning();
  
  // If any operation fails, entire transaction is rolled back
  return { campaign: campaign[0], job: job[0] };
});
```

### 3. **Error Handling**

#### **Database Error Patterns**:
```typescript
try {
  const result = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId)
  });
  
  if (!result) {
    throw new Error('User profile not found');
  }
  
  return result;
} catch (error) {
  console.error('Database error:', error);
  throw new Error('Database operation failed');
}
```

## 📊 Performance Monitoring

### Query Performance

#### **Slow Query Identification**:
```sql
-- Monitor long-running queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000  -- Queries taking > 1 second
ORDER BY mean_exec_time DESC;
```

#### **Index Usage Analysis**:
```sql
-- Check index usage efficiency
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Connection Monitoring

#### **Connection Pool Status**:
```typescript
// Monitor active connections
console.log('Active connections:', queryClient.options.max);
console.log('Idle connections:', queryClient.idle);
```

---

**Next**: Continue with [Drizzle ORM Patterns](./drizzle-orm.md) for detailed ORM usage patterns and advanced query techniques.