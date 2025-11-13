# Influencer Platform - Project Memory

> **Last Updated**: 2025-10-29
> **Coverage**: Complete codebase analysis via comprehensive file exploration
> **Status**: Production-ready SaaS platform for influencer discovery

---

## 🎯 Project Overview

This is a **B2B SaaS influencer discovery platform** that helps brands, agencies, and marketers find creators across Instagram, YouTube, and TikTok. The platform offers tiered subscription plans with usage-based limits, a 7-day trial period, and sophisticated search capabilities powered by multiple AI and scraping providers.

### Key Value Propositions
- **Multi-Platform Search**: Discover creators across Instagram (Reels), YouTube, and TikTok
- **Dual Search Modes**: Keyword-based discovery + Similar creator recommendations
- **Smart Enrichment**: Automatic follower/engagement data enhancement via Influencers.Club API
- **Campaign Management**: Organize searches into campaigns, save creators to lists, export to CSV
- **Fair Usage**: Monthly creator limits with automatic reset, transparent plan enforcement

### Target Users
- Marketing agencies managing influencer campaigns for multiple clients
- D2C brands seeking authentic creator partnerships
- Social media managers building creator databases
- PR firms conducting influencer outreach

---

## 🏗️ Architecture

### Tech Stack

#### Frontend
- **Framework**: Next.js 15 (App Router)
- **React**: v18.3.1 with Server Components
- **TypeScript**: Strict mode enabled (no `any` types)
- **UI Library**: Radix UI primitives + custom Tailwind components
- **State Management**: SWR for client-side data fetching, React hooks, Context API
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion for smooth transitions

#### Backend
- **Database**: Supabase (PostgreSQL 15) with connection pooling
- **ORM**: Drizzle ORM (type-safe, no migration hell)
- **Auth**: Clerk.js with custom test bypass for CLI automation
- **Payments**: Stripe Checkout + Customer Portal with webhook sync
- **Background Jobs**: Upstash QStash for async search processing
- **Email**: Resend with React Email templates

#### Search Providers
- **Instagram US Reels**: Serper (primary) + ScrapeCreators (fallback)
- **Instagram Similar**: Modash API (via proxy)
- **TikTok Keyword**: Custom keyword API
- **YouTube Keyword/Similar**: YouTube Similar API
- **Google SERP**: SerpAPI for general queries
- **Enrichment**: Influencers.Club API (follower counts, engagement rates)

#### Monitoring & Logging
- **Error Tracking**: Sentry (both client + server)
- **Structured Logging**: Custom logger with category-based filtering
- **Performance**: Built-in performance timers, memory monitoring
- **File Logging**: JSON-structured logs for production debugging

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Next.js 15 Frontend                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Pages     │  │  Components │  │   Hooks     │               │
│  │  (App Dir)  │  │   (UI/UX)   │  │   (State)   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API Routes (Next.js)                          │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Auth: getAuthOrTest() → Clerk OR Test Headers           │      │
│  │  Plan Enforcement: PlanEnforcementService.validate()     │      │
│  │  Job Creation: POST /api/campaigns/route.ts              │      │
│  └──────────────────────────────────────────────────────────┘      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
           ┌───────────────┴────────────────┐
           │                                │
           ▼                                ▼
┌────────────────────────┐      ┌──────────────────────────┐
│  Stripe Webhooks       │      │  QStash Job Processor    │
│  /api/webhooks/stripe  │      │  /api/qstash/process-*   │
│  ├─ checkout.completed │      │  ├─ Load job from DB     │
│  ├─ subscription.*     │      │  ├─ Dispatch to provider │
│  └─ invoice.*          │      │  ├─ Store results        │
└────────┬───────────────┘      │  └─ Schedule continuation│
         │                      └───────────┬──────────────┘
         │                                  │
         ▼                                  ▼
┌────────────────────────────────────────────────────────────────┐
│                      Service Layer (lib/)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Search Runner: runSearchJob() → Provider Dispatch       │  │
│  │  ├─ Instagram US Reels Pipeline (multi-step)            │  │
│  │  ├─ TikTok/YouTube Keyword Search                       │  │
│  │  ├─ Similar Creator Search                              │  │
│  │  └─ Result Normalization + Deduplication                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Billing Service: Stripe integration, trial management  │  │
│  │  Plan Enforcement: Usage tracking, limit validation     │  │
│  │  Email Service: Trial reminders, payment confirmations  │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL)                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Normalized User Tables:                                 │ │
│  │  • users (profile, onboarding)                          │ │
│  │  • user_subscriptions (trial, plan)                     │ │
│  │  • user_billing (Stripe data)                           │ │
│  │  • user_usage (monthly limits)                          │ │
│  │  • user_system_data (webhooks, events)                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Search Data:                                            │ │
│  │  • campaigns (user search sessions)                     │ │
│  │  • scraping_jobs (async job tracking)                   │ │
│  │  • scraping_results (creator JSONB arrays)              │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Creator Lists:                                          │ │
│  │  • creator_profiles (deduplicated creators)             │ │
│  │  • creator_lists (saved collections)                    │ │
│  │  • creator_list_items (M2M join)                        │ │
│  │  • creator_list_collaborators (sharing)                 │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### Why Next.js App Router?
- **Server Components**: Reduce client bundle, fetch data closer to the database
- **Streaming SSR**: Progressive rendering for faster perceived performance
- **API Routes**: Colocated backend logic without separate Express server
- **File-based Routing**: Intuitive structure, automatic code-splitting

