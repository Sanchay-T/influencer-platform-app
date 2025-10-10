# ScrapeCreators Feed Builder Notes

## Data Sources
- `GET ${SCRAPECREATORS_INSTAGRAM_API_URL}?handle=<username>` returns Instagram profile payloads with:
  - `edge_owner_to_timeline_media.edges[]` – latest 12 feed items including reels.
  - Reel metadata (`video_view_count`, `edge_liked_by`, `edge_media_to_comment`, `taken_at_timestamp`, `video_url`, `thumbnail_src`).
  - `edge_related_profiles.edges[]` – up to ~20 related handles for expansion.

## Gaps Discovered
- No public ScrapeCreators discovery endpoint (`/v1/discovery/` 404).
- No documented `creators/content/details` endpoint on the ScrapeCreators domain; profile payload already carries core reel metrics but lacks transcripts/audio.
- Reels endpoint advertised via env (`SCRAPECREATORS_INSTAGRAM_REELS_API_URL`) currently 404.

## Prototype Script
- `scripts/prototype-scrapecreators-feed.ts`
  - Seeds via CLI handles, BFS expands related profiles (throttle + retries).
  - Extracts recent reels (default 150-day window).
  - Scores items using log-weighted plays/engagement + recency.
  - Writes feed snapshot to `logs/scrapecreators/feeds/`.
- Example run:
  ```
  npx ts-node --transpile-only scripts/prototype-scrapecreators-feed.ts nutritionbykylie --limit=60 --handles=40 --days=150
  ```
  Result: `logs/scrapecreators/feeds/feed-nutritionbykylie-*.json` (60 scored reels from 40 profiles).

## Next Validation Steps
- Build automated test under `test-scripts/discovery/` to assert:
  - minimum `profilesFetched` and `delivered` counts for `nutritionist` seed set.
  - score values are finite and sorted descending.
  - each item contains `postUrl`, `metrics.plays`, and `creator.username`.
- Add CLI options for keyword-to-seed expansion once a search endpoint is available.
- Integrate log outputs with centralized logger once endpoint wiring moves server-side.

