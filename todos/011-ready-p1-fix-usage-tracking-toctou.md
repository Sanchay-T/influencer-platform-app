---
status: ready
priority: p1
issue_id: "011"
tags: [billing, data-integrity]
dependencies: []
---

# Fix Usage Tracking TOCTOU Race (P0 #11)

## Problem Statement

Plan limit enforcement is vulnerable to a race condition: validation and increment happen as separate operations, allowing concurrent requests to exceed limits.

## Findings

- File: `lib/billing/usage-tracking.ts`
- Risk: users can exceed plan limits; revenue leakage.

## Proposed Solutions

### Option 1: Single atomic DB operation (recommended)

**Approach:** use a transaction or a single `UPDATE ... WHERE ...` that increments only if within limit.

### Option 2: Distributed lock

**Approach:** lock per user (Redis) while checking/incrementing.

## Recommended Action

Option 1 (atomic DB write).

## Acceptance Criteria

- [ ] Concurrent requests cannot exceed plan limits.
- [ ] Add a concurrency test or script to prove correctness.
- [ ] No significant perf regression.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.
