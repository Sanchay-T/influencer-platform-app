# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-008
**Title:** Fix Search Progress UX — Keyword Search Reliability
**Status:** ✅ COMPLETE — Clean Architecture Refactor Done
**Branch:** `fix/search-progress-ux`
**Started:** Dec 30, 2025
**Completed:** Jan 01, 2026 — 06:25 PM
**Latest Commits:** Phase 2 Clean Architecture Refactor (47+ state values → 12, 7 loading indicators → 1)

### Goal
Fix the keyword search progress UI that breaks in production. Backend returns 1000 creators correctly, but frontend gets stuck with partial results (200-800), spinners that never stop, and requires full browser refresh to see correct data.

### Root Causes Identified
1. **Two independent polling loops + duplicate state = sync failure** (FIXED)
   - SearchProgress had its own polling loop
   - useCampaignJobs had its own polling loop  
   - useCreatorSearch had duplicate state
   - These never synced with each other

2. **Enrichment phase UX "slop"** (FIXED in 2e3bd8e55)
   - Status stays "enriching" even after all creators found
   - Spinner keeps running with no explanation
   - User doesn't know what's happening

3. **2-minute completion delay** (FIXED in 9d6c83e42)
   - Status API only called checkStaleAndComplete() which requires 2-min staleness
   - Enrichment workers' checkAndComplete() missed due to counter race conditions
   - Jobs waited 2 minutes even when 100% enriched
   - Fix: Status API now calls checkAndComplete() first for immediate completion

### Solution Implemented: Unified React Query Architecture

**Created single source of truth using React Query:**

```
useJobPolling (React Query) ──polls──► React Query Cache
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ↓                       ↓                       ↓
              Main Content              Sidebar               Progress Bar
              (reads cache)          (reads cache)          (reads cache)
```

### Latest Work Completed
**Full refactor to unified state architecture:**

1. ✅ **Enhanced useJobStatus hook** (`lib/query/hooks/useJobStatus.ts`)
   - Added V2 status types (searching, enriching, dispatching, etc.)
   - Added helper flags: isTerminal, isActive, isSuccess
   - Added query key exports for cache invalidation
   - Progress automatically capped at 100%

2. ✅ **Created useJobPolling hook** (`lib/query/hooks/useJobPolling.ts`) — NEW
   - Single polling source using React Query
   - Callbacks for onProgress and onComplete events
   - Automatic cache invalidation on completion
   - Stops polling on terminal states

3. ✅ **Refactored SearchProgress** (`search-progress.jsx`)
   - Removed 300+ lines of custom polling loop
   - Now uses useJobPolling hook
   - Progress capped at 100%

4. ✅ **Refactored useCreatorSearch** (`hooks/useCreatorSearch.ts`)
   - Removed duplicate state (stillProcessing, serverTotalCreators, completedStatus)
   - Now derives values from React Query (single source of truth)
   - Fixed spread accumulator performance issue

5. ✅ **Refactored useCampaignJobs** (`hooks/useCampaignJobs.ts`)
   - Removed 120+ lines of custom setInterval polling loop
   - Now uses useJobPolling hook
   - Syncs job state from React Query cache

6. ✅ **Fixed progress bar cap** (`RunSummary.tsx`)
   - Progress capped at 100% with Math.min()

7. ✅ **Build verified** — No type errors

**Follow-up fixes after initial deployment:**

8. ✅ **Fixed infinite render loop** (Commit `a676eb689`)
   - useJobPolling was triggering re-renders in dependency array
   - Wrapped callbacks in useCallback to stabilize references
   - Prevented infinite polling loops

9. ✅ **Added diagnostic logging** (Commit `0e8eb3793`)
   - Added console logs to track polling state transitions
   - Logs job status, progress, and terminal state detection
   - Helps debug production issues

10. ✅ **Fixed enrichment UX slop** (Commit `2e3bd8e55`)
    - Added enrichment-specific stage messaging in computeStage()
    - Now shows: "Found 1198 creators • Enriching data (847/1198)"
    - User understands why spinner is running after creators are found

11. ✅ **Fixed 2-minute completion delay** (Commit `9d6c83e42`)
    - Status API now calls checkAndComplete() first (immediate completion if 100% enriched)
    - Falls back to checkStaleAndComplete() (2-min stale timeout with 80%+ enriched)
    - Jobs complete immediately when fully enriched instead of waiting 2 minutes

12. ✅ **DB-driven job completion** (Commit `da2a3ab69`)
    - Added getActualEnrichmentState() — queries actual job_creators table
    - checkAndComplete() now uses COUNT(*) FILTER (WHERE bioEnriched) instead of counters
    - checkStaleAndComplete() also updated to use DB state
    - Reduced stale timeout from 2min to 30sec (counter sync no longer needed)
    - Eliminates race conditions from parallel QStash workers

