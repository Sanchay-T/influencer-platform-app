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
┌─────────────────────────────────────────────────────────────────┐
│  /api/v2/dispatch                                               │
│  ─────────────────                                              │
│  1. validateCreatorSearch(userId, targetCount)                  │
│  2. Create job in DB (status: 'dispatching')                    │
│  3. Expand keywords with AI (if enabled)                        │
│  4. Fan-out: publish N QStash messages (1 per keyword)          │
│  5. Return jobId immediately                                    │
└─────────────────────────────────────────────────────────────────┘
      │
      │ N messages published
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  /api/v2/worker/search (called by QStash, N times)              │
│  ────────────────────────────────────────────                   │
│  1. Receive: { jobId, platform, keyword, batchIndex }           │
│  2. adapter = getAdapter(platform)                              │
│  3. results = adapter.fetch(keyword)                            │
│  4. creators = results.map(adapter.normalize)                   │
│  5. Save to DB immediately (users see results!)                 │
│  6. Increment: keywords_completed++, creators_found += N        │
│  7. Dispatch enrichment batches for these creators              │
└─────────────────────────────────────────────────────────────────┘
      │
      │ M messages published (batches of 10 creators)
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  /api/v2/worker/enrich (called by QStash, M times)              │
│  ───────────────────────────────────────────                    │
│  1. Receive: { jobId, platform, creatorIds[] }                  │
│  2. adapter = getAdapter(platform)                              │
│  3. For each creator: enriched = adapter.enrich(creator)        │
│  4. Extract emails from enriched bio                            │
│  5. Update creators in DB with emails                           │
│  6. Increment: creators_enriched += batch_size                  │
│  7. If all enriched → mark job 'completed'                      │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  /api/v2/status?jobId=xxx (polling endpoint)                    │
│  ──────────────────────────                                     │
│  Returns: status, creators (paginated), progress counters       │
│  Frontend shows results progressively as they arrive            │
└─────────────────────────────────────────────────────────────────┘
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

## Input Validation & Keyword Handling

### User Input Scenarios

| Scenario | Input | AI Expansion | Keywords Used |
|----------|-------|--------------|---------------|
| Single keyword, 100 creators | `["fitness"]` | Optional | 1-4 keywords |
| Single keyword, 500 creators | `["fitness"]` | Recommended | 10-20 keywords |
| Single keyword, 1000 creators | `["fitness"]` | Required | 20-40 keywords |
| Multiple keywords, 100 creators | `["fitness", "gym", "workout"]` | No | 3 keywords |
| Multiple keywords, 500 creators | `["fitness", "gym"]` | Optional | 2-10 keywords |
| Multiple keywords, 1000 creators | `["fitness", "gym", "yoga"]` | Recommended | 3-20 keywords |

### Keyword Expansion Logic

```typescript
// In dispatch.ts
function calculateKeywordsNeeded(targetCreators: number, seedKeywords: string[]): number {
  const CREATORS_PER_KEYWORD = 25; // Average yield
  const needed = Math.ceil(targetCreators / CREATORS_PER_KEYWORD);
  return Math.max(needed, seedKeywords.length);
}

// Expansion rules:
// - If user provides enough keywords for target → use as-is
// - If user provides fewer → expand with AI (DeepSeek)
// - Maximum 50 keywords per job (hard limit)
// - Minimum 1 keyword (validation)
```

### Input Validation Rules

```typescript
interface DispatchRequest {
  platform: 'tiktok' | 'instagram' | 'youtube';
  keywords: string[];           // 1-50 keywords, each 2-100 chars
  targetResults: 100 | 500 | 1000;
  campaignId: string;           // Must exist and belong to user
}

// Validation in /api/v2/dispatch
const VALID_TARGETS = [100, 500, 1000];
const MAX_KEYWORDS = 50;
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 100;

function validateInput(body: unknown): DispatchRequest {
  // 1. Platform must be valid
  // 2. Keywords: array, 1-50 items, each 2-100 chars, sanitized
  // 3. targetResults: must be 100, 500, or 1000
  // 4. campaignId: must be valid UUID
}
```

---

## Output Format Specification

### NormalizedCreator Type (Frontend Compatible)

The `NormalizedCreator` type is designed to be compatible with the frontend's flexible field extraction.

