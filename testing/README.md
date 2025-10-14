# Testing Auth Shortcuts

> Breadcrumb: testing root → describes three auth-preserving test flows and points to per-approach scripts.

This directory holds **development-only helpers** that keep Clerk enabled while removing day-to-day friction.
Every approach lives in its own folder so you can toggle it on/off without touching production code.

- `session-exchange/` – exercise the existing `/api/internal/session-exchange` route and reuse the issued cookies.
- `automation-headers/` – hit the automation-ready API routes with `X-Testing-Token` headers (parity with `docs/automation-api-testing.md`).
- `clerk-session-token/` – mint a short-lived Clerk session token for scripted backend checks.
- `scripts/backfill-missing-emails.ts` (root `scripts/`) can backfill any legacy users that lack stored emails. Run it once after resetting data so onboarding doesn’t get blocked by missing Clerk profiles.

Each folder contains:

1. A README explaining environment variables and the one-liner to run.
2. A `tsx` script that bootstraps the flow and verifies `/api/usage/summary`.

Kill the helper and delete the cookies/token when you finish—production paths keep behaving exactly the same.
