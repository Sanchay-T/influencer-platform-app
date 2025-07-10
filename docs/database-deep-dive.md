# 🗄️ Complete Database Deep Dive - Influencer Platform

## 📚 Table of Contents
1. [Database Fundamentals](#database-fundamentals)
2. [Database Connection Architecture](#database-connection-architecture)
3. [Complete Database Schema](#complete-database-schema)
4. [CRUD Operations with Code Examples](#crud-operations-with-code-examples)
5. [Query Patterns and Advanced Operations](#query-patterns-and-advanced-operations)
6. [Migration System](#migration-system)
7. [Database Utilities and Helper Functions](#database-utilities-and-helper-functions)
8. [Performance Optimizations](#performance-optimizations)
9. [Best Practices and Patterns](#best-practices-and-patterns)

---

## 1. Database Fundamentals

### 🎯 What is a Database?
A database is a structured collection of data that's stored and accessed electronically. Think of it like a digital filing cabinet where each drawer (table) contains organized folders (rows) with specific information (columns).

### 🔗 Database Management System (DBMS)
Our application uses **PostgreSQL** as the DBMS - it's like the engine that manages our data storage, retrieval, and ensures data integrity.

### 🏗️ Database Architecture in Our App
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Next.js)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ - User Actions  │    │ - API Routes    │    │ - Data Storage  │
│ - Forms         │    │ - CRUD Logic    │    │ - Relationships │
│ - Displays      │    │ - Validation    │    │ - Constraints   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 2. Database Connection Architecture

### 📍 Location: `/lib/db/index.ts`

### 🔧 Technology Stack
- **Database**: PostgreSQL (hosted on Supabase)
- **ORM**: Drizzle ORM (Object-Relational Mapping)
- **Driver**: postgres.js (Node.js PostgreSQL client)
- **Deployment**: Vercel Serverless Functions

### 🌐 Connection Setup

```typescript
// /lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Connection string from environment variables
const connectionString = process.env.DATABASE_URL!;

// Global connection caching for serverless functions
const queryClient = global.__queryClient ?? postgres(connectionString, {
  idle_timeout: 30,        // Close idle connections after 30 seconds
  max_lifetime: 60 * 60,   // Maximum connection lifetime: 1 hour
});

// Drizzle ORM instance with schema
export const db = global.__db ?? drizzle(queryClient, {
  schema: { 
    campaigns,
    scrapingJobs,
    scrapingResults,
    userProfiles,
    systemConfigurations,
    // Relations for joins
    campaignRelations,
    scrapingJobsRelations,
    scrapingResultsRelations
  },
});

// Cache connections globally (important for serverless)
if (process.env.NODE_ENV !== 'production') {
  global.__queryClient = queryClient;
  global.__db = db;
}
```

### 🚀 Why This Architecture?

1. **Connection Pooling**: Reuses database connections instead of creating new ones
2. **Serverless Optimization**: Global caching prevents connection exhaustion
3. **Auto-cleanup**: Idle connections are automatically closed
4. **Environment Separation**: Different handling for dev vs production

---

## 3. Complete Database Schema

### 📊 Database Tables Overview

```
userProfiles (1) ──owns──► campaigns (N)
     │                        │
     │                        ├──has──► scrapingJobs (N)
     │                        │             │
     │                        │             ├──produces──► scrapingResults (N)
     │                        │             │
     │                        │             └──tracked_by──► systemConfigurations
     │                        │
     │                        └──has──► searchJobs (N) [Legacy]
     │                                      │
     │                                      └──produces──► searchResults (N)
     │
     └──references──► Clerk Users (External)
```

### 🗂️ Table Definitions

#### A. **userProfiles** - User Information & Onboarding
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,              -- Clerk user ID (text format)
  
  -- Legacy fields (from old profile system)
  name TEXT,                                 -- Optional: legacy name
  company_name TEXT,                         -- Optional: legacy company
  industry TEXT,                             -- Optional: legacy industry
  email TEXT,                                -- Optional: cached email
  
  -- NEW: Onboarding system fields
  signup_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  onboarding_step VARCHAR(50) NOT NULL DEFAULT 'pending',
  full_name TEXT,                            -- From onboarding step 1
  business_name TEXT,                        -- From onboarding step 1
  brand_description TEXT,                    -- From onboarding step 2
  email_schedule_status JSONB DEFAULT '{}', -- Email tracking
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_onboarding ON user_profiles(onboarding_step);
```

**Example Data**:
```json
{
  "user_id": "user_2zb4wFmyH7n6rV7ByOGNhexQVfi",
  "full_name": "John Doe",
  "business_name": "Acme Corp",
  "brand_description": "We're a tech startup building productivity apps...",
  "onboarding_step": "completed",
  "email_schedule_status": {
    "welcome": {
      "status": "sent",
      "messageId": "msg_123",
      "timestamp": "2025-01-08T10:00:00Z"
    }
  }
}
```

#### B. **campaigns** - Marketing Campaigns
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,                     -- Who owns this campaign
  name TEXT NOT NULL,                        -- Campaign name
  description TEXT,                          -- Campaign description
  search_type VARCHAR(20) NOT NULL,          -- 'keyword' or 'similar'
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'completed'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

**Example Data**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_2zb4wFmyH7n6rV7ByOGNhexQVfi",
  "name": "Summer Fashion Campaign",
  "description": "Finding fashion influencers for summer collection",
  "search_type": "keyword",
  "status": "active"
}
```

#### C. **scrapingJobs** - Background Processing Jobs
```sql
CREATE TABLE scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,                     -- Who initiated this job
  campaign_id UUID REFERENCES campaigns(id), -- Which campaign this belongs to
  
  -- Job configuration
  keywords JSONB,                            -- ["fashion", "summer"] for keyword search
  target_username TEXT,                      -- "@username" for similar search
  platform VARCHAR(50) NOT NULL DEFAULT 'Tiktok', -- 'TikTok', 'Instagram', 'YouTube'
  region VARCHAR(10) NOT NULL DEFAULT 'US',  -- Geographic region
  target_results INTEGER NOT NULL DEFAULT 1000, -- How many results to find
  
  -- Job status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  run_id TEXT,                               -- Unique run identifier
  processed_runs INTEGER NOT NULL DEFAULT 0, -- API calls made
  processed_results INTEGER NOT NULL DEFAULT 0, -- Results found
  progress NUMERIC DEFAULT '0',               -- 0-100 percentage
  cursor INTEGER DEFAULT 0,                  -- Pagination cursor
  
  -- QStash integration
  qstash_message_id TEXT,                    -- QStash message tracking
  search_params JSONB,                       -- Additional search parameters
  
  -- Error handling
  error TEXT,                                -- Error message if failed
  timeout_at TIMESTAMP,                      -- When job should timeout
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,                      -- When processing started
  completed_at TIMESTAMP,                    -- When job finished
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_scraping_jobs_user_id ON scraping_jobs(user_id);
CREATE INDEX idx_scraping_jobs_campaign_id ON scraping_jobs(campaign_id);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_platform ON scraping_jobs(platform);
```

**Example Data**:
```json
{
  "id": "job_abc123",
  "user_id": "user_2zb4wFmyH7n6rV7ByOGNhexQVfi",
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "keywords": ["fashion", "summer", "outfit"],
  "platform": "TikTok",
  "status": "processing",
  "processed_runs": 3,
  "processed_results": 45,
  "progress": "45.0",
  "target_results": 100
}
```

#### D. **scrapingResults** - Final Results Storage
```sql
CREATE TABLE scraping_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scraping_jobs(id), -- Which job produced this
  creators JSONB NOT NULL,                   -- Array of creator objects
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scraping_results_job_id ON scraping_results(job_id);
```

**Example Data**:
```json
{
  "job_id": "job_abc123",
  "creators": [
    {
      "creator": {
        "name": "FashionGuru",
        "followers": 150000,
        "avatarUrl": "https://...",
        "bio": "Fashion influencer and stylist",
        "emails": ["contact@fashionguru.com"]
      },
      "video": {
        "description": "Summer outfit ideas 2024",
        "url": "https://tiktok.com/@fashionguru/video/123",
        "statistics": {
          "likes": 25000,
          "comments": 1200,
          "shares": 800,
          "views": 500000
        }
      },
      "hashtags": ["#fashion", "#summer", "#outfit"],
      "platform": "TikTok"
    }
  ]
}
```

#### E. **systemConfigurations** - Dynamic Settings
```sql
CREATE TABLE system_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,             -- 'api_limits', 'timeouts', etc.
  key VARCHAR(100) NOT NULL,                 -- 'max_api_calls_tiktok'
  value TEXT NOT NULL,                       -- '5' or '30s' or 'true'
  value_type VARCHAR(20) NOT NULL,           -- 'number', 'duration', 'boolean'
  description TEXT,                          -- Human-readable description
  is_hot_reloadable VARCHAR(5) NOT NULL DEFAULT 'true',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure unique category-key combinations
  UNIQUE(category, key)
);
```

**Example Data**:
```json
[
  {
    "category": "api_limits",
    "key": "max_api_calls_tiktok",
    "value": "5",
    "value_type": "number",
    "description": "Maximum API calls for TikTok search"
  },
  {
    "category": "timeouts",
    "key": "standard_job_timeout",
    "value": "30m",
    "value_type": "duration",
    "description": "Standard job timeout duration"
  }
]
```

---

## 4. CRUD Operations with Code Examples

### 🔨 CREATE Operations

#### A. **Creating a Campaign**
**File**: `/app/api/campaigns/route.ts`

```typescript
export async function POST(request: Request) {
  try {
    // 1. Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request data
    const { name, description, searchType } = await request.json();
    
    // 3. Validation
    if (!name || !searchType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 4. Database INSERT operation
    const [campaign] = await db.insert(campaigns).values({
      userId: userId,
      name,
      description,
      searchType,
      status: 'draft'  // Default status
    }).returning();  // Returns the created record

    // 5. Return success response
    return NextResponse.json(campaign, { status: 201 });
    
  } catch (error) {
    console.error('Campaign creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

#### B. **Creating a Scraping Job**
**File**: `/app/api/scraping/tiktok/route.ts`

```typescript
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const { keywords, targetResults, campaignId } = await request.json();

    // Input validation and sanitization
    const sanitizedKeywords = keywords.map((k: string) => k.trim()).filter(Boolean);
    
    // CREATE operation with complex data
    const [job] = await db.insert(scrapingJobs)
      .values({
        userId: userId,
        keywords: sanitizedKeywords,     // JSONB array
        targetResults,
        status: 'pending',
        platform: 'Tiktok',
        campaignId,
        // Calculate timeout (30 minutes from now)
        timeoutAt: new Date(Date.now() + 30 * 60 * 1000)
      })
      .returning();

    // Schedule background processing with QStash
    await qstash.publishJSON({
      url: `${siteUrl}/api/qstash/process-scraping`,
      body: { jobId: job.id },
      delay: '5s'  // Start processing in 5 seconds
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### C. **Creating User Profile (Onboarding)**
**File**: `/app/api/onboarding/step-1/route.ts`

```typescript
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    const { fullName, businessName } = await request.json();

    // Check if profile exists
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (existingProfile) {
      // UPDATE existing profile
      await db.update(userProfiles)
        .set({
          fullName: fullName.trim(),
          businessName: businessName.trim(),
          onboardingStep: 'info_captured',
          updatedAt: new Date()
        })
        .where(eq(userProfiles.userId, userId));
    } else {
      // CREATE new profile
      await db.insert(userProfiles).values({
        userId,
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        onboardingStep: 'info_captured',
        signupTimestamp: new Date(),
        emailScheduleStatus: {}
      });

      // Schedule welcome email
      await scheduleEmail({
        userId,
        emailType: 'welcome',
        userEmail: await getUserEmailFromClerk(userId),
        templateProps: {
          fullName: fullName.trim(),
          businessName: businessName.trim(),
          dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/`
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 📖 READ Operations

#### A. **Simple Read with Filtering**
**File**: `/app/api/campaigns/route.ts`

```typescript
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = (page - 1) * limit;

    // PARALLEL queries for performance
    const [totalCount, userCampaigns] = await Promise.all([
      // Count total campaigns
      db.select({ count: count() })
        .from(campaigns)
        .where(eq(campaigns.userId, userId))
        .then(result => result[0].count),
      
      // Get paginated campaigns with related jobs
      db.query.campaigns.findMany({
        where: (campaigns, { eq }) => eq(campaigns.userId, userId),
        limit: limit,
        offset: offset,
        with: {
          scrapingJobs: {
            limit: 1,  // Only get the most recent job
            orderBy: (jobs, { desc }) => [desc(jobs.createdAt)]
          }
        },
        orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)]
      })
    ]);

    return NextResponse.json({
      campaigns: userCampaigns,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit: limit
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### B. **Complex Read with Nested Relations**
**File**: `/app/api/campaigns/[id]/route.ts`

```typescript
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    const { id } = params;

    // Complex query with multiple levels of relations
    const campaign = await db.query.campaigns.findFirst({
      where: (campaigns, { eq, and }) => and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId)  // Security: only return user's campaigns
      ),
      with: {
        scrapingJobs: {
          with: {
            results: {
              columns: {
                id: true,
                jobId: true,
                creators: true,
                createdAt: true
              }
            }
          },
          orderBy: (jobs, { desc }) => [desc(jobs.createdAt)]
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### C. **Read with Aggregations**
**File**: `/app/api/jobs/[id]/route.ts`

```typescript
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    const { id } = params;

    // Get job with results and calculate aggregations
    const job = await db.query.scrapingJobs.findFirst({
      where: (jobs, { eq, and }) => and(
        eq(jobs.id, id),
        eq(jobs.userId, userId)
      ),
      with: {
        results: {
          columns: {
            id: true,
            creators: true,
            createdAt: true
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Calculate aggregations from JSONB data
    const results = job.results || [];
    const totalCreators = results.reduce((sum, result) => {
      return sum + (result.creators ? result.creators.length : 0);
    }, 0);

    return NextResponse.json({
      ...job,
      aggregations: {
        totalResults: results.length,
        totalCreators: totalCreators,
        averageCreatorsPerResult: results.length ? totalCreators / results.length : 0
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### ✏️ UPDATE Operations

#### A. **Simple Update**
**File**: `/app/api/jobs/[id]/route.ts`

```typescript
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    const { id } = params;
    const { action } = await request.json();

    if (action === 'cancel') {
      // UPDATE with status change
      const [updatedJob] = await db.update(scrapingJobs)
        .set({ 
          status: 'cancelled',
          updatedAt: new Date(),
          completedAt: new Date(),
          error: 'Job cancelled by user'
        })
        .where(and(
          eq(scrapingJobs.id, id),
          eq(scrapingJobs.userId, userId)  // Security check
        ))
        .returning();

      if (!updatedJob) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json(updatedJob);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### B. **Complex Update with JSONB**
**File**: `/app/api/qstash/process-scraping/route.ts`

```typescript
// Update job progress and results
await db.update(scrapingJobs)
  .set({
    status: 'processing',
    processedRuns: processedRuns + 1,
    processedResults: processedResults + newResults.length,
    progress: calculateProgress(processedRuns, processedResults, targetResults),
    updatedAt: new Date(),
    startedAt: startedAt || new Date()
  })
  .where(eq(scrapingJobs.id, jobId));

// Save results as JSONB
await db.insert(scrapingResults).values({
  jobId: jobId,
  creators: newResults  // Array of creator objects stored as JSONB
});

// Update email schedule status (JSONB field)
await db.update(userProfiles)
  .set({
    emailScheduleStatus: sql`
      jsonb_set(
        COALESCE(${userProfiles.emailScheduleStatus}, '{}'),
        '{welcome}',
        '{"status": "sent", "timestamp": ${new Date().toISOString()}}',
        true
      )
    `,
    updatedAt: new Date()
  })
  .where(eq(userProfiles.userId, userId));
```

### 🗑️ DELETE Operations

#### A. **Simple Delete**
**File**: `/app/api/campaigns/[id]/route.ts`

```typescript
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    const { id } = params;

    // DELETE with security check
    const [deletedCampaign] = await db.delete(campaigns)
      .where(and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId)  // Only delete user's campaigns
      ))
      .returning();

    if (!deletedCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### B. **Cascade Delete with Cleanup**
**File**: `/app/api/jobs/cleanup/route.ts`

```typescript
export async function POST(request: Request) {
  try {
    const { status, olderThanDays } = await request.json();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // IMPORTANT: Delete in correct order due to foreign key constraints
    
    // Step 1: Delete results first (child records)
    const deletedResults = await db.delete(scrapingResults)
      .where(
        and(
          lt(scrapingResults.createdAt, cutoffDate),
          // Join condition to check job status
          inArray(scrapingResults.jobId, 
            db.select({ id: scrapingJobs.id })
              .from(scrapingJobs)
              .where(eq(scrapingJobs.status, status))
          )
        )
      )
      .returning();

    // Step 2: Delete jobs (parent records)
    const deletedJobs = await db.delete(scrapingJobs)
      .where(
        and(
          lt(scrapingJobs.createdAt, cutoffDate),
          eq(scrapingJobs.status, status)
        )
      )
      .returning();

    return NextResponse.json({
      deletedJobs: deletedJobs.length,
      deletedResults: deletedResults.length,
      cutoffDate: cutoffDate.toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 5. Query Patterns and Advanced Operations

### 🔍 Advanced Filtering with Drizzle

#### A. **Complex WHERE Conditions**
```typescript
// Multiple AND conditions
where: (table, { eq, and, lt, gt }) => and(
  eq(table.userId, userId),
  eq(table.status, 'active'),
  lt(table.createdAt, yesterday),
  gt(table.processedResults, 0)
)

// OR conditions
where: (table, { eq, or }) => or(
  eq(table.status, 'pending'),
  eq(table.status, 'processing')
)

// Complex nested conditions
where: (table, { eq, and, or, lt }) => and(
  eq(table.userId, userId),
  or(
    eq(table.status, 'completed'),
    and(
      eq(table.status, 'processing'),
      lt(table.updatedAt, timeout)
    )
  )
)
```

#### B. **JSONB Queries**
```typescript
// Query JSONB arrays
const jobs = await db.select()
  .from(scrapingJobs)
  .where(sql`${scrapingJobs.keywords} ? 'fashion'`);  // Check if array contains 'fashion'

// Query nested JSONB objects
const profiles = await db.select()
  .from(userProfiles)
  .where(sql`${userProfiles.emailScheduleStatus}->>'welcome' = 'sent'`);

// Update JSONB fields
await db.update(userProfiles)
  .set({
    emailScheduleStatus: sql`
      jsonb_set(
        ${userProfiles.emailScheduleStatus},
        '{welcome,status}',
        '"sent"'
      )
    `
  })
  .where(eq(userProfiles.userId, userId));
```

#### C. **Aggregation Queries**
```typescript
// Count queries
const campaignCounts = await db
  .select({
    status: campaigns.status,
    count: count()
  })
  .from(campaigns)
  .where(eq(campaigns.userId, userId))
  .groupBy(campaigns.status);

// Average and sum
const jobStats = await db
  .select({
    avgResults: avg(scrapingJobs.processedResults),
    totalResults: sum(scrapingJobs.processedResults),
    maxResults: max(scrapingJobs.processedResults)
  })
  .from(scrapingJobs)
  .where(eq(scrapingJobs.userId, userId));
```

### 🚀 Advanced Query Patterns

#### A. **Pagination with Cursor**
```typescript
// Offset-based pagination (current implementation)
const campaigns = await db.query.campaigns.findMany({
  where: eq(campaigns.userId, userId),
  limit: 10,
  offset: (page - 1) * 10,
  orderBy: desc(campaigns.createdAt)
});

// Cursor-based pagination (more efficient for large datasets)
const campaigns = await db.query.campaigns.findMany({
  where: and(
    eq(campaigns.userId, userId),
    lt(campaigns.createdAt, cursorDate)  // cursor is a timestamp
  ),
  limit: 10,
  orderBy: desc(campaigns.createdAt)
});
```

#### B. **Subqueries**
```typescript
// Find campaigns with active jobs
const campaignsWithActiveJobs = await db.query.campaigns.findMany({
  where: and(
    eq(campaigns.userId, userId),
    exists(
      db.select()
        .from(scrapingJobs)
        .where(and(
          eq(scrapingJobs.campaignId, campaigns.id),
          eq(scrapingJobs.status, 'processing')
        ))
    )
  )
});
```

#### C. **Raw SQL for Complex Operations**
```typescript
// When Drizzle ORM doesn't support something, use raw SQL
const complexStats = await db.execute(sql`
  SELECT 
    c.name as campaign_name,
    COUNT(sj.id) as total_jobs,
    AVG(sj.processed_results) as avg_results,
    MAX(sj.created_at) as latest_job
  FROM campaigns c
  LEFT JOIN scraping_jobs sj ON c.id = sj.campaign_id
  WHERE c.user_id = ${userId}
  GROUP BY c.id, c.name
  ORDER BY latest_job DESC
`);
```

---

## 6. Migration System

### 📍 Configuration File: `/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',           // Where table definitions are
  out: './supabase/migrations',           // Where migration files go
  dialect: 'postgresql',                  // Database type
  dbCredentials: {
    url: process.env.DATABASE_URL!,       // Connection string
  },
  // Configuration for CHECK constraint bug fix
  introspect: { casing: 'preserve' },
  strict: false,
  verbose: true,
  breakpoints: false,
});
```

### 🔄 Migration Workflow

```bash
# 1. Make changes to schema.ts
# 2. Generate migration files
npm run db:generate

# 3. Review generated migration file
# 4. Apply migration to database
npm run db:migrate

# Combined command (generate + migrate)
npm run db:push
```

### 📁 Migration Files Structure

```
supabase/migrations/
├── 0000_sleepy_moira_mactaggert.sql    # Initial schema
├── 0001_pale_jamie_braddock.sql        # Added campaigns table
├── 0002_lively_cable.sql               # Added scraping_jobs table
├── 0003_late_ultron.sql                # Added user_profiles
├── 0004_qstash_fields.sql              # Added QStash tracking
├── 0005_sudden_paibok.sql              # Added system_configurations
├── 0006_chunky_proteus.sql             # Schema improvements
├── 0007_melodic_jean_grey.sql          # Added onboarding fields
├── 0008_nifty_stick.sql                # Latest onboarding changes
└── meta/
    ├── 0000_snapshot.json              # Schema snapshots
    ├── 0001_snapshot.json
    ├── ...
    └── _journal.json                   # Migration history
```

### 🔧 Example Migration File

```sql
-- 0008_nifty_stick.sql (Latest migration)
ALTER TABLE "user_profiles" ALTER COLUMN "name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "company_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "industry" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "signup_timestamp" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "onboarding_step" varchar(50) DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "full_name" text;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "business_name" text;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "brand_description" text;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "email_schedule_status" jsonb DEFAULT '{}';
```

### 🚨 Migration Best Practices

1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Review generated SQL before applying**
4. **Use migrations for schema changes, not data changes**
5. **Don't edit migration files after they're applied**

---

## 7. Database Utilities and Helper Functions

### 🛠️ System Configuration Service

**File**: `/lib/config/system-config.ts`

```typescript
class SystemConfigService {
  private cache = new Map<string, { value: any; expires: number }>();
  private readonly TTL = 30 * 1000; // 30 seconds cache

  async get(category: string, key: string, defaultValue?: any): Promise<any> {
    const cacheKey = `${category}:${key}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return cached.value;
    }

    try {
      // Query database
      const config = await db.query.systemConfigurations.findFirst({
        where: (configs, { eq, and }) => and(
          eq(configs.category, category),
          eq(configs.key, key)
        )
      });

      if (!config) {
        return defaultValue;
      }

      // Parse value based on type
      let parsedValue: any;
      switch (config.valueType) {
        case 'number':
          parsedValue = parseInt(config.value);
          break;
        case 'boolean':
          parsedValue = config.value === 'true';
          break;
        case 'duration':
          parsedValue = this.parseDuration(config.value);
          break;
        default:
          parsedValue = config.value;
      }

      // Cache if hot-reloadable
      if (config.isHotReloadable === 'true') {
        this.cache.set(cacheKey, {
          value: parsedValue,
          expires: Date.now() + this.TTL
        });
      }

      return parsedValue;
    } catch (error) {
      console.error('SystemConfig error:', error);
      return defaultValue;
    }
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)([smhd])/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }
}

export const SystemConfig = new SystemConfigService();

// Usage examples:
const timeout = await SystemConfig.get('timeouts', 'standard_job_timeout', 30000);
const maxCalls = await SystemConfig.get('api_limits', 'max_api_calls_tiktok', 5);
```

### 📊 Database Query Builder Helpers

```typescript
// /lib/db/query-helpers.ts
export class QueryHelpers {
  // Build dynamic WHERE conditions
  static buildWhereClause(filters: any) {
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(scrapingJobs.status, filters.status));
    }
    
    if (filters.platform) {
      conditions.push(eq(scrapingJobs.platform, filters.platform));
    }
    
    if (filters.dateRange) {
      conditions.push(
        and(
          gte(scrapingJobs.createdAt, filters.dateRange.start),
          lte(scrapingJobs.createdAt, filters.dateRange.end)
        )
      );
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  // Pagination helper
  static buildPagination(page: number, limit: number) {
    return {
      limit: Math.min(limit, 100), // Max 100 items per page
      offset: (page - 1) * limit
    };
  }

  // Order by helper
  static buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc' = 'desc') {
    const column = scrapingJobs[sortBy] || scrapingJobs.createdAt;
    return sortOrder === 'desc' ? desc(column) : asc(column);
  }
}
```

---

## 8. Performance Optimizations

### 🚀 Connection Pooling

```typescript
// Global connection caching for serverless functions
const queryClient = global.__queryClient ?? postgres(connectionString, {
  idle_timeout: 30,        // Close idle connections after 30 seconds
  max_lifetime: 3600,      // Maximum connection lifetime: 1 hour
  max: 10,                 // Maximum connections in pool
  transform: postgres.camel, // Convert snake_case to camelCase
});

// Prevent connection exhaustion in serverless
if (process.env.NODE_ENV !== 'production') {
  global.__queryClient = queryClient;
  global.__db = db;
}
```

### 📈 Query Optimizations

#### A. **Parallel Queries**
```typescript
// BAD: Sequential queries
const totalCount = await db.select({ count: count() }).from(campaigns);
const campaigns = await db.query.campaigns.findMany({...});

// GOOD: Parallel queries
const [totalCount, campaigns] = await Promise.all([
  db.select({ count: count() }).from(campaigns),
  db.query.campaigns.findMany({...})
]);
```

#### B. **Selective Column Loading**
```typescript
// BAD: Load all columns
const jobs = await db.query.scrapingJobs.findMany({});

// GOOD: Select only needed columns
const jobs = await db.select({
  id: scrapingJobs.id,
  status: scrapingJobs.status,
  progress: scrapingJobs.progress,
  createdAt: scrapingJobs.createdAt
}).from(scrapingJobs);
```

#### C. **Efficient Joins**
```typescript
// BAD: N+1 queries
const campaigns = await db.query.campaigns.findMany({});
for (const campaign of campaigns) {
  const jobs = await db.query.scrapingJobs.findMany({
    where: eq(scrapingJobs.campaignId, campaign.id)
  });
}

// GOOD: Single query with relations
const campaigns = await db.query.campaigns.findMany({
  with: {
    scrapingJobs: {
      columns: { id: true, status: true, progress: true }
    }
  }
});
```

### 🗂️ Indexing Strategy

```sql
-- Essential indexes for performance
CREATE INDEX CONCURRENTLY idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX CONCURRENTLY idx_campaigns_status ON campaigns(status);
CREATE INDEX CONCURRENTLY idx_campaigns_created_at ON campaigns(created_at);

CREATE INDEX CONCURRENTLY idx_scraping_jobs_user_id ON scraping_jobs(user_id);
CREATE INDEX CONCURRENTLY idx_scraping_jobs_campaign_id ON scraping_jobs(campaign_id);
CREATE INDEX CONCURRENTLY idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX CONCURRENTLY idx_scraping_jobs_platform ON scraping_jobs(platform);
CREATE INDEX CONCURRENTLY idx_scraping_jobs_created_at ON scraping_jobs(created_at);

CREATE INDEX CONCURRENTLY idx_scraping_results_job_id ON scraping_results(job_id);
CREATE INDEX CONCURRENTLY idx_scraping_results_created_at ON scraping_results(created_at);

CREATE UNIQUE INDEX CONCURRENTLY idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX CONCURRENTLY idx_user_profiles_onboarding_step ON user_profiles(onboarding_step);

-- JSONB indexes for better performance
CREATE INDEX CONCURRENTLY idx_scraping_jobs_keywords_gin ON scraping_jobs USING gin(keywords);
CREATE INDEX CONCURRENTLY idx_scraping_results_creators_gin ON scraping_results USING gin(creators);
```

---

## 9. Best Practices and Patterns

### 🛡️ Security Best Practices

#### A. **Always Validate User Ownership**
```typescript
// GOOD: Check user ownership
const campaign = await db.query.campaigns.findFirst({
  where: (campaigns, { eq, and }) => and(
    eq(campaigns.id, campaignId),
    eq(campaigns.userId, userId)  // Security check
  )
});

// BAD: No ownership check
const campaign = await db.query.campaigns.findFirst({
  where: eq(campaigns.id, campaignId)
});
```

#### B. **Input Validation and Sanitization**
```typescript
// Validate and sanitize inputs
const { name, description } = await request.json();

if (!name || typeof name !== 'string' || name.length > 100) {
  return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
}

const sanitizedName = name.trim();
const sanitizedDescription = description?.trim().substring(0, 500);
```

#### C. **Use Parameterized Queries**
```typescript
// GOOD: Drizzle ORM automatically parameterizes
const users = await db.query.userProfiles.findMany({
  where: eq(userProfiles.userId, userId)
});

// BAD: Raw SQL with string concatenation (vulnerable to SQL injection)
const users = await db.execute(sql`
  SELECT * FROM user_profiles WHERE user_id = '${userId}'
`);
```

### 🔄 Transaction Patterns

```typescript
// Use transactions for related operations
await db.transaction(async (tx) => {
  // Create campaign
  const [campaign] = await tx.insert(campaigns).values({
    userId,
    name,
    description,
    searchType
  }).returning();

  // Create initial job
  await tx.insert(scrapingJobs).values({
    userId,
    campaignId: campaign.id,
    status: 'pending',
    keywords: ['initial']
  });

  // If any operation fails, both are rolled back
});
```

### 📊 Error Handling Patterns

```typescript
export async function handleDatabaseOperation<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Database error in ${errorContext}:`, error);
    
    // Log specific error types
    if (error.code === '23505') {
      throw new Error('Duplicate entry');
    } else if (error.code === '23503') {
      throw new Error('Referenced record not found');
    }
    
    throw new Error('Database operation failed');
  }
}

// Usage
const campaign = await handleDatabaseOperation(
  () => db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId)
  }),
  'fetching campaign'
);
```

### 🔍 Monitoring and Logging

```typescript
// Database query monitoring
const startTime = Date.now();
const result = await db.query.campaigns.findMany({...});
const queryTime = Date.now() - startTime;

console.log(`Query completed in ${queryTime}ms:`, {
  operation: 'findMany',
  table: 'campaigns',
  resultCount: result.length,
  queryTime
});

// Slow query detection
if (queryTime > 1000) {
  console.warn('Slow query detected:', {
    operation: 'findMany',
    table: 'campaigns',
    queryTime
  });
}
```

---

## 🎯 Summary

This comprehensive database system provides:

- **Robust Architecture**: PostgreSQL with Drizzle ORM
- **Scalable Design**: Optimized for serverless deployment
- **Security**: Input validation, parameterized queries, user ownership checks
- **Performance**: Connection pooling, efficient queries, proper indexing
- **Maintainability**: Clear patterns, error handling, monitoring
- **Flexibility**: JSONB storage, dynamic configuration, migration system

The database is production-ready and can handle the complex requirements of a multi-platform influencer marketing platform with real-time processing, background jobs, and comprehensive user management.

---

*This documentation covers the complete database implementation. For questions or clarifications, refer to the specific code files mentioned throughout this guide.*