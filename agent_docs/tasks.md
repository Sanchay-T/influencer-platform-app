# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-010
**Title:** Fix Search Progress UX — Keyword Search Reliability
**Status:** 🔍 INVESTIGATION PHASE
**Branch:** `fix/search-progress-ux` (clean)
**Started:** Dec 30, 2025
**Last Updated:** Jan 02, 2026 — 12:32 AM
**Latest Commits:** Portal fixes (491b7d207) + Clerk webhook email (a52525181) + Trial status removal (f8d8d313e)

### Goal
Fix keyword search progress UI reliability issues in production. Backend successfully finds and stores 1000 creators, but frontend fails to display them properly - requires full browser refresh to see correct results. Works perfectly in local dev, breaks only in production (usegems.io) and UAT (sorz.ai).

### Problems Identified

**Primary Symptoms (Production Only)**
- Progress freezes at random % during keyword search
- Loading spinners keep spinning forever after search completes
- Partial results displayed (200-800 creators instead of 1000)
- Only full browser refresh fixes the issue
- Job status stuck on "Processing" even after refresh shows 1000 creators
- Bio fetch spinners stuck (row-level, global, header spinners all affected)

**Environment Comparison**
- **Local Development:** Works perfectly - all 1000 creators display
- **Production (usegems.io):** Breaks - partial results, stuck spinners
- **UAT (sorz.ai):** Breaks - same issues as production
- **Platforms Affected:** Both TikTok and Instagram equally
- **Timing:** Breaks at 1-2 minutes into search

### Root Cause Hypotheses (From Investigation)

**High Probability (Production-Specific)**
1. Vercel serverless timing - Polling may hit function timeout limits
2. Network latency creates race conditions - Longer round-trips in production
3. QStash webhook latency - Workers complete but status updates delayed
4. Redis cache serving stale data - Production uses Redis, local uses in-memory

**Medium Probability (State Management)**
5. Polling terminates prematurely - `SearchProgress` stops before job truly completes
6. Terminal state detection broken - Backend returns "completed" but frontend doesn't recognize it
7. Spinner state not cleaned up - Multiple independent spinners don't coordinate

### User Preferences for Fix
- Add debug logging: Yes, add console logs
- Trade-off: Reliability > Real-time updates
- Polling interval: Slower (3-5s) acceptable if more reliable
- Manual fallback: No - focus on auto-updates only

### Work Completed So Far

1. ✅ **Initial investigation** (Dec 30, 2025)
   - Documented symptoms and patterns
   - Identified environment-specific behavior (local works, production breaks)
   - Listed root cause hypotheses
   - Gathered user preferences for fix approach

### Checklist
- [x] **Phase 1: Investigation & Root Cause Analysis**
  - [x] Identify 37+ users with expired trials still showing "Active"
  - [x] Document stuck onboarding case (accounts+appsumotest@usegemz.io)
  - [x] Analyze frontend trial status display logic
  - [x] Analyze backend trial expiration handling (or lack thereof)

- [x] **Phase 2: Success Page Fix** (Commit 3f23c3845)
  - [x] Fix redirect loop for partial onboarding states
  - [x] Check `billing_sync_status = 'completed'` before requiring `session_id`

- [x] **Phase 3: Tracking Integration** (Commits 6f149185d, 6a73028fd)
  - [x] Add Google Ads tracking (gtag.js)
  - [x] Add Meta Pixel tracking
  - [x] Integrate both into onboarding success page

- [ ] **Phase 4: Trial Status Implementation** (UNCOMMITTED WORK)
  - [ ] Review uncommitted changes to billing logic
  - [ ] Verify lib/billing/trial-status.ts implementation
  - [ ] Verify lib/billing/billing-status.ts changes
  - [ ] Verify lib/billing/access-validation.ts changes
  - [ ] Check if Stripe webhook handlers updated correctly
  - [ ] Test trial expiration detection logic

- [ ] **Phase 5: Database Schema Updates** (UNCOMMITTED WORK)
  - [ ] Review lib/db/schema.ts changes
  - [ ] Review lib/db/queries/user-queries.ts changes
  - [ ] Review lib/db/queries/admin-plan-manager.ts changes
  - [ ] Verify schema changes are migration-safe

- [ ] **Phase 6: Frontend Integration** (UNCOMMITTED WORK)
  - [ ] Review app/components/billing/access-guard-overlay.tsx changes
  - [ ] Review app/dashboard/page.tsx changes
  - [ ] Review app/onboarding/success/page.tsx changes
  - [ ] Verify UI correctly displays expired trial status

- [ ] **Phase 7: API Endpoints** (UNCOMMITTED WORK)
  - [ ] Review new app/api/stripe/verify-session/ endpoint
  - [ ] Review changes to admin API routes
  - [ ] Review changes to diagnostics/system-health endpoint
  - [ ] Test all modified API endpoints

