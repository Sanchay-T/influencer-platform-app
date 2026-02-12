---
status: ready
priority: p1
issue_id: "015"
tags: [billing, infra, cron]
dependencies: []
---

# Fix Missing / Broken Vercel Cron Configuration (P0 #15 + #16)

## Problem Statement

Billing reconciliation and trial reminder crons are misconfigured:
- Reconciliation cron not present (never runs)
- Trial reminders cron points to a missing route (daily 404)

## Findings

- File: `vercel.json`
- Impact: stale billing state; silent daily failure.

## Proposed Solutions

### Option 1: Add missing routes + correct `vercel.json` schedules (recommended)

**Approach:**
- Ensure the cron API routes exist
- Ensure the schedules are listed in `vercel.json`
- Add a basic “cron ran” log/metric for visibility

## Recommended Action

Option 1.

## Acceptance Criteria

- [ ] All scheduled cron paths exist and return 200.
- [ ] `vercel.json` includes the intended schedules.
- [ ] Add a quick local verification path (manual invocation).

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.
