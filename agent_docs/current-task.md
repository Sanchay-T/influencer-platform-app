# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** V2 Fan-Out Worker Architecture
**Branch:** `feat/v2-fan-out-workers` (create when starting Phase 1)
**Status:** Architecture Planning COMPLETE, Implementation Phase 1 PENDING
**Started:** Dec 8, 2025 (original v2 pipeline)
**Updated:** Dec 10, 2025

---

## Quick Context

We're building a **scalable fan-out worker system** that replaces the current monolithic search pipeline. This enables:
- Multiple users searching simultaneously
- Keywords processed in parallel via QStash
- Results shown progressively (not all-at-once)
- Platform-agnostic design (one adapter file per platform)

**Full architecture spec:** `@agent_docs/v2-fan-out-architecture.md`

---

## Current Phase: Phase 1 - Database Schema

### What to Do Next

1. **Create feature branch:**
   ```bash
   git checkout -b feat/v2-fan-out-workers
   ```

2. **Edit `lib/db/schema.ts`** - Add these columns to `scrapingJobs`:
   ```typescript
   keywordsDispatched: integer('keywords_dispatched').default(0),
   keywordsCompleted: integer('keywords_completed').default(0),
   creatorsFound: integer('creators_found').default(0),
   creatorsEnriched: integer('creators_enriched').default(0),
   enrichmentStatus: varchar('enrichment_status', { length: 20 }).default('pending'),
   ```

3. **Tell user to run:** `npx drizzle-kit generate` (requires human for prompts)

4. **After migration:** Continue to Phase 2 (Core Infrastructure)

---

## Implementation Progress

| Phase | Status | Key Files |
|-------|--------|-----------|
| 1. Schema Changes | ⬜ PENDING | `lib/db/schema.ts` |
| 2. Core Infrastructure | ⬜ PENDING | `job-tracker.ts`, `workers/types.ts` |
| 3. Workers | ⬜ PENDING | `dispatch.ts`, `search-worker.ts`, `enrich-worker.ts` |
| 4. API Routes | ⬜ PENDING | `/api/v2/dispatch`, `/api/v2/worker/*` |
| 5. Adapters | ⬜ PENDING | `instagram.ts`, `youtube.ts` |
| 6. Frontend | ⬜ PENDING | Search components, polling |
| 7. Cleanup | ⬜ PENDING | Delete old providers/routes |

---

## Key Architecture Decisions (FINAL)

1. **Full replacement** - Old code deleted, not kept alongside
2. **Platform = parameter** - Workers receive platform as string
3. **Adapter = only difference** - One file per platform (~200 lines)
4. **Billing preserved** - Same `validateCreatorSearch()`, `incrementCreatorCount()`
5. **Skip truncated bio emails** - Only extract from enriched bios

---

## Files Changed (This Session - Dec 10)

### New Files
- `agent_docs/v2-fan-out-architecture.md` - Full architecture specification

### Modified Files
- `agent_docs/current-task.md` - This file (updated for new task)

---

## Previous Work (Dec 8-10)

Before the fan-out architecture, we built the v2 parallel pipeline:

- `lib/search-engine/v2/core/parallel-pipeline.ts` - Parallel enrichment (KEEP, will be used by workers)
- `lib/search-engine/v2/core/keyword-expander.ts` - AI expansion (KEEP)
- `lib/search-engine/v2/adapters/tiktok.ts` - TikTok adapter (KEEP, enhance)

This code will be reused by the new worker system.

---

## What NOT to Do

- Don't modify old routes in `app/api/scraping/` - they'll be deleted
- Don't add new providers to `lib/search-engine/providers/` - deprecated
- Don't change billing logic in `lib/services/plan-validator.ts` - works as-is

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `@agent_docs/v2-fan-out-architecture.md` | Full architecture spec, flow diagrams |
| `@agent_docs/search-engine.md` | Current search system (for reference) |
| `@agent_docs/billing-stripe.md` | Billing integration points |
| `@agent_docs/database.md` | DB operations guide |

---

## Session Handoff Notes

**For next session:**
1. Read `@agent_docs/v2-fan-out-architecture.md` first
2. Start Phase 1: Edit schema, ask user to run migration
3. After migration success, move to Phase 2
4. Update this file after each phase completion
