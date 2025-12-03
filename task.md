# Gemz Production Hardening - Task Tracker

> **Purpose**: Persistent memory for ongoing production hardening work.
> **Last Updated**: 2025-12-03
> **Status**: IN PROGRESS

---

## Current Focus: Webhook Idempotency & Resilience

### Context
On 2025-12-02 ~21:49 UTC, production experienced "Max client connections reached" errors during user signup. Root cause analysis revealed:
1. Connection pool exhaustion (Pool Size 15 was too small) - **FIXED** (now 30)
2. Admin routes creating rogue `postgres()` connections - **FIXED** (now use shared db)
3. Deeper issues in webhook handling discovered during audit

---

## Completed Tasks

### 2025-12-03: Connection Pool Fixes
- [x] Identified Pool Size 15 as insufficient for concurrent signup load
- [x] Fixed `app/api/admin/email-testing/users-cached/route.ts` - now uses shared `db`
- [x] Fixed `app/api/admin/email-testing/users-fast/route.ts` - now uses shared `db`
- [x] Fixed `app/api/logs/onboarding/route.ts` - now uses in-memory buffer (Vercel read-only FS)
- [x] Deleted temporary stress test endpoints
- [x] Created k6 load test scripts (`scripts/load-tests/`)
- [x] Verified Pool Size 30 handles 200 concurrent users with 0 connection errors

### k6 Test Results (2025-12-03)
```
Connection Stress Test (200 VUs):
- Total Requests: 4,336
- Success Rate: 98.8%
- Connection Errors: 0
- P95 Latency: 3,689ms
- Verdict: POOL SIZE 30 SUFFICIENT

Signup Flow Test (100 VUs):
- Total Requests: 1,848
- Success Rate: 99.95%
- P95 Latency: 10,576ms (dev server, not production)
- Verdict: FUNCTIONAL
```

---

## Completed Tasks (Continued)

### 2025-12-03: Webhook Idempotency Implementation ✅

#### What Was Done
- [x] Created `webhook_events` table in schema (`lib/db/schema.ts`)
- [x] Created idempotency helper (`lib/webhooks/idempotency.ts`) with:
  - `checkWebhookIdempotency()` - Checks if event should be processed
  - `markWebhookCompleted()` - Marks event as successfully processed
  - `markWebhookFailed()` - Marks event as failed with error message
  - `isEventStale()` - Checks if event is older than last processed
  - `cleanupOldWebhookEvents()` - Cleans up old event records
- [x] Updated `/api/webhooks/clerk/route.ts` with full idempotency
- [x] Updated `/api/webhooks/stripe/route.ts` (primary) with full idempotency
- [x] Updated `/api/stripe/webhook/route.ts` (secondary) with full idempotency
- [x] Generated and ran migration (`drizzle/0004_webhook_events.sql`)

#### Updated Vulnerability Matrix
| Webhook | Idempotency | Event Ordering | Transactions |
|---------|-------------|----------------|--------------|
| `/api/webhooks/clerk` | ✅ Fixed | ✅ Fixed | ⚠️ Partial |
| `/api/webhooks/stripe` | ✅ Fixed | ✅ Fixed | ⚠️ Partial |
| `/api/stripe/webhook` | ✅ Fixed | ✅ Fixed | ⚠️ Partial |

#### How It Works
1. Every webhook event gets recorded in `webhook_events` table with status `processing`
2. If same event_id arrives again, it's skipped (returns 200, no error)
3. After successful processing, status is updated to `completed`
4. If processing fails, status is updated to `failed` with error message
5. Optional: `cleanupOldWebhookEvents(30)` can remove events older than 30 days

---

## Pending Tasks

### Priority 1: Security Cleanup
- [x] Delete debug files with hardcoded credentials
- [x] Clean package.json scripts with credentials
- [ ] Rotate Supabase credentials (DO LAST)
- [ ] Purge git history (after rotation)

### Priority 2: Webhook Resilience (Remaining)
- [x] Create webhook_events schema ✅
- [x] Implement idempotency checks ✅
- [x] Add event ordering validation ✅
- [x] Test with simulated replays ✅ (see `scripts/test-webhook-idempotency.ts`)
- [ ] Wrap handlers in transactions (enhancement - not critical)
- [ ] Add timeout guards (enhancement)

---

## 🚨 AUDIT FINDINGS (2025-12-03)

### ✅ FIXED Issues

