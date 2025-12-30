# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-008
**Title:** Fix Search Progress UX — Keyword Search Reliability
**Status:** Implementation Complete — Ready for Testing
**Branch:** `fix/search-progress-ux`
**Started:** Dec 30, 2025
**Updated:** Dec 30, 2025 — 10:45 PM

### Goal
Fix the keyword search progress UI that breaks in production. Backend returns 1000 creators correctly, but frontend gets stuck with partial results (200-800), spinners that never stop, and requires full browser refresh to see correct data.

### Root Cause Identified
**Two independent polling loops + duplicate state = sync failure**

- SearchProgress had its own polling loop
- useCampaignJobs had its own polling loop  
- useCreatorSearch had duplicate state (stillProcessing, serverTotalCreators, completedStatus)
- These never synced with each other, causing sidebar and main content to show different data

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
- [ ] **Phase 4: Test & Verify**
  - [ ] Deploy to Vercel
  - [ ] Test 1000 creator search in production
  - [ ] Verify sidebar updates in real-time
  - [ ] Verify progress never exceeds 100%
  - [ ] Verify no refresh needed after completion

### Next Action
```
PHASE 4: Deploy and Test

STEP 1: Commit and push changes
- git add the changed files
- Commit with message about unified state architecture
- Push to fix/search-progress-ux branch

STEP 2: Verify Vercel deployment
- Wait for Vercel auto-deploy
- Check deployment completes successfully

STEP 3: Test in production (usegems.io)
- Run 1000 creator TikTok search
- Watch sidebar creator count - should update in real-time
- Watch progress bar - should never exceed 100%
- On completion: sidebar should show final count immediately
- NO refresh should be needed
```

### Key Files Modified
| Purpose | File |
|---------|------|
| Unified polling | `lib/query/hooks/useJobPolling.ts` (NEW) |
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

*Last updated: Dec 30, 2025*
