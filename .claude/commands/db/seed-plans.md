---
description: Sync subscription plans from Stripe to database
argument-hint:
allowed-tools: Bash(node:*/seed-subscription-plans*.js*), Bash(node:*/seed-plans*.js*)
---

# Seed Subscription Plans

Synchronize subscription plans from Stripe to the local database. This ensures plan information, pricing, and features are up-to-date.

## Arguments

None required. Script automatically fetches from Stripe.

## Execution

Run the seeding script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/seed-subscription-plans.js
```

## Output Analysis

Report:

1. **Plans Synced**:
   - Plan names and IDs
   - Pricing information
   - Feature limits
   - Trial periods

2. **Changes Made**:
   - New plans added
   - Existing plans updated
   - Deprecated plans marked
   - Price changes

3. **Verification**:
   - Total plans in database
   - Stripe sync status
   - Any sync errors

4. **Available Plans**:
   - List all active plans
   - Features per plan
   - Pricing tiers

## Example Usage

```
/db/seed-plans
```

## When To Use

- After creating new plans in Stripe
- After updating plan pricing
- During initial setup
- After database reset
- When plans out of sync
- Before testing subscription flows

## What Gets Synced

- Plan names and descriptions
- Monthly/yearly pricing
- Feature limits (searches, campaigns, lists)
- Trial period configuration
- Plan status (active/archived)
- Stripe product and price IDs

## Common Issues

### Issue 1: Stripe API Key Missing
**Solution**: Verify STRIPE_SECRET_KEY in environment. Run `/dev/check-env`.

### Issue 2: Plans Not Appearing
**Solution**: Check Stripe dashboard for plan status. Ensure plans are active.

### Issue 3: Price Mismatch
**Solution**: Re-run seed-plans to sync latest pricing from Stripe.

## Related Commands

- `/dev/check-env` - Verify Stripe credentials
- `/user/activate <email> <plan>` - Activate plan for user
- `/test/subscription` - Test subscription system
- `/db/inspect` - View database state
