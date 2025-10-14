# Instagram US Reels Pipeline Overhaul

## Why this refactor exists

The current US Reels agent still writes intermediate results to CSV files (`session.csv`) and only returns the merged creator list once the agent has finished. That blocks incremental updates in the UI. We also ship the `csv-parse` / `csv-stringify` dependencies purely for this legacy flow.

This document outlines how to modernise the pipeline so the agent streams JSON directly into Postgres, matching the behaviour we already have for TikTok searches.

## Goals

1. **Incremental UI updates** – users should see creators appear while the agent is still processing.
2. **Drop the CSV layer** – no temp files, no additional dependencies.
3. **Keep the data model consistent** – the database remains the source of truth for job progress and results.

## Major workstreams

### 1. Refactor the agent runtime (us-reels-agent)

- Eliminate the CSV reader/writer modules (`csv-reader.ts`, `csv-writer.ts`, `master-merger.ts`).
- Replace `SessionManager` storage with an in-memory session object that tracks:
  - discovered reel URLs
  - hydrated post + profile metadata
  - transcripts / US decision metadata
- Each tool call (`scBatchPosts`, `scBatchProfiles`, transcripts, etc.) should return structured data that can be merged into the session object directly.
- The agent loop should fire a callback (or `async generator`) whenever a batch is ready so the provider can persist immediately.

### 2. Update `runInstagramUsReelsAgent`

- Change the return type to expose a `stream` of normalized creators instead of a fully buffered array.
- Keep the cost summary tracking intact (the existing observers can stay).
- Remove the CSV-derived helpers; derive profile summaries directly from the in-memory session.

### 3. Provider integration (`lib/search-engine/providers/instagram-us-reels.ts`)

- Consume the new streaming interface:
  - As soon as the agent yields a batch, call `service.mergeCreators()` so the UI sees the results.
  - Update the progress calculation to match the TikTok provider.
- Persist session diagnostics (optional): if we still want disk artefacts for debugging, write JSON instead of CSV.

### 4. Clean up dependencies & build pipeline

- Remove `csv-parse` / `csv-stringify` from `package.json`.
- Delete the now-unused storage modules and session metadata files.
- Make sure the Vercel build no longer depends on the `us-reels-agent` CSV utilities.

## Risk checklist

- **ScrapeCreators limits** – the agent currently batches API calls; keep the throttling logic when moving to in-memory storage.
- **Memory footprint** – streaming in memory should be fine for the volumes we handle, but keep an eye on extremely large campaigns.
- **Regression coverage** – add smoke tests for incremental updates (e.g., launch a US Reels job and poll `/api/scraping/instagram-us-reels?jobId=…` until completion).

## Suggested order of execution

1. Refactor the agent runtime (local unit tests, CLI runs).
2. Introduce the streaming return value and update the provider to consume it under a feature flag.
3. Once validated in staging, remove the CSV codepaths and dependencies.
4. Update docs and smoke tests to reflect the new behaviour.

## Done when…

- The Instagram US Reels job follows the same incremental update pattern as TikTok.
- No CSV files are created in `/logs/us-reels-agent` during normal runs.
- The UI shows creators arriving while the agent is still processing.
- `npm run smoke:test` passes without requiring the CSV deps.

Happy to tackle this after launch; keeping the plan here ensures the next dev can pick it up with context.
