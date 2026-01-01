# Onboarding & Billing System Audit

> **Purpose:** Complete audit of the current onboarding and billing architecture, identifying all issues and recommendations for a proper implementation.
>
> **Date:** January 1, 2026
> **Status:** Needs Refactoring

---

## Business Logic

```
1. User signs up via Clerk
2. User MUST complete onboarding:
   - Step 1: Enter name + business name
   - Step 2: Describe brand preferences
   - Step 3: Select plan (glow_up, viral_surge, fame_flex) → Stripe Checkout
   - Step 4: Success → Dashboard
3. All plans include 7-day free trial (card required)
4. After 7 days, Stripe auto-charges the card
5. User becomes paid subscriber on selected plan
6. NO FREE PLAN - everyone must select and pay for a plan
```

---

## Current Architecture

### Database Tables

**`users`**
| Column | Type | Purpose |
|--------|------|---------|
| `onboarding_step` | varchar | `'pending'`, `'info_captured'`, `'intent_captured'`, `'completed'` |

**`user_subscriptions`**
| Column | Type | Purpose |
|--------|------|---------|
| `current_plan` | varchar | Active plan (`'glow_up'`, `'viral_surge'`, `'fame_flex'`) |
| `intended_plan` | varchar | Plan selected before checkout |
| `subscription_status` | varchar | `'none'`, `'trialing'`, `'active'`, `'past_due'`, `'canceled'`, `'unpaid'` |
| `trial_status` | varchar | `'pending'`, `'active'`, `'expired'`, `'converted'`, `'cancelled'` |
| `trial_start_date` | timestamp | When trial began |
| `trial_end_date` | timestamp | When trial ends |
| `billing_sync_status` | varchar | `'pending'`, `'plan_selected'`, `'checkout_upgraded'`, etc. |

**`user_billing`**
| Column | Type | Purpose |
|--------|------|---------|
| `stripe_customer_id` | text | Stripe customer ID |
| `stripe_subscription_id` | text | Stripe subscription ID |

### Key Files

| File | Purpose |
|------|---------|
| `lib/billing/plan-config.ts` | Plan definitions, trial config (7 days) |
| `lib/billing/checkout-service.ts` | Creates Stripe checkout session |
| `lib/billing/stripe-client.ts` | Stripe API wrapper |
| `lib/billing/webhook-handlers.ts` | Processes Stripe webhooks |
| `lib/billing/billing-status.ts` | Returns billing info to frontend |
| `lib/billing/trial-utils.ts` | Trial time calculations |
| `lib/billing/access-validation.ts` | Checks if user can access features |
| `app/api/stripe/webhook/route.ts` | Webhook endpoint |
| `app/api/stripe/checkout/route.ts` | Checkout session endpoint |
| `app/api/billing/status/route.ts` | Billing status API |
| `app/onboarding/success/page.tsx` | Post-checkout success page |
| `app/components/trial/trial-sidebar-compact.tsx` | Trial status in sidebar |

### Stripe Webhooks Handled

| Event | Handler | Action |
|-------|---------|--------|
| `checkout.session.completed` | `handleCheckoutCompleted()` | Marks onboarding complete, sets trial active |
| `customer.subscription.created` | `handleSubscriptionChange()` | Updates subscription state |
| `customer.subscription.updated` | `handleSubscriptionChange()` | **Handles trial→paid conversion** |
| `customer.subscription.deleted` | `handleSubscriptionDeleted()` | Sets status to canceled |
| `customer.subscription.trial_will_end` | Logs only | **Not implemented** |
| `invoice.payment_succeeded` | Logs only | **Not implemented** |
| `invoice.payment_failed` | Logs only | **Not implemented** |

### Current Flow

```
ONBOARDING:
  1. User selects plan → POST /api/stripe/checkout
  2. CheckoutService creates Stripe session (trial_period_days=7)
  3. User completes Stripe checkout (enters card)
  4. Stripe sends: checkout.session.completed webhook
  5. Webhook updates DB: onboarding_step='completed', trial_status='active', subscription_status='trialing'
  6. Success page polls /api/onboarding/status until completed
  7. User redirected to dashboard

TRIAL END (Day 7):
  8. Stripe automatically charges card
  9. Stripe sends: customer.subscription.updated (status='active')
  10. Webhook updates DB: subscription_status='active', trial_status='converted'
  11. User is now paid subscriber
```

---

## Problems Identified

