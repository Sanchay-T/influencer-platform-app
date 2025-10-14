# Session Exchange Helper

> Breadcrumb: testing → session-exchange → uses `app/api/internal/session-exchange/route.ts` to mint real Clerk cookies.

## When to use
Run this when you want to keep Clerk in place but avoid signing in through the UI. The script calls the existing exchange endpoint, stores the cookies locally, and immediately verifies that an authenticated API request succeeds.

## Prerequisites

- `npm install` already completed.
- Dev server running (e.g. `npm run dev -- --hostname 0.0.0.0 --port 3002`).
- Environment variables:
  - `SESSION_EXCHANGE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_SITE_URL` (match the URL you use in the browser/tunnel)
- Optional:
  - `SESSION_EXCHANGE_EMAIL` (defaults to `agent+dev@example.com`)
  - `SESSION_EXCHANGE_BASE_URL` (defaults to `http://127.0.0.1:3002`)

## One-liner

```bash
SESSION_EXCHANGE_KEY=... CLERK_SECRET_KEY=... \
npx tsx testing/session-exchange/run-session-exchange.ts
```

The script writes cookies to `testing/session-exchange/.session-cookie` and prints the response payloads so you can confirm the auth handshake succeeded.

## Clean up
Delete the cookie file when you are done:

```bash
rm testing/session-exchange/.session-cookie
```

Production behavior stays identical—remove the cookie and you are back to the normal Clerk flow.
