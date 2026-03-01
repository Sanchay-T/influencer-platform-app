---
status: complete
priority: p1
issue_id: "003"
tags: [security, cors, infra]
dependencies: []
---

# Tighten API CORS Policy (P0 #3)

## Problem Statement

Global `Access-Control-Allow-Origin: *` on API routes increases risk of cross-origin abuse, especially if cookies/bearer tokens are usable cross-origin.

## Findings

- File: `vercel.json`
- Audit note: wildcard CORS headers applied to ALL API routes.

## Proposed Solutions

### Option 1: Remove global CORS headers (recommended)

**Approach:** delete wildcard headers from `vercel.json` and apply narrowly where needed.

**Pros:** safest default.

**Cons:** may break any legitimate cross-origin integrations.

### Option 2: Restrict CORS to allowlisted origins

**Approach:** set `Access-Control-Allow-Origin` to `NEXT_PUBLIC_SITE_URL` (and maybe staging domains).

**Pros:** supports controlled cross-origin needs.

**Cons:** must keep origin list updated.

## Recommended Action

Option 1, then re-add CORS per-route only when there is a real need.

## Acceptance Criteria

- [x] `vercel.json` no longer sets wildcard CORS on all API routes.
- [x] No replacement CORS added globally (default to same-origin).
- [ ] Smoke test in production after deploy.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Implemented

**By:** Codex

**Actions:**
- Removed global `/api/*` wildcard CORS headers from `vercel.json`.
