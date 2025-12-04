# Search Engine

This document covers the creator search system. Read this when working on search features.

## Overview

Two search types across three platforms:

| Search Type | TikTok | Instagram | YouTube |
|-------------|--------|-----------|---------|
| **Keyword** | ✅ ScrapeCreators | ✅ ScrapeCreators | ✅ ScrapeCreators |
| **Similar** | ✅ Influencers Club | ✅ Apify + Influencers Club | ✅ ScrapeCreators |

---

## Keyword Search

All platforms use **ScrapeCreators API** for keyword search.

| Platform | Provider File | API Used |
|----------|---------------|----------|
| TikTok | `lib/search-engine/providers/tiktok-keyword.ts` | ScrapeCreators `/v1/tiktok/search` |
| Instagram | `lib/search-engine/providers/instagram-reels-scrapecreators.ts` | ScrapeCreators `/v1/instagram/reels/search` |
| YouTube | `lib/search-engine/providers/youtube-keyword.ts` | ScrapeCreators `/v1/youtube/search` |

**Instagram special features:**
- Uses AI (OpenRouter) to expand keywords with variations
- Continuation via QStash if below target
- See the provider file for `MAX_PARALLEL_SEARCHES`, `KEYWORDS_PER_RUN` constants

---

## Similar Search

Different APIs depending on platform:

| Platform | Provider File | API Used |
|----------|---------------|----------|
| Instagram | `lib/search-engine/providers/instagram-similar.ts` | Apify (profile + related) |
| YouTube | `lib/search-engine/providers/youtube-similar.ts` | ScrapeCreators (profile → keywords → search) |
| Instagram/TikTok | `lib/search-engine/providers/similar-discovery.ts` | Influencers Club Discovery API |

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/search-engine/runner.ts` | Entry point — dispatches to correct provider |
| `lib/search-engine/job-service.ts` | Job state, progress, result merging |
| `lib/search-engine/types.ts` | Shared types (NormalizedCreator, etc.) |
| `lib/platforms/instagram-similar/api.ts` | Apify client for Instagram |
| `lib/platforms/youtube-similar/api.ts` | ScrapeCreators client for YouTube |

---

## API Routes

| Route | Platform | Search Type |
|-------|----------|-------------|
| `/api/scraping/tiktok` | TikTok | Keyword |
| `/api/scraping/youtube` | YouTube | Keyword |
| `/api/scraping/youtube-similar` | YouTube | Similar |
| `/api/scraping/instagram-scrapecreators` | Instagram | Keyword |
| `/api/scraping/similar-discovery` | Instagram/TikTok | Similar |

---

## Architecture

```
API Route → Job created in DB → QStash queue → 
Runner dispatches to provider → Provider fetches from external API → 
Results saved to scraping_jobs → Frontend polls for status
```

The runner (`lib/search-engine/runner.ts`) has detection functions that decide which provider to use based on platform and search type.

---

## External APIs

| Service | Used For | Config |
|---------|----------|--------|
| ScrapeCreators | All keyword + YouTube similar | `SCRAPECREATORS_API_KEY` |
| Apify | Instagram similar | `APIFY_TOKEN` |
| Influencers Club | Similar discovery | `INFLUENCERS_CLUB_API_KEY` |
| OpenRouter | AI keyword expansion | `OPENROUTER_API_KEY` |

---

## To Explore

When working on search:
1. Read `lib/search-engine/runner.ts` to see dispatch logic
2. Read the specific provider file for the platform you're working on
3. Check `lib/search-engine/job-service.ts` for how results are saved
4. Check the API route in `app/api/scraping/` for request handling
