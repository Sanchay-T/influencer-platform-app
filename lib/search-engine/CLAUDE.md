# lib/search-engine/CLAUDE.md — Search Job Processing

## What This Directory Contains

The `lib/search-engine/` directory is the search execution engine. It handles all background search job processing, dispatching to platform-specific providers, result normalization, and job lifecycle management. When a user submits a search, it eventually flows through this directory.

The architecture is modular: a central runner dispatches to providers based on platform and search type.

---

## Directory Structure

```
lib/search-engine/
├── runner.ts               → Main dispatch hub (runSearchJob)
├── job-service.ts          → Job lifecycle management (SearchJobService)
├── types.ts                → Type definitions
├── utils/                  → Shared utilities
│   ├── normalizer.ts       → Result normalization
│   └── deduplicator.ts     → Creator deduplication
└── providers/              → Platform-specific implementations
    ├── instagram-us-reels.ts → Instagram v2 (6-step pipeline)
    ├── instagram-reels.ts    → Instagram v1 (legacy, Apify)
    ├── instagram-similar.ts  → Instagram similar creators
    ├── tiktok-keyword.ts     → TikTok keyword search
    ├── youtube-keyword.ts    → YouTube keyword search
    ├── youtube-similar.ts    → YouTube similar creators
    └── google-serp.ts        → Google SERP search
```

---

## Core Components

### Runner (`runner.ts`)

**The central dispatch hub.** Determines which provider to use and executes the search.

**Function: `runSearchJob(jobId: string): Promise<SearchJobResult>`**

This is the entry point called by the QStash processor. It:
1. Loads the job from database via `SearchJobService.load()`
2. Reads `platform`, `keywords`, `targetUsername`, and `searchParams`
3. Dispatches to the appropriate provider
4. Returns result with status and metrics

```typescript
import { runSearchJob } from '@/lib/search-engine/runner';

const result = await runSearchJob('job_uuid');
// result.status: 'completed' | 'error' | 'continuation_scheduled'
// result.processedCount: number
// result.hasMore: boolean
```

**Dispatch Logic (in order of evaluation):**
```typescript
// 1. TikTok keyword search
if (platform === 'tiktok' && hasKeywords)
  → runTikTokKeywordProvider()

// 2. YouTube keyword search
if (platform === 'youtube' && hasKeywords)
  → runYouTubeKeywordProvider()

// 3. YouTube similar search
if (platform === 'youtube' && hasTargetUsername)
  → runYouTubeSimilarProvider()

// 4. Instagram similar search
if (platform === 'instagram' && hasTargetUsername)
  → runInstagramSimilarProvider()

// 5. Instagram US Reels v2 (explicit flag)
if (searchParams.runner === 'instagram_us_reels')
  → runInstagramUsReelsProvider()

// 6. Instagram Reels v1 (legacy)
if (platform === 'instagram' && hasKeywords)
  → runInstagramReelsProvider()

// 7. Google SERP
if (platform === 'google_serp')
  → runGoogleSerpProvider()
```

To grep: `runSearchJob`, `runInstagramUsReelsProvider`, `runTikTokKeywordProvider`

---

### SearchJobService (`job-service.ts`)

**Class: `SearchJobService`**

Manages the complete job lifecycle: loading, updating status, storing results, scheduling continuations.

**Static Methods:**

**`load(jobId: string): Promise<SearchJobService>`**
Loads a job from database and returns a service instance.

```typescript
const service = await SearchJobService.load(jobId);
```

**Instance Methods:**

**`updateStatus(status: JobStatus): Promise<void>`**
Updates job status in database.

```typescript
await service.updateStatus('processing');
// ... do work
await service.updateStatus('completed');
```

**`appendResults(creators: Creator[]): Promise<void>`**
Stores search results in `scrapingResults` table.

```typescript
await service.appendResults(normalizedCreators);
```

**`incrementProcessed(count: number): Promise<void>`**
Updates `processedResults` counter.

**`scheduleContinuation(delayMs: number): Promise<void>`**
Schedules a QStash callback to continue processing.

```typescript
if (hasMoreResults) {
  await service.scheduleContinuation(5000); // 5 second delay
}
```