13. ✅ **Added indexed enriched column** (Commit `9cd30aaf8`)
    - Added `enriched` boolean column to job_creators table
    - Added composite index (jobId, enriched) for fast COUNT queries
    - Updated enrich-worker to set column when enriching
    - Updated getActualEnrichmentState() to use column instead of JSON extraction

14. ✅ **Supabase Realtime for instant updates** (Commit `36b9a441f`)
    - Enabled Realtime on scraping_jobs table (SQL)
    - Set REPLICA IDENTITY FULL for full row data
    - Created lib/supabase/client.ts for browser-side client
    - Created useJobRealtime hook for WebSocket subscriptions
    - Updated useJobPolling to use Realtime with polling fallback
    - UI now updates instantly (no 2s polling delay)

15. ✅ **DB-driven enrichment count in status API** (Commit `d4189a3bf`)
    - Status API now queries actual COUNT(*) WHERE enriched=true
    - Replaces stale counter columns that lag behind due to race conditions
    - Counter discrepancy was significant: 347 vs 407 enriched (60 behind)

16. ✅ **Fix 15-second loading delay for completed runs** (Commit `d84c4954d`)
    - Increased server pre-load from 50 to 200 creators
    - Disabled auto-fetch all pages by default (use pagination instead)
    - Users now see 200 creators instantly, can paginate for more

17. ✅ **Fix on-demand pagination fetching** (Commit `2d5555c0b`)
    - When user navigates beyond loaded creators, fetch page from server
    - Shows loading state while fetching
    - Pagination now works correctly for 1000+ creator runs

18. ✅ **Disable duplicate client-side enrichment** (Commit `6fd8adacb`)
    - V2 enrich-workers already handle enrichment server-side
    - Client-side useBioEnrichment was writing to wrong table (scraping_results)
    - UI reads from job_creators table, so client enrichment was wasted
    - Saves ~$1.88 per 1000 creators (no more duplicate API calls)

19. ✅ **Fix CreatorSnapshot type for list saving** (Commit `6fd8adacb`)
    - Re-export type from AddToListButton to ensure compatibility
    - Previous type was missing required `externalId` field
    - This caused silent failures when saving creators to lists

20. ✅ **Improved platform detection + debug logging** (Commit `b0ff6709e`)
    - Enhanced bio enrichment platform detection logic
    - Added debug logging for bio enrichment process
    - Better error handling for platform mismatches

21. ✅ **Remove unscalable per-creator enrichment API calls** (Commit `69758761f`)
    - Removed client-side enrichment completely (was duplicating server work)
    - Server-side V2 enrich-workers handle all enrichment
    - Significant cost savings (~$1.88 per 1000 creators)

22. ✅ **Cleanup dead code** (Commit `75417b1b4`, `a83e7a2a1`)
    - Removed references to undefined platform variables
    - Removed leftover setHasFetchedComplete reference
    - Code cleanup after refactoring

23. ✅ **Re-enable client enrichment as fallback** (Commit `019e23917`)
    - Added fallback for old runs without bio_enriched field
    - Ensures backward compatibility with legacy data
    - Only runs for old data, new runs use server enrichment

24. ✅ **Clean Architecture Refactor** (Jan 01, 2026)
    - Added `message` field to Status API (human-readable from backend)
    - Created `useSearchJob` hook (single source of truth)
    - Created `ProgressDisplay` component (simple, stateless)
    - Rewrote `search-results.jsx` (500+ lines → 200 lines)
    - Deleted: `useBioEnrichment.ts`, `useAutoFetchAllPages.ts`, `useCreatorSearch.ts`
    - Before: 47+ state values, 7 loading indicators, 4 progress sources
    - After: ~12 state values, 1 loading indicator, 1 progress source (API)

### Checklist
- [x] **Phase 1: Add Debug Logging** (Previous commit)
- [x] **Phase 2: Identify Root Cause** 
  - [x] Browser tested: Progress goes to 179%, sidebar stuck
  - [x] DB verified: 1023 creators stored correctly
  - [x] Root cause: Two polling loops never sync
- [x] **Phase 3: Unified State Architecture**
  - [x] Create useJobPolling hook (single polling source)
  - [x] Enhance useJobStatus with V2 statuses and helpers
  - [x] Refactor SearchProgress to use useJobPolling
  - [x] Refactor useCreatorSearch to derive state from RQ
  - [x] Refactor useCampaignJobs to use useJobPolling
  - [x] Add cache invalidation on job completion
  - [x] Cap progress at 100% everywhere
- [x] **Phase 4: Commit & Deploy**
  - [x] Commit changes (1e21cfe2b)
  - [x] Push to fix/search-progress-ux branch
  - [x] Vercel auto-deploy triggered
- [x] **Phase 5: UX Polish**
  - [x] Fix enrichment "slop" - show enrichment progress explicitly
  - [x] Handle dispatching and partial statuses in UI
