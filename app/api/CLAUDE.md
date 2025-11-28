# app/api/CLAUDE.md — API Routes
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../../lib/auth/CLAUDE.md, ../../lib/services/CLAUDE.md, ../../lib/search-engine/CLAUDE.md.

## Scope
Backend endpoints implemented as App Router route handlers. Default posture: authenticated + structured logging. Webhooks are the only public routes.

## Golden Pattern
```ts
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId } = await getAuthOrTest();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // validate body → call service → log → respond
}
```
- Webhooks skip auth but must verify signatures (Stripe, Clerk, QStash).
- Never use `console.log`; use logger categories from `lib/logging`.

## Important Routes (know their contracts)
- Campaigns: `campaigns/route.ts` (POST create + job, GET list), `campaigns/[id]/route.ts` (GET, DELETE), `campaigns/can-create` (GET preflight).
- Jobs: `jobs/[id]/route.ts` (status/results with pagination/timeout), `jobs/process` (legacy processor), `jobs/cleanup`.
- Scraping: `scraping/instagram-scrapecreators`, `scraping/instagram-v2`, `scraping/instagram-us-reels`, `scraping/instagram`, `scraping/tiktok`, `scraping/youtube`, `scraping/youtube-similar`, `scraping/google-serp`, `new-instagram-flow` (experimental).
- QStash: `qstash/process-search` (main processor), `qstash/process-results` (monitor/follow-up), `qstash/test`.
- Webhooks (public): `/api/webhooks/stripe` and `/api/stripe/webhook` (both present—ensure Stripe dashboard points to the intended one; both verify signatures); `/api/webhooks/clerk`.
- Stripe ops: `stripe/create-checkout`, `stripe/create-subscription`, `stripe/checkout-upgrade`, `stripe/customer-portal`, `stripe/upgrade*`, `stripe/session`, `stripe/setup-intent`, `stripe/save-payment-method`, `stripe/convert-now`, `stripe/checkout-success`.
- Billing/subscription: `billing/status`, `billing/sync-stripe`, `subscription/status`, `usage/summary`.
- Onboarding: `onboarding/step-1`, `step-2`, `save-plan`, `complete`, `status`.
- Lists: `lists` CRUD, `[id]/items`, `[id]/export`, `[id]/share`, `[id]/duplicate`.
- Creators: `creators/enrich`, `creators/enriched-data`, `creators/[id]/enriched-data`.
- Admin/debug: numerous utilities under `admin/*` and `debug/*` (auth echo, trial testing, cache clear, plan set, test login, etc.) — guard with `isAdmin` where required.

## Invariants & Guardrails
- All non-webhook routes: `getAuthOrTest` first, then input validation; never bypass auth in prod.
- Apply plan enforcement (`PlanValidator`) before creating jobs or high-cost actions.
- Idempotency: webhook handlers and job processors must tolerate duplicate/out-of-order events.
- QStash concurrency: processors must be safe to run multiple times; persist before scheduling continuations.

## Testing & Dev Usage
- Dev/test auth: headers `x-test-user-id`, `x-test-email` (see `lib/auth/CLAUDE.md`); disabled in production.
- Quick curl example:
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "x-test-user-id: user_test123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","keywords":["fitness"],"platform":"instagram"}'
```

## Update Rules
Update when endpoints, auth rules, webhook events, or plan enforcement change. Keep concise (<140 lines) and point deeper readers to lib/ files.
