# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-013
**Title:** Tech Junk Cleanup
**Status:** ✅ COMPLETE (ready to commit)
**Branch:** `main` (or create `chore/tech-junk-cleanup`)
**Started:** Jan 18, 2026
**Last Updated:** Jan 18, 2026

### Summary
Comprehensive codebase cleanup removing ~9,000 lines of debug code, unused files, and technical debt.

**What was done:**
- Removed dead mock function in `openrouter-service.ts`
- Deleted 14 test/debug API routes
- Removed ~70 debug console.log statements from API routes, search engine, UI
- Deleted debug files, wishlink scripts, old test data
- Created `scripts/scan-tech-junk.sh` scanner tool

**Documentation:** `agent_docs/tech-junk-cleanup-2026-01-18.md`

### Next Action
```
COMMIT THE CLEANUP:
git add -A
git commit -m "chore: remove tech junk (~9K lines)"
git push origin HEAD
```

---

## Previous Task

**ID:** TASK-012
**Title:** Trial User Search Limits + Analytics Tracking
**Status:** 🚧 IN PROGRESS (paused for cleanup)
**Branch:** `test-trial-feature` (switched from staging/consolidate-all-work)
**Started:** Jan 15, 2026
**Last Updated:** Jan 15, 2026 — 03:10 PM
**Latest Commits:**
- 54ceecb8c — feat(trial): implement trial user search limits (USE2-34, USE2-36) (most recent)
- 2c2e753cd — chore: add MCP config with env var auth for Linear and Supabase
- 649337f0e — chore: add MCP config with Linear and Supabase
- e75620c76 — chore: add migration snapshot and update agent docs
- 4621db293 — fix: correct logger method argument order in dead-letter route

### Goal
Implement trial user search limits and comprehensive analytics tracking. Two major workstreams:
1. **Trial User Search Limits** — Enforce creator search limits for trial users (Linear: USE2-34, USE2-36)
2. **Full-Funnel Analytics** — Track user journey from signup → search → export across GA4, Meta Pixel, and LogSnag

**Previous Task (TASK-011):** Landing Page Redesign + Analytics + Scalability — All phases completed and committed.

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

- [x] **Migration Snapshot & Agent Docs Update** (Commit e75620c76)
  - Added database migration snapshot (0015_snapshot.json)
  - Updated agent documentation with session state
  - Committed agent_docs/monologue.md and tasks.md

- [x] **MCP Configuration** (Commits 649337f0e, 2c2e753cd)
  - Added MCP config for Linear and Supabase integration
  - Configured environment variable authentication
  - Enabled Claude Code integration with project management tools

- [x] **Trial User Search Limits** (Commit 54ceecb8c)
  - Implemented search creator limits for trial users (Linear: USE2-34, USE2-36)
  - Enforced 100 creators per search maximum for trial accounts
  - Added trial validation in search workflows
  - Integrated trial status checks across campaign components

- [x] **Full-Funnel Analytics Implementation** (NOT YET COMMITTED)
  - Created unified tracking layer (lib/analytics/track.ts)
  - Created type-safe event definitions (lib/analytics/events.ts)
  - Added tracking to auth flow (auth-logger.tsx)
  - Added tracking to onboarding (onboarding-modal.tsx, payment-step.tsx)
  - Added tracking to campaigns (campaigns/route.ts)
  - Added tracking to lists (lists/route.ts)
  - Added tracking to search (runner.ts)
  - Added tracking to billing (upgrade-button.tsx)
  - Added tracking to CSV export (export/csv/route.ts)
  - Code type-checks successfully
  - Ready to commit and deploy

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

- [x] **Phase 6: Trial User Search Limits** (COMPLETED - Commit 54ceecb8c)
  - [x] Implement trial validation in access-validation.ts
  - [x] Add trial limit enforcement in keyword-search-form.jsx
  - [x] Add trial status display in keyword-review.jsx
  - [x] Add TrialUpgradeOverlay component to CreatorGalleryView.tsx
  - [x] Add TrialUpgradeOverlay component to CreatorTableView.tsx
  - [x] Update search-results.jsx with trial awareness
  - [x] Add trial status hook in use-trial-status.ts
  - [x] Update Stripe client with trial support
  - [x] Test trial limits in dev environment
  - [x] Commit trial limits implementation

- [ ] **Phase 7: Full-Funnel Analytics Tracking** (NEXT - CODE READY)
  - [x] Create unified tracking layer (lib/analytics/track.ts)
  - [x] Create type-safe event definitions (lib/analytics/events.ts)
  - [x] Add tracking to all user touchpoints
  - [x] Type check all changes (npm run type-check)
  - [ ] Run Biome linter on modified files
  - [ ] Commit analytics tracking implementation
  - [ ] Push to branch
  - [ ] Deploy to production
  - [ ] Verify events in GA4 Realtime dashboard
  - [ ] Verify events in Meta Test Events dashboard

- [ ] **Phase 8: Final Testing & Deployment** (AFTER ANALYTICS)
  - [ ] Test trial limits with real user flow
  - [ ] Test analytics tracking end-to-end
  - [ ] Verify all events firing correctly
  - [ ] Merge to main
  - [ ] Monitor production for errors
  - [ ] Monitor analytics dashboards

---

