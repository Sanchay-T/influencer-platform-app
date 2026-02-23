---
status: complete
priority: p1
issue_id: "009"
tags: [security, admin, auth]
dependencies: []
---

# Enforce Admin Access Control For /admin (P0 #9)

## Problem Statement

Any authenticated user can navigate to `/admin/*` pages; no server-side access control.

## Findings

- Scope: `app/admin/**`
- Risk: privilege escalation via UI navigation.

## Proposed Solutions

### Option 1: Middleware guard for /admin (recommended)

**Approach:** in `middleware.ts`, deny or redirect non-admin users for `/admin` paths.

### Option 2: Per-page server component guard

**Approach:** each admin page checks `isAdminUser()` and returns `notFound()` / `redirect()`.

## Recommended Action

Option 1 (centralized) + Option 2 for defense-in-depth on especially sensitive pages.

## Acceptance Criteria

- [x] Non-admin cannot access `/admin/*` (direct URL or navigation).
- [x] Admin can access `/admin/*`.
- [x] Works in production (no reliance on `NEXT_PUBLIC_ADMIN_EMAILS` in client).

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Add Server-Side Guard For /admin/*

**By:** Codex

**Actions:**
- Added `app/admin/layout.tsx` with a server-side `isAdminUser()` check.
- Non-admin users now hit `notFound()` for all `/admin/*` pages (centralized guard).
