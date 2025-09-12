Agent & LLM Testing Guide (Dev/Test Only)

Overview
- Goal: let agents/CLIs call API routes as if a real user is logged in, without UI login.
- Mechanism: a signed header pair that the server accepts in development when `ENABLE_TEST_AUTH=true`.
- Safety: disabled in production; normal Clerk auth remains the default everywhere.

Setup
- Add to your dev env:
  - `ENABLE_TEST_AUTH=true`
  - `TEST_AUTH_SECRET=<random-32-chars>`
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3002` (or your dev URL)
  - For admin tests: include your email in `NEXT_PUBLIC_ADMIN_EMAILS`.

How it works
- All imports of `@clerk/nextjs/server` are aliased to a wrapper that:
  - Checks for a valid signed header on each request.
  - When present, returns a synthetic `auth()` result with `userId` and `sessionClaims.email`.
  - Otherwise, falls back to real Clerk `auth()`.
- Middleware allows requests with the test header to pass without redirecting to sign-in (dev only).
- Admin checks (`isAdminUser`) accept either:
  - `admin: true` in the test header, or
  - `email` present in `NEXT_PUBLIC_ADMIN_EMAILS`.

Header format
- `x-test-auth`: base64url(JSON: `{ userId, email?, admin?, iat }`)
- `x-test-signature`: HMAC-SHA256(base64url(JSON), `TEST_AUTH_SECRET`) in base64url

Agent helper
- Use `lib/tests/agent-auth.js` to build headers:
  - `const { buildTestAuthHeaders } = require('@/lib/tests/agent-auth')`
  - `const headers = buildTestAuthHeaders({ userId: 'test_user_123', email: 'you@example.com', admin: false })`

CLI runner
- `node test-scripts/run-api.js --path /api/profile --method GET --user-id test_user_123 --email you@example.com`
- Options:
  - `--path /api/...` or `--url https://...`
  - `--method GET|POST|...`
  - `--body '{"...": ...}'` or `--body-file data.json`
  - `--user-id <id>` and optional `--email <email>`
  - `--as admin` to set admin flag in the header
  - `--seed-user you+seed@example.com` to call `POST /api/admin/create-test-user` (requires `--as admin`)
  - `--qstash-job <id>` to invoke the QStash processor in dev

Typical flows
1) Create a test user profile
   - `node test-scripts/run-api.js --seed-user you+seed@example.com --as admin`

2) Create a campaign
   - `node test-scripts/run-api.js --path /api/campaigns --method POST --user-id test_user_123 --email you@example.com --body '{"name":"Demo","description":"..."}'`

3) Start a search (YouTube example)
   - `node test-scripts/run-api.js --path /api/scraping/youtube --method POST --user-id test_user_123 --body '{"keywords":["laptops"],"targetResults":100,"campaignId":"<campaign-id>"}'`

4) Poll status
   - `node test-scripts/run-api.js --path '/api/scraping/youtube?jobId=<jobId>' --method GET --user-id test_user_123`

5) Simulate QStash (optional in dev)
   - `node test-scripts/run-api.js --qstash-job <jobId>`

Notes & safeguards
- Production is never affected: the alias and header bypass are disabled when `NODE_ENV=production`.
- Plan/billing enforcement remains intact since routes still read from the database for entitlements.
- Admin routes remain gated; the wrapper for `isAdminUser` checks the signed header (dev only) instead of calling Clerk when appropriate.