#### 1. DUAL STRIPE WEBHOOKS - ✅ FIXED
- **Before:** Two webhooks with different logic
- **After:** `/api/webhooks/stripe` replaced with deprecation notice (39 lines)
- **Production uses:** `/api/stripe/webhook` (the correct one)
- Test: Check Stripe dashboard shows `https://www.usegemz.io/api/stripe/webhook`

#### 2. STRIPE WEBHOOK RACE WITH CLERK - ✅ FIXED
- **Before:** `getUserProfile()` returned null if user didn't exist, webhook gave up
- **After:** `ensureUserProfile()` creates user if missing
- Location: `/api/stripe/webhook/route.ts:168-188`

#### 3. TYPE MISMATCH - ✅ FIXED
- **Before:** `currentPlan: string` in TypeScript
- **After:** `currentPlan: string | null` in `UserProfileComplete`
- Location: `lib/db/schema.ts:624`

#### 4. MONTHLY RESET STUB - ⚠️ STILL PENDING
- `PlanEnforcementService.resetMonthlyUsage()` is empty stub
- Some endpoints use this service (Instagram similar/us-reels/v2)
- **Action:** Implement or migrate to PlanValidator

### Remaining High Priority Issues

| Issue | Location | Status |
|-------|----------|--------|
| ensureUserProfile blocks SSR | overview.ts:52 | Pending |
| Fail-open in can-create | can-create/route.ts | Pending |
| Two competing validators | PlanValidator vs PlanEnforcementService | Pending |
| isEventStale() never called | Stripe webhook | Pending |
| Payment failure doesn't clear plan | handlePaymentFailed() | Pending |

### Tests Created
- `scripts/test-signup-flow.ts` - Full signup flow test (all passing ✅)
- `scripts/test-user-creation-race.ts` - Race condition tests (all passing ✅)
- `scripts/test-webhook-idempotency.ts` - Idempotency tests (all passing ✅)

---

### Priority 3: Performance Optimization
- [ ] Add missing database indexes
- [ ] Lazy-load sharp/heic in image proxy
- [ ] Create shared Stripe singleton
- [ ] Defer Clerk SDK imports
- [ ] Add response caching headers

### Priority 4: Observability
- [ ] Webhook success/failure metrics
- [ ] Connection pool monitoring
- [ ] P95/P99 latency tracking
- [ ] Error budget definition

---

## Architecture Notes

### Signup Flow Query Count
```
Clerk Webhook:     5 queries (1 SELECT + 4 INSERTs)
Dashboard SSR:     8 queries (profile, favorites, lists, telemetry, plan)
Billing API:       1 query  (cached)
─────────────────────────────────────────────────
TOTAL:            14 queries per signup (happy path)
                  19 queries if race conditions occur
```

### Race Condition: User Creation ✅ FIXED
Both webhook and dashboard SSR can try to create user simultaneously:
1. Webhook calls `getUserProfile()` → null
2. Dashboard SSR calls `ensureUserProfile()` → null
3. Both try `createUser()` → one fails with unique constraint

**Fix Applied (2025-12-03)**:
- Dashboard SSR (`getDashboardOverview`) already uses `ensureUserProfile()` which handles race gracefully
- Clerk webhook (`handleUserCreated`) now catches duplicate key errors (23505) and treats them as success
- Both sides now handle the race condition - user is created once, no errors thrown
- **Bonus fix**: Made `currentPlan` nullable - NULL means user hasn't completed onboarding/payment yet
  - Migration: `supabase/migrations/0204_nullable_current_plan.sql`
  - Removed fake 'free' plan default
  - Plan enforcement correctly blocks users with NULL currentPlan (0 limits)
  - Test: `scripts/test-user-creation-race.ts` - all 3 tests pass

### Dual Stripe Webhook Paths
Two endpoints exist:
- `/api/webhooks/stripe/route.ts`
- `/api/stripe/webhook/route.ts`

**Action**: Ensure only ONE is configured in Stripe dashboard.

---

## Files Reference

### Load Test Scripts
- `scripts/load-tests/signup-flow.js` - Full signup journey simulation
- `scripts/load-tests/connection-stress.js` - DB connection pool stress test

### Key Config Files
- `lib/db/index.ts` - Database connection pool (max:1 per instance, globalThis cached)
- `middleware.ts` - Auth protection
- `.env.local` - Environment variables (never commit)

---

## Notes for Future Sessions

1. Always check this file first for context on ongoing work
2. Update "Last Updated" date when making changes
3. Move completed items from "In Progress" to "Completed"
4. The scratchpad.md file contains detailed implementation notes
5. Run `k6 run scripts/load-tests/connection-stress.js` to verify connection pool health
