# lib/db/CLAUDE.md — Database Schema & Queries

## What This Directory Contains

The `lib/db/` directory contains the Drizzle ORM schema, database connection, and query functions. This is the data layer of the application. The schema defines all tables, and the queries directory contains domain-specific query functions that handle the complexity of the normalized user model.

**Critical Rule:** Never modify `schema.ts` without running `npm run db:generate` and `npm run db:migrate`.

---

## Directory Structure

```
lib/db/
├── schema.ts               → TABLE DEFINITIONS (source of truth)
├── index.ts                → Database connection instance (export `db`)
├── migrate.ts              → Migration runner
└── queries/                → Domain-specific query functions
    ├── user-queries.ts     → getUserProfile(), updateUserProfile()
    ├── dashboard-queries.ts → getDashboardStats()
    ├── list-queries.ts     → Creator list CRUD
    └── admin-plan-manager.ts → Plan configuration
```

---

## Schema Overview (`schema.ts`)

### Normalized User Tables (5-Table Split)

User data is split across 5 tables for performance and maintainability. **Never query these individually**—use `getUserProfile()` which joins them.

**1. `users` — Core Identity**
```typescript
// Fields: id, userId (Clerk ID), email, fullName, businessName,
//         brandDescription, industry, onboardingStep, isAdmin, createdAt, updatedAt
```
- `userId`: External Clerk ID like `user_2a1b3c4d`
- `onboardingStep`: `'pending'` | `'step_1'` | `'step_2'` | `'step_3'` | `'completed'`

To grep: `users`, `onboardingStep`, `isAdmin`

**2. `userSubscriptions` — Trial & Plan State**
```typescript
// Fields: id, userId (FK), currentPlan, intendedPlan, subscriptionStatus,
//         trialStatus, trialStartDate, trialEndDate, trialConversionDate,
//         subscriptionCancelDate, subscriptionRenewalDate, billingSyncStatus
```
- `currentPlan`: `'free'` | `'glow_up'` | `'viral_surge'` | `'fame_flex'`
- `trialStatus`: `'pending'` | `'active'` | `'converted'` | `'expired'`
- `subscriptionStatus`: `'none'` | `'trialing'` | `'active'` | `'past_due'` | `'canceled'`

To grep: `userSubscriptions`, `currentPlan`, `trialStatus`

**3. `userBilling` — Stripe Data**
```typescript
// Fields: id, userId (FK), stripeCustomerId, stripeSubscriptionId,
//         paymentMethodId, cardLast4, cardBrand, cardExpMonth, cardExpYear,
//         billingAddressCity, billingAddressCountry, billingAddressPostalCode
```

To grep: `userBilling`, `stripeCustomerId`, `stripeSubscriptionId`

**4. `userUsage` — Plan Limits & Counters**
```typescript
// Fields: id, userId (FK), planCampaignsLimit, planCreatorsLimit, planFeatures,
//         usageCampaignsCurrent, usageCreatorsCurrentMonth, enrichmentsCurrentMonth,
//         usageResetDate
```
- `planCampaignsLimit`: Max campaigns (lifetime)
- `planCreatorsLimit`: Max creators per month
- `usageCreatorsCurrentMonth`: Resets on billing cycle

To grep: `userUsage`, `planCreatorsLimit`, `usageCreatorsCurrentMonth`

**5. `userSystemData` — Webhooks & Events**
```typescript
// Fields: id, userId (FK), signupTimestamp, emailScheduleStatus,
//         lastWebhookEvent, lastWebhookTimestamp
```
- `lastWebhookEvent`: Used for idempotency checking in Stripe webhooks

To grep: `userSystemData`, `lastWebhookEvent`, `emailScheduleStatus`

---

### Search & Campaign Tables

**`campaigns`**
```typescript
// Fields: id, userId, name, description, searchType, status, createdAt, updatedAt
// searchType: 'keyword' | 'similar'
// status: 'draft' | 'active' | 'completed'
```

