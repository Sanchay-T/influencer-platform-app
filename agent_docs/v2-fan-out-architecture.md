# V2 Fan-Out Architecture Specification

> **Status:** Planning Complete, Implementation Pending
> **Created:** Dec 10, 2025
> **Last Updated:** Dec 10, 2025
> **Branch:** `feat/v2-fan-out-workers`

---

## Executive Summary

This document defines the architecture for a scalable, multi-user search system that replaces the current monolithic approach with a fan-out worker pattern using QStash.

**Key Goals:**
1. True parallel processing across keywords
2. Progressive results (users see data immediately)
3. Multi-user scale without blocking
4. Platform-agnostic design (add platforms with one file)
5. No legacy tech debt (full replacement)

---

## Architecture Decisions (Agreed)

### Decision 1: Full Replacement, Not Addition
- **Decision:** Delete old providers and routes after v2 is complete
- **Rationale:** Avoid tech debt, single source of truth
- **Impact:** Clean codebase, no maintenance burden

### Decision 2: Platform = Parameter
- **Decision:** Platform passed as string parameter to all workers
- **Rationale:** One set of workers handles all platforms
- **Impact:** `getAdapter(platform)` is the only branching point

### Decision 3: Adapter = Only Difference
- **Decision:** Platform-specific code ONLY in adapter files
- **Rationale:** ~200 lines per platform, everything else shared
- **Impact:** Adding YouTube/Instagram = one new file each

### Decision 4: Billing Integration Preserved
- **Decision:** Use existing `validateCreatorSearch()` and `incrementCreatorCount()`
- **Rationale:** No changes to billing logic
- **Impact:** All plan limits, tiers, feature gates work as-is

### Decision 5: Skip Truncated Bio Email Extraction
- **Decision:** Only extract emails from enriched bios
- **Rationale:** Truncated bios have incomplete emails
- **Impact:** More reliable email data, cleaner extraction

---

## System Architecture

### Flow Diagram

```
USER REQUEST (any platform)
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/v2/dispatch                                           │
│  ─────────────────                                          │
│  1. validateCreatorSearch(userId, targetCount)              │
│  2. Create job in DB (status: 'dispatching')                │
│  3. Expand keywords with AI                                 │
│  4. Fan-out: publish N QStash messages (1 per keyword)      │
│  5. Return jobId immediately                                │
└─────────────────────────────────────────────────────────────┘
      │
      │ N messages published
      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/v2/worker/search (called by QStash, N times)          │
│  ────────────────────────────────────────────               │
│  1. Receive: { jobId, platform, keyword, batchIndex }       │
│  2. adapter = getAdapter(platform)                          │
│  3. results = adapter.fetch(keyword)                        │
│  4. creators = results.map(adapter.normalize)               │
│  5. Save to DB immediately (users see results!)             │
│  6. Increment: keywords_completed++, creators_found += N    │
│  7. Dispatch enrichment batches for these creators          │
└─────────────────────────────────────────────────────────────┘
      │
      │ M messages published (batches of 10 creators)
      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/v2/worker/enrich (called by QStash, M times)          │
│  ───────────────────────────────────────────                │
│  1. Receive: { jobId, platform, creatorIds[] }              │
│  2. adapter = getAdapter(platform)                          │
│  3. For each creator: enriched = adapter.enrich(creator)    │
│  4. Extract emails from enriched bio                        │
│  5. Update creators in DB with emails                       │
│  6. Increment: creators_enriched += batch_size              │
│  7. If all enriched → mark job 'completed'                  │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/v2/status?jobId=xxx (polling endpoint)                │
│  ──────────────────────────                                 │
│  Returns: status, creators (paginated), progress counters   │
│  Frontend shows results progressively as they arrive        │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

```sql
-- Add to scraping_jobs table
ALTER TABLE scraping_jobs ADD COLUMN
  keywords_dispatched INTEGER DEFAULT 0,
  keywords_completed INTEGER DEFAULT 0,
  creators_found INTEGER DEFAULT 0,
  creators_enriched INTEGER DEFAULT 0,
  enrichment_status VARCHAR(20) DEFAULT 'pending';
  -- enrichment_status: 'pending' | 'in_progress' | 'completed'
```

### Job Status Flow

```
pending → dispatching → searching → enriching → completed
                │           │           │
                └───────────┴───────────┴──→ error (on failure)
