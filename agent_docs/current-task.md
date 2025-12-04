# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** Rebuild Billing & Onboarding System from Scratch
**Branch:** `feat/local-changes-backup`
**Status:** In Progress (Phase 3 mostly complete)
**Started:** Dec 5, 2025

## What You Did

### Created New `lib/billing/` Module (5 files, ~1,200 lines)

**1. `plan-config.ts`** (~200 lines)
- Plan definitions: glow_up, viral_surge, fame_flex (NO free plan)
- Price ID mappings from env vars
- Limit checking helpers
- Plan comparison utilities
- TRIAL_CONFIG: 7 days, card required

**2. `stripe-client.ts`** (~300 lines)
- Thin wrapper around Stripe SDK
- Methods: createCheckoutSession, retrieveSubscription, createPortalSession, constructWebhookEvent
- Single API version: '2025-06-30.basil'
- NO business logic - just API calls

**3. `subscription-service.ts`** (~400 lines)
- THE ONLY place that writes subscription state
- `handleSubscriptionChange()` - idempotent webhook handler
- `handleSubscriptionDeleted()` - keeps currentPlan, sets status to canceled
- `getBillingStatus()` - returns exact shape frontend expects
- `validateAccess()`, `validateCampaignCreation()`, `validateCreatorSearch()`
- Trial time calculations built-in

**4. `checkout-service.ts`** (~150 lines)
- `createOnboardingCheckout()` - new users with 7-day trial
- `createUpgradeCheckout()` - existing users, no trial
- `createCheckout()` - auto-detects which flow
- `verifyCheckoutSession()` - for success page

**5. `onboarding-service.ts`** (~250 lines)
- Step validation and processing
- Step order: pending → info_captured → intent_captured → plan_selected → completed
- Email queueing (welcome, abandonment)
- Status tracking

**6. `index.ts`** - Barrel export for clean imports

### Updated/Created API Routes

**1. `app/api/stripe/webhook/route.ts`** (REPLACED - ~230 lines, was 825+)
- Clean switch statement for events
- Uses SubscriptionService for all state changes
- Proper idempotency checking
- 400 for signature errors, 500 for processing errors

**2. `app/api/stripe/checkout/route.ts`** (NEW - ~100 lines)
- Unified checkout for onboarding and upgrades
- Request: `{ planId, billing }`
- Response: `{ url }` or `{ url, price, isUpgrade }`

**3. `app/api/stripe/portal/route.ts`** (NEW - ~80 lines)
- Creates Stripe Customer Portal session
- Request: `{ returnUrl? }`
- Response: `{ success, portalUrl, sessionId }`

**4. `app/api/billing/status/route.ts`** (REPLACED - ~180 lines, was 250+)
- Uses `getBillingStatus()` from new billing module
- Auto-creates user if not found
- Proper caching headers

## Key Architecture Decisions

1. **Webhook-first**: Stripe webhooks are THE ONLY writer of subscription state
2. **No free plan**: DB FK constraint enforces this; access via `subscriptionStatus` not `currentPlan`
3. **Single source of truth**: `lib/billing/` consolidates all billing/stripe/onboarding logic
4. **Idempotent handlers**: Same webhook can be processed multiple times safely

## Files Changed

**New files:**
- `lib/billing/plan-config.ts`
- `lib/billing/stripe-client.ts`
- `lib/billing/subscription-service.ts`
- `lib/billing/checkout-service.ts`
- `lib/billing/onboarding-service.ts`
- `lib/billing/index.ts`
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/portal/route.ts`

**Replaced:**
- `app/api/stripe/webhook/route.ts`
- `app/api/billing/status/route.ts`

## What's Left (Next Session)

### Still TODO:
1. **Test the implementation** - Run type check, lint, and test endpoints
2. **Update frontend** - Point to new `/api/stripe/checkout` route (currently uses `/api/stripe/create-checkout`)
3. **Delete old files** - 25+ files to remove after verification:
   - `lib/stripe/stripe-service.ts`, `mock-stripe.ts`, `unified-webhook-handler.ts`
   - `lib/services/billing-service.ts`, `plan-validator.ts`, `trial-status-calculator.ts`
   - `lib/onboarding/flow.ts`, `finalize-onboarding.ts`, `email-hooks.ts`, `stripe-guard.ts`
   - `lib/trial/trial-service.ts`
   - Multiple `app/api/stripe/` routes (create-checkout, checkout-success, upgrade, etc.)
4. **Update agent_docs** - billing-stripe.md, onboarding-flow.md

### Clarification:
- Onboarding is a **modal overlay** on `/dashboard`, NOT separate pages
- The existing `/api/onboarding/step-1`, `step-2` routes are used by the modal
- These routes should be updated to use new `OnboardingService` but are NOT blocking

## Line Count Comparison

| Area | Before | After |
|------|--------|-------|
| lib/stripe/ | ~1,400 lines | 0 (moved to lib/billing/) |
| lib/services/billing* | ~700 lines | 0 (consolidated) |
| lib/billing/ | 0 | ~1,200 lines |
| API routes | ~2,000 lines | ~600 lines |
| **Total** | ~4,100 lines | ~1,800 lines |

~55% reduction in code, single source of truth, cleaner architecture.