- [x] **Phase 6: Backend Completion Fix**
  - [x] Add checkAndComplete() to status API for immediate completion
  - [x] Eliminate 2-minute stale timeout when 100% enriched
- [x] **Phase 7: DB-Driven Completion**
  - [x] Replace counter-based completion with actual DB queries
  - [x] Reduce stale timeout from 2min to 30sec
- [ ] **Phase 8: Final Test** (USER ACTION REQUIRED)
  - [ ] Test 1000 creator search in production
  - [ ] Verify job completes immediately when enrichment done
  - [ ] Verify enrichment progress shows correctly

### Next Action
```
✅ CLEAN ARCHITECTURE REFACTOR COMPLETE — READY FOR TESTING

Changes made:
- Status API now returns `message` field with human-readable status
- New unified `useSearchJob` hook replaces 4 scattered hooks
- New `ProgressDisplay` component for simple progress UI
- SearchResults rewritten from 500+ lines to ~200 lines
- Deleted 3 obsolete hooks (useBioEnrichment, useAutoFetchAllPages, useCreatorSearch)

Files modified:
- app/api/v2/status/route.ts (added getStatusMessage helper)
- lib/search-engine/v2/workers/types.ts (added message field to StatusResponse)
- app/components/campaigns/keyword-search/search-results.jsx (new simplified version)
- app/components/campaigns/keyword-search/hooks/useSearchJob.ts (NEW)
- app/components/campaigns/keyword-search/components/ProgressDisplay.tsx (NEW)
- app/components/campaigns/keyword-search/search-progress.jsx (minimal version for similar-search compat)

NEXT STEPS:
1. Commit changes: git add -A && git commit -m "feat: clean architecture refactor"
2. Push: git push origin fix/search-progress-ux
3. Test in production at usegems.io:
   - Start a new keyword search
   - Verify progress message updates
   - Verify creators appear in table
   - Verify pagination works after completion
   - Verify Enrich button works
```

### Key Files Modified
| Purpose | File |
|---------|------|
| **Status API (DB-driven)** | `app/api/v2/status/route.ts` |
| **Supabase client** | `lib/supabase/client.ts` (NEW) |
| **Realtime hook** | `lib/query/hooks/useJobRealtime.ts` (NEW) |
| **Hybrid polling** | `lib/query/hooks/useJobPolling.ts` |
| **Schema (enriched column)** | `lib/db/schema.ts` |
| **Enrichment worker** | `lib/search-engine/v2/workers/enrich-worker.ts` |
| **DB-driven completion** | `lib/search-engine/v2/core/job-tracker.ts` |
| **Stale timeout config** | `lib/search-engine/v2/core/job-tracker-types.ts` |
| Status hook | `lib/query/hooks/useJobStatus.ts` |
| Hook exports | `lib/query/hooks/index.ts` |
| Progress UI | `app/components/campaigns/keyword-search/search-progress.jsx` |
| Creator state | `app/components/campaigns/keyword-search/hooks/useCreatorSearch.ts` |
| Campaign jobs | `app/campaigns/[id]/hooks/useCampaignJobs.ts` |
| Run summary | `app/campaigns/[id]/components/RunSummary.tsx` |

---

## Paused Task

**ID:** TASK-006
**Title:** Tech Debt Cleanup — Monolith Breakup & Code Quality
**Status:** PAUSED (for TASK-008 hotfix)
**Branch:** `UAT`
**Waiting on:** Phase 4 (Legacy Cleanup) after current hotfix

---

## Backlog

| ID | Title | Priority | Notes |
|----|-------|----------|-------|
| TASK-007 | Virtual Scrolling | High | After monolith breakup |
| TASK-003 | Add test coverage for V2 | Medium | Unit tests for adapters |
| TASK-004 | Delete legacy search code | Low | After V2 verified |

---

## Completed

| ID | Title | Completed |
|----|-------|-----------|
| — | list-detail-client.tsx Refactor (1124→357 lines) | Dec 12, 2025 |
| — | client-page.tsx Refactor (1588→417 lines) | Dec 12, 2025 |
| — | Bug: Instagram similar search wrong API | Dec 12, 2025 |
| — | Bug: Campaign page wrong results view | Dec 12, 2025 |
| — | Similar-Search Refactor (742→319 lines) | Dec 12, 2025 |
| TASK-005 | Keyword-Search Refactor | Dec 12, 2025 |
| — | Pagination scroll UX (all 4 components) | Dec 12, 2025 |
| — | Auto-fetch pages (replace Load More) | Dec 12, 2025 |
| — | totalCreators mismatch fix | Dec 12, 2025 |
| TASK-002 | Performance Bug Fixes (Phase 1) | Dec 12, 2025 |
| TASK-001 | V2 Fan-Out Architecture | Dec 11, 2025 |

---

*Last updated: Dec 31, 2025 — 08:48 PM*
