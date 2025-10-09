# Instagram US Reels Pipeline — Runbook

This guide describes the nutritionist pipeline run you asked for, along with instructions for repeating or extending the workflow.

---

## 1. Latest Run (October 9 2025)

- **Keyword:** `nutritionist`
- **Transcripts:** disabled (command defaults)
- **SERP source:** [serper.dev](https://serper.dev) (`SERPER_DEV_API_KEY`)
- **Models used:**  
  - Primary expansion: `sonar-reasoning-pro` (Perplexity)  
  - Secondary enrichment: `gpt-4o` (OpenRouter/OpenAI)
- **Duration:** ~153 s (≈ 2.55 min)
- **Output:** 36 scored reels, stored at `test-outputs/live-nutritionist-no-transcripts.txt`

### Creator Summary

| Creator (handle)    | Reels | Avg. Relevance | US Confidence | Notes |
|---------------------|------:|---------------:|--------------:|-------|
| `nutritionstripped` | 12    | 0.96           | 0.80          | Nashville RDN, mindful eating reels |
| `nutritionbykylie`  | 12    | 0.88           | 0.80          | US nutrition coach, pragmatic tips |
| `dietitiandeanna`   | 12    | 0.90           | 0.95          | US intuitive eating content, verified Sonar reasoning |

Each reel entry in the output file contains the normalized metadata (caption, video URL, view/like counts, relevance score, US hints).

### Interesting Reel Example

```
shortcode: DPjM_j8DetM
url: https://www.instagram.com/reel/DPjM_j8DetM/
owner: nutritionstripped
relevanceScore: 1.00
US hints: ["bio:la", "sonar:US-likely"]
caption: "Do you ever feel like food takes up too much space in your mind? ..."
```

---

## 2. Environment Setup

Ensure these environment variables exist in `.env.local`:

| Key | Purpose |
| --- | --- |
| `PERPLEXITY_API_KEY` | Sonar Reasoning Pro structured output |
| `OPENROUTER_API_KEY` or `OPENAI_API_KEY` | GPT‑4o enrichment (one of them) |
| `SERPER_DEV_API_KEY` | Serper.dev Google search |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators profile/reel data |
| (optional) `SONAR_MODEL` | Override Sonar model (defaults to `sonar-reasoning-pro`) |
| (optional) `US_REELS_SNAPSHOT_LOGS=true` | Save step-by-step JSON snapshots under `logs/instagram-us-reels/` |

---

## 3. Running the Pipeline

### 3.1 Quick Run

```bash
SONAR_MODEL=sonar-reasoning-pro \
US_REELS_SNAPSHOT_LOGS=true \
node --env-file=.env.local --import tsx test-scripts/instagram-us-reels/live-run.ts "<keyword>"
```

Example (nutritionist):

```bash
SONAR_MODEL=sonar-reasoning-pro \
US_REELS_SNAPSHOT_LOGS=true \
node --env-file=.env.local --import tsx test-scripts/instagram-us-reels/live-run.ts nutritionist
```

Flags:
- `--no-serp` → disable SERP entirely (LLM-only handles)
- `--with-transcripts` → re-enable transcript fetching (adds 20–40 s per batch)

### 3.2 Inspect Intermediate Data

If `US_REELS_SNAPSHOT_LOGS=true`, you’ll find snapshots in:

```
logs/instagram-us-reels/
  ├─ step-1-expansion/      # Sonar + GPT output
  ├─ step-2-handles/        # SERP (if enabled)
  ├─ step-3-profiles/       # accepted/rejected profile data with confidence
  ├─ step-4-reels/          # raw reels before scoring
  └─ step-5-transcripts/    # transcript status (only when enabled)
```

### 3.3 Consuming Results

Each run writes a JSON payload (prefixed by runtime banners) under `test-outputs/`.  
Example: `test-outputs/live-nutritionist-no-transcripts.txt`

Remove the first two lines to parse raw JSON:

```bash
tail -n +3 test-outputs/live-nutritionist-no-transcripts.txt | jq '.results[0]'
```

---

## 4. Pipeline Internals (Reference)

The orchestration lives at `lib/instagram-us-reels/index.ts`, which chains:

1. **Keyword expansion** (`steps/keyword-expansion.ts`)
   - Sonar Reasoning Pro structured JSON
   - GPT‑4o augmentation (handles, queries, hashtags)
2. **Handle harvest** (`steps/handle-harvest.ts`)
   - Serper.dev search by default (falls back to legacy SerpApi if Serper key missing)
3. **Profile screening** (`steps/profile-screen.ts`)
   - Heuristics (bio, links, categories) + Sonar classification fallback
4. **Reel fetch** (`steps/reel-fetch.ts`)
   - ScrapeCreators `user/reels/simple` + `post` detail merge
5. **Transcript fetch** (`steps/transcript-fetch.ts`) — optional, now opt-in only
6. **Scoring** (`steps/scoring.ts`)
   - Keyword matches, recency, engagement, US confidence

---

## 5. Notes & Future Enhancements

- **Transcript reliability**: ScrapeCreators often returns `null`; consider alternate audio processing if transcripts are mission-critical.
- **Profile 404s**: A few handles (`streetsmartnutrition`, `dietitian_deanna`) returned 404 during the latest run. Retrying with user IDs or caching failures would help.
- **Creator diversity**: Adjust `US_REELS_PER_PROFILE` (env) to distribute runs across more handles.
- **Rate limits**: Serper.dev handles batches gracefully, but keep `SERPER_DEV_API_KEY` quotas in mind when scaling.

---

By following these steps you can replicate the nutritionist run, swap in new keywords, or tweak the pipeline for broader searches. Ping me if you need transcripts re-enabled or a QStash integration once you’re ready to automate batches.

