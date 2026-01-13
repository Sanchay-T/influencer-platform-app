# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-011
**Title:** Landing Page Redesign + Analytics Integration + Scalability Architecture
**Status:** 🚧 IN PROGRESS
**Branch:** `claude/improve-scalability-architecture-ZGB9v`
**Started:** Jan 13, 2026
**Last Updated:** Jan 13, 2026 — 07:27 PM
**Latest Commits:**
- ca3101f5e — Save work before worktree cleanup (most recent)
- 0813d0799 — Landing page replaced with v0 design
- 68dcea6e7 — SEO infrastructure added
- 55ab8e657 — Google Analytics 4 integration
- 5cfca99aa — User email added to LogSnag events

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

- [x] **Critical Scalability Fixes** (Uncommitted)
  - Added database index on `scrapingResults.jobId` (lib/db/schema.ts)
  - Built CSV streaming utilities to prevent memory exhaustion (lib/export/csv-stream.ts)
  - Created Dead Letter Queue API for failed QStash messages (app/api/qstash/dead-letter/route.ts)
  - Integrated DLQ across search workers (lib/search-engine/v2/workers/dispatch.ts, enrich-dispatch.ts)
  - Added QStash helper functions for DLQ URLs (lib/queue/qstash.ts)
  - Generated database migration for index (supabase/migrations/meta/)

### Checklist

- [x] **Phase 1: Landing Page + Analytics** (COMPLETED - All Committed)
  - [x] Replace landing page with v0 design
  - [x] Add SEO infrastructure
  - [x] Integrate Google Analytics 4
  - [x] Integrate LogSnag event tracking
  - [x] Fix LogSnag configuration issues
  - [x] Integrate Meta Pixel tracking

- [x] **Phase 2: Scalability Audit + Critical Fixes** (COMPLETED - Awaiting Commit)
  - [x] Conduct comprehensive scalability audit
  - [x] Document findings in agent_docs/scalability-audit.md
  - [x] Fix CRITICAL: CSV export memory issue with streaming
  - [x] Fix HIGH: Missing database index on scrapingResults.jobId
  - [x] Fix MEDIUM: Dead letter queue for failed QStash messages
  - [x] Integrate DLQ across all search workers

- [ ] **Phase 3: Commit Scalability Work** (NEXT)
  - [ ] Review all uncommitted files
  - [ ] Run Biome linter on modified files
  - [ ] Run type check (npm run type-check)
  - [ ] Run database migration (npm run db:push) for index
  - [ ] Test DLQ endpoint in development
  - [ ] Commit all scalability work with descriptive message
  - [ ] Push to branch

- [ ] **Phase 4: Testing & Deployment**
  - [ ] Test CSV export streaming with large dataset
  - [ ] Verify DLQ endpoint receives failed messages
  - [ ] Test database query performance with new index
  - [ ] Merge to main and deploy
  - [ ] Monitor Sentry for DLQ alerts

---

### Next Action
```
🚀 COMMIT SCALABILITY IMPROVEMENTS

Context:
- Branch: claude/improve-scalability-architecture-ZGB9v
- Phase 1 (Landing + Analytics): Already committed and deployed ✅
- Phase 2 (Scalability): Code complete, awaiting commit
- Uncommitted work addresses 3 CRITICAL + 2 HIGH priority issues from audit

UNCOMMITTED FILES (ready to commit):
✅ agent_docs/scalability-audit.md — Full audit report (23 issues documented)
✅ app/api/qstash/dead-letter/route.ts — DLQ endpoint for failed workers
✅ lib/export/csv-stream.ts — Streaming CSV to prevent memory exhaustion
✅ lib/db/schema.ts — Added index on scrapingResults.jobId
✅ lib/queue/qstash.ts — DLQ helper functions
✅ lib/search-engine/v2/workers/dispatch.ts — Integrated DLQ
✅ lib/search-engine/v2/workers/enrich-dispatch.ts — Integrated DLQ
✅ lib/search-engine/v2/core/adaptive-reexpand.ts — (check changes)
✅ supabase/migrations/meta/ — Migration files for index

EXACT NEXT STEPS:

1. Check what changed in adaptive-reexpand.ts:
   bash: git diff lib/search-engine/v2/core/adaptive-reexpand.ts

2. Run Biome linter on all modified files:
   bash: npx biome check --write lib/db/schema.ts lib/queue/qstash.ts lib/export/csv-stream.ts lib/search-engine/v2/workers/dispatch.ts lib/search-engine/v2/workers/enrich-dispatch.ts lib/search-engine/v2/core/adaptive-reexpand.ts app/api/qstash/dead-letter/route.ts

3. Run type check:
   bash: npm run type-check

4. Run database migration (requires human interaction for prompts):
   bash: npm run db:push
   ⚠️ Human will need to confirm migration prompts

5. Stage and commit all files:
   bash: git add -A && git commit -m "feat: add scalability improvements

   - Add comprehensive scalability audit (23 issues identified)
   - Fix CRITICAL: CSV export memory issue with streaming utilities
   - Fix HIGH: Add database index on scrapingResults.jobId
   - Fix MEDIUM: Dead letter queue for failed QStash messages
   - Integrate DLQ across search and enrichment workers

   Addresses top priority issues from scalability audit to prevent:
   - Memory exhaustion on large CSV exports
   - Slow job lookup queries at scale
   - Silent worker failures without monitoring"

6. Push to branch:
   bash: git push origin HEAD

START HERE: Check adaptive-reexpand.ts changes, then run linter.
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
