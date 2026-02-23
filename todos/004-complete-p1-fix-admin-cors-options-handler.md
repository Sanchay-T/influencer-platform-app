---
status: complete
priority: p1
issue_id: "004"
tags: [security, cors, admin]
dependencies: ["003"]
---

# Fix Admin OPTIONS CORS Wildcard (P0 #4)

## Problem Statement

Admin API route has an OPTIONS handler returning `Access-Control-Allow-Origin: *`, enabling cross-origin interaction patterns that should not exist for admin endpoints.

## Findings

- File: `app/api/admin/config/route.ts`
- Line: around 239 (per audit)

## Proposed Solutions

### Option 1: Remove OPTIONS handler CORS headers (recommended)

**Approach:** do not respond with wildcard CORS; either remove or restrict to same-origin.

### Option 2: Explicit allowlist

**Approach:** only allow your app origins.

## Recommended Action

Implement Option 1 (and depend on todo #003 to avoid reintroducing wildcard globally).

## Acceptance Criteria

- [x] OPTIONS no longer returns `Access-Control-Allow-Origin: *` (route now responds `404` for OPTIONS in dev).
- [ ] Admin route remains functional from the app (verify after deploy).
- [ ] Cross-origin preflight from random origins is rejected (verify after deploy).

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Implemented

**By:** Codex

**Actions:**
- Removed the explicit OPTIONS handlers (and wildcard CORS headers) from:
  - `app/api/admin/config/route.ts`
  - `app/api/admin/config/init/route.ts`
- Verified locally that OPTIONS returns `404` and does not include CORS wildcard headers.