#### Why Supabase + Drizzle?
- **Supabase**: Managed PostgreSQL with excellent connection pooling (max 15 connections)
- **Drizzle ORM**: Type-safe queries without heavyweight abstractions, zero-cost migrations
- **Normalized Schema**: Migrated from monolithic `user_profiles` to 5 separate tables for better performance and maintainability
- **RLS Policies**: Row-level security ensures users only see their own data

#### Why QStash for Background Jobs?
- **Serverless-Native**: No Redis/workers to manage, perfect for Vercel/Netlify
- **Automatic Retries**: 3 retries with exponential backoff (configured via env)
- **HTTP-Based**: Simple to test with curl, no complex SDKs
- **Continuation Pattern**: Schedule next run if job has more results to process

#### Why Multiple Search Providers?
- **Reliability**: Primary + fallback providers prevent complete search failures
- **Cost Optimization**: Use cheaper providers first, expensive ones as backup
- **Quality**: Different providers excel at different platforms (Serper for IG, Modash for similar)
- **Rate Limits**: Distribute load across providers to avoid hitting limits

---

## 💼 Business Model & Domain Logic

### Subscription Plans

| Plan Key       | Display Name   | Campaigns | Creators/Month | Monthly Price | Features                        |
|----------------|----------------|-----------|----------------|---------------|---------------------------------|
| `glow_up`      | Glow Up        | 3         | 1,000          | $99           | Basic search, CSV export        |
| `viral_surge`  | Viral Surge    | 10        | 10,000         | $299          | All features, priority support  |
| `fame_flex`    | Fame Flex      | ∞         | ∞              | $899          | Unlimited + dedicated CSM       |

**Plan Keys**: Used throughout code (`currentPlan` field). Always lowercase with underscores.

**Limits Enforcement**:
- **Campaigns**: Lifetime limit (never reset unless user deletes campaigns)
- **Creators**: Monthly limit (resets on subscription renewal date)
- **Enrichments**: Monthly limit (separate counter for API cost management)

**Trial System**:
- **Duration**: 7 days from `onboardingStep` = `completed`
- **Status Flow**: `pending` → `active` → `converted` (paid) OR `expired` (no payment)
- **Grace Period**: Users can continue using platform for 3 days post-trial before hard block

### User Journey

```
1. SIGNUP (Clerk)
   └─> User signs up with email/Google
   └─> Clerk webhook triggers: POST /api/webhooks/clerk
   └─> Backend creates normalized user records (users + 4 related tables)
   └─> onboardingStep = 'pending'

2. ONBOARDING (4 Steps)
   ├─> Step 1: Personal info (name, email pre-filled from Clerk)
   ├─> Step 2: Business details (company, industry, description)
   ├─> Step 3: Plan selection (stores as `intendedPlan`, NOT `currentPlan`)
   └─> Step 4: Payment (Stripe Checkout)

3. TRIAL START (Post-Payment)
   └─> Stripe webhook: checkout.session.completed
   └─> Update: currentPlan = intendedPlan, trialStatus = 'active'
   └─> Calculate: trialEndDate = now + 7 days
   └─> Email: Trial welcome + feature guide

4. ACTIVE USAGE
   ├─> User creates campaigns
   ├─> Submits search jobs → QStash → Background processing
   ├─> Results stream to frontend via polling
   ├─> Usage tracked: usageCreatorsCurrentMonth++
   └─> Plan limits enforced via PlanEnforcementService

5. TRIAL CONVERSION OR EXPIRY
   ├─> Stripe attempts first payment at trialEndDate
   ├─> Success: trialStatus = 'converted', subscriptionStatus = 'active'
   └─> Failure: trialStatus = 'expired', show upgrade modal

6. ONGOING BILLING
   ├─> Stripe invoice.payment_succeeded → Reset monthly usage
   ├─> Stripe subscription.updated → Handle plan changes
   └─> Stripe subscription.deleted → Downgrade to free plan
```

### Search Architecture

#### Platforms & Search Types

| Platform       | Keyword Search | Similar Search | Provider(s)                          |
|----------------|----------------|----------------|--------------------------------------|
| Instagram      | ✅             | ✅             | Serper, ScrapeCreators, Apify        |
| TikTok         | ✅             | ❌             | Custom TikTok Keyword API            |
| YouTube        | ✅             | ✅             | YouTube Similar API                  |

#### Data Flow (End-to-End)

