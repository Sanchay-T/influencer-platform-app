---
status: complete
priority: p1
issue_id: "002"
tags: [security, api]
dependencies: []
---

# Lock Down /api/validate-deployment (P0 #2)

## Problem Statement

`/api/validate-deployment` exposes environment details and validation output and is currently callable without authentication.

## Findings

- File: `app/api/validate-deployment/route.ts`
- Endpoints:
  - `POST /api/validate-deployment`
  - `GET /api/validate-deployment?format=report`
- Risk: information disclosure (env/config hints, memory usage, security configuration flags).

## Proposed Solutions

### Option 1: Disable outside local dev

**Approach:** if deployed (or `NODE_ENV=production`) always return `404`.

**Pros:** safest, minimal complexity.

**Cons:** breaks any tooling that expects to run validation against staging/prod.

### Option 2: Require admin auth

**Approach:** use server-side admin checks (`isAdminUser()`), return `403` if not admin.

**Pros:** keeps feature for internal users.

**Cons:** scripts/CI may not have Clerk context.

### Option 3: Require a shared secret token (recommended)

**Approach:** require an env var like `DEPLOYMENT_VALIDATION_TOKEN` and check it against a request header (and/or query param for GET report download).

**Pros:** works for scripts/CI and is easy to rotate.

**Cons:** needs secret management; avoid putting token in URLs.

## Recommended Action

Disable in production by returning `404` for both GET and POST.

## Acceptance Criteria

- [x] In production, both GET and POST return `404` (disabled).
- [x] In development, endpoint behavior is unchanged.
- [x] Verified via ngrok (dev): request redirects to auth (expected since middleware protects route).

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Implemented

**By:** Codex

**Actions:**
- Added a production guard to `app/api/validate-deployment/route.ts` (GET + POST return `404` when `NODE_ENV=production`).
- Verified dev server still starts and route remains protected by Clerk middleware.

**Verification artifacts:**
- `tmp/verify-validate-deployment-dev.png`
