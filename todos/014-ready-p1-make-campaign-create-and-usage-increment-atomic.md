---
status: ready
priority: p1
issue_id: "014"
tags: [billing, campaigns, data-integrity]
dependencies: ["011"]
---

# Make Campaign Creation + Usage Increment Atomic (P0 #14)

## Problem Statement

Campaign creation and usage increments are not atomic; crashes/timeouts can cause counter drift.

## Findings

- File: `app/api/campaigns/route.ts` (audit points to lines ~56-78)
- Impact: usage counters desync from reality.

## Proposed Solutions

### Option 1: Wrap in a DB transaction (recommended)

**Approach:** in one transaction: create campaign + increment usage; commit together.

### Option 2: Reconciliation-only

**Approach:** accept drift and rely on reconciliation jobs.

## Recommended Action

Option 1.

## Acceptance Criteria

- [ ] Campaign creation cannot succeed without usage increment.
- [ ] Usage increment cannot occur without campaign record.
- [ ] Add regression coverage.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.
