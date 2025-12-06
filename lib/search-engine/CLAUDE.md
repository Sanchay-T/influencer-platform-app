# lib/search-engine/CLAUDE.md — Search Jobs
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md, lib/services/CLAUDE.md, app/api/CLAUDE.md.

## Scope
Search job orchestration, provider dispatch, and persistence for Instagram/TikTok/YouTube/Google SERP.

## Core Files
- `runner.ts` — `runSearchJob(jobId)` selects provider based on platform + params.
- `job-service.ts` — `SearchJobService` handles job load/save, result append, continuation scheduling.
- `providers/*` — platform-specific implementations.
- `types.ts` — shared interfaces for providers, metrics, statuses.

## Provider Dispatch (current order)
1) TikTok keyword → `runTikTokKeywordProvider`
2) YouTube keyword → `runYouTubeKeywordProvider`
3) YouTube similar → `runYouTubeSimilarProvider`
4) Instagram similar → `runInstagramSimilarProvider`
5) Instagram ScrapeCreators → `runInstagramScrapeCreatorsProvider` (`runner='instagram_scrapecreators'`)
6) Instagram V2 → `runInstagramV2Provider` (`runner='instagram_v2'`)
7) Instagram US Reels v2 → `runInstagramUsReelsProvider` (`runner='instagram_us_reels'`)
8) Instagram Reels v1 (legacy) → `runInstagramReelsProvider`
9) Google SERP → `runGoogleSerpProvider`

## Invariants
- Jobs are idempotent; QStash may call processors concurrently—guard writes and continuations.
- Persist results before scheduling next run; update `processedResults` counts accurately.
- Respect plan enforcement: cap target results to remaining quota before dispatch.
- Signature verification: QStash signature required unless explicitly disabled in config (dev only).
- Logging: use `scrapingLogger` with `{ jobId, userId, provider, durationMs }`; runner also emits `console.warn` snapshots in prod as a documented exception to the no-console rule.
- Runtime config (max API calls, continuation delay) comes from `SystemConfig` keyed by platform.
- Providers filter creators by minimum likes before dedupe/merge; dedupe uses merge keys + platform hint.

## Data Model Touchpoints
- Reads/writes `scraping_jobs`, `scraping_results`; updates job status (`pending → processing → completed | error | timeout`).
- Creator deduplication and normalization happen in providers; keep JSONB payload lean.

## Testing
- Provider-specific smoke scripts live in `scripts/` (see `scripts/CLAUDE.md`).
- Add unit tests under `lib/search-engine/__tests__/` when changing dispatch logic or provider outputs.

## Update Rules
Update this file when adding/removing providers, changing dispatch order, or altering job lifecycle fields. Keep concise (<140 lines).
