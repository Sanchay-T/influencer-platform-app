# Feed Pipeline Overview

## Goals
- Accept any user keyword and return a curated table/list of Instagram reels.
- Guarantee U.S.-centric results with enough quantity (target 60+ reels when possible).
- Keep runtime bounded (~10 minutes) by staging the ScrapeCreators crawl and batching AI calls.

## High-Level Flow
1. **Keyword intake**
   - User keyword or pre-seeded handles.
   - Optional CLI overrides for thresholds, handle count, etc.

2. **AI-assisted discovery**
   - `generateKeywordVariants` prompts GPT-4o for alternate queries, descriptors, and hashtags.
   - Each variant is run through SerpApi (`fetchSerpHandles`).
   - `expandSeedsWithAI` asks GPT-4o for additional handles with metadata (confidence, region, follower hints).
   - All handles are merged/deduped before the crawl.

3. **Staged ScrapeCreators crawl**
   - Handles are fetched in waves up to `--handles`.
   - Early-stop multiplier (default 2.0) aborts the crawl once we have roughly 2 × requested reels.
   - Retry logic covers transient 429/timeout responses.

4. **Reel extraction**
   - Recent reels (default 120 days) pulled from `edge_owner_to_timeline_media`.
   - U.S. heuristic check (`isLikelyUS`) rejects non-US creators early.
   - Keyword hits recorded for auditing.

5. **AI relevance scoring**
   - GPT-4o classifies reels in batches (20 per call) returning relevance, reason, and US hints.
   - Items below `--ai-threshold` are demoted.
   - Composite score = numeric metrics × relevance boost.

6. **Diversity and export**
   - Per-creator cap (`--maxPerCreator`, default 3) enforced before final sort.
   - `diversifyFeed` interleaves creators to avoid consecutive duplicates.
   - JSON and CSV written with AI metadata (relevance, rationale, composite score).

## Artifacts
- **JSON**: stored under `logs/scrapecreators/feeds/feed-<primary-handle>-*.json`
  - Contains crawl summary, AI stats, handle suggestions, and full reel payload.
- **CSV**: same path with `.csv` extension for table-ready consumption.
- **Logs**: stdout records SERP queries, AI expansion stats, runtime, and warnings.

## Current Defaults
| Parameter | Default | Notes |
|-----------|---------|-------|
| `--handles` | 120 | Staged crawl; early-stop halts sooner once enough reels collected |
| `--maxPerCreator` | 3 (4 for fitness demo) | Protects diversity |
| `--ai-threshold` | 0.6 (nutrition/vegan), 0.5 (fitness) | Lower admits more reels, higher tightens quality |
| Recency window | 120 days | Adjust via `--days` |
| Concurrency | 12–15 | Balances speed vs. ScrapeCreators limits |
| Early-stop multiplier | 2.0 | Collect ~2× requested reels before trimming |

## Output Columns
| Field | Description |
|-------|-------------|
| `score` | Baseline numeric score from plays/likes/comments and recency |
| `aiRelevance` | GPT-4o relevance score (0–1) |
| `compositeScore` | Score × (0.5 + 0.5 × relevance) |
| `aiReason` | Short justification for inclusion |
| `us_hint` | Inferred US location/signal |
| `keyword_hits` | Raw keyword matches in caption/bio |

Consult the other documents in this folder for usage details, troubleshooting, and benchmarks.