**`scrapingJobs`**
```typescript
// Fields: id, userId, campaignId (FK), platform, status, keywords, targetUsername,
//         searchParams, targetResults, processedResults, processedRuns,
//         qstashMessageId, timeoutAt, createdAt, startedAt, completedAt
// status: 'pending' | 'processing' | 'completed' | 'error' | 'timeout'
// platform: 'instagram' | 'tiktok' | 'youtube'
```

**`scrapingResults`**
```typescript
// Fields: id, jobId (FK), creators (JSONB array), createdAt
// creators: [{ username, followerCount, profileUrl, reels, ... }]
```

To grep: `scrapingJobs`, `scrapingResults`, `campaigns`

---

### Creator List Tables

**`creatorProfiles`** — Deduplicated creators
```typescript
// Fields: id, platform, externalId, handle, displayName, avatarUrl, url,
//         followers, engagementRate, category, metadata
// UNIQUE(platform, externalId)
```

**`creatorLists`** — User's saved collections
```typescript
// Fields: id, ownerId (FK), name, description, type, privacy, tags,
//         settings, stats, isArchived, slug
// type: 'custom' | 'campaign' | 'favorites' | 'industry' | 'contacted'
```

**`creatorListItems`** — M2M join table
```typescript
// Fields: id, listId (FK), creatorId (FK), position, bucket, addedBy,
//         notes, metricsSnapshot, customFields, pinned, lastContactedAt
// bucket: 'backlog' | 'contacted' | 'responded' | 'rejected'
```

To grep: `creatorProfiles`, `creatorLists`, `creatorListItems`

---

## Query Functions (`queries/`)

### User Queries (`user-queries.ts`)

**`getUserProfile(userId: string): Promise<UserProfileComplete>`**
Joins all 5 user tables and returns a unified object. **Always use this** to get user data.

```typescript
import { getUserProfile } from '@/lib/db/queries/user-queries';
const user = await getUserProfile('user_2a1b3c4d');
// Returns: { email, fullName, currentPlan, trialStatus, usageCreatorsCurrentMonth, ... }
```

**`updateUserProfile(userId: string, changes: Partial<UserProfileUpdates>): Promise<void>`**
Distributes updates across the appropriate tables.

```typescript
import { updateUserProfile } from '@/lib/db/queries/user-queries';
await updateUserProfile('user_2a1b3c4d', {
  currentPlan: 'viral_surge',
  trialStatus: 'converted',
  usageCreatorsCurrentMonth: 0
});
```

To grep: `getUserProfile`, `updateUserProfile`, `UserProfileComplete`

### Dashboard Queries (`dashboard-queries.ts`)

**`getDashboardStats(userId: string): Promise<DashboardStats>`**
Returns campaign count, usage stats, recent activity.

To grep: `getDashboardStats`, `DashboardStats`

### List Queries (`list-queries.ts`)

Functions for creator list operations:
- `createCreatorList(userId, data)` — Create new list
- `getUserLists(userId)` — Get all user's lists
- `addCreatorToList(listId, creatorId)` — Add creator
- `removeCreatorFromList(listId, creatorId)` — Remove creator
- `getListWithCreators(listId)` — Get list with all items

To grep: `createCreatorList`, `getUserLists`, `addCreatorToList`

---

## Database Connection (`index.ts`)

```typescript
import { db } from '@/lib/db';

// Use db for all queries
const campaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
```

Connection uses Supabase PostgreSQL with connection pooling (max 15 connections).

---

## Migration Workflow

1. **Modify schema.ts**
2. **Generate migration:** `npm run db:generate`
3. **Apply migration:** `npm run db:migrate`
4. **Verify in Studio:** `npm run db:studio`

**Never skip migrations.** Direct schema changes will cause drift.

---

## Next in Chain

- For services that use these queries, see `lib/services/CLAUDE.md`
- For API routes that call these queries, see `app/api/CLAUDE.md`