```

---

## File Structure (Target State)

```
lib/search-engine/
├── v2/
│   ├── adapters/                    # PLATFORM-SPECIFIC (only here)
│   │   ├── interface.ts             # SearchAdapter interface
│   │   ├── tiktok.ts               # TikTok: fetch, normalize, enrich
│   │   ├── instagram.ts            # Instagram: fetch, normalize, enrich
│   │   └── youtube.ts              # YouTube: fetch, normalize, enrich
│   │
│   ├── core/                        # PLATFORM-AGNOSTIC
│   │   ├── types.ts                # NormalizedCreator, configs, etc.
│   │   ├── config.ts               # API URLs, timeouts, constants
│   │   ├── job-tracker.ts          # Atomic DB counter updates
│   │   └── keyword-expander.ts     # AI keyword expansion
│   │
│   ├── workers/                     # PLATFORM-AGNOSTIC
│   │   ├── types.ts                # Worker message types
│   │   ├── dispatch.ts             # Fan-out logic
│   │   ├── search-worker.ts        # Process one keyword
│   │   └── enrich-worker.ts        # Enrich batch of creators
│   │
│   └── index.ts                    # Public exports
│
├── job-service.ts                  # Simplified, used by workers
└── types.ts                        # Shared types

app/api/v2/
├── dispatch/route.ts               # POST: Create job, fan out
├── worker/
│   ├── search/route.ts             # POST: QStash search worker
│   └── enrich/route.ts             # POST: QStash enrich worker
└── status/route.ts                 # GET: Job status + results

[TO DELETE after migration]
├── lib/search-engine/providers/    # Old provider files
├── lib/search-engine/runner.ts     # Old dispatch logic
├── app/api/scraping/tiktok/        # Old routes
├── app/api/scraping/instagram-*/   # Old routes
├── app/api/scraping/youtube*/      # Old routes
└── app/api/qstash/process-search/  # Old QStash handler
```

---

## Implementation Phases

### Phase 1: Database Schema ⬜ NOT STARTED
**Goal:** Add coordination columns to scraping_jobs

**Files:**
- [ ] `lib/db/schema.ts` - Add new columns

**Schema Changes:**
```typescript
// Add to scrapingJobs table definition
keywordsDispatched: integer('keywords_dispatched').default(0),
keywordsCompleted: integer('keywords_completed').default(0),
creatorsFound: integer('creators_found').default(0),
creatorsEnriched: integer('creators_enriched').default(0),
enrichmentStatus: varchar('enrichment_status', { length: 20 }).default('pending'),
```

**Human Action Required:** Run `npx drizzle-kit generate` and answer migration prompts

---

### Phase 2: Core Infrastructure ⬜ NOT STARTED
**Goal:** Create job tracking and worker types

**Files:**
- [ ] `lib/search-engine/v2/core/job-tracker.ts` - Atomic counter updates
- [ ] `lib/search-engine/v2/workers/types.ts` - Message type definitions

**Key Types:**
```typescript
// Worker message types
interface DispatchRequest {
  platform: 'tiktok' | 'instagram' | 'youtube';
  keywords: string[];
  targetResults: number;
  campaignId: string;
  userId: string;
}

interface SearchWorkerMessage {
  jobId: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  keyword: string;
  batchIndex: number;
  totalBatches: number;
}

interface EnrichWorkerMessage {
  jobId: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  creatorIds: string[];
  batchIndex: number;
}
```

---

### Phase 3: Workers ⬜ NOT STARTED
**Goal:** Create platform-agnostic worker logic

**Files:**
- [ ] `lib/search-engine/v2/workers/dispatch.ts`
- [ ] `lib/search-engine/v2/workers/search-worker.ts`
- [ ] `lib/search-engine/v2/workers/enrich-worker.ts`

**Worker Responsibilities:**

| Worker | Input | Actions | Output |
|--------|-------|---------|--------|
| dispatch | keywords, platform, target | Expand keywords, create job, fan-out | jobId |
| search | jobId, keyword, platform | Fetch, normalize, save, dispatch enrich | creators saved |
| enrich | jobId, creatorIds, platform | Fetch bio, extract email, update | creators enriched |

---

### Phase 4: API Routes ⬜ NOT STARTED
**Goal:** Create unified routes for all platforms

**Files:**
- [ ] `app/api/v2/dispatch/route.ts`
- [ ] `app/api/v2/worker/search/route.ts`
- [ ] `app/api/v2/worker/enrich/route.ts`
- [ ] `app/api/v2/status/route.ts`

**Route Specifications:**

```typescript
// POST /api/v2/dispatch
// Body: { platform, keywords, targetResults, campaignId }
// Auth: Clerk user required
// Response: { jobId, status: 'dispatching' }

