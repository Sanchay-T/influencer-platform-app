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
**Updated:** Dec 12, 2025 — 08:15 PM

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

1. Verify V2 adapter coverage for all platforms:
   - TikTok: lib/search-engine/v2/adapters/tiktok.ts
   - Instagram: lib/search-engine/v2/adapters/instagram.ts
   - YouTube: lib/search-engine/v2/adapters/youtube.ts
2. Check if legacy providers are still called anywhere
3. Plan safe removal of legacy code
```

### Key Files
| Purpose | File |
|---------|------|
| Refactored | `app/campaigns/[id]/client-page.tsx` (417 lines) |
| Refactored | `app/components/campaigns/similar-search/search-results.jsx` (319 lines) |
| Refactored | `app/components/campaigns/keyword-search/search-results.jsx` (480 lines) |
| Refactored | `app/lists/[id]/_components/list-detail-client.tsx` (357 lines) |

### Context
- **Session Summary:**
  1. Refactored similar-search (742 → 319 lines)
  2. Fixed bug: Instagram similar search called wrong API
  3. Fixed bug: Campaign page showed wrong results view
  4. Refactored client-page.tsx (1588 → 417 lines, 74% reduction)
  5. Refactored list-detail-client.tsx (1124 → 357 lines, 68% reduction)
- **Branch:** `UAT`
- **Files Created:**
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

*Last updated: Dec 12, 2025 8:15 PM*
