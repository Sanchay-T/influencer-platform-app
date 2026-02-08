# Remaining Fixes — Complete Technical Specification

> **Date:** Feb 7, 2026
> **Context:** After the 10 business-logic fixes (A-J) were shipped with 18 regression tests, a deep scan + state management architecture review surfaced 10 additional issues.
> **Companion docs:** `business-logic-fixes-2026-02-07.md` (what's already done), `remaining-issues-2026-02-07.md` (earlier draft)

---

## Summary Table

| # | Sev | Bug | Status | File(s) |
|---|-----|-----|--------|---------|
| 1 | P0 | Webhook skips plan upgrades/downgrades | **Actively broken** | `lib/billing/webhook-handlers.ts` |
| 2 | P0 | Admin set-plan doesn't set subscriptionStatus | **Actively broken** | `app/api/admin/users/set-plan/route.ts` |
| 3 | P1 | TOCTOU race in legacy search routes | Dormant (exploitable) | 3 files in `app/api/scraping/` |
| 4 | P1 | Image proxy has no auth and no domain allowlist (SSRF) | **Actively exploitable** | `app/api/proxy/image/route.ts` |
| 5 | P1 | CSV exports uploaded with public access | **Active** | `app/api/export/csv-worker/route.ts` |
| 6 | P2 | Hardcoded billing cycle and next billing date | **Active UX bug** | `lib/billing/billing-status.ts` |
| 7 | P2 | Division by zero in subscription progress bar | Dormant | `app/components/billing/subscription-management.tsx` |
| 8 | P2 | Tautological WHERE clause in getUserBilling | Dormant (mitigated) | `lib/db/queries/user-queries.ts` |
| 9 | P2 | Three competing frontend billing hooks | **Active (cache incoherence)** | `lib/hooks/use-billing.ts`, `use-billing-cached.ts`, `use-trial-status.ts` |
| 10 | P2 | Denormalized plan limits drift from config | **Active (silent)** | `lib/billing/webhook-handlers.ts` vs `lib/billing/access-validation.ts` |

---

## P0 — Users Losing Money or Access

### 1. Webhook skips plan upgrades/downgrades

**File:** `lib/billing/webhook-handlers.ts`
**Lines:** 162-181

**The code:**
```typescript
// Line 163: Build expected status from incoming Stripe event
const expectedStatus = mapStripeSubscriptionStatus(subscription.status);

// Lines 164-167: Early-exit idempotency guard
if (
  user.stripeSubscriptionId === subscription.id &&
  user.subscriptionStatus === expectedStatus
) {
  // Lines 168-181: Return early — SKIPS all processing
  return {
    success: true,
    action: 'already_current',
    details: { eventType, subscriptionId: subscription.id },
  };
}
```

**Why it's broken:** When a user changes plan via Stripe Billing Portal (e.g., Growth → Scale), Stripe keeps the **same subscription ID** and the status stays `active` → `active`. The guard matches on both conditions and returns early. The code that extracts the new price ID (line 184), resolves the plan key (line 185), and writes the update (line 249) **never executes**.

Fields that never update on plan change:
- `currentPlan` (line 218)
- `intendedPlan` (line 219)
- `planCampaignsLimit` (line 229)
- `planCreatorsLimit` (line 230)

**Impact:** Users pay for an upgraded plan but retain old plan's limits and features. Revenue is collected but service isn't delivered. This is actively broken for every portal-initiated plan change.

**Repro:** User on Growth ($199) upgrades to Scale ($599) via Stripe portal. Stripe fires `customer.subscription.updated`. Webhook logs `already_current` and skips. User keeps Growth's 6,000 creator/month limit instead of Scale's 30,000.

**Fix:** Add `currentPlan` to the idempotency check:
```typescript
const incomingPriceId = subscription.items.data[0]?.price?.id;
const incomingPlanKey = getPlanKeyByPriceId(incomingPriceId);

if (
  user.stripeSubscriptionId === subscription.id &&
  user.subscriptionStatus === expectedStatus &&
  user.currentPlan === incomingPlanKey  // <-- ADD THIS
) {
  return { success: true, action: 'already_current', ... };
}
```

This requires moving the plan resolution (currently at lines 184-185) above the guard. No other changes needed.

---

### 2. Admin set-plan doesn't set subscriptionStatus

**File:** `app/api/admin/users/set-plan/route.ts`
**Lines:** 31-37

**The code:**
```typescript
// Lines 32-37: Update user's plan — notice what's missing
await updateUserProfile(userId, {
  currentPlan: plan.planKey,          // ✅ Set
  planCampaignsLimit: plan.campaignsLimit,  // ✅ Set
  planCreatorsLimit: plan.creatorsLimit,    // ✅ Set
  planFeatures: plan.features,              // ✅ Set
  // subscriptionStatus: ???           // ❌ NOT SET
  // onboardingStep: ???               // ❌ NOT SET
});
```

**Why it's broken:** The access validation gate at `lib/billing/access-validation.ts:50` requires:
```typescript
const hasActiveSubscription = user.subscriptionStatus === 'active';
```
Without setting `subscriptionStatus` to `'active'`, the admin-assigned plan is visible in the DB but every gated API route (campaigns, search, enrichment, export) returns 403 Forbidden.

**Impact:** Every admin plan override is non-functional. Users assigned plans via admin panel cannot access any features. Affects testing, comps, and manual overrides.

**Fix:**
```typescript
await updateUserProfile(userId, {
  currentPlan: plan.planKey,
  planCampaignsLimit: plan.campaignsLimit,
  planCreatorsLimit: plan.creatorsLimit,
  planFeatures: plan.features,
  subscriptionStatus: 'active',      // ADD: Required by access-validation.ts
  onboardingStep: 'completed',       // ADD: Required by access-validation.ts:91
});
```

---

## P1 — Security / Data Integrity

### 3. TOCTOU race in legacy search routes

**Files:**
- `app/api/scraping/instagram/route.ts` — lines 76-106
- `app/api/scraping/youtube-similar/route.ts` — lines 78-107
- `app/api/scraping/similar-discovery/route.ts` — lines 101-132

**The pattern (identical in all 3 files):**
```typescript
// Step 1: Check trial limit (READ)
const trialCheck = await validateTrialSearchLimit(userId);  // line 76/78/101
if (!trialCheck.allowed) {
  return NextResponse.json({ error: trialCheck.reason, upgrade: true }, { status: 403 });
}

// --- GAP: No lock, no transaction ---

// Step 2: Insert job (WRITE) — lines 84-106 / 85-107 / 109-132
const [job] = await db
  .insert(scrapingJobs)
  .values({ userId, ... })
  .returning();
```

**Why it's broken:** `validateTrialSearchLimit()` counts existing jobs, then `db.insert()` creates a new one. These are two separate operations with no transaction or row lock. If a trial user (limited to 3 searches) sends 5 concurrent POST requests, all 5 pass validation (count is still < 3) before any job is inserted. All 5 jobs get created.

**Comparison:** The v2 dispatch at `lib/search-engine/v2/workers/dispatch.ts:310-337` correctly wraps both operations in a `db.transaction()` with `FOR UPDATE` lock. These 3 legacy routes were never retrofitted.

**Impact:** Trial users can bypass the 3-search limit. Each search hits expensive external APIs (Apify actors). Exploitable with any HTTP client sending concurrent requests.

**Fix:** Wrap validation + insert in a transaction with `FOR UPDATE` lock on the user's usage row, matching the v2 dispatch pattern.

---

### 4. Image proxy — no auth, no domain allowlist (SSRF)

**File:** `app/api/proxy/image/route.ts`
**Line:** 124 (GET handler entry), 137 (URL extraction), 218 (fetch)

**The code:**
```typescript
// Line 124: Public GET handler — no auth check
export async function GET(request: Request) {

  // Line 137: Takes any URL from query string
  const imageUrl = searchParams.get('url');

  // Line 162-183: Only check is for blob URLs (optimization, not security)
  if (imageUrl.includes('blob.vercel-storage.com')) {
    return NextResponse.redirect(imageUrl, 302);
  }

  // Line 218: Fetches ANY URL from the server
  response = await fetch(imageUrl, { headers: fetchHeaders });
}
```

**Why it's broken:** No authentication required. No domain allowlist. Anyone can call `/api/proxy/image?url=http://169.254.169.254/latest/meta-data/` and the Vercel function will fetch it server-side. This is a textbook Server-Side Request Forgery (SSRF) vulnerability.

**Impact:**
- Probe internal/cloud metadata endpoints from Vercel's IP range
- Bypass IP-based access controls on third-party services
- Exfiltrate data from internal services
- Consume serverless execution time (30s `maxDuration` per request)

**Fix:** Add domain allowlist at the top of the handler:
```typescript
const ALLOWED_DOMAINS = [
  'instagram.com', 'cdninstagram.com', 'fbcdn.net',     // Instagram
  'tiktokcdn.com', 'tiktokcdn-us.com',                  // TikTok
  'ytimg.com', 'ggpht.com', 'googleusercontent.com',    // YouTube
  'blob.vercel-storage.com',                             // Our blob storage
];

const url = new URL(imageUrl);
const isAllowed = ALLOWED_DOMAINS.some(d => url.hostname.endsWith(d));
if (!isAllowed) {
  return new NextResponse('Domain not allowed', { status: 403 });
}
```

---

### 5. CSV exports uploaded with public access

**File:** `app/api/export/csv-worker/route.ts`
**Lines:** 171-174

**The code:**
```typescript
// Line 171-174: Upload to Vercel Blob with public access
const blob = await put(filename, csvContent, {
  access: 'public',     // ❌ Anyone with the URL can download
  contentType: 'text/csv',
});
```

**Why it's broken:** Creator data exports (names, handles, emails, social profiles, follower counts) are uploaded as publicly accessible Vercel Blob files. While URLs contain UUIDs and timestamps (hard to guess), any leak via logs, referrer headers, shared links, or browser history exposes the data.

**Impact:** PII-adjacent data exposure. Every CSV export creates a publicly accessible URL that lives for 7 days (line 179: `expiresAt`). No authentication required to download.

**Fix:** Change to authenticated access:
```typescript
const blob = await put(filename, csvContent, {
  access: 'private',  // Requires signed URL to download
  contentType: 'text/csv',
});
```
Then generate a short-lived signed download URL in the status polling response.

---

## P2 — UX / Data Correctness

### 6. Hardcoded billing cycle and next billing date

**File:** `lib/billing/billing-status.ts`
**Lines:** 99-102

**The code:**
```typescript
// Line 99: Always says "monthly" — even for yearly subscribers
billingCycle: 'monthly',

// Lines 100-102: Next billing date is literally "today + 30 days"
nextBillingDate: hasActiveSubscription
  ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  : undefined,
```

**Why it's broken:** Stripe knows the real `current_period_end` and billing interval. This code ignores both and fabricates values. A user on a yearly plan ($1,908/year for Growth) sees "Monthly" billing cycle and a next billing date that's always 30 days out — which is wrong by up to 11 months.

**Impact:** Incorrect billing information displayed in the subscription management UI. Confusing for yearly subscribers.

**Fix:** Store `billingInterval` (from `subscription.items.data[0].price.recurring.interval`) and `currentPeriodEnd` (from `subscription.current_period_end`) in the webhook handler's update data. Serve those in `getBillingStatus()` instead of hardcoded values.

**Webhook handler addition** (`webhook-handlers.ts`, inside the `updateData` object around line 212):
```typescript
billingInterval: subscription.items.data[0]?.price?.recurring?.interval || 'month',
currentPeriodEnd: subscription.current_period_end
  ? new Date(subscription.current_period_end * 1000)
  : undefined,
```

**Schema addition:** Add `billingInterval` (text) and `currentPeriodEnd` (timestamp) columns to users table.

---

### 7. Division by zero in subscription progress bar

**File:** `app/components/billing/subscription-management.tsx`
**Lines:** 184-203

**The code:**
```tsx
// Lines 186-189: Checks for -1 (unlimited) but NOT for 0
<Progress
  value={
    usageInfo.campaignsLimit === -1
      ? 0
      : (usageInfo.campaignsUsed / usageInfo.campaignsLimit) * 100
      //                          ^^^^^^^^^^^^^^^^^^^^^^^^^ can be 0
  }
/>

// Lines 197-200: Same issue for creators
<Progress
  value={
    usageInfo.creatorsLimit === -1
      ? 0
      : (usageInfo.creatorsUsed / usageInfo.creatorsLimit) * 100
  }
/>
```

**Why it's broken:** When `usageInfo.campaignsLimit` or `usageInfo.creatorsLimit` is `0` (no plan, or plan with 0 limit), the division produces `Infinity` or `NaN`. This gets passed to the `<Progress>` component's `value` prop.

**Impact:** Broken progress bar rendering for users with no active plan viewing `/billing`. Currently dormant because most paths to this component require a plan, but reachable via direct URL.

**Fix:**
```tsx
value={
  usageInfo.campaignsLimit === -1 || usageInfo.campaignsLimit === 0
    ? 0
    : (usageInfo.campaignsUsed / usageInfo.campaignsLimit) * 100
}
```

---

### 8. Tautological WHERE clause in getUserBilling

**File:** `lib/db/queries/user-queries.ts`
**Lines:** 588-594

**The code:**
```typescript
.where(
  and(
    eq(users.userId, userId),
    // Comment says: "Only return records with Stripe customer ID"
    eq(userBilling.stripeCustomerId, userBilling.stripeCustomerId)  // line 592
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // Column compared to ITSELF — always true (except NULL)
  )
)
```

**Why it's broken:** `eq(column, column)` evaluates to `column = column` in SQL, which is always true (unless NULL). The intended filter was `isNotNull(userBilling.stripeCustomerId)` to exclude records without a Stripe customer ID.

**Mitigation:** Line 597 provides a safety net:
```typescript
if (!record || typeof record.stripeCustomerId !== 'string') {
  return null;
}
```
This post-query check catches the same condition, so the tautological WHERE doesn't cause incorrect results — just wastes a few bytes of SQL evaluation.

**Impact:** Dormant. The post-check prevents incorrect behavior. Performance impact is negligible.

**Fix:**
```typescript
.where(
  and(
    eq(users.userId, userId),
    isNotNull(userBilling.stripeCustomerId)  // Actual intent
  )
)
```

---

## P2 — Architecture / Tech Debt

### 9. Three competing frontend billing hooks

**Files:**
- `lib/hooks/use-billing.ts` — 390 lines
- `lib/hooks/use-billing-cached.ts` — 253 lines
- `lib/hooks/use-trial-status.ts` — 128 lines

**The three caches:**

| Hook | localStorage Key | In-Memory Cache | TTL | API Endpoint |
|------|-----------------|-----------------|-----|-------------|
| `useBilling()` | `gemz_entitlements_v1` | `globalThis.__BILLING_CACHE__` | 30s (memory), 60s (localStorage) | `/api/billing/status` |
| `useBillingCached()` | `gemz_billing_cache` | none | 2min | `/api/billing/status` |
| `useTrialStatus()` | `gemz_trial_status_cache` | none | 30s | `/api/trial/search-count` |

**Why it's a problem:**
1. **Cache incoherence:** A component using `useBilling()` can see `isTrialing: true` while another component using `useTrialStatus()` shows `isTrialUser: false` — their caches refresh independently at different intervals.
2. **Duplicate API calls:** Both `useBilling()` and `useBillingCached()` fetch from `/api/billing/status` but maintain separate caches. Components using different hooks trigger redundant API calls.
3. **Three `clearBillingCache()` functions:** `use-billing.ts:328` clears 3 keys, `use-billing-cached.ts:245` clears 1 key. Clearing one doesn't clear the others.
4. **`useBillingCached()`** re-implements `useBilling()` with slightly different caching — it's a fork, not an extension.

**Impact:** Inconsistent UI state across components. User can see "Trial active" in the sidebar while seeing "Subscribe now" in the header. Redundant API calls waste bandwidth.

**Fix:** Consolidate into one hook. `useBilling()` becomes the single source. `useTrialStatus()` becomes a thin wrapper that derives its return value from `useBilling()`. Delete `useBillingCached()`.

---

### 10. Denormalized plan limits drift from config

**Files:**
- **Write path:** `lib/billing/webhook-handlers.ts` lines 229-230
- **Read path A:** `lib/billing/access-validation.ts` lines 137-138
- **Read path B:** `lib/billing/billing-status.ts` lines 58-62

**The write path (webhook handler):**
```typescript
// webhook-handlers.ts:229-230 — Writes config values to DB at webhook time
planCampaignsLimit: planConfig.limits.campaigns,
planCreatorsLimit: planConfig.limits.creatorsPerMonth,
```

**Read path A (access validation):**
```typescript
// access-validation.ts:137-138 — Reads from plan-config.ts directly
const planConfig = getPlanConfig(currentPlan);
const limit = planConfig.limits.campaigns;
```

**Read path B (billing status response):**
```typescript
// billing-status.ts:58-62 — Reads from plan-config.ts
const planConfig = getPlanConfig(currentPlan);
campaignsLimit = planConfig.limits.campaigns;
creatorsLimit = planConfig.limits.creatorsPerMonth;
```

**Why it's a problem:** The DB stores snapshot values from the last webhook. The validators read current config values. If you update `plan-config.ts` (e.g., increase Growth creators from 6,000 to 8,000), access validation immediately uses 8,000 while the DB still shows 6,000 until the next webhook fires for each user. Two sources of truth.

The DB values (`planCampaignsLimit`, `planCreatorsLimit`) are only consumed by the admin panel and some older code paths. The critical access checks already use `plan-config.ts` directly.

**Impact:** Low — the validators use the correct (config) values. But the denormalized DB fields create confusion and are a maintenance trap. If someone adds a feature that reads from the DB fields instead of config, they'll get stale data.

**Fix:** Stop writing `planCampaignsLimit` and `planCreatorsLimit` to the users table from the webhook handler. Always read from `plan-config.ts`. Remove the DB columns in a migration, or at minimum stop relying on them.

---

## Execution Priority

```
Tier 1 (fix now — users are affected):
  #1  Webhook plan change guard    — 15 min, surgical
  #2  Admin set-plan               — 5 min, two fields

Tier 2 (fix soon — security exposure):
  #3  TOCTOU race in legacy routes — 30 min, wrap in transactions
  #4  Image proxy SSRF             — 15 min, add domain allowlist
  #5  CSV public access            — 10 min, change to private + signed URLs

Tier 3 (fix next — UX / correctness):
  #6  Hardcoded billing data       — 30 min, needs schema migration
  #7  Division by zero             — 5 min, add zero check
  #8  Tautological WHERE           — 5 min, swap to isNotNull

Tier 4 (refactor — tech debt):
  #9  Consolidate billing hooks    — 2-3 hours, touches many components
  #10 Remove denormalized limits   — 1 hour, needs migration
```

---

## Files Changed by Previous Fixes (A-J) — Do Not Re-touch

These files were already modified in the business-logic-fixes batch. Any new fixes to these files should be aware of the changes:

```
lib/billing/usage-tracking.ts          # Fix A: tx parameter
app/api/campaigns/route.ts             # Fix A: atomic transaction
lib/billing/index.ts                   # Fix B: export incrementEnrichmentCount
lib/services/creator-enrichment.ts     # Fix B: call incrementEnrichmentCount
app/api/campaigns/can-create/route.ts  # Fix C: log metadata
lib/db/queries/list-queries.ts         # Fix D, E, F: stats tx, Zod, logger
lib/logging/constants.ts               # Fix F: LIST category
lib/logging/types.ts                   # Fix F: LIST category
app/api/campaigns/[id]/route.ts        # Fix G: remove creators from results
app/components/.../search-results.jsx  # Fix H, I: pagination reset, startIndex
app/components/.../CreatorTableView.tsx # Fix I: startIndex-aware blur
app/components/.../export-button.tsx   # Fix J: exponential backoff
```

Only **#1 (webhook handler)** overlaps — `lib/billing/webhook-handlers.ts` was NOT modified by the previous fixes, so no conflict.
