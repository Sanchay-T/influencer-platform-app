---
status: complete
priority: p1
issue_id: "013"
tags: [billing, admin, bug]
dependencies: []
---

# Fix Admin set-plan Not Granting Access (P0 #13)

## Problem Statement

Admin plan assignment endpoint does not set `subscriptionStatus`, so admin-assigned plans do not actually grant access.

## Findings

- File: `app/api/admin/users/set-plan/route.ts`
- Impact: support/admin workflows fail; users stay locked out.

## Proposed Solutions

### Option 1: Set subscription status consistently (recommended)

**Approach:** update the same fields the Stripe webhook path would set (plan + status + timestamps), and add an admin integration test.

## Recommended Action

Option 1.

## Acceptance Criteria

- [x] Admin can assign a plan and user receives correct entitlements immediately.
- [x] Billing state remains consistent with Stripe flows.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Set subscriptionStatus + onboardingStep

**By:** Codex

**Actions:**
- Updated `app/api/admin/users/set-plan/route.ts` to set:
  - `subscriptionStatus: 'active'`
  - `onboardingStep: 'completed'`
  - (plus existing plan snapshot fields)
- Added regression test to ensure the route sets these fields:
  - `testing/__tests__/billing/admin-set-plan-route.test.ts`

**Verification:**
- `npx vitest run testing/__tests__/billing/admin-set-plan-route.test.ts`
