# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-006
**Title:** Tech Debt Cleanup — Monolith Breakup & Code Quality
**Status:** 🟡 IN PROGRESS
**Branch:** `UAT`
**Started:** Dec 12, 2025
**Updated:** Dec 24, 2025 — 10:15 AM

### Goal
Systematically reduce tech debt identified in codebase audit. Break up monolithic files, clean up legacy code, improve maintainability.

### Fact-Checked Audit Results (Dec 12, 2025)
| File | Lines | Status |
|------|-------|--------|
| `client-page.tsx` | 417 | ✅ REFACTORED (was 1588, 74% reduction) |
| `similar-search/search-results.jsx` | 319 | ✅ REFACTORED |
| `list-detail-client.tsx` | 357 | ✅ REFACTORED (was 1124, 68% reduction) |
| `keyword-search/search-results.jsx` | 480 | ✅ REFACTORED |
| `marketing-landing.tsx` | 1312 | ⚠️ Low priority |
| Legacy providers (7 files) | ~900 each | ❌ Can be deleted after V2 verified |
| console.log in search-engine/ | 51 calls | ⚠️ Should use structured logging |

### Checklist
- [x] **Audit & Fact-Check** ✅ COMPLETE
  - [x] Verify line counts of claimed monoliths
  - [x] Audit `any` usage (260 total, mostly in loggers - acceptable)
  - [x] Audit console.log usage (86 raw vs 995 structured - 92% adoption)
  - [x] Audit legacy vs V2 coexistence (all 3 platforms have both)
  - [x] Verify keyword-search refactor status (DONE - 480 lines now)
- [x] **Phase 1: similar-search Refactor** ✅ COMPLETE
  - [x] Extract components (SimilarSearchHeader.tsx)
  - [x] Extract hooks (useSimilarCreatorSearch.ts)
  - [x] Extract utils (transform-rows.ts)
  - [x] Target: 742 → 319 lines ✅
- [x] **Bug Fixes Found During Testing** ✅ COMPLETE
  - [x] Fix Instagram similar search calling wrong API
  - [x] Fix campaign detail page showing wrong results view
  - [x] Added `isSimilarSearchJob()` helper
- [x] **Phase 2: client-page.tsx Refactor** ✅ COMPLETE
  - [x] Extract types to `types/campaign-page.ts`
  - [x] Extract helpers to `utils/campaign-helpers.ts`
  - [x] Extract state to `hooks/useCampaignJobs.ts`
  - [x] Extract RunRail, RunSummary, ActivityLog components
  - [x] Target: 1588 → 417 lines (74% reduction) ✅
- [x] **Phase 3: list-detail-client.tsx Refactor** ✅ COMPLETE
  - [x] Extract types to `types/list-detail.ts`
  - [x] Extract helpers to `utils/list-helpers.ts`
  - [x] Extract state to `hooks/useListDetail.ts`
  - [x] Extract DroppableColumn, CreatorCard, ListView, ListInsights, DeleteModal
  - [x] Target: 1124 → 357 lines (68% reduction) ✅
- [ ] **Phase 4: Legacy Cleanup** ⭐ NEXT
  - [ ] Verify V2 covers all use cases
  - [ ] Remove legacy providers from runner.ts imports
  - [ ] Delete legacy provider files
- [ ] **Phase 5: Console.log Cleanup**
  - [ ] Replace 51 console.logs in lib/search-engine/ with structured logging

### Next Action
```
READY: Start legacy cleanup verification

STEP 1: Check if legacy providers are still imported/used
Run: grep -r "instagram-provider" lib/ app/
Run: grep -r "tiktok-provider" lib/ app/
Run: grep -r "youtube-provider" lib/ app/
Check: lib/search-engine/runner.ts (does it import legacy providers?)

STEP 2: Verify V2 coverage is complete
Read: lib/search-engine/v2/adapters/tiktok.ts
Read: lib/search-engine/v2/adapters/instagram.ts
Read: lib/search-engine/v2/adapters/youtube.ts
Verify: All 3 adapters implement keyword + similar search

STEP 3: If no references found, safe to delete:
- lib/search-engine/providers/tiktok-provider.ts
- lib/search-engine/providers/instagram-provider.ts
- lib/search-engine/providers/youtube-provider.ts
- lib/search-engine/providers/youtube-competitor-provider.ts
- lib/search-engine/providers/instagram-similar-provider.ts
- lib/search-engine/providers/tiktok-similar-provider.ts
- lib/search-engine/providers/youtube-similar-provider.ts

EXPECTED: All legacy code now unused due to V2 fan-out architecture
```