```typescript
interface NormalizedCreator {
  // Platform identification
  platform: 'TikTok' | 'YouTube' | 'Instagram';
  id: string;                    // Content ID (video/reel/short)
  mergeKey: string;              // Deduplication key (username)

  // Creator info (frontend reads from creator.*)
  creator: {
    username: string;            // Frontend: base.uniqueId || base.username
    name: string;                // Frontend: base.name || base.displayName
    followers: number;           // Frontend: base.followers
    avatarUrl: string;           // Frontend: base.avatarUrl
    bio: string;                 // Frontend: base.bio
    emails: string[];            // Frontend: creator.creator.emails ✓
    verified: boolean;
    uniqueId?: string;           // TikTok specific
    channelId?: string;          // YouTube specific
  };

  // Content info
  content: {
    id: string;
    url: string;                 // Profile/video URL
    description: string;
    thumbnail: string;
    statistics: {
      views: number;
      likes: number;
      comments: number;
      shares?: number;
    };
    postedAt?: string;
    duration?: number;
  };

  hashtags: string[];

  // Enrichment tracking
  bioEnriched?: boolean;
  bioEnrichedAt?: string;

  // Legacy compatibility (frontend also checks these)
  preview?: string;
  previewUrl?: string;
  video?: {
    description: string;
    url: string;
    preview?: string;
    thumbnail?: string;
    statistics: ContentStatistics;
  };
}
```

### Frontend Field Extraction Paths

The frontend uses flexible extraction. Our `NormalizedCreator` satisfies all these paths:

| Frontend Looks For | NormalizedCreator Provides |
|--------------------|----------------------------|
| `creator.creator?.emails` | ✅ `creator.emails` |
| `base.uniqueId \|\| base.username` | ✅ `creator.username`, `creator.uniqueId` |
| `base.name \|\| base.displayName` | ✅ `creator.name` |
| `base.avatarUrl` | ✅ `creator.avatarUrl` |
| `base.followers` | ✅ `creator.followers` |
| `base.bio \|\| base.description` | ✅ `creator.bio` |
| `video.thumbnail` | ✅ `content.thumbnail`, `video.thumbnail` |

### API Response Format (GET /api/v2/status)

```typescript
interface StatusResponse {
  status: 'dispatching' | 'searching' | 'enriching' | 'completed' | 'error';

  // Progress counters
  progress: {
    keywordsDispatched: number;
    keywordsCompleted: number;
    creatorsFound: number;
    creatorsEnriched: number;
    percentComplete: number;      // 0-100
  };

  // Results (paginated)
  results: [{
    id: string;
    creators: NormalizedCreator[];
  }];

  // Pagination
  pagination: {
    limit: number;
    total: number;
    offset: number;
    nextOffset: number | null;
  };

  // Metadata
  totalCreators: number;
  targetResults: number;
  platform: string;
  keywords: string[];
  error?: string;

  // Benchmark (optional)
  benchmark?: {
    totalDurationMs: number;
    apiCalls: number;
    creatorsPerSecond: number;
  };
}
```

---

## Platform Adapter Specifications

All platforms use **ScrapeCreators API** (`https://api.scrapecreators.com`).

### TikTok Adapter (EXISTS - `tiktok.ts`)

```typescript
// Endpoints
const ENDPOINTS = {
  search: '/v1/tiktok/search/keyword',  // Keyword search
  profile: '/v1/tiktok/profile',         // Bio enrichment
};

// Search Response → NormalizedCreator mapping
{
  search_item_list[].aweme_info.author.unique_id    → creator.username
  search_item_list[].aweme_info.author.nickname     → creator.name
  search_item_list[].aweme_info.author.follower_count → creator.followers
  search_item_list[].aweme_info.author.avatar_medium.url_list[0] → creator.avatarUrl
  search_item_list[].aweme_info.author.signature    → creator.bio (truncated!)
  search_item_list[].aweme_info.statistics.*        → content.statistics
  search_item_list[].aweme_info.share_url           → content.url
}

// Profile Response (enrichment)
{
  user.signature || user.desc → creator.bio (full)
}

// Deduplication key: unique_id
```

### Instagram Adapter (CREATE - `instagram.ts`)

