---
description: Diagnose webhook delivery and processing issues
argument-hint: [service]
allowed-tools: Bash(node:*/diagnose-webhook*.js*), Read
---

# Diagnose Webhook Issues

Analyze webhook delivery and processing for Stripe, Clerk, and other services. Identifies webhook failures and configuration issues.

## Arguments

- `$1`: **[Optional]** Service to diagnose (stripe/clerk/all) - defaults to all

## Execution

Run webhook diagnostics:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/diagnose-webhook.js ${1:-all}
```

## Output Analysis

Report on webhook health:

1. **Webhook Configuration**:
   - Endpoint URLs configured
   - Webhook secrets present
   - HTTPS requirement met
   - Signing validation enabled

2. **Recent Webhook Events**:
   For each service:
   - Total events received
   - Successful processing count
   - Failed processing count
   - Latest event timestamp

3. **Stripe Webhooks**:
   - Events monitored
   - Success rate
   - Common failures
   - Retry status
   - Recent events:
     - checkout.session.completed
     - customer.subscription.created
     - customer.subscription.updated
     - customer.subscription.deleted
     - invoice.payment_succeeded
     - invoice.payment_failed

4. **Clerk Webhooks**:
   - Events monitored
   - Success rate
   - Common failures
   - Recent events:
     - user.created
     - user.updated
     - user.deleted
     - session.created
     - session.ended

5. **Issues Detected**:
   - Missing webhook secrets
   - Signature validation failures
   - Processing errors
   - Duplicate event processing
   - Timeout errors
   - Replay attacks

6. **Recommendations**:
   - Configuration fixes needed
   - Error handling improvements
   - Performance optimizations

## Example Usage

```
/logs/diagnose-webhook
/logs/diagnose-webhook stripe
/logs/diagnose-webhook clerk
```

## Webhook Health Indicators

### Healthy Webhook:
- ✅ Events received regularly
- ✅ 95%+ success rate
- ✅ Signature validation passing
- ✅ Processing time < 3s
- ✅ No duplicate processing

### Unhealthy Webhook:
- ❌ No events received
- ❌ High failure rate
- ❌ Signature validation failing
- ❌ Timeout errors
- ❌ Duplicate processing

## Common Issues

### Issue 1: No Webhooks Received
**Symptoms**: Zero events in logs
**Causes**:
- Webhook not configured in service dashboard
- Wrong endpoint URL
- Firewall blocking requests
- Development server not running

**Solutions**:
1. Verify webhook URL in Stripe/Clerk dashboard
2. Use `/dev/ngrok` for local testing
3. Check endpoint is accessible publicly
4. Review service dashboard for delivery attempts

### Issue 2: Signature Validation Failing
**Symptoms**: 400 errors, "Invalid signature"
**Causes**:
- Wrong webhook secret
- Secret not set in environment
- Request body modified before validation

**Solutions**:
1. Verify STRIPE_WEBHOOK_SECRET / CLERK_WEBHOOK_SECRET
2. Check `.env.local` has correct values
3. Ensure raw body parsing for webhooks

### Issue 3: Webhooks Timing Out
**Symptoms**: Service retrying webhooks, timeout errors
**Causes**:
- Slow processing logic
- External API calls in webhook handler
- Database queries too slow

**Solutions**:
1. Optimize webhook handler performance
2. Move slow operations to background jobs
3. Return 200 quickly, process async

### Issue 4: Duplicate Event Processing
**Symptoms**: Same event processed multiple times
**Causes**:
- No idempotency key checking
- Race conditions
- Retry logic issues

**Solutions**:
1. Implement idempotency checking
2. Store processed event IDs
3. Add database constraints

### Issue 5: Events Processed Out of Order
**Symptoms**: State inconsistencies, data issues
**Causes**:
- Webhook retries
- Network delays
- Async processing

**Solutions**:
1. Use event timestamps for ordering
2. Implement state machine
3. Handle out-of-order events gracefully

## Webhook Best Practices

1. **Always validate signatures** - Prevent spoofed webhooks
2. **Return 200 quickly** - Avoid timeouts and retries
3. **Process async** - Move heavy work to background
4. **Implement idempotency** - Prevent duplicate processing
5. **Log everything** - Essential for debugging
6. **Handle failures gracefully** - Retry logic
7. **Monitor webhook health** - Set up alerts

## Testing Webhooks Locally

1. Start ngrok: `/dev/ngrok`
2. Copy public URL
3. Configure webhook in service dashboard
4. Trigger event in service (e.g., test subscription)
5. Check logs: `/logs/api webhook`
6. Diagnose issues: `/logs/diagnose-webhook`

## Webhook Endpoints

- **Stripe**: `/api/webhooks/stripe`
- **Clerk**: `/api/webhooks/clerk`

## Related Commands

- `/dev/ngrok` - Enable webhook testing locally
- `/logs/api webhook` - View webhook logs
- `/test/subscription` - Trigger test webhooks
- `/dev/check-env` - Verify webhook secrets
- `/user/fix-billing` - Fix billing sync from webhooks
