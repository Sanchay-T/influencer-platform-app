---
description: Run comprehensive deployment validation checks
argument-hint: [environment]
allowed-tools: Bash(node:*/validate-deployment*.js*)
---

# Validate Deployment

Run comprehensive validation checks before or after deployment. Tests all critical system components and integrations.

## Arguments

- `$1`: **[Optional]** Environment to validate (production/staging/development) - defaults to current NODE_ENV

## Execution

Run the validation script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/validate-deployment.js ${1:-}
```

## Output Analysis

Report on all validation checks:

1. **Environment Configuration**:
   - All required env vars present
   - No development keys in production
   - Webhook secrets configured
   - URLs properly set

2. **Database Health**:
   - Database connection working
   - All tables exist
   - Indexes present
   - No orphaned data
   - Recent backup verified

3. **Authentication**:
   - Clerk integration working
   - JWT validation working
   - Session management functional
   - User creation flow

4. **Payment System**:
   - Stripe connection valid
   - Webhook endpoint reachable
   - Plans synced correctly
   - Test payment succeeds

5. **Search Functionality**:
   - All search providers responding
   - API keys valid and not expired
   - Rate limits not hit
   - Results quality acceptable

6. **API Endpoints**:
   - Health check: /api/health
   - Authentication: /api/auth/*
   - Search: /api/search/*
   - Webhooks: /api/webhooks/*
   - User: /api/user/*

7. **Background Jobs**:
   - Scheduled tasks running
   - Queue system operational
   - Cleanup jobs executing

8. **Monitoring & Logging**:
   - Logging system active
   - Error tracking configured
   - Performance monitoring
   - Alert system functional

9. **Security Checks**:
   - HTTPS enforced
   - CORS configured properly
   - Rate limiting active
   - Input validation working

10. **Performance**:
    - Response times acceptable
    - Database query performance
    - API latency within limits
    - Memory usage normal

## Example Usage

```
/dev/validate
/dev/validate production
/dev/validate staging
```

## Validation Levels

### Critical (Must Pass):
- Database connectivity
- Authentication working
- Payment processing
- Core API endpoints

### Important (Should Pass):
- Search providers working
- Webhooks configured
- Background jobs running
- Monitoring active

### Optional (Nice to Have):
- Performance optimizations
- Advanced features
- Analytics working
- Email delivery

## Success Report

If all critical checks pass:
```
✅ DEPLOYMENT VALIDATED
- All critical systems operational
- 0 critical issues
- 2 warnings (non-blocking)
- Ready for production traffic
```

## Failure Report

If any critical checks fail:
```
❌ DEPLOYMENT BLOCKED
- 3 critical issues found
- Payment system not responding
- Database migration pending
- Clerk webhook not configured

DO NOT DEPLOY until issues resolved.
```

## Common Issues

### Issue 1: Database Migration Pending
**Solution**: Run pending migrations before deploying

### Issue 2: Environment Variables Missing
**Solution**: Add missing variables to deployment platform

### Issue 3: Webhook Endpoints Not Reachable
**Solution**: Verify webhook URLs in Stripe/Clerk dashboards

### Issue 4: API Keys Expired
**Solution**: Rotate keys and update in environment

### Issue 5: Performance Issues Detected
**Solution**: Investigate slow queries or endpoints

## Pre-Deployment Checklist

Before deploying to production:
- [ ] Run `/dev/validate production`
- [ ] All critical checks pass
- [ ] Database backed up
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment

## Post-Deployment Validation

After deploying:
- [ ] Run `/dev/validate` against production
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Verify user flows working
- [ ] Test critical features

## Related Commands

- `/dev/check-env` - Validate environment variables
- `/test/all-searches` - Test search functionality
- `/test/subscription` - Test billing system
- `/db/analyze` - Check database health
- `/logs/api` - View API logs
