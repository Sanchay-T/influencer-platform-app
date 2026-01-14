# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** USE2-34, USE2-36
**Title:** Trial User Search Limits (Blurred Results + 3 Search Cap)
**Status:** 🚧 IN PROGRESS
**Branch:** `claude/consolidate-all-work-BhEyW`
**Started:** Jan 14, 2026
**Last Updated:** Jan 14, 2026
**Latest Commits:**
- 54ceecb — feat(trial): implement trial user search limits (USE2-34, USE2-36)

### Goal
Implement trial user restrictions to encourage upgrades:
1. **USE2-36**: Limit trial users to 3 total search jobs during trial period
2. **USE2-34**: Show 25 clear results + 75 blurred with "Upgrade to see more" CTA

### Work Completed

- [x] **Backend: Trial Search Limit Validation**
  - Added `validateTrialSearchLimit()` to `lib/billing/access-validation.ts`
  - Added `countUserJobsSince()` helper to count jobs since trial start
  - Integrated validation into `lib/search-engine/v2/workers/dispatch.ts`
  - `TRIAL_SEARCH_LIMIT = 3` constant

- [x] **API Endpoint**
  - Created `/api/trial/search-count` endpoint
  - Returns `isTrialUser`, `searchesUsed`, `searchesRemaining`, `searchesLimit`

- [x] **Frontend: Slider Lock**
  - Created `useTrialStatus` hook in `lib/hooks/use-trial-status.ts`
  - Updated `keyword-search-form.jsx` to lock slider at 100 for trial users
  - Shows "Trial: locked at 100" message

- [x] **Frontend: Blurred Results**
  - Added `isBlurred` prop to `CreatorTableRow.tsx` and `CreatorGalleryCard.tsx`
  - Updated `CreatorTableView.tsx` and `CreatorGalleryView.tsx` to pass blur state
  - Created `TrialUpgradeOverlay.tsx` component with upgrade CTA
  - Integrated into `search-results.jsx`
  - `TRIAL_CLEAR_LIMIT = 25` (25 clear + 75 blurred)

### Checklist

- [x] Add `validateTrialSearchLimit()` to access-validation.ts
- [x] Integrate trial validation into dispatch.ts
- [x] Create `/api/trial/search-count` endpoint
- [x] Create `useTrialStatus` hook
- [x] Update KeywordSearchForm with slider lock at 100
- [x] Add `isBlurred` prop to CreatorTableRow
- [x] Update CreatorTableView to pass blur state
- [x] Add `isBlurred` prop to CreatorGalleryCard
- [x] Update CreatorGalleryView to pass blur state
- [x] Create TrialUpgradeOverlay component
- [x] Integrate trial logic into search-results.jsx
- [x] Commit and push to branch
- [ ] Test with trial user account
- [ ] Verify blur effect works in UI
- [ ] Verify upgrade CTA links to /pricing

---

## Previous Task (Completed)

**ID:** TASK-011
**Title:** Landing Page Redesign + Analytics Integration + Scalability Architecture
**Status:** ✅ COMPLETED
**Branch:** `staging/consolidate-all-work`
**Completed:** Jan 13, 2026
**Latest Commits:**
- 4621db293 — Logger method argument order fix in dead-letter route
- 0fc273900 — Disposable email blocking in checkout process
- 82517e79f — Comprehensive TypeScript type fixes across codebase
- a315f4d3f — Background CSV export with QStash and polling
- 1426246ec — Merged scalability improvements branch

### Goal
Improve platform scalability, conversion tracking, and landing page design. Three major workstreams:
1. Landing page redesign + analytics (COMMITTED)
2. Scalability audit + critical fixes (UNCOMMITTED - in progress)
3. SEO infrastructure (COMMITTED)

### Work Completed

- [x] **Landing Page Redesign** (Commit 0813d0799)
  - Replaced old landing page with v0 design
  - Modern, conversion-optimized layout

- [x] **SEO Infrastructure** (Commit 68dcea6e7)
  - Added SEO metadata system
  - Improved search engine discoverability

- [x] **Google Analytics 4 Integration** (Commit 55ab8e657)
  - GA4 tracking setup
  - Event tracking for user behavior

- [x] **LogSnag Event Tracking** (Commits 7a21bda3c through 5cfca99aa)
  - Integrated LogSnag for real-time notifications
  - Added user email to events for better context
  - Fixed serverless timing issues (await tracking calls)
  - Fixed project slug configuration
  - Added debug logging

- [x] **Meta Pixel Integration** (Commit ff23e0907)
  - Meta Pixel tracking for Facebook/Instagram ads
  - Event tracking for conversion optimization

- [x] **Scalability Audit** (Uncommitted)
  - Comprehensive audit report: `agent_docs/scalability-audit.md`
  - Identified 23 issues: 3 critical, 7 high, 8 medium, 5 low
  - Documented database, API, search engine, frontend, and infrastructure concerns

- [x] **Critical Scalability Fixes** (Commit 41fdf3eeb)
  - Added database index on `scrapingResults.jobId` (lib/db/schema.ts)
  - Built CSV streaming utilities to prevent memory exhaustion (lib/export/csv-stream.ts)
  - Created Dead Letter Queue API for failed QStash messages (app/api/qstash/dead-letter/route.ts)
  - Integrated DLQ across search workers (lib/search-engine/v2/workers/dispatch.ts, enrich-dispatch.ts)
  - Added QStash helper functions for DLQ URLs (lib/queue/qstash.ts)
  - Generated database migration for index (supabase/migrations/meta/)

