---
status: complete
priority: p1
issue_id: "010"
tags: [security, admin, privacy]
dependencies: ["009"]
---

# Stop Shipping Admin Email List To Client (P0 #10)

## Problem Statement

`NEXT_PUBLIC_ADMIN_EMAILS` is a client-exposed env var, so the admin identity list ships to every browser.

## Findings

- File: `lib/hooks/use-admin.ts`
- Risk: information disclosure; also invites client-side security assumptions.

## Proposed Solutions

### Option 1: Server-side admin check API (recommended)

**Approach:** create `/api/me/admin` (or similar) that returns `{ isAdmin: boolean }` based on server checks. Client hook calls this.

### Option 2: Put admin flags in DB and check server-side only

**Approach:** use `users.isAdmin` and never expose an allowlist.

## Recommended Action

Option 1 now (minimal refactor), then migrate toward Option 2.

## Acceptance Criteria

- [x] `NEXT_PUBLIC_ADMIN_EMAILS` is no longer required in the browser runtime.
- [x] Client derives admin status from server response.
- [x] Admin gating cannot be bypassed by client-side edits.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Remove Client Allowlist + Add Server Admin Status Endpoint

**By:** Codex

**Actions:**
- Updated server admin allowlist env var to `ADMIN_EMAILS` (server-only), with backward-compatible fallback to `NEXT_PUBLIC_ADMIN_EMAILS`.
  - `lib/auth/admin-utils.ts`
- Replaced client-side allowlist logic with a server call:
  - `app/api/admin/me/route.ts` (returns `{ isAdmin: boolean }`)
  - `lib/hooks/use-admin.ts` now fetches `/api/admin/me` instead of reading env vars.
- Updated deployment validation checks to read `ADMIN_EMAILS` (fallback supported):
  - `app/api/validate-deployment/route.ts`
  - `scripts/validate-deployment.js`
