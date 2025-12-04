# Onboarding Flow

This document describes the 4-step onboarding process. Read this when working on signup or onboarding.

## Step Order

```
info_captured → intent_captured → plan_selected → completed
```

Defined in `lib/onboarding/schemas.ts` as `OnboardingStepOrder`.

---

## UI Flow

| Step | What Happens |
|------|--------------|
| 1. info_captured | User enters name + business name |
| 2. intent_captured | User describes brand preferences |
| 3. plan_selected | User selects plan → Stripe checkout |
| 4. completed | Success screen → Dashboard |

All plans include 7-day free trial.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/onboarding/schemas.ts` | Step order, validation schemas |
| `lib/onboarding/flow.ts` | State transitions, event recording |
| `lib/onboarding/finalize-onboarding.ts` | Completes onboarding after Stripe |
| `lib/onboarding/email-hooks.ts` | Welcome/abandonment emails |
| `app/onboarding/complete/page.tsx` | Success page after checkout |

---

## State Machine

Steps must happen in order. Use `assertStepOrder()` from `lib/onboarding/schemas.ts` to validate transitions.

---

## Stripe Integration

1. User clicks "Start Checkout" on step 3
2. Backend creates Stripe Checkout Session
3. User pays on Stripe
4. Webhook fires `checkout.session.completed`
5. `finalizeOnboarding()` runs

---

## Trial System

- 7-day trial on all plans
- Managed by Stripe subscription
- Status tracked in `user_subscriptions.trialStatus`

Trial statuses: `pending` | `active` | `expired` | `converted` | `cancelled`

---

## To Explore

When working on onboarding:
1. Read `lib/onboarding/schemas.ts` for step definitions
2. Read `lib/onboarding/finalize-onboarding.ts` for completion logic
3. Check `app/onboarding/` for UI pages
4. Check `app/api/webhooks/stripe/route.ts` for webhook handling
