# Scalability Audit Report

**Date:** January 13, 2026
**Codebase:** UseGems.io (Gemz) - Influencer Discovery Platform
**Auditor:** Claude Opus 4.5

---

## Executive Summary

This audit identifies scalability concerns across the database layer, search architecture, API routes, frontend, and infrastructure. The codebase has **good foundations** (proper indexing on key tables, fan-out worker architecture, Redis caching) but has several areas that will cause issues as user count grows from tens to hundreds/thousands.

**Critical Issues:** 3
**High Priority:** 7
**Medium Priority:** 8
**Low Priority:** 5

---

## 1. Database Layer (lib/db/)

### 1.1 Missing Indexes

#### Issue: `scrapingResults` table lacks job lookup index
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/schema.ts` (lines 94-99)
**Priority:** HIGH

The `scrapingResults` table stores large JSON blobs of creators but has no index on `jobId`:

```typescript
export const scrapingResults = pgTable('scraping_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => scrapingJobs.id),
  creators: jsonb('creators').notNull(),  // Can be MB-sized JSON
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**Impact at Scale:**
- Every job status check does a full table scan on `scrapingResults`
- CSV export queries (`/api/export/csv`) scan entire table
- With 10K+ jobs, queries will timeout

**Fix:**
```typescript
(table) => ({
  jobIdIdx: index('idx_scraping_results_job_id').on(table.jobId),
})
```

---

#### Issue: `creatorListItems` missing composite index for bucket queries
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/schema.ts` (lines 415-442)
**Priority:** MEDIUM

The Kanban board view queries by `(listId, bucket)` but only has a unique constraint, not a composite index:

```typescript
export const creatorListItems = pgTable('creator_list_items', {
  // ...
  bucket: varchar('bucket', { length: 32 }).notNull().default('backlog'),
  // ...
}, (table) => ({
  uniqueListCreator: unique('creator_list_items_list_creator_unique').on(
    table.listId, table.creatorId
  ),
  // Missing: index on (listId, bucket) for Kanban queries
}));
```

**Impact at Scale:**
- Lists with 1000+ creators will have slow bucket filtering
- Board view loads will degrade

**Fix:**
```typescript
listBucketIdx: index('idx_creator_list_items_bucket').on(table.listId, table.bucket),
```

---

#### Issue: `creatorProfiles` missing handle search index
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/schema.ts` (lines 363-386)
**Priority:** MEDIUM

Creator profile lookups by `handle` (username) have no index:

```typescript
export const creatorProfiles = pgTable('creator_profiles', {
  handle: text('handle').notNull(),  // No index!
  // ...
});
```

**Impact at Scale:**
- `upsertCreatorProfile()` does `SELECT WHERE handle = ?` on every save
- With 100K+ profiles, each lookup becomes slow

**Fix:**
```typescript
handlePlatformIdx: index('idx_creator_profiles_handle_platform').on(table.platform, table.handle),
```

---

### 1.2 N+1 Query Patterns

#### Issue: List detail fetches creators without batching
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/queries/list-queries.ts` (lines 535-608)
**Priority:** HIGH

The `addCreatorsToList()` function loops through creators one-by-one:

```typescript
for (const creator of creators) {
  const profile = await upsertCreatorProfile(tx, creator);  // N queries!
  const result = await tx.insert(creatorListItems).values({...});  // N more!
}
```

**Impact at Scale:**
- Saving 100 creators = 200+ database round trips
- Transaction timeout risk with large batches

**Fix:**
Batch the upserts using `INSERT ... ON CONFLICT DO UPDATE`:
```typescript
// Batch all creators in one INSERT
await tx.insert(creatorProfiles)
  .values(creators.map(c => ({...})))
  .onConflictDoUpdate({
    target: [creatorProfiles.platform, creatorProfiles.externalId],
    set: { updatedAt: new Date() }
  });
```

---

#### Issue: Dashboard favorites query has multiple JOINs
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/queries/dashboard-queries.ts` (lines 74-127)
**Priority:** MEDIUM

The `getFavoriteInfluencersForDashboard()` function joins 4 tables:

```typescript
.from(creatorListItems)
.leftJoin(creatorLists, ...)
.leftJoin(creatorProfiles, ...)
.where(and(
  eq(creatorLists.isArchived, false),
  or(eq(creatorListItems.pinned, true), favoriteListCondition()),
  accessibleListFilter(internalUserId)  // Subquery!
))
```

**Impact at Scale:**
- Complex filter with JSON extraction (`settings->>'dashboardFavorite'`)
- Subquery for collaborator check on every dashboard load

**Fix:**
- Add materialized view or denormalized `isFavorite` column
- Cache dashboard data in Redis for 1-5 minutes

---

### 1.3 Connection Pooling Issues

#### Issue: Single connection per serverless instance
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/index.ts` (lines 81-89)
**Priority:** CRITICAL

```typescript
const queryClient = postgres(connectionString, {
  max: isLocal ? 10 : 1,  // CRITICAL: 1 connection per serverless instance
});
```

**Analysis:**
This is actually **correct** for Vercel serverless with PgBouncer/Supabase. However, the risk is:

- Supabase free tier: 60 connections max
- Supabase Pro tier: 200 connections max
- Each Vercel function instance = 1 connection
- With 200+ concurrent users, you'll hit connection limits

**Impact at Scale:**
- Connection pool exhaustion errors
- Random `ECONNREFUSED` during traffic spikes

**Fix:**
1. Use Supabase connection pooler (pgBouncer) - **already configured via `?pgbouncer=true` in URL** (verify this)
2. Add connection retry logic
3. Monitor connection count in Supabase dashboard
4. Consider upgrading to Supabase Pro/Team for higher limits

---

### 1.4 Large JSON Storage

#### Issue: `scrapingResults.creators` stores unbounded JSON
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/schema.ts` (lines 94-99)
**Priority:** HIGH

The legacy `scrapingResults` table stores ALL creators as a single JSON blob:

```typescript
creators: jsonb('creators').notNull(),  // Can be 1000+ creator objects
```

**Impact at Scale:**
- Single row can be 1-10 MB
- PostgreSQL TOAST storage kicks in (slower reads)
- CSV export must load entire blob into memory

**Note:** The V2 architecture (`jobCreators` table) correctly normalizes this with one row per creator. However, legacy code paths still use `scrapingResults`.

**Fix:**
- Complete migration to `jobCreators` table
- Add migration script to move legacy data
- Remove `scrapingResults` table after migration

---

## 2. Search Architecture (lib/search-engine/)

### 2.1 Concurrent Search Scaling

#### Issue: No rate limiting on search dispatch
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/search-engine/v2/workers/dispatch.ts` (lines 69-140)
**Priority:** HIGH

The `fanoutSearchWorkers()` function dispatches all keywords simultaneously:

```typescript
for (let i = 0; i < keywords.length; i++) {
  const publishPromise = qstash.publishJSON({
    url: searchWorkerUrl,
    body: message,
    delay: Math.floor(i / 5) * 1,  // Only 1s delay every 5 keywords
  });
  dispatchPromises.push(publishPromise);
}
const results = await Promise.allSettled(dispatchPromises);
```

**Impact at Scale:**
- 50 keywords = 50 parallel workers hitting external APIs
- External API rate limits (ScrapeCreators) may be exceeded
- QStash has throughput limits (check your plan)

**Fix:**
```typescript
// Add exponential backoff and smaller batches
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

for (let batch = 0; batch < keywords.length; batch += BATCH_SIZE) {
  const batchKeywords = keywords.slice(batch, batch + BATCH_SIZE);
  // Dispatch batch with delay
  await Promise.all(batchKeywords.map((kw, i) =>
    qstash.publishJSON({...})
  ));
  if (batch + BATCH_SIZE < keywords.length) {
    await sleep(BATCH_DELAY_MS);
  }
}
```

---

#### Issue: No user-level search concurrency limit
**File:** `/Users/sanchay/Documents/projects/personal/gemz/app/api/v2/dispatch/route.ts`
**Priority:** MEDIUM

A user can start multiple searches simultaneously. There's billing validation but no "one active search per user" limit.

**Impact at Scale:**
- Malicious/buggy client could spam searches
- Worker queue gets flooded
- Other users' searches delayed

**Fix:**
Add check in `dispatch()`:
```typescript
// Check for existing in-progress job
const activeJob = await db.query.scrapingJobs.findFirst({
  where: and(
    eq(scrapingJobs.userId, userId),
    eq(scrapingJobs.status, 'processing')
  )
});
if (activeJob) {
  return { success: false, error: 'Search already in progress' };
}
```

---

### 2.2 Redis Caching Strategy

#### Issue: No cache warming or precomputation
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/cache/redis.ts`
**Priority:** MEDIUM

Cache is only populated after first request (cache-aside pattern). For completed jobs:

```typescript
// Only cache completed jobs
if (data.status !== 'completed') {
  return false;
}
```

**Impact at Scale:**
- First user to view results always hits DB
- Cold cache after Redis TTL expiry (24h)
- No proactive caching

**Fix:**
Cache job results immediately when search completes:
```typescript
// In job-tracker.ts markComplete()
await cacheJobResults(jobId, 0, 200, {
  status: 'completed',
  totalCreators: count,
  creators: firstPageCreators,
  pagination: {...}
});
```

---

#### Issue: Cache key pattern allows KEYS scan
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/cache/redis.ts` (lines 119-135)
**Priority:** LOW

```typescript
export async function cacheDeletePattern(pattern: string): Promise<number> {
  // Upstash doesn't support SCAN, so we use KEYS (ok for small datasets)
  const keys = await client.keys(pattern);
  // ...
}
```

**Impact at Scale:**
- `KEYS` blocks Redis
- With 100K+ cache keys, this will cause latency spikes

**Fix:**
- Use explicit key tracking instead of pattern matching
- Or use Redis SCAN if available (Upstash may support it now)

---

### 2.3 QStash Queue Handling

#### Issue: No dead letter queue handling
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/search-engine/v2/workers/search-worker.ts`
**Priority:** MEDIUM

Workers retry 3 times but there's no handling for permanently failed messages:

```typescript
qstash.publishJSON({
  url: searchWorkerUrl,
  body: message,
  retries: 3,  // After 3 failures, message is dropped
});
```

**Impact at Scale:**
- Failed keywords silently disappear
- User sees partial results without knowing why

**Fix:**
1. Configure QStash dead letter queue
2. Add monitoring/alerting for DLQ messages
3. Consider storing failed keywords in DB for manual retry

---

## 3. API Routes (app/api/)

### 3.1 Timeout Risks

#### Issue: CSV export loads all data into memory
**File:** `/Users/sanchay/Documents/projects/personal/gemz/app/api/export/csv/route.ts`
**Priority:** CRITICAL

```typescript
export const maxDuration = 60;  // 60 second timeout

// For campaign export, loads ALL jobs and ALL results
const jobs = await db.query.scrapingJobs.findMany({
  where: eq(jobs.campaignId, campaignId),
  with: { results: true },  // Eager loads all JSON blobs!
});

let allCreators: any[] = [];
jobs.forEach((job) => {
  job.results.forEach((result) => {
    allCreators = allCreators.concat(creatorsData);  // Memory grows unbounded
  });
});
```

**Impact at Scale:**
- Campaign with 10 runs x 1000 creators = 10K objects in memory
- Vercel function memory limit (1GB on Pro) exceeded
- 60s timeout exceeded for large exports

**Fix:**
1. Stream CSV generation:
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    controller.enqueue(encoder.encode(headers));

    // Stream creators in batches
    for await (const batch of getCreatorBatches(campaignId, 100)) {
      for (const creator of batch) {
        controller.enqueue(encoder.encode(formatRow(creator)));
      }
    }
    controller.close();
  }
});
return new Response(stream, { headers: {...} });
```

2. Or offload to background job with download link

---

#### Issue: Job status endpoint makes multiple DB queries
**File:** `/Users/sanchay/Documents/projects/personal/gemz/app/api/v2/status/route.ts` (lines 125-220)
**Priority:** MEDIUM

```typescript
const job = await db.query.scrapingJobs.findFirst({...});
const countResult = await db.select({count: ...}).from(jobCreators);
const enrichedResult = await db.select({count: ...}).from(jobCreators);
const paginatedRows = await db.select(...).from(jobCreators);
```

**Impact at Scale:**
- 4 sequential DB queries per status poll
- Frontend polls every 2-5 seconds during search
- 100 concurrent users = 400+ queries/second

**Fix:**
Combine into single query:
```typescript
const [result] = await db.execute(sql`
  SELECT
    j.*,
    (SELECT COUNT(*) FROM job_creators WHERE job_id = j.id) as total_count,
    (SELECT COUNT(*) FROM job_creators WHERE job_id = j.id AND enriched = true) as enriched_count
  FROM scraping_jobs j
  WHERE j.id = ${jobId}
`);
```

---

### 3.2 Missing Pagination

#### Issue: Lists API returns all lists without pagination
**File:** `/Users/sanchay/Documents/projects/personal/gemz/app/api/lists/route.ts` (lines 19-37)
**Priority:** MEDIUM

```typescript
export async function GET() {
  const lists = await getListsForUser(userId);  // No limit!
  return NextResponse.json({ lists });
}
```

**Impact at Scale:**
- User with 100+ lists gets them all at once
- Response size grows unbounded

**Fix:**
Add pagination:
```typescript
const page = parseInt(url.searchParams.get('page') || '1');
const limit = parseInt(url.searchParams.get('limit') || '20');
const lists = await getListsForUser(userId, { page, limit });
```

---

#### Issue: Webhook events table grows unbounded
**File:** `/Users/sanchay/Documents/projects/personal/gemz/lib/db/schema.ts` (lines 303-327)
**Priority:** LOW

The `webhookEvents` table stores all webhook payloads but has no cleanup:

```typescript
payload: jsonb('payload'),  // Optional: store event payload for debugging
```

**Impact at Scale:**
- 1000 users x 10 webhooks/month x 12 months = 120K rows/year
- Table grows indefinitely

**Fix:**
Add cron job to clean old events:
```typescript
// In /api/cron/cleanup-webhooks
await db.delete(webhookEvents).where(
  lt(webhookEvents.createdAt, subDays(new Date(), 90))
);
```

---

## 4. Frontend Performance

### 4.1 Large Data Fetching

#### Issue: No virtualization for creator lists
**File:** `/Users/sanchay/Documents/projects/personal/gemz/app/components/campaigns/search/search-results.tsx`
**Priority:** HIGH

The search results render all creators in DOM:

```typescript
const currentInfluencers = creators.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);
// Renders only 10 at a time, but...
```

**Note:** This component does have pagination (10 items per page), which is good. However:

**Related Issue:** The V2 status endpoint returns 200 creators per request:
```typescript
const limit = Math.min(500, Math.max(1, Number.parseInt(searchParams.get('limit') || '200', 10)));
```

**Impact at Scale:**
- 200 creator objects in memory per poll
- Gallery view renders all visible cards (no virtual scrolling)

**Fix:**
1. Implement react-window or react-virtuoso for large lists
2. Reduce default page size to 50

---

#### Issue: Polling continues after unmount risk
**File:** `/Users/sanchay/Documents/projects/personal/gemz/app/components/campaigns/search/search-results.tsx` (lines 71-114)
**Priority:** MEDIUM

```typescript
React.useEffect(() => {
  const pollResults = async () => {
    // ...
    setTimeout(pollResults, 5000);  // No cleanup!
  };
  pollResults();
}, [jobId, title]);  // Missing cleanup return
```

**Impact at Scale:**
- Memory leak if user navigates away mid-search
- Multiple polling loops if component remounts

**Fix:**
```typescript
React.useEffect(() => {
  let cancelled = false;
  const pollResults = async () => {
    if (cancelled) return;
    // ...
    if (!cancelled) setTimeout(pollResults, 5000);
  };
  pollResults();
  return () => { cancelled = true; };
}, [jobId]);
```

---

### 4.2 Bundle Size

#### Issue: No dynamic imports for heavy components
**Priority:** LOW

The campaign detail page loads all view components upfront:
- CreatorGalleryView
- CreatorTableView
- ActivityLog
- etc.

**Impact at Scale:**
- Initial page load includes unused code
- Slower Time to Interactive

**Fix:**
Use `next/dynamic`:
```typescript
const CreatorGalleryView = dynamic(
  () => import('./components/CreatorGalleryView'),
  { loading: () => <Skeleton /> }
);
```

---

## 5. Infrastructure

### 5.1 Vercel Serverless Limits

#### Issue: 300s max function duration may not be enough
**File:** `/Users/sanchay/Documents/projects/personal/gemz/vercel.json`
**Priority:** MEDIUM

```json
"functions": {
  "app/api/**/*.ts": {
    "maxDuration": 300
  }
}
```

**Analysis:**
- Most endpoints set individual `maxDuration` (15-60s)
- CSV export has 60s timeout
- Webhook handler has 60s timeout

**Impact at Scale:**
- Large CSV exports may still timeout
- Long-running searches handled by QStash (good)

**Recommendation:**
Current setup is reasonable. For very large exports, consider:
1. Background job with email notification
2. Vercel Pro plan for 300s max

---

### 5.2 Database Connection Limits

#### Issue: Supabase connection limits
**Priority:** CRITICAL (as user count grows)

**Current State:**
- Code uses `max: 1` connection per instance (correct)
- Supabase Free: 60 connections
- Supabase Pro: 200 connections

**Impact at Scale:**
- 200+ concurrent Vercel instances = connection errors
- Cold start connection storms

**Fix:**
1. Enable Supabase connection pooling (pgBouncer)
2. Monitor connection count
3. Consider Supabase Team plan or Neon.tech for higher limits
4. Add connection error retry:
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e.code === 'ECONNREFUSED' && i < maxRetries - 1) {
        await sleep(1000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}
```

