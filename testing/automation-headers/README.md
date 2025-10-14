# Automation Header Smoke Test

> Breadcrumb: testing → automation-headers → reuses the bearer-style headers already supported by API handlers.

## When to use
Ideal for backend smoke tests and CI. The script sends `X-Testing-Token` and `X-Automation-User-Id` so you can reach protected APIs without Clerk cookies. This mirrors the flow in `docs/automation-api-testing.md`.

## Prerequisites

- `npm install` already completed.
- Dev server running (e.g. `npm run dev -- --hostname 0.0.0.0 --port 3002`).
- Environment variables:
  - `AUTOMATION_TESTING_SECRET`
  - `AUTOMATION_USER_ID`
  - `AUTOMATION_BASE_URL` (defaults to `http://127.0.0.1:3002`)

You can seed the automation user with:

```bash
npx tsx scripts/seed-automation-onboarding.ts
```

## One-liner

```bash
AUTOMATION_TESTING_SECRET=... AUTOMATION_BASE_URL=http://127.0.0.1:3002 \
npx tsx testing/automation-headers/run-automation-smoke.ts
```

You should see HTTP 200 responses and a summary payload. Edit the script to hit any endpoint that honours the automation headers.
