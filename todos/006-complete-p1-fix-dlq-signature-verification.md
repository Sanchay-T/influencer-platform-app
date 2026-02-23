---
status: complete
priority: p1
issue_id: "006"
tags: [security, qstash, dlq]
dependencies: ["005"]
---

# Fix DLQ Handler Signature Verification (P0 #6)

## Problem Statement

Dead-letter handler processes messages even when signature verification fails.

## Findings

- File: `app/api/qstash/dead-letter/route.ts` (audit points to line ~66)
- Risk: forged DLQ messages leading to untrusted processing.

## Proposed Solutions

### Option 1: Hard fail on invalid signature (recommended)

**Approach:** if signature verification fails, return `401/403` and do not process.

### Option 2: Allow invalid signatures only in non-production

**Approach:** keep a dev-only bypass, gated by `NODE_ENV !== 'production'`.

## Recommended Action

Option 1 with Option 2 only for local dev.

## Acceptance Criteria

- [x] Invalid signature returns `401/403`.
- [x] No processing occurs for invalid signatures.
- [x] Add regression test or a small manual reproduction guide.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Fail Closed On Invalid/Failed Signature Verification

**By:** Codex

**Actions:**
- Updated `app/api/qstash/dead-letter/route.ts` to use `verifyQstashRequestSignature()`.
- Removed the previous "catch and continue anyway" behavior; invalid/missing signatures now return `401` and no DLQ processing occurs.

**Verification:**
- With `VERIFY_QSTASH_SIGNATURE=true` in dev, `POST /api/qstash/dead-letter` without `Upstash-Signature` returns `401`.
