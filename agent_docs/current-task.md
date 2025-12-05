# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** Rebuild Billing & Onboarding System from Scratch
**Branch:** `feat/local-changes-backup`
**Status:** Cleanup Complete - Ready for Testing
**Started:** Dec 5, 2025

## What You Did (This Session)

### Completed Phase 4: Delete Old Files & Fix Imports

**Deleted old lib/ files:**
- `lib/stripe/stripe-service.ts`, `mock-stripe.ts`, `unified-webhook-handler.ts`
- `lib/services/billing-service.ts`, `plan-validator.ts`, `plan-enforcement.ts`, `trial-status-calculator.ts`
- `lib/onboarding/flow.ts`, `finalize-onboarding.ts`, `email-hooks.ts`, `stripe-guard.ts`
- `lib/trial/` entire directory

**Kept:**
- `lib/stripe/stripe-env-validator.js` (utility)
- `lib/stripe/stripe-client.ts` (recreated - client-side Stripe.js loader)
- `lib/onboarding/schemas.ts` (step definitions)

**Deleted old API routes:**
- `app/api/stripe/checkout-success/`, `checkout-upgrade/`, `convert-now/`
- `app/api/stripe/create-checkout/`, `create-subscription/`, `customer-portal/`
- `app/api/stripe/save-payment-method/`, `session/`, `setup-intent/`
- `app/api/stripe/upgrade-direct/`, `upgrade/`
- `app/api/onboarding/complete/`, `save-plan/`, `step-1/`, `step-2/`
- `app/api/billing/sync-stripe/`
- `app/api/debug/automation/upgrade-plan/`, `trial-testing/`
- `app/api/usage/summary/`

**Deleted old test files:**
- `scripts/test-billing-upgrade-flow.ts`, `test-simple-upgrade-flow.ts`
- `scripts/test-user-profile.ts`, `test-webhook-handler.ts`, `test-onboarding-e2e.ts`
- `testing/api-suite/runners/onboarding.ts`
- `lib/test-utils/subscription-test.ts`

**Fixed imports in:**
- `app/api/campaigns/can-create/route.ts` → uses `validateCampaignCreation` from `@/lib/billing`
- `app/api/campaigns/route.ts` → uses `validateCampaignCreation` and `incrementUsage`
- `app/api/scraping/*.ts` routes → updated to use `@/lib/billing`
- `app/api/profile/route.ts` → uses `getBillingStatus` from `@/lib/billing`
- `lib/dashboard/overview.ts` → uses `getBillingStatus`
- `lib/search-engine/job-service.ts` → uses `incrementUsage` from user-queries

## Current File Structure

### New Billing Module (`lib/billing/`)
```
lib/billing/
├── index.ts          # Barrel export
├── plan-config.ts    # Plan definitions, limits, price IDs
├── stripe-client.ts  # Server-side Stripe SDK wrapper
├── subscription-service.ts  # Webhook handling, billing status
├── checkout-service.ts      # Checkout session creation
└── onboarding-service.ts    # Step validation, emails
```

### Remaining API Routes (`app/api/stripe/`)
```
app/api/stripe/
├── checkout/route.ts   # Unified checkout (new/upgrade)
├── portal/route.ts     # Customer portal
└── webhook/route.ts    # Webhook handler
```

### Kept Files
```
lib/stripe/stripe-client.ts      # Client-side Stripe.js loader
lib/stripe/stripe-env-validator.js
lib/onboarding/schemas.ts        # Step definitions
```

## What's Left

### Frontend Updates Needed:
1. Update checkout calls to use `/api/stripe/checkout` (was `/api/stripe/create-checkout`)
2. The frontend may need to be updated to match the new response shape

### Testing Needed:
1. Run full type check (clean build)
2. Test onboarding flow end-to-end
3. Test webhook handling
4. Test billing status endpoint

## Key Architecture

1. **Webhook-first**: Stripe webhooks write subscription state
2. **No free plan**: DB FK constraint, access via `subscriptionStatus`
3. **Single source of truth**: `lib/billing/` for all billing logic
4. **Idempotent handlers**: Safe to process webhooks multiple times

## Line Count Summary

| Area | Before | After |
|------|--------|-------|
| Old lib/ files | ~3,500 lines | 0 (deleted) |
| lib/billing/ | 0 | ~1,200 lines |
| API routes | ~2,000 lines | ~600 lines |
| **Net Change** | ~5,500 lines | ~1,800 lines |

**~67% reduction in billing-related code.**
