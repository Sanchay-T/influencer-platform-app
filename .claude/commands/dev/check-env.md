---
description: Validate environment variables and API keys
argument-hint:
allowed-tools: Bash(node:*/check-env*.js*)
---

# Check Environment Configuration

Validate that all required environment variables are set and API credentials are working. Essential before running tests or deployment.

## Arguments

None required. Checks all environment variables.

## Execution

Run the environment check:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/check-env.js
```

## Output Analysis

Report on each category:

1. **Database Configuration**:
   - `DATABASE_URL`: Set and valid
   - Connection test: Success/failure
   - Database accessible

2. **Authentication**:
   - `CLERK_SECRET_KEY`: Present
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Present
   - Clerk API: Reachable

3. **Payment Processing**:
   - `STRIPE_SECRET_KEY`: Valid
   - `STRIPE_PUBLISHABLE_KEY`: Valid
   - `STRIPE_WEBHOOK_SECRET`: Present
   - Stripe API: Working

4. **Search Providers**:
   - `APIFY_API_KEY`: Valid and has credits
   - `SCRAPECREATORS_API_KEY`: Valid
   - Other provider keys
   - Test API calls: Success

5. **Enrichment**:
   - `ENRICHMENT_API_KEY`: Valid
   - API quota: Remaining calls
   - Service status: Online

6. **Application**:
   - `NEXT_PUBLIC_APP_URL`: Set
   - `NODE_ENV`: Current environment
   - `PORT`: Configured

7. **Optional Services**:
   - Analytics keys
   - Email service keys
   - Monitoring keys

## Example Usage

```
/dev/check-env
```

## Success Criteria

All checks should:
- Show "OK" or "VALID"
- Have values set (not empty)
- Pass connectivity tests
- Show available quotas/credits

## Common Issues

### Issue 1: Missing Environment Variables
**Solution**: Copy `.env.example` to `.env.local` and fill in values

### Issue 2: Invalid API Keys
**Solution**: Regenerate keys in respective service dashboards

### Issue 3: Database Connection Failed
**Solution**: Check DATABASE_URL format and database accessibility

### Issue 4: Stripe Test Mode Mismatch
**Solution**: Ensure test keys used in development, live keys in production

### Issue 5: Expired or Revoked Keys
**Solution**: Generate new keys from service dashboards

## Environment Files

Check these files exist:
- `.env.local` - Local development variables
- `.env.production` - Production variables (if applicable)
- `.env.example` - Template with required variables

## Security Warnings

The script will warn about:
- Empty required variables
- Production keys in development
- Test keys in production
- Exposed secrets in code
- Weak webhook secrets

## Validation Details

For each service:
- **Exists**: Variable is set
- **Format**: Correct format (e.g., sk_test_xxx for Stripe)
- **Valid**: Makes test API call successfully
- **Quota**: Shows remaining credits/calls
- **Status**: Service health check

## When To Use

- Before starting development
- After environment setup
- Before deploying
- Debugging API errors
- Onboarding new developers
- After key rotation

## Related Commands

- `/dev/validate` - Full deployment validation
- `/test/all-searches` - Test search providers
- `/db/seed-plans` - Requires Stripe keys
- `/dev/ngrok` - Start development server
