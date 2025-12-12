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
**Updated:** Dec 12, 2025 — 12:30 PM

### Goal
Systematically reduce tech debt identified in codebase audit. Break up monolithic files, clean up legacy code, improve maintainability.

### Fact-Checked Audit Results (Dec 12, 2025)
| File | Lines | Status |
|------|-------|--------|
| `client-page.tsx` | 1574 | ❌ Needs refactor |
| `similar-search/search-results.jsx` | 742 | ❌ Needs refactor |
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
- [ ] **Phase 1: similar-search Refactor** ⭐ START HERE
  - [ ] Extract components (reuse patterns from keyword-search)
  - [ ] Extract hooks (useCreatorSearch pattern)
  - [ ] Extract utils
  - [ ] Target: 742 → ~300 lines
- [ ] **Phase 2: client-page.tsx Refactor**
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
START: Refactor similar-search/search-results.jsx

This file needs the same treatment keyword-search got.

1. Read: app/components/campaigns/similar-search/search-results.jsx (742 lines)

2. Compare to keyword-search structure:
   - keyword-search/components/ (12 extracted components)
   - keyword-search/hooks/ (6 extracted hooks)
   - keyword-search/utils/ (7 extracted utilities)

3. Create parallel structure for similar-search:
   - similar-search/components/
   - similar-search/hooks/
   - similar-search/utils/

4. Extract in this order:
   a. Utils first (pure functions, no React)
   b. Hooks second (stateful logic)
   c. Components last (UI pieces)

5. Target: Get similar-search down to ~300 lines orchestrator
```

### Key Files
| Purpose | File |
|---------|------|
| Current target | `app/components/campaigns/similar-search/search-results.jsx` |
| Reference (already refactored) | `app/components/campaigns/keyword-search/search-results.jsx` |
| Next target | `app/campaigns/[id]/client-page.tsx` |
| Lists page | `app/lists/[id]/_components/list-detail-client.tsx` |

### Context
- **Just Committed:** `76a3cacb6` - keyword-search refactor + pagination scroll UX
- **Branch:** `UAT`
- **Approach:** Follow the keyword-search extraction pattern - it worked well
- **Reusable Components:** Many keyword-search components may work for similar-search too

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
| TASK-005 | Keyword-Search Refactor | Dec 12, 2025 |
| — | Pagination scroll UX (all 4 components) | Dec 12, 2025 |
| — | Auto-fetch pages (replace Load More) | Dec 12, 2025 |
| — | totalCreators mismatch fix | Dec 12, 2025 |
| TASK-002 | Performance Bug Fixes (Phase 1) | Dec 12, 2025 |
| TASK-001 | V2 Fan-Out Architecture | Dec 11, 2025 |

---

*Last updated: Dec 12, 2025 12:30 PM*