```typescript
// Endpoints
const ENDPOINTS = {
  search: '/v1/instagram/reels/search',  // Reels search
  // Note: No separate profile endpoint - bio included in search
};

// Search Response → NormalizedCreator mapping
{
  reels[].owner.username         → creator.username
  reels[].owner.full_name        → creator.name
  reels[].owner.follower_count   → creator.followers
  reels[].owner.profile_pic_url  → creator.avatarUrl
  reels[].owner.biography        → creator.bio (FULL - no enrichment needed!)
  reels[].owner.bio_links[]      → parse for emails
  reels[].like_count             → content.statistics.likes
  reels[].comment_count          → content.statistics.comments
  reels[].video_view_count       → content.statistics.views
  reels[].url                    → content.url
  reels[].thumbnail_src          → content.thumbnail
}

// Deduplication key: owner.username
// Note: Instagram returns FULL bio in search - enrichment may be optional
```

### YouTube Adapter (CREATE - `youtube.ts`)

```typescript
// Endpoints
const ENDPOINTS = {
  search: '/v1/youtube/search',      // Video search
  channel: '/v1/youtube/channel',    // Channel profile (enrichment)
};

// Search Response → NormalizedCreator mapping
{
  videos[].channel.handle        → creator.username
  videos[].channel.title         → creator.name
  videos[].channel.thumbnail     → creator.avatarUrl
  videos[].channel.id            → creator.channelId
  // Note: No follower count in search results!
  videos[].viewCountInt          → content.statistics.views
  videos[].title                 → content.description
  videos[].url                   → content.url
  videos[].hashtags[]            → hashtags
}

// Channel Response (enrichment)
{
  subscriberCountText → parse to creator.followers
  description         → creator.bio
  links[]             → parse for emails
  email               → creator.emails (if present)
}

// Deduplication key: channel.id or channel.handle
// Note: YouTube REQUIRES enrichment for followers + bio
```

### Adapter Similarity Matrix

| Feature | TikTok | Instagram | YouTube |
|---------|--------|-----------|---------|
| **Search endpoint** | `/v1/tiktok/search/keyword` | `/v1/instagram/reels/search` | `/v1/youtube/search` |
| **Profile endpoint** | `/v1/tiktok/profile` | N/A (bio in search) | `/v1/youtube/channel` |
| **Auth header** | `x-api-key` | `x-api-key` | `x-api-key` |
| **Pagination** | `cursor` (numeric) | `amount` param | `continuationToken` |
| **Bio in search** | Truncated | Full | None |
| **Needs enrichment** | Yes (for bio) | Optional | Yes (for bio + followers) |
| **Dedupe key** | `unique_id` | `username` | `channel.id` |
| **Lines of code** | ~300 | ~200 | ~250 |

---

## File Structure (Target State)

```
lib/search-engine/
├── v2/
│   ├── adapters/                    # PLATFORM-SPECIFIC (only here)
│   │   ├── interface.ts             # SearchAdapter interface
│   │   ├── tiktok.ts               # TikTok: fetch, normalize, enrich (~300 lines)
│   │   ├── instagram.ts            # Instagram: fetch, normalize (~200 lines)
│   │   └── youtube.ts              # YouTube: fetch, normalize, enrich (~250 lines)
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

scripts/
├── test-v2-e2e.ts                  # E2E test runner (all scenarios)
└── test-v2-platform.ts             # Single platform test

[Legacy cleanup status]
├── Removed (keyword): legacy keyword providers + `/api/scraping/{tiktok,youtube,instagram-*}`
└── Still in use (similar): `lib/search-engine/runner.ts` + `/api/qstash/process-search` + similar routes
```

---

## Implementation Phases

### Phase 1: Database Schema ✅ COMPLETE
**Goal:** Add coordination columns to scraping_jobs

**Files:**
- [x] `lib/db/schema.ts` - New columns added
- [x] `supabase/migrations/0205_v2_fan_out_columns.sql` - Migration created

**Schema Changes (DONE):**
```typescript
// Added to scrapingJobs table definition
keywordsDispatched: integer('keywords_dispatched').default(0),
keywordsCompleted: integer('keywords_completed').default(0),
creatorsFound: integer('creators_found').default(0),
creatorsEnriched: integer('creators_enriched').default(0),
enrichmentStatus: varchar('enrichment_status', { length: 20 }).default('pending'),
```

**To Apply Migration:** Run `npx drizzle-kit migrate` (no prompts, fully automated)

---

### Phase 2: Core Infrastructure ⬜ NOT STARTED
**Goal:** Create job tracking and worker types

