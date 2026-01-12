# Agent Tasks

> **This is your source of truth.** After context clears, read this FIRST.
> The checklist shows what's done. "Next Action" tells you exactly what to do.

---

## Current Task

**ID:** TASK-011
**Title:** Post-Type-Fixes Assessment & Next Steps
**Status:** 🔍 NEEDS ASSESSMENT
**Branch:** `fix/type-fixes-20260111` (clean)
**Started:** Jan 11, 2026
**Last Updated:** Jan 12, 2026 — 01:18 AM
**Latest Commit:** c83f5df4e - fix: comprehensive TypeScript type fixes across codebase

### Context

**What Just Happened:**
- Comprehensive TypeScript type fixes were committed on Jan 11, 2026
- Git status shows clean working tree (no uncommitted changes)
- Branch `fix/type-fixes-20260111` is current
- The previous tasks.md mentioned uncommitted trial status work, but repo is now clean

**What's Unclear:**
- Were the trial status changes from TASK-010 completed and committed?
- Or were they reverted/abandoned?
- What TypeScript type issues were fixed in the latest commit?
- Should we continue with TASK-010 (Search Progress UX), or is there new work?

### Work Completed (Based on Git History)

1. ✅ **Type Fixes** (Commit c83f5df4e - Jan 11, 2026)
   - Comprehensive TypeScript type fixes across codebase
   - Details unknown - need to review commit diff

2. ✅ **Previous Commits** (Recent)
   - de539edc4 - Monitoring
   - 0813d0799 - Replace landing page with v0 design
   - 68dcea6e7 - Add SEO infrastructure
   - 55ab8e657 - Add Google Analytics 4 integration

### Checklist
- [ ] **Phase 1: Understand Current State**
  - [ ] Review what type fixes were made in commit c83f5df4e
  - [ ] Check if trial status work was completed or abandoned
  - [ ] Verify if branch should be merged to main
  - [ ] Determine if there are any follow-up tasks needed

- [ ] **Phase 2: Verify Type Fixes**
  - [ ] Run `npm run type-check` to ensure no type errors
  - [ ] Check if any files still need attention
  - [ ] Review for any introduced bugs from type fixes

- [ ] **Phase 3: Decision Point**
  - [ ] If type fixes complete → Merge to main and close task
  - [ ] If more work needed → Continue on this branch
  - [ ] If trial status work needed → Assess priority vs TASK-010

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