```
1. USER SUBMITS SEARCH
   Frontend: POST /api/campaigns/route.ts
   Body: { name, keywords, platform, targetResults: 1000 }

2. API VALIDATES & CREATES JOB
   • getAuthOrTest() → Resolve userId (Clerk OR test headers)
   • PlanEnforcementService.validateJobCreation(userId, 1000)
     └─> Check: usageCreatorsCurrentMonth + 1000 < planCreatorsLimit
     └─> Adjust: If exceeds, clamp to creatorsRemaining
   • db.insert(scrapingJobs).values({
       userId, campaignId, keywords, platform,
       status: 'pending', targetResults: 1000
     })

3. PUBLISH TO QSTASH
   qstash.publishJSON({
     url: 'https://yourapp.com/api/qstash/process-search',
     body: { jobId: newJob.id },
     retries: 3
   })

4. QSTASH WORKER PROCESSES JOB
   POST /api/qstash/process-search
   • Verify Upstash signature (skip in dev if VERIFY_QSTASH_SIGNATURE=false)
   • Load job: SearchJobService.load(jobId)
   • Dispatch to provider: runSearchJob(jobId)
     └─> Detect platform + search type
     └─> Route to: runInstagramUsReelsProvider() | runTikTokKeywordProvider() | etc.

5. PROVIDER EXECUTES SEARCH
   Example: Instagram US Reels Pipeline (6 steps)
   a) Keyword Expansion (GPT-4): "fitness" → ["fitness tips", "workout routine", ...]
   b) Handle Harvest (Serper): Search expanded keywords → Extract IG handles
   c) Profile Screening (ScrapeCreators): Filter by follower count, engagement
   d) Reel Fetch (ScrapeCreators): Get last 12 reels per profile
   e) Transcript Fetch (OpenAI Whisper): Extract text from reels
   f) Scoring: Match reels against keywords → Relevance score

6. STORE RESULTS
   db.insert(scrapingResults).values({
     jobId,
     creators: [
       { username, followerCount, profileUrl, reels: [...] },
       ...
     ]
   })

7. UPDATE JOB STATUS
   • processedResults += creators.length
   • If processedResults >= targetResults: status = 'completed'
   • If hasMore: Schedule continuation (QStash delay: 5-30s)
   • Else: status = 'completed'

8. FRONTEND POLLS FOR RESULTS
   GET /api/jobs/[id]
   • Return: { status, processedResults, targetResults, results }
   • UI updates progress bar: (processedResults / targetResults * 100)%
```

#### Provider Selection Logic (Search Runner)

The `runSearchJob()` function in `/lib/search-engine/runner.ts` uses this dispatch logic:

```typescript
// 1. TikTok Keyword?
if (platform === 'tiktok' && hasKeywords)
  → runTikTokKeywordProvider()

// 2. YouTube Keyword?
if (platform === 'youtube' && hasKeywords)
  → runYouTubeKeywordProvider()

// 3. YouTube Similar?
if (platform === 'youtube' && hasTargetUsername)
  → runYouTubeSimilarProvider()

// 4. Instagram Similar?
if (platform === 'instagram' && hasTargetUsername)
  → runInstagramSimilarProvider()

// 5. Instagram US Reels (v2 pipeline)?
if (searchParams.runner === 'instagram_us_reels')
  → runInstagramUsReelsProvider()

// 6. Instagram Reels (v1 legacy)?
if (platform === 'instagram' && hasKeywords)
  → runInstagramReelsProvider()

// 7. Google SERP?
if (platform === 'google_serp')
  → runGoogleSerpProvider()
```

**Note**: Instagram has **two implementations** for keyword search:
- **v1 (Legacy)**: `instagram-reels` provider (Apify-based, slower)
- **v2 (Modern)**: `instagram_us_reels` provider (6-step pipeline, Serper + GPT)

Use `searchParams.runner = 'instagram_us_reels'` to explicitly request v2.

---

## 📋 Code Conventions

### API Route Patterns

**All API routes MUST follow this structure**:

```typescript
// app/api/[endpoint]/route.ts
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { NextResponse } from 'next/server';
import { logger, LogCategory } from '@/lib/logging';

export async function POST(req: Request) {
  try {
    // 1. AUTH VALIDATION (always first!)
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. PARSE + VALIDATE BODY
    const body = await req.json();

    // Validate required fields
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'Missing required field' },
        { status: 400 }
      );
    }

    // 3. BUSINESS LOGIC (call service layer)
    const result = await performOperation(userId, body);

    // 4. STRUCTURED LOGGING (not console.log!)
    logger.info('Operation completed', {
      userId,
      resultCount: result.length
    }, LogCategory.API);

    // 5. RETURN SUCCESS
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    // 6. ERROR HANDLING + LOGGING
    logger.error('Operation failed', error as Error, {
      userId
    }, LogCategory.API);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Key Rules**:
- ✅ **Always** use `getAuthOrTest()` for auth (NOT `auth()` from Clerk directly)
- ✅ **Always** return `NextResponse.json()` (NOT `Response`)
- ✅ **Always** use structured logging (NOT `console.log`)
- ✅ **Always** catch errors and return 500 (NOT let them crash)
- ❌ **Never** use `console.log` in API routes (use `logger.*`)
- ❌ **Never** skip auth validation (even for "public" routes - use plan gating instead)

### Database Patterns

#### Query with Drizzle ORM

```typescript
import { db } from '@/lib/db';
import { campaigns, scrapingJobs } from '@/lib/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

// ✅ Good: Type-safe queries
const userCampaigns = await db
  .select()
  .from(campaigns)
  .where(eq(campaigns.userId, userId))
  .orderBy(desc(campaigns.createdAt))
  .limit(10);

// ✅ Good: Joins with relations
const campaignWithJobs = await db.query.campaigns.findFirst({
  where: eq(campaigns.id, campaignId),
  with: {
    scrapingJobs: {
      orderBy: desc(scrapingJobs.createdAt)
    }
  }
});

// ✅ Good: Transactions for multi-table operations
await db.transaction(async (tx) => {
  const [campaign] = await tx.insert(campaigns).values({
    userId, name, searchType: 'keyword'
  }).returning();

  await tx.insert(scrapingJobs).values({
    userId, campaignId: campaign.id, status: 'pending'
  });
});

