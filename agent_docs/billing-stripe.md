# Billing & Stripe Integration

This document covers plans, trials, subscriptions, and webhook handling. Read this when working on billing features.

## Plans

| Plan | Monthly | Campaigns | Creators/month |
|------|---------|-----------|----------------|
| `glow_up` | $99 | 3 | 1,000 |
| `viral_surge` | $249 | 10 | 10,000 |
| `fame_flex` | $499 | Unlimited | Unlimited |

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/stripe/stripe-service.ts` | Stripe API wrapper (plan mapping, subscriptions) |
| `lib/stripe/mock-stripe.ts` | Mock for development |
| `lib/services/plan-validator.ts` | Plan limit enforcement — **read this for limit checks** |
| `lib/trial/trial-service.ts` | Trial status calculation |
| `app/api/webhooks/stripe/route.ts` | Webhook handler |

---

## Database Tables

User billing data is split across normalized tables:

| Table | Key Fields |
|-------|------------|
| `user_subscriptions` | currentPlan, trialStatus, trialEndDate, subscriptionStatus |
| `user_billing` | stripeCustomerId, stripeSubscriptionId, cardLast4 |
| `user_usage` | usageCampaignsCurrent, usageCreatorsCurrentMonth |

See `lib/db/schema.ts` for full schema.

---

## Trial Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `active` | In trial period |
| `expired` | Trial ended |
| `converted` | Now paying |
| `cancelled` | Cancelled during trial |

---

## Plan Validation

Before creating campaigns or running searches, use `PlanValidator`:

| Method | Purpose |
|--------|---------|
| `validateCampaignCreation(userId)` | Check if user can create a campaign |
| `validateCreatorSearch(userId, count)` | Check if user can run a search |
| `getUserPlanStatus(userId)` | Get full plan status |
| `incrementUsage(userId, type, amount)` | Track usage after operation |

See `lib/services/plan-validator.ts` for implementation and `PLAN_CONFIGS` defaults.

---

## Webhook Events

The webhook handler at `app/api/webhooks/stripe/route.ts` handles:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`

---

## To Explore

When working on billing:
1. Read `lib/services/plan-validator.ts` for limit enforcement logic
2. Read `lib/stripe/stripe-service.ts` for Stripe API calls
3. Read `lib/trial/trial-service.ts` for trial calculations
4. Check `lib/db/queries/user-queries.ts` for `getUserProfile()` which joins all billing tables