---

### 5.3 External API Quotas

#### Issue: No tracking of external API usage
**Priority:** MEDIUM

The search workers call ScrapeCreators API but there's no:
- Usage tracking per user
- Rate limit handling
- Quota alerting

**Impact at Scale:**
- Unknown API costs
- Sudden billing surprises
- Rate limit errors during traffic spikes

**Fix:**
1. Add API call counter per user/day
2. Implement circuit breaker for API failures
3. Add monitoring dashboard for API usage

---

## 6. Summary of Recommended Actions

### Immediate (Before next traffic spike)

| Priority | Issue | Fix Effort |
|----------|-------|------------|
| CRITICAL | CSV export memory explosion | 2-4 hours |
| CRITICAL | Connection pooling verification | 1 hour |
| HIGH | Missing `scrapingResults.jobId` index | 10 minutes |
| HIGH | N+1 in `addCreatorsToList` | 2-3 hours |

### Short-term (Next 2 weeks)

| Priority | Issue | Fix Effort |
|----------|-------|------------|
| HIGH | No rate limiting on search dispatch | 2 hours |
| HIGH | Status endpoint multiple queries | 2 hours |
| MEDIUM | User-level search concurrency limit | 1 hour |
| MEDIUM | Cache warming for completed jobs | 2 hours |
| MEDIUM | Lists API pagination | 1 hour |

### Medium-term (Next month)

| Priority | Issue | Fix Effort |
|----------|-------|------------|
| MEDIUM | Missing `creatorListItems` bucket index | 10 minutes |
| MEDIUM | Missing `creatorProfiles` handle index | 10 minutes |
| MEDIUM | Polling cleanup in React components | 1-2 hours |
| MEDIUM | Dead letter queue handling | 3-4 hours |
| LOW | Webhook events cleanup cron | 1 hour |
| LOW | Dynamic imports for bundle size | 2-3 hours |

---

## 7. Monitoring Recommendations

Add these metrics to your observability stack:

1. **Database**
   - Active connections (target: <80% of limit)
   - Query duration P95
   - Table row counts

2. **API**
   - Request latency by endpoint
   - Error rate by endpoint
   - Timeout count

3. **Search**
   - Jobs per hour
   - Average job duration
   - Worker failure rate
   - QStash queue depth

4. **External APIs**
   - ScrapeCreators calls per day
   - Error rate
   - Response latency

---

*Report generated by Claude Opus 4.5 for UseGems.io scalability audit.*