### Next Action
```
🚀 COMMIT ANALYTICS TRACKING - Phase 7

BRANCH: test-trial-feature
STATUS: Code implemented and type-checked ✅ — Ready to commit

CONTEXT:
- Trial user search limits: COMMITTED ✅ (Commit 54ceecb8c)
- Full-funnel analytics tracking: IMPLEMENTED but NOT YET COMMITTED ⚠️
- All files type-check successfully
- Analytics files created:
  * lib/analytics/track.ts (new file)
  * lib/analytics/events.ts (new file)
- Modified 9 files to add tracking across user journey

EXACT STEPS TO COMPLETE PHASE 7:

1. Run Biome linter on ALL modified files:
   npx biome check --write lib/analytics/track.ts lib/analytics/events.ts app/components/auth/auth-logger.tsx app/components/onboarding/onboarding-modal.tsx app/components/onboarding/payment-step.tsx app/api/export/csv/route.ts app/api/campaigns/route.ts app/api/lists/route.ts lib/search-engine/runner.ts app/components/billing/upgrade-button.tsx

2. Stage analytics files:
   git add lib/analytics/track.ts lib/analytics/events.ts

3. Stage modified tracking files:
   git add app/components/auth/auth-logger.tsx
   git add app/components/onboarding/onboarding-modal.tsx
   git add app/components/onboarding/payment-step.tsx
   git add app/api/export/csv/route.ts
   git add app/api/campaigns/route.ts
   git add app/api/lists/route.ts
   git add lib/search-engine/runner.ts
   git add app/components/billing/upgrade-button.tsx

4. Commit with descriptive message:
   git commit -m "feat: add full-funnel analytics tracking (GA4 + Meta + LogSnag)

   - Create unified tracking layer (lib/analytics/track.ts)
   - Add type-safe event definitions (lib/analytics/events.ts)
   - Track auth events (sign in, sign up, sign out)
   - Track onboarding flow (steps, payment initiation)
   - Track campaign creation and search execution
   - Track list creation and management
   - Track CSV exports
   - Track billing upgrades

   Events sent to: Google Analytics 4, Meta Pixel, LogSnag"

5. Push to remote:
   git push origin test-trial-feature

6. Update tasks.md:
   - Mark Phase 7 linting and commit steps as complete
   - Move to deployment verification steps

AFTER COMMIT:
- Deploy to production (Vercel auto-deploys from branch)
- Verify events in GA4 Realtime dashboard
- Verify events in Meta Test Events dashboard
- If events not appearing, check browser console for tracking script errors

START HERE: Run Biome linter on all modified files (step 1 above)
```

---

### Previous Next Action (Resolved)
```
🚨 CRITICAL: INVESTIGATE UNCOMMITTED PRODUCTION CODE CHANGES

Context:
- Branch: staging/consolidate-all-work
- Latest commit: e75620c76 (migration snapshot and agent docs)
- Phase 1-5: ALL COMMITTED ✅
- Phase 6: Final cleanup — BUT FOUND UNCOMMITTED PRODUCTION CODE

⚠️ ALERT: Git status shows 7 uncommitted files (production code):
  M .claude/settings.json
  M app/api/keywords/suggest/route.ts
  M app/api/v2/status/route.ts
  M app/components/campaigns/keyword-search/keyword-review.jsx
  M lib/db/schema.ts
  M lib/search-engine/v2/workers/save-creators.ts
  M lib/search-engine/v2/workers/search-worker.ts

CURRENT STATUS:
✅ All Phase 1-5 work committed (landing page, analytics, scalability, CSV export, TypeScript fixes)
🚨 UNKNOWN: Why are there uncommitted changes to 7 production files?
❓ UNKNOWN: What do these changes do? Are they part of a new feature or unfinished work?
🎯 MUST INVESTIGATE before merging to main

EXACT NEXT STEPS:

1. Check what changed in each file using git diff:
   bash: git diff .claude/settings.json
   bash: git diff app/api/keywords/suggest/route.ts
   bash: git diff app/api/v2/status/route.ts
   bash: git diff app/components/campaigns/keyword-search/keyword-review.jsx
   bash: git diff lib/db/schema.ts
   bash: git diff lib/search-engine/v2/workers/save-creators.ts
   bash: git diff lib/search-engine/v2/workers/search-worker.ts

2. Analyze the changes:
   - Are these related to an ongoing feature?
   - Are these debug changes that should be reverted?
   - Are these important fixes that need to be committed?
   - Check agent_docs/current-task.md for context

3. Based on analysis, take ONE of these actions:

   OPTION A: Changes are intentional work-in-progress
   → Document what these changes do in tasks.md
   → Add them to a new checklist item in Phase 6
   → Commit with descriptive message

   OPTION B: Changes are debug/test code
   → Revert them: git checkout -- <files>
   → Verify clean state: git status

   OPTION C: Changes are incomplete feature
   → Stash them: git stash save "WIP: [description]"
   → Document in tasks.md that work was stashed
   → Proceed with Phase 6 cleanup

4. After resolving production code files, then handle agent_docs:
   bash: git add agent_docs/monologue.md agent_docs/tasks.md
   bash: git commit -m "chore: update agent docs before merge"
   bash: git push origin staging/consolidate-all-work

5. Final verification before main merge:
   - Run type check: npm run type-check
   - Run linter: npx biome check --write <modified-files>
   - Review all changes: git log main..staging/consolidate-all-work --oneline
   - Test critical paths in dev environment

START HERE: Run git diff on all 7 modified files to understand what changed.
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

*Last updated: Jan 15, 2026 — 03:10 PM*