**`getJob(): ScrapingJobRecord`**
Returns the current job record.

To grep: `SearchJobService`, `appendResults`, `scheduleContinuation`, `updateStatus`

---

### Providers (`providers/`)

Each provider implements the same interface pattern:

```typescript
export async function runXxxProvider(
  context: { job: ScrapingJobRecord; config: SearchRuntimeConfig },
  service: SearchJobService
): Promise<ProviderRunResult>
```

#### Instagram US Reels v2 (`instagram-us-reels.ts`)

The modern 6-step pipeline for Instagram keyword search. **Use this for new searches.**

```typescript
// Set searchParams.runner = 'instagram_us_reels' to use this provider
```

**Pipeline Steps:**
1. **Keyword Expansion** — GPT-4 expands "fitness" → ["workout tips", "gym motivation", ...]
2. **Handle Harvest** — Serper API finds Instagram handles from search results
3. **Profile Screen** — Filter profiles by follower count, engagement
4. **Reel Fetch** — Get last 12 reels per profile
5. **Transcript Fetch** — Extract transcripts from reels (Whisper)
6. **Scoring** — Score reels against original keywords for relevance

To grep: `runInstagramUsReelsProvider`, `instagram_us_reels`

#### Instagram Reels v1 (`instagram-reels.ts`)

Legacy Apify-based provider. Slower but still functional.

To grep: `runInstagramReelsProvider`

#### TikTok Keyword (`tiktok-keyword.ts`)

Searches TikTok by keyword using custom TikTok Keyword API.

To grep: `runTikTokKeywordProvider`

#### YouTube Keyword (`youtube-keyword.ts`)

Searches YouTube channels by keyword.

To grep: `runYouTubeKeywordProvider`

#### YouTube Similar (`youtube-similar.ts`)

Finds channels similar to a target YouTube creator.

To grep: `runYouTubeSimilarProvider`

#### Instagram Similar (`instagram-similar.ts`)

Finds Instagram accounts similar to a target creator. Uses Modash API.

To grep: `runInstagramSimilarProvider`

---

### Types (`types.ts`)

**`ScrapingJobRecord`** — Database job record
```typescript
interface ScrapingJobRecord {
  id: string;
  userId: string;
  campaignId: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
  status: 'pending' | 'processing' | 'completed' | 'error' | 'timeout';
  keywords: string[];
  targetUsername?: string;
  searchParams: Record<string, any>;
  targetResults: number;
  processedResults: number;
}
```

**`ProviderRunResult`** — Provider return type
```typescript
interface ProviderRunResult {
  status: 'completed' | 'error' | 'continuation_scheduled';
  hasMore: boolean;
  metrics: {
    totalFetched: number;
    apiCallsMade: number;
    executionTimeMs: number;
  };
}
```

**`SearchRuntimeConfig`** — Runtime configuration
```typescript
interface SearchRuntimeConfig {
  maxResults: number;
  continuationDelayMs: number;
  timeoutMs: number;
  retryAttempts: number;
}
```

To grep: `ScrapingJobRecord`, `ProviderRunResult`, `SearchRuntimeConfig`

---

### Utilities (`utils/`)

**`normalizeCreator(raw: any, platform: string): NormalizedCreator`**
Converts provider-specific creator data to a standard format.

**`deduplicateCreators(creators: Creator[]): Creator[]`**
Removes duplicate creators based on platform + external ID.

To grep: `normalizeCreator`, `deduplicateCreators`

---

## Data Flow

```
QStash POST /api/qstash/process-search
  ↓
runSearchJob(jobId)
  ↓
SearchJobService.load(jobId)
  ↓
Detect platform + search type
  ↓
Dispatch to provider (e.g., runInstagramUsReelsProvider)
  ↓
Provider fetches results from external APIs
  ↓
normalizeCreator() + deduplicateCreators()
  ↓
service.appendResults(creators)
  ↓
If hasMore: service.scheduleContinuation()
  ↓
Return ProviderRunResult
```

---

## Next in Chain

- For the Instagram v2 pipeline details, see `lib/instagram-us-reels/`
- For API routes that trigger jobs, see `app/api/CLAUDE.md`
- For database schema, see `lib/db/CLAUDE.md`