// ❌ Bad: Raw SQL (avoid unless absolutely necessary)
await db.execute(sql`SELECT * FROM campaigns WHERE user_id = ${userId}`);
```

#### User Queries (Normalized Schema)

```typescript
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';

// ✅ Good: Use abstraction for user data
const user = await getUserProfile(userId); // Joins 5 tables automatically
if (user.currentPlan === 'free') {
  // Upgrade logic
}

// ✅ Good: Update across normalized tables
await updateUserProfile(userId, {
  // Updates spread across users, user_subscriptions, user_billing, etc.
  currentPlan: 'viral_surge',
  planCampaignsLimit: 10,
  planCreatorsLimit: 10000,
  trialStatus: 'converted'
});

// ❌ Bad: Directly updating individual tables
await db.update(users).set({ fullName: 'New Name' }); // Missing related tables!
```

### Error Handling

```typescript
// ✅ Good: Structured error logging
try {
  const result = await riskyOperation();
} catch (error) {
  logger.error('Risky operation failed', error as Error, {
    userId,
    operationId: '123'
  }, LogCategory.SYSTEM);

  // Re-throw if caller should handle
  throw error;
}

// ✅ Good: Sentry integration (automatic for errors)
// logger.error() automatically sends to Sentry if level >= WARN

// ❌ Bad: Silent failures
try {
  await riskyOperation();
} catch (error) {
  // Nothing - error swallowed!
}

// ❌ Bad: Generic console.error
catch (error) {
  console.error('Something failed', error); // No context!
}
```

### TypeScript Rules

```typescript
// ✅ Good: Explicit types
interface CreateCampaignParams {
  name: string;
  keywords: string[];
  platform: 'instagram' | 'tiktok' | 'youtube';
}

// ✅ Good: Type inference where obvious
const campaigns = await db.query.campaigns.findMany(); // Type inferred

// ✅ Good: Narrow error types
catch (error) {
  if (error instanceof Error) {
    logger.error('Failed', error);
  } else {
    logger.error('Unknown error', new Error(String(error)));
  }
}

// ❌ Bad: `any` types
function doSomething(data: any) { ... } // NEVER USE `any`!

// ❌ Bad: Type assertions without validation
const user = data as User; // Dangerous if data doesn't match!
```

### Logging Standards

```typescript
import { logger, LogCategory } from '@/lib/logging';

// ✅ Good: Appropriate log levels
logger.debug('Detailed debugging info', { data }, LogCategory.SYSTEM);
logger.info('Normal operation', { userId }, LogCategory.API);
logger.warn('Something unusual', { issue }, LogCategory.PERFORMANCE);
logger.error('Operation failed', error, { context }, LogCategory.DATABASE);
logger.critical('System down!', error, {}, LogCategory.SYSTEM);

// ✅ Good: Use categories
LogCategory.API        // API routes, HTTP requests
LogCategory.DATABASE   // DB queries, transactions
LogCategory.AUTH       // Authentication, authorization
LogCategory.PAYMENT    // Stripe, billing
LogCategory.SCRAPING   // Search jobs, providers
LogCategory.JOB        // Background jobs, QStash
LogCategory.PERFORMANCE // Slow queries, memory issues

// ✅ Good: Structured context
logger.info('Job completed', {
  jobId,
  userId,
  duration: 1234,
  resultsCount: 50
}, LogCategory.JOB);

// ❌ Bad: Console methods in backend
console.log('Debug info'); // Use logger.debug() instead
console.error('Error'); // Use logger.error() instead
```

---

## 🔧 Integration Points

### Clerk Authentication

**Standard Auth (Production)**:
```typescript
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';

const { userId, sessionId, sessionClaims } = await getAuthOrTest();
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Test Auth Bypass (Development ONLY)**:

There are **3 methods** to bypass auth for CLI testing:

#### Method 1: Test Headers (Recommended)
```bash
curl -X POST https://yourapp.com/api/campaigns \
  -H "x-test-user-id: user_123" \
  -H "x-test-email: test@example.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Campaign"}'
```

#### Method 2: Dev Bypass Header
```bash
curl -X POST https://yourapp.com/api/campaigns \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: user_123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Campaign"}'
```

#### Method 3: Environment Bypass
```bash
# .env.local
ENABLE_AUTH_BYPASS=true
AUTH_BYPASS_USER_ID=user_123
AUTH_BYPASS_EMAIL=test@example.com
```

**⚠️ IMPORTANT**: Auth bypass is **disabled in production** (`NODE_ENV === 'production'`). Attempting to use test headers in prod will fail authentication.

### Stripe Integration

**Checkout Flow**:
```typescript
// 1. User selects plan in onboarding
POST /api/stripe/create-checkout
Body: { planId: 'viral_surge', userId: 'user_123' }

// 2. Backend creates Stripe Checkout Session
const session = await stripe.checkout.sessions.create({
  customer_email: user.email,
  mode: 'subscription',
  line_items: [{ price: 'price_123', quantity: 1 }],
  metadata: { userId: user.userId, planId: 'viral_surge' },
  success_url: '/onboarding/success',
  cancel_url: '/onboarding/step-3'
});

// 3. User completes payment on Stripe-hosted page

// 4. Stripe webhook fires: checkout.session.completed
POST /api/webhooks/stripe (from Stripe servers)
• Verify signature: stripe.webhooks.constructEvent()
• Extract metadata: userId, planId
• Update user: currentPlan = planId, trialStatus = 'active'
• Calculate trial end: trialEndDate = now + 7 days
```

