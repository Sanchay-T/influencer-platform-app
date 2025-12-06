---
description: Test subscription and billing system end-to-end
argument-hint:
allowed-tools: Bash(node:*/test-subscription*.js*), Bash(tsx:*/test-billing*.ts*)
---

# Test Subscription System

Run end-to-end tests of the subscription and billing system including trial creation, upgrades, downgrades, and cancellations.

## Arguments

None required. Runs complete test suite.

## Execution

Run the subscription test:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/test-subscription-system.js
```

## Output Analysis

Report on each test:

1. **Trial Creation**:
   - User can start trial
   - Trial period set correctly
   - Trial expiration date accurate
   - Usage limits applied

2. **Plan Activation**:
   - Plans available in system
   - Plan selection works
   - Stripe subscription created
   - Database synced correctly

3. **Upgrade Flow**:
   - User can upgrade plan
   - Prorated billing calculated
   - Features updated immediately
   - Usage limits increased

4. **Downgrade Flow**:
   - User can downgrade
   - Change effective at period end
   - Usage limits handled
   - Refund calculated

5. **Cancellation**:
   - User can cancel subscription
   - Access continues until period end
   - Status updated correctly
   - No future charges

6. **Trial Expiration**:
   - Trial expires on time
   - Access restricted appropriately
   - User prompted to upgrade
   - Grace period handling

7. **Webhook Processing**:
   - Stripe webhooks received
   - Events processed correctly
   - Database updated
   - Errors logged

8. **Billing Sync**:
   - Stripe and DB in sync
   - Payment failures handled
   - Retry logic works
   - Customer portal access

## Example Usage

```
/test/subscription
```

## Test Scenarios Covered

### Positive Tests:
- New user trial signup
- Trial to paid conversion
- Plan upgrade mid-cycle
- Plan downgrade scheduling
- Successful payment processing
- Subscription renewal

### Negative Tests:
- Payment failure handling
- Invalid plan selection
- Expired trial access
- Over-limit usage
- Webhook replay attacks
- Concurrent updates

### Edge Cases:
- Trial extension
- Multiple plan changes
- Immediate cancellation
- Refund processing
- Failed payment recovery

## Success Criteria

All tests should:
- Complete without errors
- Maintain data consistency
- Handle edge cases properly
- Sync with Stripe correctly
- Log events appropriately

## Common Issues

### Issue 1: Webhook Not Received
**Solution**: Check webhook endpoint configuration in Stripe, verify `/logs/diagnose-webhook`

### Issue 2: Billing Mismatch
**Solution**: Run `/user/fix-billing <email>` to resync

### Issue 3: Trial Not Expiring
**Solution**: Check trial expiration logic and scheduled jobs

### Issue 4: Payment Failure Not Handled
**Solution**: Review payment failure webhook handling

## What Gets Tested

- Database operations
- Stripe API integration
- Webhook processing
- State transitions
- Error handling
- Email notifications
- Usage limit enforcement
- Proration calculations

## Related Commands

- `/user/activate <email> <plan>` - Manual activation
- `/user/fix-billing <email>` - Fix billing sync
- `/db/seed-plans` - Ensure plans exist
- `/test/webhook/clerk` - Test webhook system
- `/logs/diagnose-webhook` - Debug webhook issues
