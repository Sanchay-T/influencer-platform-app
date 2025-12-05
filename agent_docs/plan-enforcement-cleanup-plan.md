# Plan Enforcement Cleanup - Implementation Plan

**Branch:** `feat/plan-enforcement-cleanup`
**Created:** Dec 5, 2025

---

## Current State Analysis

### What's Already Well Organized ✅

The `lib/billing/` module is already consolidated with:

| File | Lines | Purpose |
|------|-------|---------|
| `plan-config.ts` | 323 | Plan definitions, limits, price IDs |
| `access-validation.ts` | 163 | validateAccess, validateCampaignCreation, validateCreatorSearch |
| `subscription-types.ts` | ~95 | Type definitions |
| `trial-utils.ts` | 99 | Trial time calculations |
| `webhook-handlers.ts` | ~220 | Webhook event processing |
| `billing-status.ts` | ~105 | Read-only billing queries |
| `checkout-service.ts` | ~180 | Checkout session creation |
| `onboarding-service.ts` | 369 | Onboarding steps, emails |
| `stripe-client.ts` | ~100 | Stripe SDK wrapper |
| `index.ts` | 135 | Unified exports |

**API routes already import from `@/lib/billing`:**
- 8 scraping routes use `validateCreatorSearch`
- 2 campaign routes use `validateCampaignCreation`
- 1 billing route uses `getBillingStatus`
- 1 profile route uses `getBillingStatus`

### What Needs Cleanup 🔧

1. **Orphaned Feature Gates** - `lib/services/feature-gates.ts` (71 lines)
   - Currently separate from billing module
   - Reads from DB `subscription_plans` table for features JSON
   - Used only by `app/api/export/csv/route.ts`

2. **Missing Usage Tracking**
   - No centralized module to increment usage counts
   - Usage increment happens inline in API routes (if at all)
   - No monthly reset job for `usageCreatorsCurrentMonth`

3. **Feature-Level Entitlements**
   - Plan features defined in `plan-config.ts` but not actively used
   - `PlanFeatures` interface exists (csvExport, analytics, apiAccess, etc.)
   - Need to connect feature gates to plan config

---

## Implementation Plan

### Phase 1: Feature Gates Consolidation

**Task 1.1: Create `lib/billing/feature-gates.ts`** (NEW)
- Move logic from `lib/services/feature-gates.ts`
- Use `PLANS` from `plan-config.ts` instead of DB query
- Simpler implementation: check plan's features directly

**Task 1.2: Update `lib/billing/index.ts`**
- Export feature gate functions

**Task 1.3: Update `app/api/export/csv/route.ts`**
- Change import from `@/lib/services/feature-gates` to `@/lib/billing`

**Task 1.4: Delete `lib/services/feature-gates.ts`**
- Remove orphaned file

### Phase 2: Usage Tracking Module

**Task 2.1: Create `lib/billing/usage-tracking.ts`** (NEW)
Functions:
- `incrementCampaignCount(userId)` - After campaign creation
- `incrementCreatorCount(userId, count)` - After search results
- `resetMonthlyUsage(userId)` - For monthly reset
- `getUsageSummary(userId)` - Current usage vs limits

**Task 2.2: Update API routes to use usage tracking**
- `app/api/campaigns/route.ts` - Call `incrementCampaignCount` after creation
- `app/api/scraping/*/route.ts` - Call `incrementCreatorCount` after results

### Phase 3: Monthly Reset Job

**Task 3.1: Create `app/api/cron/reset-monthly-usage/route.ts`**
- Vercel cron-compatible endpoint
- Resets `usageCreatorsCurrentMonth` to 0 for all users
- Logs action for audit

**Task 3.2: Add to `vercel.json`**
- Configure cron to run monthly (1st of each month at 00:00 UTC)

### Phase 4: Feature Entitlements Integration

**Task 4.1: Create `lib/billing/entitlements.ts`** (NEW)
Functions:
- `canExportCSV(userId)` - Uses plan's csvExport feature
- `hasAdvancedAnalytics(userId)` - Uses plan's analytics feature
- `hasApiAccess(userId)` - Uses plan's apiAccess feature
- `hasPrioritySupport(userId)` - Uses plan's prioritySupport feature

**Task 4.2: Update export/csv route**
- Use `canExportCSV()` instead of FeatureGateService

---

## Testing Strategy

1. **Unit Tests**
   - Test feature gates return correct values per plan
   - Test usage increment/reset functions
   - Test entitlement checks

2. **E2E Tests**
   - Create user → Run search → Verify usage incremented
   - Test export with different plans → Verify feature gate works
   - Test monthly reset (mock time or manual trigger)

---

## Files Changed Summary

### New Files
- `lib/billing/feature-gates.ts`
- `lib/billing/usage-tracking.ts`
- `lib/billing/entitlements.ts`
- `app/api/cron/reset-monthly-usage/route.ts`

### Modified Files
- `lib/billing/index.ts` (add exports)
- `app/api/export/csv/route.ts` (update import)
- `app/api/campaigns/route.ts` (add usage tracking)
- `app/api/scraping/*/route.ts` (add usage tracking - 8 files)
- `vercel.json` (add cron config)

### Deleted Files
- `lib/services/feature-gates.ts`

---

## Success Criteria

1. ✅ All feature gate logic in `lib/billing/`
2. ✅ Usage tracked after every campaign creation and search
3. ✅ Monthly usage reset job configured
4. ✅ No orphaned files in `lib/services/` related to billing
5. ✅ All tests pass
6. ✅ `npx biome check` clean on modified files
7. ✅ `npx tsc --noEmit` passes

---

## Estimated Effort

- Phase 1 (Feature Gates): ~20 min
- Phase 2 (Usage Tracking): ~30 min
- Phase 3 (Monthly Reset): ~15 min
- Phase 4 (Entitlements): ~20 min
- Testing: ~30 min

**Total: ~2 hours**
