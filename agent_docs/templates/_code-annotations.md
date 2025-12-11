# Code Annotation Standard

> **Use these annotations to inject context directly into code.**
> Claude reads these to understand purpose, history, and patterns.

## File Header

Add at the top of significant files:

```typescript
/**
 * @file Feature Name
 * @description Brief description of what this file does
 * @created TASK-XXX (date)
 * @see agent_docs/[relevant-doc].md
 *
 * @pattern [Architecture pattern used, e.g., "QStash fan-out"]
 * @depends [Key dependencies this relies on]
 */
```

## Function/Component Annotations

```typescript
/**
 * @context Why this exists, business context
 * @param x - What this parameter means in business terms
 * @returns What the return value represents
 *
 * @example
 * // How to use this
 *
 * @gotcha Watch out for X edge case
 * @see Related function or doc
 */
```

## Inline Context

```typescript
// @why: Explain non-obvious decisions
const BATCH_SIZE = 10; // @why: QStash payload limit

// @context: Brief explanation
// This uses fan-out because sequential was too slow for 1000 creators
await dispatchToWorkers(keywords);

// @gotcha: Edge case or known issue
// @gotcha: Empty array crashes downstream, must check
if (results.length === 0) return [];

// @todo(TASK-XXX): Link to task
// @todo(TASK-002): Refactor when splitting this file

// @deprecated(TASK-XXX): Mark old code
// @deprecated(TASK-004): Remove after V2 migration
```

## Section Markers

For large files (before splitting):

```typescript
// ============================================================================
// SECTION: Types and Interfaces
// ============================================================================

// ============================================================================
// SECTION: Helper Functions
// ============================================================================

// ============================================================================
// SECTION: Main Component
// ============================================================================
```

## Architecture Decision Records (in code)

```typescript
/**
 * @adr Why we chose X over Y
 *
 * Context: We needed to handle N concurrent users
 *
 * Decision: Use QStash fan-out instead of sequential processing
 *
 * Consequences:
 * - Pro: 10x faster for large searches
 * - Pro: Users see results progressively
 * - Con: More complex error handling
 * - Con: Harder to debug
 *
 * @see agent_docs/v2-fan-out-architecture.md
 */
```

## Tag Reference

| Tag | Use |
|-----|-----|
| `@file` | File purpose |
| `@context` | Business/domain context |
| `@why` | Non-obvious decision |
| `@gotcha` | Edge case, pitfall |
| `@todo(TASK-X)` | Linked to task |
| `@deprecated(TASK-X)` | To be removed |
| `@see` | Reference to docs |
| `@pattern` | Architecture pattern |
| `@adr` | Architecture Decision Record |
| `@created` | Origin task |

## When to Annotate

**Always annotate:**
- Non-obvious business logic
- Workarounds and hacks
- Performance-critical code
- Integration points with external APIs
- Anything you'd explain in PR review

**Don't over-annotate:**
- Self-explanatory code
- Standard patterns
- Obvious variable names