- [x] **Background CSV Export** (Commit a315f4d3f)
  - Implemented QStash-based background CSV export to prevent timeouts
  - Added polling mechanism for export status
  - Fixed V2 CSV export issues
  - Improved reliability for large dataset exports

- [x] **TypeScript Type Fixes** (Commit 82517e79f)
  - Comprehensive TypeScript type fixes across codebase
  - Resolved type errors and improved type safety
  - Enhanced code quality and maintainability

- [x] **Disposable Email Blocking** (Commit 0fc273900)
  - Implemented disposable email blocking in checkout process
  - Prevents fraudulent signups and trial abuse
  - Added validation layer for email domains

- [x] **Dead Letter Queue Logger Fix** (Commit 4621db293)
  - Corrected logger method argument order in dead-letter route
  - Fixed logging issues in DLQ endpoint
  - Improved error tracking and debugging

### Checklist

- [x] **Phase 1: Landing Page + Analytics** (COMPLETED - All Committed)
  - [x] Replace landing page with v0 design
  - [x] Add SEO infrastructure
  - [x] Integrate Google Analytics 4
  - [x] Integrate LogSnag event tracking
  - [x] Fix LogSnag configuration issues
  - [x] Integrate Meta Pixel tracking

- [x] **Phase 2: Scalability Audit + Critical Fixes** (COMPLETED - Committed 41fdf3eeb)
  - [x] Conduct comprehensive scalability audit
  - [x] Document findings in agent_docs/scalability-audit.md
  - [x] Fix CRITICAL: CSV export memory issue with streaming
  - [x] Fix HIGH: Missing database index on scrapingResults.jobId
  - [x] Fix MEDIUM: Dead letter queue for failed QStash messages
  - [x] Integrate DLQ across all search workers

- [x] **Phase 3: Commit Scalability Work** (COMPLETED - Committed + Merged)
  - [x] Review all uncommitted files
  - [x] Run Biome linter on modified files
  - [x] Run type check (npm run type-check)
  - [x] Run database migration (npm run db:push) for index
  - [x] Test DLQ endpoint in development
  - [x] Commit all scalability work with descriptive message
  - [x] Push to branch
  - [x] Merge scalability improvements (Commit 1426246ec)

- [x] **Phase 4: Background CSV Export** (COMPLETED - Commit a315f4d3f)
  - [x] Implement QStash-based background CSV export
  - [x] Add polling mechanism for export status
  - [x] Fix V2 CSV export issues
  - [x] Commit and push background CSV export

- [x] **Phase 5: Post-Export Fixes** (COMPLETED - Commits 82517e79f, 0fc273900, 4621db293)
  - [x] Fix comprehensive TypeScript type errors across codebase
  - [x] Implement disposable email blocking in checkout
  - [x] Fix logger method argument order in dead-letter route
  - [x] Consolidate all work into staging branch

- [ ] **Phase 6: Final Cleanup & Deployment** (NEXT)
  - [ ] Resolve uncommitted migration file (supabase/migrations/meta/0015_snapshot.json)
  - [ ] Test background CSV export with large dataset
  - [ ] Verify DLQ endpoint receives failed messages
  - [ ] Test database query performance with new index
  - [ ] Merge to main and deploy
  - [ ] Monitor Sentry for DLQ alerts

---

### Next Action
```
🎯 TEST TRIAL USER SEARCH LIMITS (USE2-34, USE2-36)

Context:
- Branch: claude/consolidate-all-work-BhEyW
- Implementation: COMPLETED ✅
- Commit: 54ceecb — feat(trial): implement trial user search limits

WHAT WAS IMPLEMENTED:
✅ Backend: validateTrialSearchLimit() enforces 3 search cap
✅ Backend: Integrated into dispatch.ts pipeline
✅ API: /api/trial/search-count endpoint
✅ Frontend: useTrialStatus hook with caching
✅ Frontend: Slider locked at 100 for trial users
✅ Frontend: 25 clear + 75 blurred results
✅ Frontend: TrialUpgradeOverlay with upgrade CTA

REMAINING TESTING:
- [ ] Test with trial user account in dev/staging
- [ ] Verify blur effect appears on results 26-100
- [ ] Verify upgrade CTA links to /pricing
- [ ] Verify slider is locked at 100 for trial users
- [ ] Verify 4th search attempt shows error message

TECH DEBT IDENTIFIED (Low Priority):
- 2 unused functions in lib/billing/trial-status.ts
- Duplicate trial countdown logic across files
- Trial constants scattered (intentional, different purposes)

START HERE: Test the feature with a trial user account
```

---

## Paused Tasks

### TASK-010: Fix Search Progress UX — Keyword Search Reliability
**Status:** PAUSED (investigation phase complete, implementation pending)
**Branch:** `fix/search-progress-ux`
**Context:** Keyword search works in local dev but breaks in production (usegems.io) and UAT (sorz.ai). Backend finds 1000 creators but frontend shows partial results, stuck spinners. Requires full browser refresh to see correct results. Investigation documented root causes (Vercel serverless timing, network latency, Redis cache issues). Ready for implementation when resumed.

### TASK-006: Tech Debt Cleanup — Monolith Breakup & Code Quality
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

*Last updated: Jan 13, 2026 — 07:27 PM*
