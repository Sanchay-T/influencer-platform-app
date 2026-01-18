# Search Engine

This document covers the creator search system. Read this when working on search features.

## Overview

Two search types across three platforms:

| Search Type | TikTok | Instagram | YouTube |
|-------------|--------|-----------|---------|
| **Keyword** | ✅ V2 fan-out | ✅ V2 fan-out | ✅ V2 fan-out |
| **Similar** | ✅ Influencers Club | ✅ Apify + Influencers Club | ✅ ScrapeCreators |

---

## Keyword Search

Keyword search runs through the **v2 fan-out pipeline** under `lib/search-engine/v2`.
Adapters live in `lib/search-engine/v2/adapters` and call ScrapeCreators.

Key entry points:
- `/api/v2/dispatch` — create job + queue workers
- `/api/v2/status` — poll status + results

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
| `lib/search-engine/v2/` | V2 fan-out keyword search pipeline |
| `app/api/v2/dispatch/route.ts` | V2 keyword entrypoint |
| `app/api/v2/status/route.ts` | V2 keyword polling |
| `lib/search-engine/runner.ts` | Legacy runner (similar search only) |
| `lib/search-engine/job-service.ts` | Job state, progress, result merging |
| `lib/search-engine/types.ts` | Shared types (NormalizedCreator, etc.) |
| `lib/platforms/instagram-similar/api.ts` | Apify client for Instagram |
| `lib/platforms/youtube-similar/api.ts` | ScrapeCreators client for YouTube |

---

## API Routes

| Route | Platform | Search Type |
|-------|----------|-------------|
| `/api/v2/dispatch` | TikTok/Instagram/YouTube | Keyword |
| `/api/v2/status` | TikTok/Instagram/YouTube | Keyword |
| `/api/scraping/youtube-similar` | YouTube | Similar |
| `/api/scraping/instagram` | Instagram | Similar |
| `/api/scraping/similar-discovery` | Instagram/TikTok | Similar |

---

## Architecture

```
Keyword: `/api/v2/dispatch` → QStash workers → v2 adapters → job_creators → `/api/v2/status`

Similar: `/api/scraping/*` → QStash → legacy runner → scraping_jobs → `/api/scraping/*` status
```

The runner (`lib/search-engine/runner.ts`) has detection functions that decide which provider to use based on platform and search type.

---

## External APIs

| Service | Used For | Config |
|---------|----------|--------|
| ScrapeCreators | Keyword (v2 adapters) + YouTube similar | `SCRAPECREATORS_API_KEY` |
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
