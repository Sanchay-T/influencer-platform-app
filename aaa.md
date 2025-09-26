# Initial Audit Findings

## Flows Reviewed
- Auth & session
- Search
- Lists (create/update/delete & item management)
- Viewing content
- Likes/Favorites
- Background jobs
- APIs / Route Handlers / Server Actions
- Cross-cutting concerns (security, reliability, performance, observability)

## Findings

Flow | Finding | Severity | Evidence (file:line / repro) | Root Cause | Fix Plan (code-level) | Tests to Add/Run | Acceptance Criteria
-- | -- | -- | -- | -- | -- | -- | --
Viewing content | Campaign detail page renders other users' campaigns when given an arbitrary ID. | Critical | `app/campaigns/[id]/page.tsx`: server component fetches the campaign without scoping to the signed-in user, so any authenticated user can view another user's jobs/results by guessing the UUID. 【F:app/campaigns/[id]/page.tsx†L13-L82】 | Missing server-side authorization check when reading campaigns in the RSC layer. | Use `auth()` in the server component (or fetch via a server action) and scope the query to `campaigns.userId = userId`; return 404/redirect when it does not match. Mirror this check in any downstream loaders. | Add an integration test hitting `/campaigns/[id]` as a secondary user (expect 404) and a unit test for the data loader ensuring it rejects non-owners. | Navigating to `/campaigns/[id]` as a non-owner returns 404/redirects instead of leaking another user's campaign data.
Cross-cutting (Security) | Public image proxy acts as an unauthenticated SSRF primitive. | Critical | `middleware.ts` whitelists `/api/proxy/(.*)` as public, and the handler blindly fetches any user-provided URL (including http and internal IPs) and returns the bytes. 【F:middleware.ts†L6-L28】【F:app/api/proxy/image/route.ts†L64-L199】 | Proxy endpoint lacks domain allowlisting and transport restrictions while being exposed to anonymous traffic. | Require authentication or signed URLs, enforce an allowlist of trusted hosts + `https`, and short-circuit requests to private address ranges; log & deny others. | Add unit tests for URL validation (allow known CDNs, block `http`, localhost, RFC1918, link-local) and an integration test confirming unauthenticated calls are rejected. | Only authenticated users can proxy approved remote images; requests to disallowed hosts/protocols are rejected with 403.
Search | Instagram "similar profiles" job creation lets a user mutate another user's campaign. | Critical | The POST handler inserts a job and updates the campaign without first verifying `campaign.userId === userId`. A malicious user can submit another campaign's UUID and enqueue work against it. 【F:app/api/scraping/instagram/route.ts†L120-L158】 | Campaign ownership validation was omitted before mutating campaign/job records. | Fetch the campaign with a `userId` filter (or update with a compound `WHERE` on id + userId). Abort with 404/403 if the campaign doesn't belong to the caller. | Add an integration test that attempts to enqueue a job against someone else's campaign (expect 404/403) plus a happy-path regression test. | Only campaign owners/collaborators can start Instagram similar searches; foreign campaign IDs are rejected.
Background jobs | QStash callbacks default to `VERCEL_URL` without a scheme, yielding invalid webhook targets in production. | Major | Both Instagram scraping handlers build the callback URL with `process.env.VERCEL_URL`, which on Vercel lacks `https://`, so QStash publishes to a malformed host (e.g., `my-app.vercel.app/api/qstash/process-scraping`). 【F:app/api/scraping/instagram/route.ts†L130-L142】【F:app/api/scraping/instagram-hashtag/route.ts†L195-L205】 | Callback URL builder assumes `VERCEL_URL` already includes the protocol. | Introduce a helper to normalize the site URL (prefer `NEXT_PUBLIC_SITE_URL`, otherwise prefix `https://` to `VERCEL_URL`), reuse it across all producers, and add logging/validation. | Unit tests for the helper covering local/dev/prod env permutations; smoke test that a QStash publish succeeds with the normalized URL. | Background jobs published from Vercel successfully call back into `/api/qstash/process-scraping` without manual env overrides.

## Proposed Remediation Order
1. **Security & Authorization** – Fix the campaign data exposure and lock down the image proxy before anything else.
2. **Search / Campaign Integrity** – Patch the Instagram job authorization gap and add regression coverage.
3. **Background Job Reliability** – Normalize the QStash callback URL and add monitoring around failed publishes.
4. **Remaining UX & Observability Polish** – After the above, address smaller DX/observability gaps surfaced during testing.

Please review the ordering; I'll pause here until I receive your go-ahead.