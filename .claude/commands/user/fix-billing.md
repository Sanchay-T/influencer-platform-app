---
description: Fix billing sync issues between Stripe and database
argument-hint: <email>
allowed-tools: Bash(node:*/fix-user-billing*.js*)
---

# Fix User Billing State

Synchronize billing state between Stripe and the local database. Fixes common billing sync issues where subscription status doesn't match between systems.

## Arguments

- `$1`: **[Required]** User email address

## Execution

Run the billing fix script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/fix-user-billing-state.js "$1"
```

## Output Analysis

Report:

1. **Current State**:
   - Database subscription status
   - Stripe subscription status
   - Discrepancies found

2. **Actions Taken**:
   - Updated subscription status
   - Synced plan information
   - Fixed billing dates
   - Corrected trial status

3. **Final State**:
   - New subscription status
   - Active plan
   - Next billing date
   - Sync verification

4. **Manual Steps**: Any manual intervention needed

## Example Usage

```
/user/fix-billing sanchay@example.com
```

## Common Issues Fixed

### Issue 1: Subscription Active in Stripe but Not in DB
**Fix**: Updates database to match Stripe status

### Issue 2: Trial Expired but Still Shows Active
**Fix**: Syncs trial expiration date and status

### Issue 3: Plan Mismatch
**Fix**: Updates plan in database to match Stripe subscription

### Issue 4: Missing Stripe Customer ID
**Fix**: Creates link between user and Stripe customer

## When To Use

- User reports billing issues
- Subscription status shows incorrectly
- After manual Stripe changes
- Post-migration billing verification
- Trial expiration not updating

## Related Commands

- `/user/inspect <email>` - Check billing state
- `/user/activate <email> <plan>` - Activate subscription
- `/test/subscription` - Test subscription system