**Files:**
- [ ] `lib/search-engine/v2/core/job-tracker.ts` - Atomic counter updates
- [ ] `lib/search-engine/v2/workers/types.ts` - Message type definitions

---

### Phase 3: Workers ⬜ NOT STARTED
**Goal:** Create platform-agnostic worker logic

**Files:**
- [ ] `lib/search-engine/v2/workers/dispatch.ts`
- [ ] `lib/search-engine/v2/workers/search-worker.ts`
- [ ] `lib/search-engine/v2/workers/enrich-worker.ts`

---

### Phase 4: API Routes ⬜ NOT STARTED
**Goal:** Create unified routes for all platforms

**Files:**
- [ ] `app/api/v2/dispatch/route.ts`
- [ ] `app/api/v2/worker/search/route.ts`
- [ ] `app/api/v2/worker/enrich/route.ts`
- [ ] `app/api/v2/status/route.ts`

---

### Phase 5: Complete Adapters ⬜ NOT STARTED
**Goal:** Ensure all platforms have adapters

**Files:**
- [x] `lib/search-engine/v2/adapters/tiktok.ts` - EXISTS, enhance for fan-out
- [ ] `lib/search-engine/v2/adapters/instagram.ts` - CREATE
- [ ] `lib/search-engine/v2/adapters/youtube.ts` - CREATE

---

### Phase 6: E2E Testing ⬜ NOT STARTED
**Goal:** Verify all scenarios work without frontend

**Files:**
- [ ] `scripts/test-v2-e2e.ts` - Comprehensive test runner

---

### Phase 7: Cleanup ⬜ NOT STARTED
**Goal:** Delete legacy code (AFTER frontend integration)

---

## E2E Test Plan

### Test Script: `scripts/test-v2-e2e.ts`

```bash
# Usage
npx tsx scripts/test-v2-e2e.ts --platform=tiktok --target=100 --keywords="fitness"
npx tsx scripts/test-v2-e2e.ts --platform=instagram --target=500 --keywords="beauty,makeup"
npx tsx scripts/test-v2-e2e.ts --platform=youtube --target=1000 --keywords="cooking"
```

### Test Scenarios Matrix

| Test ID | Platform | Target | Keywords | Expected Behavior |
|---------|----------|--------|----------|-------------------|
| T1 | TikTok | 100 | 1 ("fitness") | ~4 keywords expanded, 100 creators |
| T2 | TikTok | 500 | 1 ("fitness") | ~20 keywords expanded, 500 creators |
| T3 | TikTok | 1000 | 1 ("fitness") | ~40 keywords expanded, 1000 creators |
| T4 | TikTok | 100 | 3 ("fitness", "gym", "workout") | No expansion, 100 creators |
| T5 | TikTok | 500 | 2 ("beauty", "makeup") | Light expansion, 500 creators |
| T6 | Instagram | 100 | 1 ("fashion") | 100 creators, full bios |
| T7 | Instagram | 500 | 3 ("food", "recipe", "cooking") | 500 creators |
| T8 | YouTube | 100 | 1 ("tech") | 100 creators, enriched |
| T9 | YouTube | 500 | 2 ("gaming", "esports") | 500 creators |
| T10 | All platforms | 100 | 1 | Verify identical output format |

### Test Assertions

```typescript
interface TestResult {
  passed: boolean;
  scenario: string;
  assertions: {
    // Count assertions
    creatorsFound: { expected: number; actual: number; passed: boolean };
    creatorsEnriched: { expected: number; actual: number; passed: boolean };

    // Format assertions
    allHaveUsername: boolean;
    allHaveFollowers: boolean;
    enrichedHaveBio: boolean;
    emailsExtractedFromEnriched: boolean;

    // Deduplication
    noDuplicateUsernames: boolean;

    // Frontend compatibility
    frontendFieldsPresent: boolean;  // All required fields exist
  };
  metrics: {
    totalDurationMs: number;
    creatorsPerSecond: number;
    apiCalls: number;
    qstashMessages: number;
  };
}
```

### Test Output Format

