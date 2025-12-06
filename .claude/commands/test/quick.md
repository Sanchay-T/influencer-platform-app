---
description: Quick sanity check of core functionality
argument-hint:
allowed-tools: Bash(node:*/quick-test*.js*), Bash(curl*)
---

# Quick System Test

Run a quick sanity check of core functionality. Tests critical paths in under 30 seconds.

## Arguments

None required. Runs predefined quick tests.

## Execution

Run quick sanity checks:
```bash
# 1. Check API health
curl -s http://localhost:3000/api/health

# 2. Quick Instagram test
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/quick-test-instagram-apis.js

# 3. Database connection
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/test-local-db.js
```

## Output Analysis

Report:

1. **API Health**:
   - Server responding
   - Database connected
   - All services up

2. **Instagram Search**:
   - At least one provider working
   - Results returned
   - Reasonable quality

3. **Database**:
   - Connection successful
   - Basic queries working
   - Tables accessible

4. **Overall Status**:
   - PASS: All critical systems working
   - FAIL: Issues detected with details

## Example Usage

```
/test/quick
```

## What This Tests

**Critical Paths Only:**
- Server is running
- Database is accessible
- At least one search provider works
- Basic API endpoints respond

**Does NOT Test:**
- All search providers
- Payment processing
- Webhooks
- Background jobs

## When To Use

- After pulling new code
- Before starting work
- After deployment
- Quick health check
- Pre-demo validation

## Success Criteria

- All checks complete in <30s
- No critical errors
- Core functionality working

## If Tests Fail

1. Check server is running
2. Run `/dev/check-env` for configuration
3. Run `/dev/validate` for full diagnosis
4. Check `/logs/api` for errors

## Related Commands

- `/dev/validate` - Comprehensive validation
- `/test/all-searches` - Test all search providers
- `/dev/check-env` - Verify environment
