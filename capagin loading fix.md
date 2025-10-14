## Campaign Loading Fix

### Root Cause
- The server component at `app/campaigns/[id]/page.tsx` eagerly loads `scrapingJobs.results.creators`, so every visit pulls megabytes of JSON from Supabase when a run is still processing.
- That long-running query blocks the server render, Next.js hits its timeout, and the user gets the “Something went wrong” error.

### Resolution Plan
1. Update `getCampaign` to return only campaign details and lightweight job metadata (id, status, timestamps). Drop `results.creators` from the initial query.
2. Let `ClientCampaignPage` fetch creators via the existing `/api/scraping/${platform}?jobId=…` polling after the page mounts. Show a “run in progress” state while waiting.
3. (Optional hardening) Paginate the scraping API responses so oversized runs don’t ship huge JSON even in the client fetch path.

This keeps the initial payload tiny, so the page always renders quickly while results stream in asynchronously.
