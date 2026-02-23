---
status: complete
priority: p1
issue_id: "007"
tags: [security, admin]
dependencies: []
---

# Lock Down /api/admin/e2e Routes (P0 #7)

## Problem Statement

E2E/admin test routes become accessible in production if `ENABLE_AUTH_BYPASS=true`, enabling arbitrary user creation/deletion.

## Findings

- File: `app/api/admin/e2e/*`
- Risk: catastrophic if misconfigured env var leaks into prod.

## Proposed Solutions

### Option 1: Compile-time / hard runtime guard (recommended)

**Approach:** early-return `404` when `NODE_ENV === 'production'` or `VERCEL_ENV === 'production'`.

### Option 2: Require an additional secret and admin auth

**Approach:** allow only with both admin check + token.

## Recommended Action

Option 1. These are test-only endpoints; safest is making them impossible in production.

## Acceptance Criteria

- [x] In production, requests return 404 and do not execute.
- [x] In non-production, routes still work for E2E.
- [x] Add unit test or guard helper shared across all e2e routes.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Hard-Disable E2E Routes In Production + Middleware Defense

**By:** Codex

**Actions:**
- Added shared guard: `lib/auth/e2e-guards.ts` to centralize the "never in production" rule.
- Updated E2E routes to fail closed using the shared guard:
  - `app/api/admin/e2e/create-test-user/route.ts`
  - `app/api/admin/e2e/set-plan/route.ts`
  - `app/api/admin/e2e/user-state/route.ts`
- Updated `middleware.ts` so `/api/admin/e2e/*` is only treated as public when `NODE_ENV !== 'production'`.

**Verification:**
- In dev, `POST /api/admin/e2e/create-test-user` without auth still reaches the handler (returns `400` for missing fields).
- In production, handler-level guard returns `404` regardless of bypass flags.