- [ ] **Phase 8: Testing & Verification**
  - [ ] Test with accounts+appsumotest@usegemz.io
  - [ ] Test with other users with expired trials
  - [ ] Verify "Active" → "Expired" status transition works
  - [ ] Verify stuck onboarding users can proceed
  - [ ] Run E2E tests (e2e-clerk-sandbox.ts)

- [ ] **Phase 9: Commit & Deploy**
  - [ ] Run Biome linter on modified files
  - [ ] Run type check
  - [ ] Commit all billing/trial changes
  - [ ] Push to main
  - [ ] Verify deployment on usegems.io

- [ ] **Phase 10: Production Verification**
  - [ ] Check trial status display for 37+ affected users
  - [ ] Monitor for new trial expirations
  - [ ] Verify no users stuck in onboarding
  - [ ] Check Sentry for errors

---

## Investigation: Expired Trials & Stuck Onboarding (Jan 1, 2026)

### Issue 1: Trial Status Not Expiring

**Problem:** Users with expired trials still show "Active" status with "0 days left" in the UI.

**Evidence (UAT Database):**
- 37 users have `trial_status = 'active'` but `trial_end_date < NOW()`
- Example: Trial ended Nov 28, 2025 but still shows "Active" on Jan 1, 2026

**Production Database - Expired Trials:**
| Email | Trial End | Status |
|-------|-----------|--------|
| (anonymous) | Oct 20, 2025 | trialing/active |
| (anonymous) | Oct 19, 2025 | trialing/active |
| (anonymous) | Oct 17, 2025 | trialing/active |
| accounts+appsumotest@usegemz.io | Oct 9, 2025 | none/active |

**Root Cause:**
- No scheduled job or webhook to update `trial_status` when trial expires
- Stripe webhooks may not be triggering for trial end (need to verify webhook configuration)
- Frontend displays `trial_status` directly without checking `trial_end_date`

**Proposed Fix Options:**
1. **Frontend Fix (Quick):** Add date check in UI - if `trial_end_date < now`, show "Expired"
2. **Backend Fix (Proper):** Add scheduled job to mark expired trials as `expired`
3. **Webhook Fix (Best):** Ensure Stripe `customer.subscription.trial_will_end` webhook updates status

---

### Issue 2: Stuck Onboarding - accounts+appsumotest@usegemz.io

**User Data:**
```
Email: accounts+appsumotest@usegemz.io
User ID: edd4b955-66f9-4547-b4e8-9e63ad0174a3
Created: Oct 2, 2025

user_subscriptions:
  - trial_status: active (SHOULD BE EXPIRED - trial ended Oct 9, 2025)
  - subscription_status: none (never paid)
  - billing_sync_status: plan_selected
  - intended_plan: glow_up
  - current_plan: free

user_profiles:
  - NO RECORD EXISTS (NULL from LEFT JOIN)
```

**Root Cause:**
1. User started onboarding, selected "glow_up" plan (`billing_sync_status: plan_selected`)
2. Never completed Stripe checkout (`subscription_status: none`)
3. Trial expired Oct 9, 2025 but status never updated
4. `user_profiles` record was never created (possibly signup flow bug)

**Why Stuck:**
- No profile record → Onboarding state unknown
- `billing_sync_status: plan_selected` → Waiting for checkout completion that never happened
- User may see partial UI or be blocked from dashboard

**Proposed Fix:**
1. Create missing `user_profiles` record with `onboarding_step: 'pending'` to restart onboarding
2. Update `trial_status` to `expired`
3. Or: Delete user and have them re-signup

---