### Problem 1: Local State Diverges from Stripe

```
Your DB says:           Stripe says:
trial_status='active'   subscription.status='canceled'
```

No reconciliation exists. Once they drift, they stay drifted forever.

**Evidence:** Found 12 users in production with `trial_status='active'` but `trial_end_date` in the past.

### Problem 2: Too Many Status Fields

```sql
users.onboarding_step              -- 4 possible values
user_subscriptions.trial_status    -- 5 possible values
user_subscriptions.subscription_status  -- 6 possible values
user_subscriptions.billing_sync_status  -- 5+ possible values
```

**Total combinations:** 4 × 5 × 6 × 5 = 600+ possible states. Most are invalid but possible to create.

### Problem 3: Webhook Dependency Without Fallback

```
User completes Stripe checkout
  → Webhook should fire
  → But webhook can fail/delay/timeout
  → User stuck on "Activating your plan..." forever
  → 60s timeout is a band-aid, not a fix
```

### Problem 4: No Single Source of Truth

Who's authoritative for "is this user paying?"
- Stripe? (yes, but we don't query it)
- `subscription_status`? (can be stale)
- `trial_status`? (can be stale)
- `onboarding_step`? (different concern entirely)

### Problem 5: trial_status Never Gets Updated

The `trial_status` field is set to `'active'` when trial starts, but **nothing** updates it to `'expired'` when:
- Trial end date passes without payment
- User never completed Stripe checkout
- Webhook is missed

### Problem 6: Abandoned Checkout Creates Broken State

User flow:
1. Selects plan → `intended_plan='glow_up'`, `billing_sync_status='plan_selected'`
2. Redirected to Stripe checkout
3. Closes browser / abandons
4. **Result:** User stuck in limbo forever

Current state for abandoned user:
```
onboarding_step = 'intent_captured'
subscription_status = 'none'
trial_status = 'active' (but expired!)
billing_sync_status = 'plan_selected'
```

---

## All Possible Scenarios

### Phase 1: Onboarding

| Case | Scenario | Current Handling | Ideal Handling |
|------|----------|------------------|----------------|
| 1A | Completes Step 1, abandons | Shows modal on next login | ✅ OK |
| 1B | Completes Step 2, abandons | Shows modal on next login | ✅ OK |
| 1C | Selects plan, abandons Stripe | Stuck forever | Show modal, retry checkout |
| 1D | Completes checkout | Webhook updates DB | ✅ OK |
| 1E | Card declined at checkout | Stripe shows error | ✅ OK (Stripe handles) |
| 1F | Webhook fails/delayed | 60s timeout, then allow | Query Stripe as fallback |

### Phase 2: During Trial (Days 1-7)

| Case | Scenario | Current Handling | Ideal Handling |
|------|----------|------------------|----------------|
| 2A | Active trial | Full access | ✅ OK |
| 2B | Upgrade during trial | Stripe Portal | ✅ OK |
| 2C | Cancel during trial | Stripe Portal | ✅ OK |
| 2D | Trial ending in 3 days | Nothing | Send email reminder |
| 2E | Trial ending tomorrow | Nothing | Send urgent email |

### Phase 3: Trial End (Day 7)

| Case | Scenario | Current Handling | Ideal Handling |
|------|----------|------------------|----------------|
| 3A | Card charged successfully | Webhook updates status | ✅ OK |
| 3B | Card declined | Logs only | Send email, show banner |
| 3C | All retries fail | Nothing | Block access, show update payment screen |

### Phase 4: Active Subscription

| Case | Scenario | Current Handling | Ideal Handling |
|------|----------|------------------|----------------|
| 4A | Monthly renewal success | Webhook updates | ✅ OK |
| 4B | Monthly renewal failed | Logs only | Email + banner + grace period |
| 4C | User cancels | Webhook updates | ✅ OK |
| 4D | Card expires | Nothing | Email to update card |

### Phase 5: Edge Cases (Broken States)

| Case | Scenario | Current Handling | Ideal Handling |
|------|----------|------------------|----------------|
| 5A | Selected plan, never paid, trial "expired" | Shows "Active" forever | Block access, redirect to checkout |
| 5B | Webhook never arrived | User stuck | Query Stripe as fallback |
| 5C | Duplicate subscriptions | Nothing | Alert admin, cleanup |
| 5D | State drift (DB ≠ Stripe) | Nothing | Hourly reconciliation job |

---

## Specific Bugs Found

### Bug 1: Expired Trials Show "Active"

**Query to find affected users:**
```sql
SELECT u.email, s.trial_status, s.trial_end_date, s.subscription_status
FROM users u
JOIN user_subscriptions s ON u.id = s.user_id
WHERE s.trial_status = 'active'
  AND s.trial_end_date < NOW();
```

**Production result:** 12 users affected

**Root cause:** `getBillingStatus()` trusts `trial_status` from DB without checking `trial_end_date`

### Bug 2: Success Page Stuck on "Activating your plan..."

**File:** `app/onboarding/success/page.tsx`

**Problem:** If no `session_id` in URL, page never polls for webhook completion.

**Fixed:** Commit `3f23c3845` - Now checks user status first, redirects if needed.

### Bug 3: Abandoned Checkout Users Stuck Forever

**Example user:** `accounts+appsumotest@usegemz.io`

**State:**
```
onboarding_step = 'intent_captured'
subscription_status = 'none'
trial_status = 'active' (stale)
trial_end_date = 2025-10-09 (expired)
billing_sync_status = 'plan_selected'
```

**Root cause:** Selected plan but never completed Stripe checkout. No mechanism to detect or recover.

---

## Comparison to Industry Best Practices

### Current Architecture: 6/10

| Aspect | Current | Best Practice |
|--------|---------|---------------|
| Source of truth | Local DB (can drift) | Stripe API |
| Status fields | 4 (confusing) | 2 (simple) |
| Webhook failure handling | 60s timeout | Query Stripe as fallback |
| State reconciliation | None | Hourly job |
| Invalid states possible | Yes (600+ combinations) | No (state machine) |
| Will accumulate broken users | Yes | No |

### What Top SaaS Companies Do

**1. Stripe is the ONLY source of truth**
- Don't store billing state locally, or treat it as cache
- Always query Stripe API for authoritative state

**2. Webhook + Reconciliation**
- Webhooks update local cache in real-time
- Background job runs hourly to sync Stripe → DB
- Detects and fixes drift automatically

**3. Derived State, Not Stored State**
- Don't store `trial_status` - calculate it from `subscription_status` + `trial_end_date`
- Fewer fields = fewer ways to be inconsistent

**4. Explicit State Machine**
- Only valid transitions allowed
- Invalid states impossible by design

---

## Recommended Architecture

### Simplified Status Fields

**REMOVE:**
- `trial_status` (derive from subscription_status + trial_end_date)
- `billing_sync_status` (debugging only, not for logic)

**KEEP:**
```sql
onboarding_step      -- 'pending' | 'completed' (just 2 values)
subscription_status  -- mirrors Stripe: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled'
trial_end_date       -- from Stripe
```

### Derive Trial Status

```typescript
function getEffectiveTrialStatus(user: UserSubscription): TrialStatus {
  if (user.subscriptionStatus === 'trialing') {
    return user.trialEndDate > new Date() ? 'active' : 'expired';
  }
  if (user.subscriptionStatus === 'active') {
    return 'converted';
  }
  if (user.subscriptionStatus === 'canceled') {
    return 'cancelled';
  }
  // No Stripe subscription
  if (user.trialEndDate && user.trialEndDate < new Date()) {
    return 'expired';
  }
  return 'none';
}
```

### Add Stripe Fallback on Success Page

```typescript
// If webhook hasn't arrived after 10 seconds, query Stripe directly
const session = await stripe.checkout.sessions.retrieve(sessionId);

if (session.payment_status === 'paid' && session.subscription) {
  // Webhook may not have arrived, but Stripe confirms payment
  await updateUserFromStripeSession(session);
}
```

### Add Reconciliation Job

```typescript
// Run every hour via cron/QStash
async function reconcileStripeSubscriptions() {
  const usersWithStripe = await db.getUsersWithStripeCustomerId();

  for (const user of usersWithStripe) {
    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      limit: 1,
    });

    const stripeStatus = subs.data[0]?.status ?? 'none';

    if (user.subscriptionStatus !== stripeStatus) {
      logger.warn('State drift detected', {
        userId: user.id,
        db: user.subscriptionStatus,
        stripe: stripeStatus
      });
      await db.updateSubscriptionStatus(user.id, stripeStatus);
    }
  }
}
```

### Ideal State Machine

```
ONBOARDING:
  pending
    → info_captured
    → intent_captured
    → [Stripe Checkout]
    → completed

SUBSCRIPTION (mirrors Stripe):
  none
    → trialing (checkout completed)
    → active (trial converted OR payment succeeded)
    → past_due (payment failed)
    → canceled (user canceled OR payment permanently failed)

ACCESS DECISION (simple):
  if (subscription_status === 'trialing' || subscription_status === 'active') {
    return ALLOW;
  }
  return BLOCK;
```

---

## Implementation Priorities

### P0: Critical Fixes (Do Now)

| Task | Effort | Impact |
|------|--------|--------|
| Calculate `trial_status` dynamically in `getBillingStatus()` | 30 min | Fixes "Active" showing for expired trials |
| Block access for `subscription_status='none'` after trial end | 30 min | Prevents unauthorized access |
| Fix abandoned checkout users (redirect to checkout) | 1 hr | Unblocks stuck users |

### P1: Important (Next Sprint)

| Task | Effort | Impact |
|------|--------|--------|
| Add Stripe fallback on success page | 2 hrs | Handles webhook failures |
| Send trial ending reminder emails (3 days, 1 day) | 3 hrs | Reduces churn |
| Handle `invoice.payment_failed` webhook | 2 hrs | Notifies users of failed payments |
| Show "Payment failed" banner in UI | 2 hrs | User awareness |

### P2: Proper Architecture (Future Sprint)

| Task | Effort | Impact |
|------|--------|--------|
| Remove `trial_status` field, derive dynamically | 4 hrs | Eliminates state drift |
| Add hourly reconciliation job | 4 hrs | Auto-fixes drift |
| Simplify to 2 status fields | 8 hrs | Cleaner architecture |
| Add explicit state machine validation | 4 hrs | Prevents invalid states |

### P3: Nice to Have

| Task | Effort | Impact |
|------|--------|--------|
| Event sourcing for billing events | 16 hrs | Full audit trail |
| Real-time subscription updates via Supabase | 4 hrs | Instant UI updates |
| Admin dashboard for billing issues | 8 hrs | Easier debugging |

---

## Quick Fix: Patch `getBillingStatus()`

**File:** `lib/billing/billing-status.ts`

**Change:**
```typescript
// Line 38-41, change from:
const trialTime = calculateTrialTime(user.trialStartDate, user.trialEndDate);
const isTrialing = user.trialStatus === 'active' && user.subscriptionStatus !== 'active';

// To:
const trialTime = calculateTrialTime(user.trialStartDate, user.trialEndDate);

// Override if trial expired but DB wasn't updated
let effectiveTrialStatus = user.trialStatus as TrialStatus;
if (effectiveTrialStatus === 'active' && trialTime.isExpired) {
  effectiveTrialStatus = 'expired';
}

const isTrialing = effectiveTrialStatus === 'active' && user.subscriptionStatus !== 'active';

// Also update return value to use effectiveTrialStatus:
return {
  // ...
  trialStatus: effectiveTrialStatus,
  // ...
};
```

---

## SQL: Find All Broken Users

```sql
-- Users with expired trials still showing active
SELECT u.email, s.trial_status, s.trial_end_date, s.subscription_status, s.billing_sync_status
FROM users u
JOIN user_subscriptions s ON u.id = s.user_id
WHERE s.trial_status = 'active'
  AND s.trial_end_date < NOW()
ORDER BY s.trial_end_date DESC;

-- Users who selected plan but never completed checkout
SELECT u.email, u.onboarding_step, s.intended_plan, s.subscription_status, s.billing_sync_status
FROM users u
JOIN user_subscriptions s ON u.id = s.user_id
WHERE s.intended_plan IS NOT NULL
  AND s.subscription_status = 'none'
  AND u.onboarding_step != 'completed';

-- Users with no Stripe subscription but claiming active
SELECT u.email, s.subscription_status, b.stripe_subscription_id
FROM users u
JOIN user_subscriptions s ON u.id = s.user_id
LEFT JOIN user_billing b ON u.id = b.user_id
WHERE s.subscription_status IN ('trialing', 'active')
  AND b.stripe_subscription_id IS NULL;
```

---

## References

- **Stripe Subscription Lifecycle:** https://stripe.com/docs/billing/subscriptions/overview
- **Stripe Webhook Events:** https://stripe.com/docs/api/events/types
- **Best Practices for Webhooks:** https://stripe.com/docs/webhooks/best-practices

---

*Last Updated: January 1, 2026*
