---
status: ready
priority: p1
issue_id: "012"
tags: [billing, bug]
dependencies: []
---

# Fix getUserBilling WHERE Clause Bug (P0 #12)

## Problem Statement

`getUserBilling` has a self-referential WHERE (`eq(col, col)`) that is always true, returning incorrect billing records.

## Findings

- File: `lib/db/queries/user-queries.ts` (audit points to line ~510)
- Impact: incorrect billing state, entitlements bugs.

## Proposed Solutions

### Option 1: Fix the predicate (recommended)

**Approach:** replace `eq(col, col)` with `eq(col, userId)` (or correct FK), add a unit test.

## Recommended Action

Implement Option 1 and add regression coverage.

## Acceptance Criteria

- [ ] Correct billing record returned for user.
- [ ] Add a test covering the prior bug.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.
