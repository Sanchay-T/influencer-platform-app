---
status: ready
priority: p1
issue_id: "016"
tags: [build, quality]
dependencies: []
---

# Remove ignoreBuildErrors / ignoreDuringBuilds (P0 #17)

## Problem Statement

TypeScript and lint errors are ignored during builds, so broken code can ship to production.

## Findings

- File: `next.config.mjs`
- Related: repo currently has known TypeScript errors (audit noted this explicitly).

## Proposed Solutions

### Option 1: Turn off ignores and fix errors (recommended)

**Approach:**
- Set ignores to false
- Fix current build-breaking TypeScript/lint errors
- Add CI gating to prevent regression

### Option 2: Gradual enforcement

**Approach:** temporarily keep ignores but only for specific paths, and burn down debt.

## Recommended Action

Option 2 if you need to ship, but target Option 1 quickly (this is a safety-net).

## Acceptance Criteria

- [ ] Builds fail on TypeScript errors.
- [ ] Builds fail on lint errors (or agreed lint baseline).
- [ ] CI enforces the same locally.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.
