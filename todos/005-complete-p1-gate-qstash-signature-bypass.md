---
status: complete
priority: p1
issue_id: "005"
tags: [security, qstash, webhooks]
dependencies: []
---

# Gate SKIP_QSTASH_SIGNATURE In Production (P0 #5)

## Problem Statement

`SKIP_QSTASH_SIGNATURE` can disable signature verification in production, allowing forged webhook/worker calls.

## Findings

- Audit indicates this exists across 6+ QStash route files.
- Risk: forged worker payloads, untrusted job execution.

## Proposed Solutions

### Option 1: Force signature verification in production (recommended)

**Approach:** if `NODE_ENV === 'production'` (or `VERCEL_ENV === 'production'`), ignore `SKIP_QSTASH_SIGNATURE` entirely.

### Option 2: Require an additional secret for bypass

**Approach:** bypass only if both `SKIP_QSTASH_SIGNATURE=true` and `QSTASH_BYPASS_TOKEN` matches request.

## Recommended Action

Option 1. If you need local testing speed, keep bypass only for `NODE_ENV !== 'production'`.

## Acceptance Criteria

- [x] In production, signature verification always runs (fail-closed).
- [x] Add a single helper (no copy/paste) to determine bypass logic.
- [x] Add tests for bypass gating.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Centralize QStash Signature Verification

**By:** Codex

**Actions:**
- Added shared helper: `lib/queue/qstash-signature.ts`
  - Policy: always verify outside dev/test; dev/test is opt-in via `VERIFY_QSTASH_SIGNATURE=true`.
  - This implicitly ignores `SKIP_QSTASH_SIGNATURE` in production (audit requirement).
- Updated routes to use helper (removed copy/paste `shouldVerifySignature()`):
  - `app/api/v2/worker/search/route.ts`
  - `app/api/v2/worker/dispatch/route.ts`
  - `app/api/v2/worker/enrich/route.ts`
  - `app/api/export/csv-worker/route.ts`
  - `app/api/qstash/process-search/route.ts`
  - `app/api/email/send-scheduled/route.ts` (removed attacker-controlled `source === 'admin-testing'` bypass)
- Added unit tests: `lib/queue/qstash-signature.test.ts`

**Verification:**
- Restarted dev server with `VERIFY_QSTASH_SIGNATURE=true` and confirmed:
  - `POST /api/v2/worker/search` without signature returns `401`.
  - `POST /api/email/send-scheduled` without signature returns `401` even with `{"source":"admin-testing"}`.
