# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** V2 Fan-Out Worker Architecture
**Branch:** `UAT`
**Status:** Phases 1-4 COMPLETE, Phase 5 (Adapters) PENDING, Phase 6 (E2E) VERIFIED ✅
**Started:** Dec 8, 2025 (original v2 pipeline)
**Updated:** Dec 10, 2025

---

## Quick Context

We're building a **scalable fan-out worker system** that replaces the current monolithic search pipeline. This enables:
- Multiple users searching simultaneously
- Keywords processed in parallel via QStash
- Results shown progressively (not all-at-once)
- Platform-agnostic design (one adapter file per platform)

**Full architecture spec:** `@agent_docs/v2-fan-out-architecture.md`

---

## Current Phase: Phase 5 - Platform Adapters

### What Was Just Verified

The v2 fan-out architecture is **FULLY WORKING** for TikTok:
- ✅ Keyword expansion (1 keyword → 5 via AI)
- ✅ Parallel search workers (5 concurrent QStash workers)
- ✅ Progressive results (status updates in real-time)
- ✅ Bio enrichment in parallel batches
- ✅ Job completion detection
- ✅ Found 230 creators from 100 target (exceeded!)
- ✅ 100% enrichment rate

### What to Do Next

1. **Create Instagram adapter**:
   `lib/search-engine/v2/adapters/instagram.ts`
   - Uses ScrapeCreators `/v1/instagram/reels/search`
   - Bio comes with search results (no enrichment needed)
   - ~200 lines

2. **Create YouTube adapter**:
   `lib/search-engine/v2/adapters/youtube.ts`
   - Uses ScrapeCreators `/v1/youtube/search` and `/v1/youtube/channel`
   - REQUIRES enrichment for followers + bio
   - ~250 lines

3. **Continue to Phase 6** (E2E Testing)

---

## Implementation Progress

| Phase | Status | Key Files |
|-------|--------|-----------|
| 1. Schema Changes | ✅ DONE | `lib/db/schema.ts` |
| 2. Core Infrastructure | ✅ DONE | `job-tracker.ts`, `workers/types.ts` |
| 3. Workers | ✅ DONE | `dispatch.ts`, `search-worker.ts`, `enrich-worker.ts` |
| 4. API Routes | ✅ DONE | `/api/v2/dispatch`, `/api/v2/worker/*`, `/api/v2/status` |
| 5. Adapters | ⬜ PENDING | `instagram.ts`, `youtube.ts` |
| 6. E2E Testing | ⬜ PENDING | `scripts/test-v2-e2e.ts` |
| 7. Cleanup | ⬜ PENDING | Delete old providers/routes |

---

## Key Architecture Decisions (FINAL)

1. **Full replacement** - Old code deleted, not kept alongside
2. **Platform = parameter** - Workers receive platform as string
3. **Adapter = only difference** - One file per platform (~200 lines)
4. **Billing preserved** - Same `validateCreatorSearch()`, `incrementCreatorCount()`
5. **Skip truncated bio emails** - Only extract from enriched bios

---

## Files Changed (This Session - Dec 10)

### New Files Created
- `lib/search-engine/v2/core/job-tracker.ts` - Atomic counter updates, job status transitions
- `lib/search-engine/v2/workers/types.ts` - QStash message types, validation helpers
- `lib/search-engine/v2/workers/dispatch.ts` - Fan-out logic, keyword expansion
- `lib/search-engine/v2/workers/search-worker.ts` - Single keyword processing
- `lib/search-engine/v2/workers/enrich-worker.ts` - Batch bio enrichment
- `lib/search-engine/v2/workers/index.ts` - Worker exports
- `app/api/v2/dispatch/route.ts` - User-facing dispatch endpoint
- `app/api/v2/worker/search/route.ts` - QStash search webhook
- `app/api/v2/worker/enrich/route.ts` - QStash enrich webhook
- `app/api/v2/status/route.ts` - Job status + results endpoint

### Modified Files
- `lib/search-engine/v2/index.ts` - Added job-tracker and workers exports

---

## V2 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/dispatch` | POST | Create job, fan out to workers |
| `/api/v2/worker/search` | POST | QStash webhook for keyword search |
| `/api/v2/worker/enrich` | POST | QStash webhook for bio enrichment |
| `/api/v2/status?jobId=xxx` | GET | Get job progress + paginated results |

---

## Previous Work (Dec 8-10)

Before the fan-out architecture, we built the v2 parallel pipeline:

- `lib/search-engine/v2/core/parallel-pipeline.ts` - Parallel enrichment (KEEP)
- `lib/search-engine/v2/core/keyword-expander.ts` - AI expansion (KEEP)
- `lib/search-engine/v2/adapters/tiktok.ts` - TikTok adapter (KEEP)

This code is reused by the new worker system.

---

## What NOT to Do

- Don't modify old routes in `app/api/scraping/` - they'll be deleted
- Don't add new providers to `lib/search-engine/providers/` - deprecated
- Don't change billing logic in `lib/services/plan-validator.ts` - works as-is

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `@agent_docs/v2-fan-out-architecture.md` | Full architecture spec, flow diagrams |
| `@agent_docs/search-engine.md` | Current search system (for reference) |
| `@agent_docs/billing-stripe.md` | Billing integration points |
| `@agent_docs/database.md` | DB operations guide |

---

## Session Handoff Notes

**For next session:**
1. Read `@agent_docs/v2-fan-out-architecture.md` for adapter specs
2. Create Instagram adapter (see "Instagram Adapter" section in spec)
3. Create YouTube adapter (see "YouTube Adapter" section in spec)
4. Test with TikTok first to verify the full flow works
5. Update this file after each phase completion
