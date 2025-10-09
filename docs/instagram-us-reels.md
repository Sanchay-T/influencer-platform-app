# Instagram US Reels Pipeline

## Purpose
Turns a keyword into US-focused Instagram reel suggestions by orchestrating Sonar Pro, Google SERP, and ScrapeCreators APIs.

## Environment Variables
| Key | Description |
| --- | --- |
| `PERPLEXITY_API_KEY` / `PPLX_API_KEY` | Sonar Pro API key for keyword enrichment |
| `SERP_API_KEY` | Google SERP API key used by handle harvesting |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators API key for profile/reel/transcript data |
| `US_REELS_MAX_PROFILES` | (Optional) Max profiles to screen per request (default 8) |
| `US_REELS_PER_PROFILE` | (Optional) Reels fetched per accepted profile (default 12) |
| `US_REELS_TRANSCRIPT_CONCURRENCY` | (Optional) Transcript fetch concurrency (default 2) |
| `US_REELS_SNAPSHOT_LOGS` | Set to `true` to write JSON snapshots under `logs/instagram-us-reels/` |
| `US_REELS_SERP_LIMIT` | (Optional) Instagrams handles to request per SERP query |
| `US_REELS_PROFILE_THRESHOLD` | (Optional) Confidence threshold to accept a profile (default 0.6) |

## Usage
```bash
# Run pipeline programmatically
import { runInstagramUsReelsPipeline } from '@/lib/instagram-us-reels';

const results = await runInstagramUsReelsPipeline({ keyword: 'vegan snacks' });
```

### API Endpoint
`POST /api/internal/instagram-us-reels`
```json
{
  "keyword": "vegan snacks",
  "maxProfiles": 5,
  "reelsPerProfile": 10,
  "transcripts": true
}
```

### Logging
Enable `US_REELS_SNAPSHOT_LOGS=true` to capture per-step JSON for debugging inside `logs/instagram-us-reels/`.

### Testing
Unit tests live under `test-scripts/instagram-us-reels/`. Run with:
```bash
npx tsx test-scripts/instagram-us-reels/handle-harvest.test.ts
```