### Key Files
| Purpose | File |
|---------|------|
| Refactored | `app/campaigns/[id]/client-page.tsx` (417 lines) |
| Refactored | `app/components/campaigns/similar-search/search-results.jsx` (319 lines) |
| Refactored | `app/components/campaigns/keyword-search/search-results.jsx` (480 lines) |
| Refactored | `app/lists/[id]/_components/list-detail-client.tsx` (357 lines) |

### Context
- **Recent Work (Dec 12-23):**
  1. ✅ All refactoring complete: similar-search, client-page, list-detail-client, keyword-search
  2. ✅ Shared type contract for job statuses (commit: f6a9ef938)
  3. ✅ Handle 'partial' status in run sidebar display (commit: e510cea29)
  4. ✅ Add v2 status mappings and fix progress parsing (commit: 3f409f370)
  5. ✅ Atomic deduplication for v2 workers using job_creator_keys table (commit: 988f782e3)
  6. ✅ maxDuration added to v2 worker routes for Vercel Pro timeout (commit: 5d7c8560e)
  7. ✅ Redis env vars deployed (commit: d748653a6)
  8. ✅ Redis caching for completed job results (commit: cb53abfcc)
  9. ✅ Timeout and error handling for v2/status API (commit: 5543ae803)
  10. ✅ Campaigns API timeout optimization (commit: 5c117483c)
  11. ✅ **React Query Integration** (Dec 23-24) - Fix loading flash on completed runs:
      - Installed @tanstack/react-query, added QueryProvider
      - Created useJobStatus, useJobCreators hooks with auto-polling
      - Server pre-loads first 50 creators for completed jobs from job_creators table
      - Cache hydration in client-page.tsx for instant loading
      - useCreatorSearch now checks React Query cache first
      - Fixed React hydration mismatch in QueryProvider (commit: 5f78b9263)
      - All completed runs now load instantly without flickering
      - Fixed pagination bug: Page 3+ showed empty (commit: b356d3d43)
        - Bug: toUiJob was overwriting server totalCreators with counted=50
        - Fix: Prefer job.totalCreators from server, enabling auto-fetch
      - Fixed gallery/table showing "0 views" (commit: 88a62e289)
      - Fixed job completion not updating UI (commit: 1bde9c105)
        - Bug: handleSearchComplete was overwriting instead of merging
        - Fix: Merge completion data + always fetch fresh data on complete
- **Branch:** `UAT`
- **Files Created (React Query):**
  - `lib/query/query-client.ts` - QueryClient config
  - `lib/query/hooks/useJobStatus.ts` - Job status + auto-polling
  - `lib/query/hooks/useJobCreators.ts` - Paginated creators
  - `lib/query/hooks/index.ts` - Exports
  - `app/providers/query-provider.tsx` - QueryClientProvider wrapper
- **Files Created During Refactoring:**
  - `similar-search/hooks/useSimilarCreatorSearch.ts`
  - `similar-search/utils/transform-rows.ts`
  - `similar-search/components/SimilarSearchHeader.tsx`
  - `campaigns/[id]/types/campaign-page.ts`
  - `campaigns/[id]/utils/campaign-helpers.ts`
  - `campaigns/[id]/hooks/useCampaignJobs.ts`
  - `campaigns/[id]/components/RunRail.tsx`
  - `campaigns/[id]/components/RunSummary.tsx`
  - `campaigns/[id]/components/ActivityLog.tsx`
  - `lists/[id]/_components/types/list-detail.ts`
  - `lists/[id]/_components/utils/list-helpers.ts`
  - `lists/[id]/_components/hooks/useListDetail.ts`
  - `lists/[id]/_components/components/DroppableColumn.tsx`
  - `lists/[id]/_components/components/CreatorCard.tsx`
  - `lists/[id]/_components/components/ListView.tsx`
  - `lists/[id]/_components/components/ListInsights.tsx`
  - `lists/[id]/_components/components/DeleteModal.tsx`

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

*Last updated: Dec 22, 2025 12:13 AM*
