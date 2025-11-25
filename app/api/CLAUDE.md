# app/api/CLAUDE.md — Backend API Routes

## What This Directory Contains

The `app/api/` directory contains all backend API endpoints. Every route follows the Next.js App Router convention: export async functions named `GET`, `POST`, `PUT`, `DELETE` from `route.ts` files. All routes (except webhooks) require authentication via `getAuthOrTest()`.

---

## Directory Structure

```
app/api/
├── campaigns/               → Campaign CRUD + search job creation
│   ├── route.ts             → POST (create), GET (list)
│   ├── [id]/route.ts        → GET (single), DELETE
│   └── can-create/route.ts  → GET (check if user can create)
├── jobs/                    → Search job status & results
│   ├── [id]/route.ts        → GET (job status + results)
│   ├── process/route.ts     → POST (legacy processor)
│   └── cleanup/route.ts     → POST (cleanup old jobs)
├── qstash/                  → QStash background job callbacks
│   └── process-search/route.ts → POST (main job processor)
├── webhooks/                → External service webhooks (NO AUTH)
│   ├── stripe/route.ts      → Stripe billing events
│   └── clerk/route.ts       → Clerk user events
├── stripe/                  → Stripe operations
│   ├── create-checkout/route.ts → POST (start checkout)
│   └── customer-portal/route.ts → GET (portal link)
├── billing/                 → Billing status endpoints
│   ├── status/route.ts      → GET (user billing status)
│   └── sync-stripe/route.ts → POST (force sync)
├── onboarding/              → Onboarding flow endpoints
│   ├── step-1/route.ts      → POST (save personal info)
│   ├── step-2/route.ts      → POST (save business info)
│   ├── save-plan/route.ts   → POST (save intended plan)
│   └── complete/route.ts    → POST (finalize onboarding)
├── lists/                   → Creator list management
│   ├── route.ts             → POST (create), GET (list all)
│   └── [id]/                → Single list operations
│       ├── route.ts         → GET, PUT, DELETE
│       ├── items/route.ts   → POST (add), DELETE (remove)
│       └── export/route.ts  → GET (CSV download)
├── creators/                → Creator enrichment
│   └── enrich/route.ts      → POST (enrich with follower data)
├── admin/                   → Admin-only endpoints
│   ├── users/route.ts       → GET (list users)
│   └── reset-user-state/route.ts → POST (reset user)
└── debug/                   → Development helpers
    ├── whoami/route.ts      → GET (current auth context)
    └── trial-testing/route.ts → POST (test trial logic)
```

---

## Authentication Pattern

**Every API route** (except webhooks) must start with authentication:

```typescript
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```

The `getAuthOrTest()` function (from `lib/auth/get-auth-or-test.ts`) checks:
1. Test headers (`x-test-user-id`) — dev only
2. Dev bypass env var (`ENABLE_AUTH_BYPASS`) — dev only
3. Clerk `auth()` — production

To grep: `getAuthOrTest`, `x-test-user-id`, `ENABLE_AUTH_BYPASS`

---

## Core Endpoint Details

### Campaigns (`campaigns/route.ts`)

**POST — Create Campaign + Search Job:**
```typescript
// Creates campaign record, then scrapingJobs record
// Validates plan limits via PlanValidator.validateCampaignCreation()
// Publishes job to QStash for async processing
```
Functions: `createCampaign()`, `validateCampaignCreation()`, `qstash.publishJSON()`

**GET — List User Campaigns:**
Returns all campaigns for authenticated user with job status.

### Jobs (`jobs/[id]/route.ts`)

**GET — Job Status & Results:**
```typescript
// Returns: { status, processedResults, targetResults, results[] }
// Checks timeout: if started > 10 min ago and still processing → error
// Paginates results with cursor
```
Functions: `getJobWithResults()`, `checkJobTimeout()`

### QStash Processor (`qstash/process-search/route.ts`)

**POST — Process Search Job:**
This is the callback URL that QStash hits. It:
1. Verifies Upstash signature (unless `VERIFY_QSTASH_SIGNATURE=false`)
2. Loads job via `SearchJobService.load(jobId)`
3. Calls `runSearchJob(jobId)` to dispatch to appropriate provider
4. Stores results in `scrapingResults` table
5. Schedules continuation if more results needed

To grep: `runSearchJob`, `SearchJobService`, `Upstash-Signature`

### Stripe Webhook (`webhooks/stripe/route.ts`)

**POST — Handle Stripe Events:**
No auth required (webhook). Verifies Stripe signature instead.

Events handled:
- `checkout.session.completed` → Start trial, set plan
- `customer.subscription.created` → Sync subscription data
- `customer.subscription.updated` → Handle plan changes
- `customer.subscription.deleted` → Mark canceled
- `invoice.payment_succeeded` → Reset monthly usage
- `invoice.payment_failed` → Mark past_due

Functions: `handleCheckoutCompleted()`, `handleSubscriptionUpdated()`, `handleInvoicePaid()`

To grep: `checkout.session.completed`, `invoice.payment_succeeded`, `stripe.webhooks.constructEvent`

### Onboarding (`onboarding/`)

**step-1/route.ts POST:**
Saves `fullName`, validates email, updates `onboardingStep` to `step_1`.

**step-2/route.ts POST:**
Saves `businessName`, `brandDescription`, `industry`, updates `onboardingStep` to `step_2`.

**save-plan/route.ts POST:**
Saves `intendedPlan` (not `currentPlan`—that's set after payment).

**complete/route.ts POST:**
Finalizes onboarding, sets `onboardingStep` to `completed`.

Functions: `updateUserProfile()`, `finalizeOnboarding()`

### Creator Lists (`lists/`)

**route.ts POST:** Create new list (`createCreatorList()`)
**route.ts GET:** List all user's lists (`getUserLists()`)
**[id]/items/route.ts POST:** Add creator to list (`addCreatorToList()`)
**[id]/export/route.ts GET:** Export as CSV (`exportListToCsv()`)

To grep: `createCreatorList`, `addCreatorToList`, `exportListToCsv`

---

## Response Patterns

**Success:**
```typescript
return NextResponse.json({ success: true, data: result });
return NextResponse.json({ data: items, cursor: nextCursor });
```

**Error:**
```typescript
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
return NextResponse.json({ error: 'Not found' }, { status: 404 });
return NextResponse.json({ error: 'Plan limit exceeded', upgradeRequired: true }, { status: 403 });
```

---

## Logging Pattern

All routes should log using `BillingLogger` or category loggers:

```typescript
import BillingLogger from '@/lib/loggers/billing-logger';

const requestId = BillingLogger.generateRequestId();
await BillingLogger.logAPI('REQUEST_START', { requestId, endpoint: '/api/campaigns' });
// ... handle request
await BillingLogger.logAPI('REQUEST_COMPLETE', { requestId, duration: Date.now() - start });
```

To grep: `BillingLogger`, `generateRequestId`, `logAPI`

---

## Testing API Routes

Use curl with test headers (dev only):

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "x-test-user-id: user_test123" \
  -H "x-test-email: test@example.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Campaign","keywords":["fitness"],"platform":"instagram"}'
```

---

## Next in Chain

- For business logic behind these endpoints, see `lib/services/CLAUDE.md`
- For database queries, see `lib/db/CLAUDE.md`
- For search job processing, see `lib/search-engine/CLAUDE.md`