// POST /api/v2/worker/search
// Body: SearchWorkerMessage
// Auth: QStash signature
// Response: { success, creatorsFound }

// POST /api/v2/worker/enrich
// Body: EnrichWorkerMessage
// Auth: QStash signature
// Response: { success, creatorsEnriched }

// GET /api/v2/status?jobId=xxx
// Auth: Clerk user required (must own job)
// Response: { status, creators[], progress, pagination }
```

---

### Phase 5: Complete Adapters ⬜ NOT STARTED
**Goal:** Ensure all platforms have adapters

**Files:**
- [x] `lib/search-engine/v2/adapters/tiktok.ts` - EXISTS, enhance
- [ ] `lib/search-engine/v2/adapters/instagram.ts` - CREATE
- [ ] `lib/search-engine/v2/adapters/youtube.ts` - CREATE

---

### Phase 6: Frontend Integration ⬜ NOT STARTED
**Goal:** Update frontend to use v2 routes

**Files:**
- [ ] Update campaign search components to call `/api/v2/dispatch`
- [ ] Update polling logic to call `/api/v2/status`
- [ ] Progressive loading UI (show results as they arrive)

---

### Phase 7: Cleanup ⬜ NOT STARTED
**Goal:** Delete legacy code

**Files to Delete:**
- [ ] `lib/search-engine/providers/` (entire directory)
- [ ] `lib/search-engine/runner.ts`
- [ ] `app/api/scraping/tiktok/route.ts`
- [ ] `app/api/scraping/instagram-scrapecreators/route.ts`
- [ ] `app/api/scraping/instagram-v2/route.ts`
- [ ] `app/api/scraping/youtube/route.ts`
- [ ] `app/api/scraping/youtube-similar/route.ts`
- [ ] `app/api/qstash/process-search/route.ts`

---

## QStash Message Budget

For a 1000-creator search with 20 keywords:

| Message Type | Count | Calculation |
|--------------|-------|-------------|
| Search workers | 20 | 1 per keyword |
| Enrich workers | 100 | 1000 creators / 10 per batch |
| **Total** | **~120** | Per job |

**QStash Pro (100k/day):** ~830 large jobs/day or ~8,300 small jobs/day

---

## Billing Integration Points

```typescript
// In dispatch route (before job creation)
const validation = await validateCreatorSearch(userId, targetResults);
if (!validation.allowed) {
  return Response.json({ error: validation.reason }, { status: 403 });
}

// In search-worker (after saving creators)
await incrementCreatorCount(userId, newCreatorsCount);

// No other billing changes needed
```

---

## Testing Checklist

- [ ] Single keyword search works
- [ ] Multi-keyword search fans out correctly
- [ ] Enrichment batches dispatch after search
- [ ] Job completes when all enrichment done
- [ ] Progress updates in real-time
- [ ] Multiple users can search simultaneously
- [ ] Plan limits enforced
- [ ] Usage incremented correctly
- [ ] Deduplication works across keywords
- [ ] Error handling doesn't break other workers

---

## Open Questions

1. **Rate limiting:** Do we need Redis-based rate limiting for ScrapeCreators API?
   - Current: No rate limiting
   - Proposed: Add Upstash rate limiter if needed

2. **Retry strategy:** What happens if a worker fails?
   - Current: QStash retries 3 times
   - Proposed: Keep QStash retries, add idempotency keys

3. **Partial completion:** What if some keywords fail?
   - Proposed: Mark job as 'partial' with error details

---

## Reference: Existing Code Locations

| What | Where |
|------|-------|
| Plan validation | `lib/services/plan-validator.ts` |
| Usage increment | `lib/billing/index.ts` → `incrementCreatorCount()` |
| Job service | `lib/search-engine/job-service.ts` |
| QStash client | `lib/queue/qstash.ts` |
| TikTok adapter | `lib/search-engine/v2/adapters/tiktok.ts` |
| Keyword expander | `lib/search-engine/v2/core/keyword-expander.ts` |
| DB schema | `lib/db/schema.ts` |

---

## Next Session Start Here

1. Read this document
2. Check current-task.md for immediate next step
3. Check git status for any uncommitted work
4. Continue from the current phase