```
═══════════════════════════════════════════════════════════════════
  V2 FAN-OUT E2E TEST RESULTS
═══════════════════════════════════════════════════════════════════

Platform: TikTok
Target: 500 creators
Keywords: ["fitness"] → Expanded to: ["fitness", "workout", "gym", ...]

┌─────────────────────────────────────────────────────────────────┐
│ PROGRESS                                                        │
├─────────────────────────────────────────────────────────────────┤
│ Keywords dispatched: 20/20 ✓                                    │
│ Keywords completed:  20/20 ✓                                    │
│ Creators found:      512/500 ✓                                  │
│ Creators enriched:   512/512 ✓                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ASSERTIONS                                                      │
├─────────────────────────────────────────────────────────────────┤
│ ✓ All creators have username                                    │
│ ✓ All creators have followers count                             │
│ ✓ All enriched creators have full bio                           │
│ ✓ Emails extracted from enriched bios                           │
│ ✓ No duplicate usernames                                        │
│ ✓ Frontend-compatible field structure                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SAMPLE CREATOR (Frontend Format)                                │
├─────────────────────────────────────────────────────────────────┤
│ {                                                               │
│   platform: "TikTok",                                           │
│   creator: {                                                    │
│     username: "fitnessguru123",                                 │
│     name: "Fitness Guru",                                       │
│     followers: 1250000,                                         │
│     avatarUrl: "https://...",                                   │
│     bio: "Fitness coach | DM for collabs | ...",               │
│     emails: ["contact@fitnessguru.com"],                       │
│   },                                                            │
│   content: { ... }                                              │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ METRICS                                                         │
├─────────────────────────────────────────────────────────────────┤
│ Total duration:      45.2s                                      │
│ Creators/second:     11.3                                       │
│ API calls:           42                                         │
│ QStash messages:     120 (20 search + 100 enrich)              │
│ Emails found:        187 (36.5%)                                │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
  TEST PASSED ✓
═══════════════════════════════════════════════════════════════════
```

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

### Functional Tests
- [ ] Single keyword search works (all platforms)
- [ ] Multiple keyword search works (all platforms)
- [ ] 100 creators target achieved
- [ ] 500 creators target achieved
- [ ] 1000 creators target achieved
- [ ] Keyword expansion triggers when needed
- [ ] Enrichment batches dispatch after search
- [ ] Job completes when all enrichment done
- [ ] Emails extracted from enriched bios only

### Scale Tests
- [ ] Multiple users can search simultaneously
- [ ] No blocking between users
- [ ] QStash messages don't exceed budget

### Integration Tests
- [ ] Plan limits enforced (validateCreatorSearch)
- [ ] Usage incremented correctly (incrementCreatorCount)
- [ ] Deduplication works across keywords

### Output Tests
- [ ] NormalizedCreator matches frontend expectations
- [ ] All platforms output identical structure
- [ ] Pagination works correctly
- [ ] Progress counters update correctly

### Error Handling
- [ ] Single keyword failure doesn't break job
- [ ] Enrichment failure doesn't break job
- [ ] Job marked 'partial' if some keywords fail
- [ ] QStash retries work correctly

---

## Open Questions (Resolved)

1. **Rate limiting:** Do we need Redis-based rate limiting for ScrapeCreators API?
   - **Answer:** Start without, add if we hit issues. ScrapeCreators handles their own rate limiting.

2. **Retry strategy:** What happens if a worker fails?
   - **Answer:** QStash retries 3 times. Workers are idempotent (check if already processed).

3. **Partial completion:** What if some keywords fail?
   - **Answer:** Mark job as 'partial', include error details, return what we got.

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
| Frontend results | `app/components/campaigns/keyword-search/search-results.jsx` |
| Frontend extraction | Lines 1485-1564 in search-results.jsx |

---

## Adding a New Platform (Future)

Once v2 is complete, adding a new platform (e.g., Twitter/X) requires:

1. **Create adapter file** (~200-300 lines):
   ```
   lib/search-engine/v2/adapters/twitter.ts
   ```

2. **Implement interface**:
   ```typescript
   class TwitterAdapter implements SearchAdapter {
     platform = 'twitter' as const;
     fetch(keyword, cursor, config) { ... }
     normalize(raw) { ... }
     enrich(creator, config) { ... }
     getDedupeKey(creator) { ... }
   }
   registerAdapter(new TwitterAdapter());
   ```

3. **Add to Platform type**:
   ```typescript
   type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter';
   ```

4. **Done.** No changes to workers, routes, or frontend.

---

## Next Session Start Here

1. Read this document
2. Check current-task.md for immediate next step
3. Check git status for any uncommitted work
4. Continue from the current phase
