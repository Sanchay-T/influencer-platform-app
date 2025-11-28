# Instagram ScrapeCreators - Testing Guide

> **Last Tested**: 2025-11-27
> **Status**: ✅ Fully Working

---

## Prerequisites

1. **Server running** on port 3001 (or 3000)
2. **Ngrok tunnel active** for QStash callbacks
3. **Environment variables set** in `.env.local`:
   - `DATABASE_URL` - Supabase connection
   - `QSTASH_TOKEN` - For job queue
   - `SCRAPECREATORS_API_KEY` - For Instagram API

---

## Testing Process

### Step 1: Find Your User ID

```bash
psql "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres" \
  -c "SELECT user_id, email FROM users WHERE email = 'YOUR_EMAIL';"
```

**Result**: `user_2zrF0Aod9GyXO5b3R74PC3EPpeC`

### Step 2: Find a Campaign ID

```bash
psql "postgresql://..." \
  -c "SELECT id, name FROM campaigns WHERE user_id = 'YOUR_USER_ID' LIMIT 5;"
```

**Result**: `791e8aea-dd42-4f38-adfa-99561bfa113c`

### Step 3: Create a Search Job

```bash
curl -s -X POST 'http://localhost:3001/api/scraping/instagram-scrapecreators' \
  -H 'x-dev-auth: dev-bypass' \
  -H 'x-dev-user-id: YOUR_USER_ID' \
  -H 'Content-Type: application/json' \
  -d '{
    "keywords": ["meditation"],
    "campaignId": "YOUR_CAMPAIGN_ID",
    "targetResults": 10
  }'
```

**Expected Response**:
```json
{
  "jobId": "35f6c476-bce2-47b9-a4d0-050196bd2774",
  "status": "queued",
  "targetResults": 10,
  "amount": 10
}
```

### Step 4: Check Job Status

```bash
curl -s 'http://localhost:3001/api/scraping/instagram-scrapecreators?jobId=JOB_ID' \
  -H 'x-dev-auth: dev-bypass' \
  -H 'x-dev-user-id: YOUR_USER_ID'
```

**Status Progression**: `pending` → `processing` → `completed`

### Step 5: Verify Likes Filter

```sql
SELECT
  (c->'creator'->>'username') as username,
  (c->'video'->'statistics'->>'likes')::int as likes
FROM scraping_results sr,
     jsonb_array_elements(sr.creators) as c
WHERE sr.job_id = 'JOB_ID'
ORDER BY likes ASC
LIMIT 5;
```

---

## Auth Bypass Methods

For local testing without Clerk authentication:

### Method 1: Dev Bypass Header (Recommended)
```bash
-H 'x-dev-auth: dev-bypass' \
-H 'x-dev-user-id: user_xxx'
```

### Method 2: Environment Variable
```bash
# In .env.local
ENABLE_AUTH_BYPASS=true
AUTH_BYPASS_USER_ID=user_xxx
```

---

## Test Results (2025-11-27)

| Metric | Value |
|--------|-------|
| Keyword | `meditation` |
| Target Results | 10 |
| Actual Results | **117 creators** |
| Status | `completed` |
| Min Likes | 101 (filter working ✅) |

### Sample Creators Found

| Username | Followers | Likes | Verified |
|----------|-----------|-------|----------|
| @mikechangofficial | 4.17M | 6,304 | ✅ |
| @jeffiverson | 2.13M | 25,381 | ✅ |
| @melissawoodtepperberg | 1.35M | 6,055 | ✅ |
| @michael.galyon | 998K | 6,304 | ✅ |

---

## Troubleshooting

### Job Stuck in "processing"
- **Cause**: QStash can't reach localhost
- **Fix**: Ensure ngrok is running and webhook URL is configured

### "Unauthorized" Error
- **Cause**: Auth bypass not working
- **Fix**: Use `x-dev-auth: dev-bypass` header

### Empty Results
- **Cause**: SCRAPECREATORS_API_KEY missing or invalid
- **Fix**: Check `.env.local` for valid API key

---

## Related Files

- **API Route**: `app/api/scraping/instagram-scrapecreators/route.ts`
- **Provider**: `lib/search-engine/providers/instagram-reels-scrapecreators.ts`
- **Likes Filter**: `lib/search-engine/utils/filter-creators.ts`
- **Job Service**: `lib/search-engine/job-service.ts`