**Webhook Events Handled**:
- `checkout.session.completed` → Trial starts, plan activated
- `customer.subscription.created` → Subscription details synced
- `customer.subscription.updated` → Plan changes, trial conversion
- `customer.subscription.deleted` → Downgrade to free plan
- `invoice.payment_succeeded` → Reset monthly usage counters
- `invoice.payment_failed` → Mark account past_due

**Idempotency Protection**:
```typescript
// Stripe webhooks can arrive multiple times!
// Check: Has this exact event already been processed?

const recentWebhookWindow = 5 * 60 * 1000; // 5 minutes
const isRecentWebhook =
  currentProfile.lastWebhookTimestamp &&
  (Date.now() - new Date(currentProfile.lastWebhookTimestamp).getTime() < recentWebhookWindow);

const isDuplicateWebhook =
  isRecentWebhook &&
  currentProfile.stripeSubscriptionId === session.subscription &&
  currentProfile.lastWebhookEvent === 'checkout.session.completed';

if (isDuplicateWebhook) {
  return; // Skip duplicate processing
}
```

### QStash Job Processing

**Publishing a Job**:
```typescript
import { qstash } from '@/lib/queue/qstash';

await qstash.publishJSON({
  url: 'https://yourapp.com/api/qstash/process-search',
  body: { jobId: 'job_123' },
  retries: 3,
  delay: '5s', // Optional: delay first execution
  notifyOnFailure: true
});
```

**Processing a Job**:
```typescript
// POST /api/qstash/process-search
export async function POST(req: Request) {
  // 1. Verify signature
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  const valid = await receiver.verify({
    signature: req.headers.get('Upstash-Signature')!,
    body: await req.text(),
    url: callbackUrl
  });

  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse body
  const { jobId } = JSON.parse(body);

  // 3. Execute search
  const { result, config } = await runSearchJob(jobId);

  // 4. Schedule continuation if needed
  if (result.hasMore && processedResults < targetResults) {
    await qstash.publishJSON({
      url: callbackUrl,
      body: { jobId },
      delay: `${config.continuationDelayMs}ms`
    });
  }
}
```

**Signature Verification** (can be disabled in dev):
```bash
# .env.local (development)
VERIFY_QSTASH_SIGNATURE=false # Allows curl testing without signing

# .env (production)
# Always verify signatures in production!
VERIFY_QSTASH_SIGNATURE=true # Default
```

### Enrichment API (Influencers.Club)

**Usage**:
```typescript
// Enrich creators with follower counts, engagement rates
POST /api/creators/enrich
Body: {
  creators: [
    { username: 'fitness_guru', platform: 'instagram' }
  ]
}

// Response:
{
  enriched: [
    {
      username: 'fitness_guru',
      platform: 'instagram',
      followerCount: 150000,
      engagementRate: 3.2,
      avgLikes: 4800,
      avgComments: 150
    }
  ]
}
```

**Caching** (TODO):
- Cache enrichment data for 24 hours to reduce API costs
- Store in `enrichmentCache` table (not yet implemented)

**Fallback**:
- If enrichment API is down, continue without enrichment
- Log warning but don't fail search job

---

## 🗄️ Database Schema

### Core Tables

#### Normalized User Tables (5-Table Split)

**Why Normalized?** Migrated from monolithic `user_profiles` table to improve performance, reduce column bloat, and enable easier query optimization.

##### `users` - Core Identity
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,  -- Clerk user ID
  email TEXT,
  full_name TEXT,
  business_name TEXT,
  brand_description TEXT,
  industry TEXT,
  onboarding_step VARCHAR(50) DEFAULT 'pending',
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Fields**:
- `user_id`: External auth ID from Clerk (e.g., `user_2a1b3c4d`)
- `onboarding_step`: `pending` | `step_1` | `step_2` | `step_3` | `completed`
- `is_admin`: Access to `/admin/*` routes

