# Search Flow Smoke Tests

This guide captures the six platform/search combinations and the runnable smoke scripts that now live under `test-scripts/search/*`. Each script mirrors the production search logic and loads credentials from `.env.development` so you can validate end-to-end integrations without starting the Next.js app or background queue.

## Directory Layout for Test Artifacts

Every run now drops CSV artifacts under `logs/search-matrix/<search-type>/<platform>/`. The hierarchy is:

```
logs/
  search-matrix/
    keyword/
      instagram/
      tiktok/
      youtube/
    similar/
      instagram/
      tiktok/
      youtube/
```

Each CSV filename is timestamped (UTC ISO string with colons replaced) so you can diff between runs.

## Test Matrix

| Search Type | Platform | Script | Default Input |
|-------------|----------|--------|---------------|
| Keyword     | Instagram (Enhanced) | `npm run test:search:instagram:keyword` | `nike sneakers` |
| Keyword     | TikTok              | `npm run test:search:tiktok:keyword`    | `beauty influencer` |
| Keyword     | YouTube             | `npm run test:search:youtube:keyword`   | `ai tools, productivity, tech review` |
| Similarity  | Instagram           | `npm run test:search:instagram:similar` | `natgeo` |
| Similarity  | TikTok              | `npm run test:search:tiktok:similar`    | `charlidamelio` |
| Similarity  | YouTube             | `npm run test:search:youtube:similar`   | `@marquesbrownlee` |

Adjust inputs by exporting `TEST_*` environment variables before running (e.g. `TEST_TIKTOK_KEYWORD="music marketing" npm run test:search:tiktok:keyword`).

## Environment Requirements

Each script explicitly checks for the API keys used in production:

- RapidAPI Instagram Reels: `RAPIDAPI_INSTAGRAM_KEY`
- ScrapeCreators (TikTok + YouTube keyword/similar): `SCRAPECREATORS_API_KEY` and `SCRAPECREATORS_API_URL`
- Apify Instagram Similar: `APIFY_TOKEN` (optional `INSTAGRAM_SCRAPER_ACTOR_ID`)

The helper uses `dotenv` to load `.env.development`, so nothing else is required as long as that file contains the credentials.

## Current Run Results (2025-09-26)

- ✅ Instagram keyword (`npm run test:search:instagram:keyword`) – CSV stored at `logs/search-matrix/keyword/instagram/`.
- ✅ TikTok keyword (`npm run test:search:tiktok:keyword`) – CSV stored at `logs/search-matrix/keyword/tiktok/`.
- ✅ YouTube keyword (`npm run test:search:youtube:keyword`) – CSV stored at `logs/search-matrix/keyword/youtube/`.
- ✅ Instagram similar (`npm run test:search:instagram:similar`) – CSV stored at `logs/search-matrix/similar/instagram/` (Apify-backed).
- ✅ TikTok similar (`npm run test:search:tiktok:similar`) – CSV stored at `logs/search-matrix/similar/tiktok/`.
- ✅ YouTube similar (`npm run test:search:youtube:similar`) – CSV stored at `logs/search-matrix/similar/youtube/`; requires a ScrapeCreators key with access to both `/v1/youtube/channel` and `/v1/youtube/search` (the `SPPv8ILr6ydcwat6NCr9gpp3pZA3` key currently satisfies this).

All CSVs capture the top ~25 rows per search with canonical columns so you can diff outputs between runs or feed them into downstream validation steps.
