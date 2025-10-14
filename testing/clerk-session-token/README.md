# Clerk Session Token Helper

> Breadcrumb: testing → clerk-session-token → mint a backend session token and reuse it as a bearer/cookie.

## When to use
Perfect for scripted backend checks (CI, smoke tests) when you need a Clerk-issued JWT but do not want to build cookies manually. The script talks directly to the Clerk API using the existing service token and immediately exercises `/api/usage/summary`.

## Prerequisites

- `npm install` already completed.
- Environment variables:
  - `CLERK_SECRET_KEY`
  - `CLERK_AUTOMATION_SERVICE_TOKEN` (or another service token with `sessions:create` scope)
  - `CLERK_SESSION_USER_ID` (defaults to `user_33neqrnH0OrnbvECgCZF9YT4E7F`)
  - `CLERK_SESSION_BASE_URL` (defaults to `http://127.0.0.1:3002`)

## One-liner

```bash
CLERK_SECRET_KEY=sk_test_... CLERK_AUTOMATION_SERVICE_TOKEN=sk_test_... \
npx tsx testing/clerk-session-token/mint-session-token.ts
```

The script prints the JWT, writes it to `testing/clerk-session-token/.session-token`, and verifies that an `Authorization: Bearer` request succeeds.

## Notes

- The resulting token expires quickly (usually <1 hour). Re-run the script when you need a fresh value.
- Production traffic is unaffected—remove the header or token file and you are back to the default Clerk flow.
