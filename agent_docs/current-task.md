# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** V2 Fan-Out Worker Architecture — Add Instagram & YouTube Adapters
**Branch:** `UAT`
**Status:** TikTok COMPLETE ✅, Instagram & YouTube PENDING
**Started:** Dec 8, 2025 (original v2 pipeline)
**Updated:** Dec 11, 2025

---

## Quick Context

The V2 fan-out search system is **COMPLETE for TikTok** with verified benchmarks:

| Target | Found | Accuracy | Duration |
|--------|-------|----------|----------|
| 100    | 100   | 100.0% ✅ | 22.6s   |
| 500    | 500   | 100.0% ✅ | 30.5s   |
| 1000   | 1186  | 118.6%   | 172.8s  |

**Key features working:**
- QStash fan-out with parallel workers
- Two-checkpoint target capping (no overshoot for 100/500)
- PostgreSQL row-level locking (`SELECT ... FOR UPDATE`)
- Progressive results (users see data immediately)
- Bio enrichment in parallel batches

**Full architecture spec:** `@agent_docs/v2-fan-out-architecture.md`

---

## Current Phase: Add Instagram & YouTube Support

### What to Do Next

1. **Create Instagram adapter** (~200 lines):
   - File: `lib/search-engine/v2/adapters/instagram.ts`
   - API: ScrapeCreators `/v1/instagram/reels/search`
   - Key: Bio comes with search results (NO enrichment needed)
   - Dedupe key: `owner.username`

2. **Create YouTube adapter** (~250 lines):
   - File: `lib/search-engine/v2/adapters/youtube.ts`
   - Search API: `/v1/youtube/search`
   - Channel API: `/v1/youtube/channel`
   - Key: REQUIRES enrichment for followers + bio
   - Dedupe key: `channel.id`

3. **Update UI with radio buttons**:
   - File: `app/components/campaigns/keyword-search/keyword-search-form.jsx`
   - Wire to `/api/v2/dispatch` instead of legacy routes

4. **Test all platforms** with benchmark script

---

## Implementation Progress

| Phase | Status | Key Files |
|-------|--------|-----------|
| 1. Schema Changes | ✅ DONE | `lib/db/schema.ts` |
| 2. Core Infrastructure | ✅ DONE | `job-tracker.ts`, `workers/types.ts` |
| 3. Workers | ✅ DONE | `dispatch.ts`, `search-worker.ts`, `enrich-worker.ts` |
| 4. API Routes | ✅ DONE | `/api/v2/dispatch`, `/api/v2/worker/*`, `/api/v2/status` |
| 5. TikTok Adapter | ✅ DONE | `adapters/tiktok.ts` |
| 6. Target Capping | ✅ DONE | Two-checkpoint system in `search-worker.ts` |
| 7. Benchmarks | ✅ DONE | `scripts/test-v2-benchmark.ts` |
| 8. Instagram Adapter | ⬜ PENDING | `adapters/instagram.ts` |
| 9. YouTube Adapter | ⬜ PENDING | `adapters/youtube.ts` |
| 10. UI Radio Buttons | ⬜ PENDING | `keyword-search-form.jsx` |

---

## Target Capping Implementation (For Reference)

The two-checkpoint system that prevents overshooting:

**Checkpoint 1** (Before API call):
```typescript
// In search-worker.ts:75-101
const currentProgress = await tracker.getProgress();
if (currentProgress.creatorsFound >= targetResults) {
  return { skipped: true }; // Skip API call entirely
}
```

**Checkpoint 2** (At DB save time):
```typescript
// In search-worker.ts:337-458
const lockResult = await tx.execute(sql`
  SELECT id, creators FROM scraping_results
  WHERE job_id = ${jobId} FOR UPDATE
`);
const slotsLeft = targetResults - existingCreators.length;
// Cap at slotsLeft when saving
```

**Key insight:** `FOR UPDATE` only locks existing rows, so we pre-create the `scraping_results` row during dispatch.

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/dispatch` | POST | Create job, fan out to workers |
| `/api/v2/worker/search` | POST | QStash webhook for keyword search |
| `/api/v2/worker/enrich` | POST | QStash webhook for bio enrichment |
| `/api/v2/status?jobId=xxx` | GET | Get job progress + paginated results |

---

## Test Scripts

```bash
# Run benchmark for all targets
npx tsx scripts/test-v2-benchmark.ts

# Test single dispatch
npx tsx scripts/test-v2-dispatch.ts --target=100 --keyword="fitness"
```

---

## Benchmark Results (CSV)

Saved to: `scripts/v2-benchmark-2025-12-10T19-38-26-385Z.csv`

---

## Session Handoff Notes

**For Claude Web session (next):**
1. Create Instagram adapter following TikTok pattern
2. Create YouTube adapter with enrichment method
3. Update UI to use radio buttons + V2 dispatch
4. Run benchmarks for all platforms
5. Handoff prompt prepared in previous conversation

**Reference the TikTok adapter** at `lib/search-engine/v2/adapters/tiktok.ts` as the template.
