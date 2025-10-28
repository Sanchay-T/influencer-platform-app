# Enrichment Backend Test Results

**Run date:** October 28, 2025 (US/Pacific)  
**API base:** `http://localhost:3002` (local Next.js dev server)  
**Test user:** `test_plan_glow` (Glow Up plan, limit = 50 enrichments/month)  
**Auth mode:** `x-dev-auth: dev-bypass` headers with `x-dev-user-id`

## Automation Script

- Command:

  ```bash
  ENRICHMENT_API_BASE_URL=http://localhost:3002 \
  TEST_USER_ID=test_plan_glow \
  TEST_USER_EMAIL=dev-user-test_plan_glow@example.dev \
  node scripts/test-enrichment-backend.js
  ```

- Key output highlights:
  - Selected creator: `@chlogeddes (TikTok)`
  - POST `/api/creators/enrich` with `forceRefresh=true` → `200 OK`, `usage.count=1`, `usage.limit=50`
  - POST `/api/creators/enrich` (cached) → `200 OK`, reused `enrichedAt=2025-10-28T15:33:52.790Z`
  - GET `/api/creators/<id>/enriched-data` → `200 OK`, returned stored payload
  - Simulated plan-limit breach by setting `enrichments_current_month = 50` → API returned `403 LIMIT_REACHED`
  - Script reset counters/plan at completion

## Manual API Verification

> All requests include `-H "x-dev-auth: dev-bypass" -H "x-dev-user-id: test_plan_glow"` (and `x-dev-email` when available).

### 1. Enrich Creator (Force Refresh)

```bash
curl -X POST http://localhost:3002/api/creators/enrich \
  -H "Content-Type: application/json" \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: test_plan_glow" \
  -d '{
        "creatorId": "ebfe247f-486f-4e70-abf5-68649ae1d15e",
        "handle": "chlogeddes",
        "platform": "tiktok",
        "forceRefresh": true
      }'
```

- Response excerpt (`200 OK`):

```json
{
  "success": true,
  "usage": { "count": 1, "limit": 50 },
  "data": {
    "handle": "chlogeddes",
    "platform": "tiktok",
    "enrichedAt": "2025-10-28T15:33:52.790Z",
    "summary": {
      "primaryEmail": "chloebgeddes@gmail.com",
      "followerCounts": { "tiktok": 163474, "instagram": 507852 }
    }
  }
}
```

### 2. Cached Enrichment Hit

```bash
curl -X POST http://localhost:3002/api/creators/enrich \
  -H "Content-Type: application/json" \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: test_plan_glow" \
  -d '{
        "creatorId": "ebfe247f-486f-4e70-abf5-68649ae1d15e",
        "handle": "chlogeddes",
        "platform": "tiktok"
      }'
```

- Response excerpt (`200 OK`):

```json
{
  "success": true,
  "usage": { "count": 1, "limit": 50 },
  "data": {
    "enrichedAt": "2025-10-28T15:33:52.790Z",
    "request": { "handle": "chlogeddes", "platform": "tiktok" }
  }
}
```

### 3. Fetch Cached Data

```bash
curl -X GET http://localhost:3002/api/creators/ebfe247f-486f-4e70-abf5-68649ae1d15e/enriched-data \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: test_plan_glow"
```

- Response excerpt (`200 OK`): same payload as cached POST, proving persistence.

### 4. Plan Limit Error

```bash
curl -X POST http://localhost:3002/api/creators/enrich \
  -H "Content-Type: application/json" \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: test_plan_glow" \
  -d '{
        "creatorId": "ebfe247f-486f-4e70-abf5-68649ae1d15e",
        "handle": "chlogeddes",
        "platform": "tiktok",
        "forceRefresh": true
      }'
```

- Response (`403`):

```json
{
  "error": "LIMIT_REACHED",
  "message": "Enrichment limit reached. Upgrade your plan to continue.",
  "plan": "glow_up",
  "usage": 50,
  "limit": 50
}
```

## Database Verification

```sql
SELECT handle,
       platform,
       metadata->'enrichment'->>'enrichedAt' AS enriched_at,
       metadata->'enrichment'->'summary'->>'primaryEmail' AS primary_email
FROM creator_profiles
WHERE handle = 'chlogeddes'
LIMIT 1;
```

Result:

| handle     | platform | enriched_at              | primary_email             |
|------------|----------|--------------------------|---------------------------|
| chlogeddes | TikTok   | 2025-10-28T15:33:52.790Z | chloebgeddes@gmail.com    |

Usage counters reset to their pre-test state (script cleanup confirmed):

```sql
SELECT uu.enrichments_current_month, uu.usage_creators_current_month
FROM user_usage uu
JOIN users u ON u.id = uu.user_id
WHERE u.user_id = 'test_plan_glow';
```

Result: `enrichments_current_month = 0`, `usage_creators_current_month = 0`.

## Error Handling Checks

- Invalid platform payload → `400 UNSUPPORTED_PLATFORM`
- Missing auth header → `401 Unauthorized`
- Simulated plan limit (see Test 4) → `403 LIMIT_REACHED`
- External API failure (tested with intentionally bad handle) → `400 ENRICHMENT_FAILED`

## UI Verification Highlights

- ✅ Keyword-search table shows an **Enrich** column with status badge, refresh control, and summary (email, ER, follower delta, and brand highlights).
- ✅ “Enrich Selected” bulk action batches requests (2 concurrent) and stops at plan limit with inline feedback.
- ✅ Gallery cards expose the same enrich/refresh flow with enriched metadata.
- ✅ Cached enrichments rehydrate automatically on page load via `GET /api/creators/enriched-data?platform=&handle=`.

## Summary

- ✅ New column `user_usage.enrichments_current_month` created & wired through plan logic
- ✅ `/api/creators/enrich` and `/api/creators/[id]/enriched-data` working end-to-end
- ✅ Caching returns stored payload without consuming plan usage
- ✅ Plan limits enforced before external API calls
- ✅ Integration script (`scripts/test-enrichment-backend.js`) provides reproducible regression coverage
