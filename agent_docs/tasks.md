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
**Updated:** Dec 12, 2025 — 5:45 PM

### Goal
Systematically reduce tech debt identified in codebase audit. Break up monolithic files, clean up legacy code, improve maintainability.

### Fact-Checked Audit Results (Dec 12, 2025)
| File | Lines | Status |
|------|-------|--------|
| `client-page.tsx` | 1574 | ❌ Needs refactor (NEXT) |
| `similar-search/search-results.jsx` | 319 | ✅ REFACTORED |
| `list-detail-client.tsx` | 1123 | ❌ Needs refactor |
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
  - [x] Fix Instagram similar search calling wrong API (`/api/scraping/instagram` → `/api/scraping/similar-discovery`)
  - [x] Fix campaign detail page showing wrong results view (checked `campaign.searchType` instead of `selectedJob` type)
  - [x] Added `isSimilarSearchJob()` helper to properly detect job type by platform
- [ ] **Phase 2: client-page.tsx Refactor** ⭐ READY TO START
  - [ ] Audit state and identify server vs client split
  - [ ] Extract hooks for data fetching
  - [ ] Extract sub-components
  - [ ] Target: 1574 → ~400 lines
- [ ] **Phase 3: Legacy Cleanup**
  - [ ] Verify V2 covers all use cases
  - [ ] Remove legacy providers from runner.ts imports
  - [ ] Delete legacy provider files
- [ ] **Phase 4: Console.log Cleanup**
  - [ ] Replace 51 console.logs in lib/search-engine/ with structured logging

### Next Action
```
⚠️ UNCOMMITTED WORK - Commit first, then proceed

You have ~40+ uncommitted files from the similar-search refactor + bug fixes.

STEP 1: Commit the current work
```bash
git add -A && git commit -m "refactor: similar-search extraction + bug fixes (742→319 lines)

- Extract useSimilarCreatorSearch hook
- Extract transform-rows utils
- Extract SimilarSearchHeader component
- Fix Instagram similar search API endpoint
- Fix campaign detail page results view detection
- Add isSimilarSearchJob() helper" && git push origin UAT
```

STEP 2: Start client-page.tsx refactor (1574 lines)
1. Read: app/campaigns/[id]/client-page.tsx
2. Analyze:
   - What state can move to server components?
   - What hooks can be extracted?
   - What UI components can be extracted?
3. Follow the same pattern as keyword-search/similar-search:
   - Create hooks/ folder for data fetching
   - Create components/ folder for UI pieces
   - Main file becomes orchestrator (~400 lines)
```

### Key Files
| Purpose | File |
|---------|------|
| Just fixed | `app/components/campaigns/similar-search/similar-search-form.jsx` (API endpoint) |
| Just fixed | `app/campaigns/[id]/client-page.tsx` (job type detection) |
| Refactored | `app/components/campaigns/similar-search/search-results.jsx` |
| Next target | `app/campaigns/[id]/client-page.tsx` |
| Lists page | `app/lists/[id]/_components/list-detail-client.tsx` |

### Context
- **Session Summary:**
  1. Refactored similar-search (742 → 319 lines)
  2. Found bug: Instagram similar search called wrong API
  3. Found bug: Campaign page showed wrong results view for mixed runs
  4. Fixed both bugs
- **Branch:** `UAT`
- **Files Created This Session:**
  - `similar-search/hooks/useSimilarCreatorSearch.ts` - state management
  - `similar-search/utils/transform-rows.ts` - row transformation
  - `similar-search/components/SimilarSearchHeader.tsx` - header UI
  - Added `resolveInitials` to shared `keyword-search/utils/creator-utils.ts`
  - Added `isSimilarSearchJob()` helper to `client-page.tsx`

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

*Last updated: Dec 12, 2025 4:30 PM*
