# API Smoke Suite

> Breadcrumb: testing → api-suite → orchestrates authenticated checks for core API endpoints.

## What this does
- Reads the Clerk session token saved by `testing/clerk-session-token/mint-session-token.ts`.
- Signs `x-test-auth` headers so routes using `getAuthOrTest()` pick up the automation user.
- Exercises a curated list of API endpoints (status, usage summary, onboarding status, campaign CRUD, YouTube scraping kick-off) and prints a compact success table.
- Persists contextual IDs (e.g., new campaign, scraping job) so you can extend the script with more checks.

## Prerequisites
1. Install dependencies: `npm install`
2. Export env vars (usually via `.env.local`): `CLERK_AUTOMATION_SERVICE_TOKEN`, `CLERK_SECRET_KEY`, `AUTOMATION_USER_ID`, `TEST_AUTH_SECRET`, `ENABLE_TEST_AUTH=true`
3. Run the session minter once to populate `.session-token`:
   ```bash
   CLERK_AUTOMATION_SERVICE_TOKEN=... CLERK_SESSION_BASE_URL=http://127.0.0.1:3001 \
   npx tsx testing/clerk-session-token/mint-session-token.ts
   ```
4. Ensure the dev server is running (currently `http://127.0.0.1:3001`)

## Run it
```bash
SESSION_BASE_URL=http://127.0.0.1:3001 \
npx tsx testing/api-suite/run-api-suite.ts
```

By default it hits:
- `GET /api/status`
- `GET /api/usage/summary`
- `GET /api/onboarding/status`
- `PATCH /api/onboarding/step-1` is intentionally **not** invoked—step 1 now short-circuits with `409` if Clerk has no primary email. Make sure your test accounts have an email stored (or run `npx tsx scripts/backfill-missing-emails.ts`) before driving the flow.
- `POST /api/campaigns` (creates a timestamped “Smoke Test” campaign)
- `GET /api/campaigns?page=1&limit=5`
- `POST /api/scraping/youtube` (targetResults=100)
- `GET /api/scraping/youtube?jobId=<from previous step>`

## End-to-end scrape validation

When you have a public tunnel or staging env that QStash can reach, run:

```bash
SESSION_BASE_URL=https://<your-ngrok>.ngrok.app \
CLERK_SESSION_BASE_URL=https://<your-ngrok>.ngrok.app \
npx tsx testing/clerk-session-token/mint-session-token.ts      # fresh token
npx tsx testing/api-suite/youtube-e2e.ts                       # polls until job completes
```

The script waits for `status: completed`, prints the number of creators returned, and dumps a sample result so you can confirm the search engine pipeline worked end to end.

Need all major scrapers at once? Use the combined harness:

```bash
SESSION_BASE_URL=https://<your-ngrok>.ngrok.app \
CLERK_SESSION_BASE_URL=https://<your-ngrok>.ngrok.app \
npx tsx testing/clerk-session-token/mint-session-token.ts      # refresh token first
npx tsx testing/api-suite/full-e2e.ts                          # YouTube, TikTok, Instagram similar
```

It creates the required campaigns, starts each scrape, polls until completion, and prints sample creators plus timing benchmarks for every platform.

Want granular runs? Individual scripts are available:

```bash
npx tsx testing/api-suite/youtube-e2e.ts
npx tsx testing/api-suite/tiktok-e2e.ts
npx tsx testing/api-suite/instagram-similar-e2e.ts
npx tsx testing/api-suite/onboarding-e2e.ts
npx tsx testing/api-suite/campaigns-e2e.ts
npx tsx testing/api-suite/lists-e2e.ts
```

Modify the `tests` array in `run-api-suite.ts` to cover more endpoints. Each entry can inspect the JSON response and push additional follow-up checks into the queue.

## Clean up
- Delete or archive generated campaigns/scraping jobs if you need a pristine DB.
- Remove `testing/clerk-session-token/.session-token` after the run to avoid stale tokens.
