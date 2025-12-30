# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-008
**Title:** Fix Search Progress UX — Keyword Search Reliability
**Status:** Investigation Phase
**Branch:** `fix/search-progress-ux`
**Started:** Dec 30, 2025
**Updated:** Dec 30, 2025

### Goal
Fix the keyword search progress UI that breaks in production. Backend returns 1000 creators correctly, but frontend gets stuck with partial results (200-800), spinners that never stop, and requires full browser refresh to see correct data.

### Critical Insight
**Works perfectly in local development, breaks only in production (usegems.io) and UAT (sorz.ai).**

### Symptoms Summary
| # | Symptom |
|---|---------|
| 1 | Progress freezes at random % |
| 2 | Spinner keeps spinning forever |
| 3 | Shows 200-800 instead of 1000 creators |
| 4 | Only full browser refresh fixes it |
| 5 | Job status stuck on "Processing" even after refresh |
| 6 | Bio fetch spinners (row/global/header) all get stuck |
| 7 | "Finding more creators..." disappears but other spinners remain |

### User Preferences
- **Logging:** Add console logs for debugging
- **Priority:** Reliability > Real-time updates
- **Polling:** Slower (3-5s) acceptable if more reliable
- **Fallback:** No manual refresh button, fix auto-updates

### Checklist
- [ ] **Phase 1: Add Debug Logging**
  - [ ] Add verbose logs to polling loop in search-progress.jsx
  - [ ] Log state transitions (stillProcessing, isFetching, isLoading)
  - [ ] Log terminal state detection points
  - [ ] Log creator merge operations
  - [ ] Log API response status values

- [ ] **Phase 2: Identify Root Cause**
  - [ ] Deploy with logging to production
  - [ ] Run 1000 creator search
  - [ ] Capture console logs during failure
  - [ ] Identify exact point where polling/state breaks

- [ ] **Phase 3: Fix Polling Termination**
  - [ ] Ensure all terminal states detected (completed, error, timeout, partial)
  - [ ] Verify status string comparison is case-insensitive
  - [ ] Handle V2 status values (UI_JOB_STATUS enum)
  - [ ] Add timeout safety net for stuck polls

- [ ] **Phase 4: Fix State Management**
  - [ ] Ensure `stillProcessing` is set to false on any terminal state
  - [ ] Clean up all spinner states on terminal state
  - [ ] Verify creator merge preserves existing data
  - [ ] Add final "completion fetch" to guarantee all data loaded

- [ ] **Phase 5: Improve Reliability**
  - [ ] Increase polling interval (3-5s) for production
  - [ ] Add exponential backoff on network errors
  - [ ] Add redundant completion check after polling stops

- [ ] **Phase 6: Test & Verify**
  - [ ] Test in UAT (sorz.ai)
  - [ ] Test in production (usegems.io)
  - [ ] Verify all 1000 creators display
  - [ ] Verify all spinners stop on completion
  - [ ] Verify no regression in local dev

### Next Action
```
STEP 1: Read the UI_JOB_STATUS definitions
Read: lib/types/statuses.ts
Purpose: Understand what status values backend sends

STEP 2: Check if frontend recognizes V2 statuses
Read: app/components/campaigns/keyword-search/search-progress.jsx (lines 316-345)
Check: Does it handle 'searching', 'enriching', 'dispatching'?
Check: Is comparison case-insensitive?

STEP 3: Add debug logging to polling
File: app/components/campaigns/keyword-search/search-progress.jsx
Add: console.log statements at key points:
- Line 229: Log raw API response status
- Line 278: Log before setStatus
- Line 317: Log terminal state detection
- Line 328-344: Log onComplete call

STEP 4: Add debug logging to state management
File: app/components/campaigns/keyword-search/hooks/useCreatorSearch.ts
Add: console.log statements at:
- handleSearchComplete (line 384)
- handleIntermediateResults (line 501)
- State transitions for stillProcessing

STEP 5: Commit and deploy for testing
git add -A
git commit -m "chore: add debug logging for search progress investigation"
git push origin fix/search-progress-ux
```

### Key Files
| Purpose | File |
|---------|------|
| Main polling | `app/components/campaigns/keyword-search/search-progress.jsx` |
| State management | `app/components/campaigns/keyword-search/hooks/useCreatorSearch.ts` |
| Loading UI | `app/components/campaigns/keyword-search/components/SearchLoadingStates.tsx` |
| Results container | `app/components/campaigns/keyword-search/components/ResultsContainer.tsx` |
| Bio enrichment | `app/components/campaigns/keyword-search/hooks/useBioEnrichment.ts` |
| V2 status API | `app/api/v2/status/route.ts` |
| Status types | `lib/types/statuses.ts` |

### Root Cause Hypotheses
| Priority | Hypothesis |
|----------|------------|
| High | Vercel serverless timing differences |
| High | Network latency creates race conditions |
| High | QStash webhook latency |
| High | Redis cache serving stale data |
| Medium | Polling terminates prematurely |
| Medium | Terminal state not detected |
| Medium | Spinner states not cleaned up |

### Full Spec
See: `agent_docs/current-task.md`

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
