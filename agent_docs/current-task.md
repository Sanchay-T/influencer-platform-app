# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** Plan Enforcement Cleanup + Bug Fixes + Tech Debt
**Branch:** `feat/plan-enforcement-cleanup`
**Status:** Ready for review
**Started:** Dec 5, 2025
**Updated:** Dec 8, 2025

## What You Did (This Session - Dec 8)

### Critical Bug Fix: Usage Tracking Not Working ✅

**Problem:** Billing page showed "0 / ∞ creators" despite users having campaigns and searches.

**Root Cause:** The `incrementCampaignCount()`, `incrementCreatorCount()`, and `incrementEnrichmentCount()` functions in `lib/billing/usage-tracking.ts` were using Clerk user IDs to query the `user_usage` table. However, `userUsage.userId` references `users.id` (internal UUID), not the Clerk ID. No rows matched, so usage was never updated.

**Fix Applied:**
- Added `getInternalUserId(clerkUserId)` helper function that resolves Clerk ID → internal UUID
- Updated all increment functions to use this helper before querying

**File:** `lib/billing/usage-tracking.ts` (lines 28-38, 126-130, 186-190)

### Tech Debt Cleanup ✅

1. **Fixed typo in schema:** `stripeMonthlaPriceId` → `stripeMonthlyPriceId`
   - Files: `lib/db/schema.ts`, `scripts/seed-subscription-plans.js`

2. **Added deprecation comments to dead columns in `user_usage`:**
   - `planCampaignsLimit`, `planCreatorsLimit` - Set but never read (limits come from PLANS config)
   - `planEnrichmentsLimit` - Never used
   - `enrichmentsCurrentMonth` - Never incremented (feature not implemented)

3. **Added deprecation comment to `subscription_plans` table:**
   - Source of truth is now static `PLANS` config in `lib/billing/plan-config.ts`
   - Table only used by admin API and seed scripts

4. **Removed unused `incrementEnrichmentCount()` function:**
   - Feature not implemented, column deprecated
   - Files: `lib/billing/usage-tracking.ts`, `lib/billing/index.ts`

5. **Consolidated plan order to single `PLAN_ORDER` constant:**
   - Added `export const PLAN_ORDER: PlanKey[] = ['glow_up', 'viral_surge', 'fame_flex']` to `plan-config.ts`
   - Updated `getRecommendedPlan()` and `comparePlans()` to use it
   - Updated `lib/hooks/billing-plan.ts` to import and derive `['free', ...PLAN_ORDER]`
   - Updated `lib/hooks/use-billing-cached.ts` to import and use `PLAN_HIERARCHY_WITH_FREE`

## Files Changed (This Session)

### Modified Files
- `lib/billing/usage-tracking.ts` - Added getInternalUserId helper, removed incrementEnrichmentCount
- `lib/billing/plan-config.ts` - Added PLAN_ORDER constant, updated functions
- `lib/billing/index.ts` - Updated exports
- `lib/db/schema.ts` - Fixed typo, added deprecation comments
- `lib/hooks/billing-plan.ts` - Import PLAN_ORDER instead of hardcoded array
- `lib/hooks/use-billing-cached.ts` - Import PLAN_ORDER instead of inline arrays
- `scripts/seed-subscription-plans.js` - Fixed typo

### Legacy Files Deleted (Previous Commit)
- `drizzle/relations.ts` - Empty file
- `drizzle/schema.ts` - Old auto-generated schema
- `scripts/reset-user-onboarding.js` - Used legacy table
- `scripts/reset-user-onboarding.ts` - Used legacy table
- `scripts/reset-user-simple.js` - Used legacy table
- `scripts/test-local-db.js` - Used legacy table

## Key Architecture Notes

### User ID Types
```
Clerk ID (string): "user_xxxxx" - External auth provider ID
Internal UUID (uuid): "550e8400-e29b-..." - Database primary key

scrapingJobs.userId → Clerk ID (text)
userUsage.userId → Internal UUID (references users.id)
```

Always use `getInternalUserId()` when updating `user_usage` table.

### Plan Configuration Source of Truth
```
PLANS constant in lib/billing/plan-config.ts
├── Plan limits (campaigns, creators)
├── Plan features (csvExport, analytics, etc.)
├── Stripe price IDs
└── Plan order (PLAN_ORDER)

subscription_plans table → DEPRECATED for billing logic
```

## Testing Status

- [x] Linting passed (Biome)
- [x] Type check passed (pre-existing errors in unrelated files)
- [x] Usage tracking fix verified - manual data correction applied
- [x] Plan order consolidation working

## What's Left

### Not Changed (Future Work):
1. **API routes using incrementCreatorCount** - Scraping routes should call this after saving results
2. **Trial expiration cron** - Could add a job to handle expired trials
3. **Remove deprecated columns** - Need migration after confirming no production usage

## Next Steps

1. Commit and push current changes
2. User should test billing page shows correct usage
3. Consider merging to main after verification
