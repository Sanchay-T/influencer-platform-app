# Campaigns & Lists

This document covers campaign management and creator lists. Read this when working on campaigns, search runs, or list features.

## Campaigns

Campaigns are containers for creator searches. Each search "run" belongs to a campaign.

### Campaign Structure

```
Campaign → scrapingJobs[] (runs)
```

### Campaign Statuses

`draft` | `active` | `completed` | `archived`

### Key Files

| File | Purpose |
|------|---------|
| `app/campaigns/page.tsx` | Campaign list page |
| `app/campaigns/[id]/page.tsx` | Single campaign (server) |
| `app/campaigns/[id]/client-page.tsx` | Campaign detail (client) |
| `app/campaigns/search/keyword/page.jsx` | Keyword search flow |
| `app/api/campaigns/route.ts` | Campaign CRUD API |
| `lib/db/schema.ts` | Schema: `campaigns`, `scrapingJobs` tables |

---

## Scraping Jobs (Runs)

Each search run is stored in `scraping_jobs` table.

### Job Statuses

`pending` | `processing` | `completed` | `error` | `timeout`

### Key Fields

- `platform` — tiktok, instagram, youtube
- `keywords` — search keywords (jsonb)
- `targetUsername` — for similar search
- `processedResults`, `targetResults`, `progress`
- `searchParams` — provider-specific config

See `lib/db/schema.ts` for full schema.

---

## Lists

Lists organize saved creators for outreach tracking.

### List Types

`campaign` | `favorites` | `industry` | `research` | `contacted` | `custom`

### Creator Buckets (Board View)

The `bucket` field on `creator_list_items`:

`backlog` (default) | `shortlist` | `contacted` | `booked`

### Key Files

| File | Purpose |
|------|---------|
| `app/lists/page.tsx` | Lists overview |
| `app/lists/[id]/page.tsx` | Single list |
| `app/lists/[id]/_components/list-detail-client.tsx` | List detail UI |
| `app/api/lists/route.ts` | List CRUD API |
| `lib/db/queries/list-queries.ts` | List database operations |
| `lib/db/schema.ts` | Schema: `creatorLists`, `creatorListItems` tables |

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `campaigns` | Campaign containers |
| `scraping_jobs` | Search runs with results |
| `creator_lists` | User-created lists |
| `creator_list_items` | Creators in lists (with bucket, position) |
| `creator_profiles` | Normalized creator directory |

See `lib/db/schema.ts` for all fields.

---

## To Explore

When working on campaigns/lists:
1. Read `lib/db/schema.ts` for table definitions
2. Read `lib/db/queries/list-queries.ts` for list operations
3. Check `app/api/campaigns/route.ts` for campaign CRUD
4. Check `app/api/lists/` for list API patterns