### Next Action
```
⚠️ REVIEW UNCOMMITTED BILLING/TRIAL STATUS CHANGES

Context:
- Working directly on main branch (no feature branch)
- 20+ files modified for trial status expiration detection
- New trial-status.ts module created
- New Stripe verify-session API endpoint created
- Changes span billing logic, database queries, frontend UI, API routes

CRITICAL: Before continuing, you need to understand what was implemented.

STEP 1: Review core billing logic changes
   Read these files to understand the trial expiration implementation:
   - lib/billing/trial-status.ts (NEW - core trial expiration logic)
   - lib/billing/billing-status.ts (MODIFIED - trial status integration)
   - lib/billing/access-validation.ts (MODIFIED - access control changes)
   - lib/billing/webhook-handlers.ts (MODIFIED - Stripe webhook handling)

STEP 2: Review database layer changes
   - lib/db/schema.ts (MODIFIED - schema changes)
   - lib/db/queries/user-queries.ts (MODIFIED - query updates)
   - lib/db/queries/admin-plan-manager.ts (MODIFIED - admin operations)

STEP 3: Review frontend changes
   - app/components/billing/access-guard-overlay.tsx (MODIFIED)
   - app/dashboard/page.tsx (MODIFIED)
   - app/onboarding/success/page.tsx (MODIFIED)

STEP 4: Review API changes
   - app/api/stripe/verify-session/ (NEW directory - what's in here?)
   - app/api/admin/e2e/*.ts (MODIFIED - 3 admin test routes)
   - app/api/admin/email-testing/*.ts (MODIFIED - 2 email test routes)
   - app/api/admin/users/billing-status/route.ts (MODIFIED)
   - app/api/debug/whoami/route.ts (MODIFIED)
   - app/api/diagnostics/system-health/route.ts (MODIFIED)

STEP 5: Make a decision
   After reviewing the changes, either:
   A) Changes look good → Continue to Phase 4 checklist items (test, lint, commit)
   B) Changes need work → Identify what needs fixing
   C) Changes are incomplete → Determine what's missing

IMPORTANT:
- Do NOT commit blindly - understand what was changed and why
- Check for any schema migrations needed (lib/db/schema.ts changes)
- Verify backward compatibility with existing users
- Test the trial expiration detection logic before deploying
```

### Key Files Modified (Uncommitted)
| Purpose | File |
|---------|------|
| **Trial expiration logic (NEW)** | `lib/billing/trial-status.ts` |
| **Billing status integration** | `lib/billing/billing-status.ts` |
| **Access validation** | `lib/billing/access-validation.ts` |
| **Stripe webhooks** | `lib/billing/webhook-handlers.ts` |
| **Database schema** | `lib/db/schema.ts` |
| **User queries** | `lib/db/queries/user-queries.ts` |
| **Admin plan manager** | `lib/db/queries/admin-plan-manager.ts` |
| **Job processor** | `lib/jobs/job-processor.ts` |
| **Access guard UI** | `app/components/billing/access-guard-overlay.tsx` |
| **Dashboard page** | `app/dashboard/page.tsx` |
| **Onboarding success** | `app/onboarding/success/page.tsx` |
| **Stripe verify session (NEW)** | `app/api/stripe/verify-session/` |
| **Admin E2E test routes** | `app/api/admin/e2e/create-test-user/route.ts` |
| | `app/api/admin/e2e/set-plan/route.ts` |
| | `app/api/admin/e2e/user-state/route.ts` |
| **Admin email test routes** | `app/api/admin/email-testing/users-cached/route.ts` |
| | `app/api/admin/email-testing/users-fast/route.ts` |
| **Admin billing status** | `app/api/admin/users/billing-status/route.ts` |
| **Debug whoami** | `app/api/debug/whoami/route.ts` |
| **System health diagnostics** | `app/api/diagnostics/system-health/route.ts` |
| **Test scripts** | `scripts/test-v2-concurrent-users.ts` |
| **E2E test sandboxes** | `testing/api-suite/sandbox/complete-sandbox.ts` |
| | `testing/api-suite/sandbox/e2e-clerk-sandbox.ts` |
| | `testing/api-suite/sandbox/onboarding-sandbox.ts` |

---

## Paused Task

**ID:** TASK-006
**Title:** Tech Debt Cleanup — Monolith Breakup & Code Quality
**Status:** PAUSED (for TASK-008 hotfix)
**Branch:** `UAT`
**Waiting on:** Phase 4 (Legacy Cleanup) after current hotfix

---

## Backlog

| ID | Title | Priority | Notes |
|----|-------|----------|-------|
| TASK-007 | Virtual Scrolling | High | After monolith breakup |
| TASK-003 | Add test coverage for V2 | Medium | Unit tests for adapters |
| TASK-004 | Delete legacy search code | Low | After V2 verified |

---

## Completed

| ID | Title | Completed |
|----|-------|-----------|
| — | list-detail-client.tsx Refactor (1124→357 lines) | Dec 12, 2025 |
| — | client-page.tsx Refactor (1588→417 lines) | Dec 12, 2025 |
| — | Bug: Instagram similar search wrong API | Dec 12, 2025 |
| — | Bug: Campaign page wrong results view | Dec 12, 2025 |
| — | Similar-Search Refactor (742→319 lines) | Dec 12, 2025 |
| TASK-005 | Keyword-Search Refactor | Dec 12, 2025 |
| — | Pagination scroll UX (all 4 components) | Dec 12, 2025 |
| — | Auto-fetch pages (replace Load More) | Dec 12, 2025 |
| — | totalCreators mismatch fix | Dec 12, 2025 |
| TASK-002 | Performance Bug Fixes (Phase 1) | Dec 12, 2025 |
| TASK-001 | V2 Fan-Out Architecture | Dec 11, 2025 |

---

*Last updated: Jan 01, 2026 — 10:29 PM*