##### `user_subscriptions` - Trial & Plan Management
```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  current_plan VARCHAR(50) DEFAULT 'free',
  intended_plan VARCHAR(50),  -- Plan selected before checkout
  subscription_status VARCHAR(20) DEFAULT 'none',
  trial_status VARCHAR(20) DEFAULT 'pending',
  trial_start_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  trial_conversion_date TIMESTAMP,
  subscription_cancel_date TIMESTAMP,
  subscription_renewal_date TIMESTAMP,
  billing_sync_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Status Flows**:
- `trial_status`: `pending` → `active` → `converted` | `expired` | `cancelled`
- `subscription_status`: `none` → `trialing` → `active` | `past_due` | `canceled`
- `billing_sync_status`: `pending` → `synced` | `failed`

##### `user_billing` - Stripe Payment Data
```sql
CREATE TABLE user_billing (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  payment_method_id TEXT,
  card_last_4 VARCHAR(4),
  card_brand VARCHAR(20),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  billing_address_city TEXT,
  billing_address_country VARCHAR(2),
  billing_address_postal_code VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

##### `user_usage` - Plan Limits & Tracking
```sql
CREATE TABLE user_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_campaigns_limit INTEGER,
  plan_creators_limit INTEGER,
  plan_features JSONB DEFAULT '{}',
  usage_campaigns_current INTEGER DEFAULT 0,
  usage_creators_current_month INTEGER DEFAULT 0,
  enrichments_current_month INTEGER DEFAULT 0,
  usage_reset_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Usage Tracking**:
- `usage_campaigns_current`: Total campaigns created (lifetime, never resets)
- `usage_creators_current_month`: Creators discovered this billing cycle
- `enrichments_current_month`: API calls to enrichment service

##### `user_system_data` - Webhooks & Events
```sql
CREATE TABLE user_system_data (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  signup_timestamp TIMESTAMP DEFAULT NOW(),
  email_schedule_status JSONB DEFAULT '{}',
  last_webhook_event VARCHAR(100),
  last_webhook_timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Email Schedule Example**:
```json
{
  "trial_day_3_reminder": { "sent": true, "timestamp": "2025-10-26T10:00:00Z" },
  "trial_day_6_reminder": { "sent": false }
}
```

---

#### Search & Campaign Tables

##### `campaigns`
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  search_type VARCHAR(20) NOT NULL,  -- 'keyword' | 'similar'
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

##### `scraping_jobs`
```sql
CREATE TABLE scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id),
  platform VARCHAR(50) DEFAULT 'Tiktok',
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'processing' | 'completed' | 'error' | 'timeout'
  keywords JSONB,  -- ['keyword1', 'keyword2']
  target_username TEXT,  -- For similar search
  search_params JSONB,  -- { runner: 'instagram_us_reels', ... }
  target_results INTEGER DEFAULT 1000,
  processed_results INTEGER DEFAULT 0,
  processed_runs INTEGER DEFAULT 0,
  qstash_message_id TEXT,
  timeout_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Status Flow**:
```
pending → processing → completed
                     ↘ error
                     ↘ timeout
```

##### `scraping_results`
```sql
CREATE TABLE scraping_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES scraping_jobs(id),
  creators JSONB NOT NULL,  -- Array of creator objects
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Creators JSONB Structure**:
```json
[
  {
    "username": "fitness_guru",
    "displayName": "Fitness Guru",
    "platform": "instagram",
    "followers": 150000,
    "profileUrl": "https://instagram.com/fitness_guru",
    "avatarUrl": "https://...",
    "bio": "Helping you get fit...",
    "reels": [
      {
        "id": "reel_123",
        "url": "https://...",
        "caption": "Morning workout routine",
        "transcript": "Hey guys, today we're doing...",
        "likes": 4500,
        "comments": 120
      }
    ]
  }
]
```

---

#### Creator Lists Tables

##### `creator_profiles` (Deduplicated Creators)
```sql
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY,
  platform VARCHAR(32) NOT NULL,
  external_id TEXT NOT NULL,  -- Instagram user ID, YouTube channel ID, etc.
  handle TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  url TEXT,
  followers INTEGER,
  engagement_rate NUMERIC,
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, external_id)
);
```

##### `creator_lists` (Saved Collections)
```sql
CREATE TABLE creator_lists (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type VARCHAR(24) DEFAULT 'custom',  -- 'campaign' | 'favorites' | 'industry' | 'contacted'
  privacy VARCHAR(16) DEFAULT 'private',  -- 'private' | 'public' | 'workspace'
  tags JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  slug TEXT,  -- For shareable URLs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_shared_at TIMESTAMP
);
```

##### `creator_list_items` (M2M Join)
```sql
CREATE TABLE creator_list_items (
  id UUID PRIMARY KEY,
  list_id UUID REFERENCES creator_lists(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creator_profiles(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  bucket VARCHAR(32) DEFAULT 'backlog',  -- 'backlog' | 'contacted' | 'responded' | 'rejected'
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  metrics_snapshot JSONB DEFAULT '{}',  -- Follower count at time of adding
  custom_fields JSONB DEFAULT '{}',
  pinned BOOLEAN DEFAULT false,
  last_contacted_at TIMESTAMP,
  UNIQUE(list_id, creator_id)
);
```

---

### Indexes (Critical for Performance)

```sql
-- User lookups
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_email ON users(email);

-- Campaign queries
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Job queries
CREATE INDEX idx_scraping_jobs_user_id ON scraping_jobs(user_id);
CREATE INDEX idx_scraping_jobs_campaign_id ON scraping_jobs(campaign_id);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_created_at ON scraping_jobs(created_at DESC);

-- Result lookups
CREATE INDEX idx_scraping_results_job_id ON scraping_results(job_id);

-- Creator deduplication
CREATE UNIQUE INDEX idx_creator_profiles_platform_external ON creator_profiles(platform, external_id);
```

### RLS Policies (Row-Level Security)

**Supabase automatically enforces these policies**:

```sql
-- Users only see their own data
CREATE POLICY "Users can view own campaigns"
  ON campaigns FOR SELECT
  USING (user_id = auth.uid());

-- Admins see everything
CREATE POLICY "Admins can view all campaigns"
  ON campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.is_admin = true
    )
  );
```

---

## 📜 Script Reference (99+ Scripts)

### Categories

#### User Management
```bash
# Reset user onboarding state
node scripts/reset-user-onboarding.js user@example.com

# Inspect user billing & trial status
node scripts/inspect-user-state.js user@example.com

# Find user ID from email
node scripts/find-user-id.js user@example.com

# Delete user completely (hard delete)
node scripts/delete-user-completely.js user@example.com

# Upgrade user to specific plan
DATABASE_URL="..." npx tsx scripts/upgrade-user-to-fame-flex.ts user@example.com
```

#### Database Operations
```bash
# Seed subscription plans from Stripe
node scripts/seed-subscription-plans.js

# Analyze database performance
node scripts/analyze-database.js

# Run database migrations
npm run db:migrate

# Reset database schema (⚠️ DESTRUCTIVE)
npm run db:reset:schema
```

#### Instagram Testing
```bash
# Compare Instagram keyword providers
node scripts/test-instagram-keyword-comparison.js "fitness"

# Quick sanity check all Instagram APIs
node scripts/quick-test-instagram-apis.js

# Test Instagram keyword with specific provider
node scripts/test-instagram-keyword.js "yoga tips"
```

#### Development Helpers
```bash
# Start dev server with ngrok tunnel (for webhooks)
npm run dev:ngrok

# Stop ngrok tunnel
npm run ngrok:stop

# Start on specific port
npm run dev:wt2  # Port 3002
```

#### Deployment & Validation
```bash
# Validate deployment health
node scripts/validate-deployment.js

# Generate founder usage report
npm run report:founder

# Test Sentry integration
npm run sentry:test
```

### Most Common Scripts

**Daily Use**:
1. `npm run dev:ngrok` - Start with webhook tunnel
2. `node scripts/inspect-user-state.js <email>` - Debug user issues
3. `node scripts/reset-user-onboarding.js <email>` - Reset test user
4. `node scripts/find-user-id.js <email>` - Get user ID for API testing

**Monthly Maintenance**:
1. `node scripts/seed-subscription-plans.js` - Sync Stripe plans
2. `node scripts/analyze-database.js` - Check DB performance
3. `npm run report:founder` - Generate founder metrics

---

## ⚠️ Important Gotchas

### Authentication
- ❌ **Never skip auth validation in API routes** - Even if it seems "safe"
- ❌ **Test auth bypass ONLY works in development** - `NODE_ENV !== 'production'` check
- ✅ **Clerk webhooks require Svix signature verification** - Use `svix` package
- ✅ **Always use `getAuthOrTest()`** - Don't import `auth()` from Clerk directly

### Billing
- ⚠️ **Trial period is 7 days from `onboardingStep = 'completed'`** - NOT from signup
- ⚠️ **Plan limits: campaigns = lifetime, creators = monthly** - Different reset logic
- ⚠️ **Stripe webhooks can arrive out of order** - Use idempotency checks
- ⚠️ **Race condition**: `checkout.session.completed` may fire AFTER `/api/stripe/checkout-success` - Check if user already upgraded before downgrading

### Search Processing
- ⚠️ **QStash jobs can run concurrently** - Ensure idempotent operations
- ⚠️ **Job timeouts are NOT automatically enforced** - Must check `timeoutAt` in GET endpoint
- ⚠️ **Results are paginated** - Default 20 per page, use `cursor` for next page
- ⚠️ **Instagram has 2 implementations** - Use `searchParams.runner = 'instagram_us_reels'` for v2

### Database
- ⚠️ **Supabase connection pooling: max 15 connections** - Don't leak connections
- ❌ **Never hard-delete users** - Use soft delete (`status='deleted'`)
- ✅ **Migrations must be idempotent** - Use `IF NOT EXISTS` for CREATE statements
- ✅ **Always use transactions for multi-table operations** - Prevent partial writes

### Logging
- ❌ **Never use `console.log` in backend** - Use `logger.debug/info/warn/error`
- ✅ **Use appropriate log levels** - DEBUG filtered out in production
- ✅ **Include context objects** - `{ userId, jobId, duration }` for filtering
- ✅ **Use log categories** - `LogCategory.API`, `LogCategory.DATABASE`, etc.

---

## 🚀 Common Workflows

### 1. Creating a New API Endpoint

```bash
# 1. Create route file
touch app/api/new-feature/route.ts

# 2. Implement handler
cat > app/api/new-feature/route.ts << 'EOF'
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { NextResponse } from 'next/server';
import { logger, LogCategory } from '@/lib/logging';

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    // Business logic here

    logger.info('New feature used', { userId }, LogCategory.API);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('New feature failed', error as Error, {}, LogCategory.API);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
EOF

# 3. Test with curl
curl -X POST http://localhost:3000/api/new-feature \
  -H "x-test-user-id: user_test" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}'

# 4. Deploy & test in production
vercel --prod
curl -X POST https://yourapp.com/api/new-feature \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}'
```

### 2. Adding a New Search Provider

```bash
# 1. Create provider file
touch lib/search-engine/providers/new-provider.ts

# 2. Implement provider interface
cat > lib/search-engine/providers/new-provider.ts << 'EOF'
import type { ProviderRunResult, SearchRuntimeConfig } from '../types';
import type { SearchJobService } from '../job-service';

export async function runNewProvider(
  { job, config }: { job: any; config: SearchRuntimeConfig },
  service: SearchJobService
): Promise<ProviderRunResult> {
  const results = []; // Fetch from API

  await service.appendResults(results);

  return {
    status: 'completed',
    hasMore: false,
    metrics: {
      totalFetched: results.length,
      apiCallsMade: 1,
      executionTimeMs: 1000
    }
  };
}
EOF

# 3. Add dispatch logic to runner
# Edit: lib/search-engine/runner.ts
# Add condition: if (platform === 'new_platform') → runNewProvider()

# 4. Add cost constants
# Edit: lib/cost/constants.ts
# Add: export const COST_NEW_PROVIDER_PER_CALL = 0.05;

# 5. Create test script
touch scripts/test-new-provider.js
node scripts/test-new-provider.js "test keyword"

# 6. Update CLAUDE.md
# Add provider to Search Architecture section
```

### 3. Debugging a Stuck Job

```bash
# 1. Find job ID from UI or database
export JOB_ID="abc-123"

# 2. Check job status in database
psql $DATABASE_URL -c "
  SELECT id, status, platform, created_at, started_at, completed_at, error
  FROM scraping_jobs
  WHERE id = '$JOB_ID';
"

# 3. Check QStash dashboard
# Visit: https://console.upstash.com/qstash
# Look for failed messages related to job ID

# 4. Review logs in Sentry
# Visit: https://sentry.io/organizations/your-org/issues/
# Search for: jobId:$JOB_ID

# 5. Inspect user state (if user-related issue)
node scripts/inspect-user-state.js user@example.com

# 6. Manually mark job as error (if stuck)
psql $DATABASE_URL -c "
  UPDATE scraping_jobs
  SET status = 'error',
      error = 'Manually marked as error for debugging',
      completed_at = NOW()
  WHERE id = '$JOB_ID';
"

# 7. Retry job manually (if fixable)
curl -X POST http://localhost:3000/api/qstash/process-search \
  -H "Content-Type: application/json" \
  -d "{\"jobId\":\"$JOB_ID\"}"
```

### 4. Testing Webhooks Locally

```bash
# 1. Start dev server with ngrok
npm run dev:ngrok
# Output: https://abc123.ngrok.io

# 2. Update Stripe webhook URL
# Visit: https://dashboard.stripe.com/webhooks
# Add endpoint: https://abc123.ngrok.io/api/webhooks/stripe

# 3. Trigger test event from Stripe Dashboard
# Visit: https://dashboard.stripe.com/webhooks/we_xxx
# Click "Send test webhook" → Select event type

# 4. View logs in terminal
# Watch for: [STRIPE-WEBHOOK] Event received: checkout.session.completed

# 5. Test Clerk webhook
# Visit: https://dashboard.clerk.com/webhooks
# Add endpoint: https://abc123.ngrok.io/api/webhooks/clerk
# Trigger: Create test user

# 6. Stop ngrok when done
npm run ngrok:stop
```

---

## 🎓 Learning Resources

### Official Docs
- **Next.js App Router**: https://nextjs.org/docs/app
- **Drizzle ORM**: https://orm.drizzle.team/docs/overview
- **Clerk Auth**: https://clerk.com/docs
- **Stripe Webhooks**: https://stripe.com/docs/webhooks
- **QStash**: https://upstash.com/docs/qstash
- **Supabase**: https://supabase.com/docs

### Internal Guides (Legacy)
- `docs/instagram-us-reels-runbook.md` - Instagram v2 pipeline deep-dive
- `docs/search-test-guide.md` - Testing search providers
- `docs/logging/runtime-logging.md` - Structured logging system

### Architecture Decisions
- **Normalized User Schema**: See commit `e42ef7a` - "Implement user profile normalization"
- **Instagram US Reels v2**: See commit `23113c3` - "Implement sequential fair keyword distribution"

---

## 📊 Key Metrics & Monitoring

### Production Health Checks
```bash
# System health
curl https://yourapp.com/api/diagnostics/system-health

# Validate deployment
npm run validate:deployment:prod

# Check Sentry errors
# https://sentry.io/organizations/your-org/issues/?query=is:unresolved
```

### User Metrics
```bash
# Generate founder report (user count, revenue, usage)
npm run report:founder

# Analyze user billing system
node scripts/analyze-billing-system.js
```

### Performance Benchmarks
```bash
# Run performance benchmark suite
node scripts/benchmark-performance.js

# Analyze database query performance
node scripts/analyze-database.js
```

---

## 🔮 Future Enhancements (TODOs)

### High Priority
- [ ] Implement enrichment caching (24hr TTL) to reduce API costs
- [ ] Add creator deduplication across campaigns
- [ ] Build email drip campaign for trial users
- [ ] Add admin dashboard for system config hot-reloading

### Medium Priority
- [ ] Implement team workspaces (multi-user accounts)
- [ ] Add CSV export for campaign results
- [ ] Build creator CRM (notes, outreach status tracking)
- [ ] Add webhook notification system for job completion

### Low Priority
- [ ] Implement creator scoring algorithm (custom relevance)
- [ ] Add A/B testing framework for search providers
- [ ] Build analytics dashboard (most searched keywords, etc.)

---

**Note to Claude Code**: This file represents a comprehensive snapshot of the codebase architecture, conventions, and business logic as of 2025-10-29. When working on this project, **always reference this file first** to understand context before making changes.

**Key Principles**:
1. ✅ **Auth First**: Never skip `getAuthOrTest()` in API routes
2. ✅ **Structured Logging**: Use `logger.*` instead of `console.*`
3. ✅ **Type Safety**: Strict TypeScript, no `any` types
4. ✅ **Plan Enforcement**: Always validate limits before creating jobs
5. ✅ **Idempotency**: Handle duplicate webhooks, concurrent jobs gracefully
6. ✅ **Error Handling**: Log context, don't swallow errors silently

**When in Doubt**:
- Check this CLAUDE.md first
- Review similar existing endpoints/providers
- Test with CLI scripts before pushing to prod
- Use test auth bypass for automated testing

Good luck building! 🚀
