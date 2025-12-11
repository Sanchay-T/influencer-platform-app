# Delegation Guide

> **When and how to use subagents (Task tool) effectively.**

---

## When to Delegate

### ✅ Good Candidates

| Scenario | Example |
|----------|---------|
| **Parallel independent work** | "Update 5 different files" → 5 subagents |
| **Research while working** | Subagent explores codebase, you continue coding |
| **Background tasks** | "Run tests" while you do other work |
| **Specialized review** | Security audit, performance review |
| **Exploration** | "Find all usages of X function" |

### ❌ Don't Delegate

| Scenario | Why |
|----------|-----|
| Sequential dependent tasks | Need A's output before doing B |
| Tasks needing conversation context | Subagent won't know what user said |
| Quick simple tasks | Overhead not worth it |
| Tasks that modify shared state | Risk of conflicts |

---

## Task Markers

In `tasks.md`, mark tasks with their delegation status:

```markdown
### Checklist
- [ ] Update schema *(sequential)*
- [ ] Update API routes *(delegate)*
- [ ] Update frontend *(delegate)*
- [ ] Run tests *(background)*
- [ ] Cleanup *(sequential, needs above)*
```

| Marker | Meaning |
|--------|---------|
| `*(sequential)*` | Must be done in order, don't delegate |
| `*(delegate)*` | Can run in parallel, safe to delegate |
| `*(background)*` | Can run while you do other work |

---

## Standard Subagent Prompt

When spawning a subagent, ALWAYS use this structure:

```
## Context
Read agent_docs/tasks.md for current project state.
[Optional: Read agent_docs/templates/X.md for patterns]

## Your Task
[Specific task from checklist — ONE item only]

## Constraints
- Only modify files related to your task
- Don't update tasks.md or other docs
- Report back what you changed

## When Done
Tell me:
1. What files you changed
2. What you did
3. Any issues or blockers
```

### Example

```
## Context
Read agent_docs/tasks.md for current project state.
Use agent_docs/templates/feature-implementation.md as guide.

## Your Task
Update the API route at app/api/v2/dispatch/route.ts to add input validation.

## Constraints
- Only modify the dispatch route
- Don't update tasks.md
- Follow existing patterns in the codebase

## When Done
Tell me what validation you added and any edge cases to watch for.
```

---

## The Flow

```
YOU (main Claude)
│
├── Read tasks.md
│   See: "- [ ] Update API *(delegate)*"
│
├── Decide to delegate
│   (It's marked delegate, independent, clear scope)
│
├── Spawn subagent with standard prompt
│   "Read tasks.md... Your task: Update API..."
│
├── Continue other work (or wait)
│
├── Subagent returns:
│   "Changed dispatch/route.ts, added Zod validation"
│
└── YOU update tasks.md:
    "- [x] Update API *(delegate)*"
```

---

## Rules

1. **Subagents don't update tasks.md** — You stay in control
2. **One task per subagent** — Keep scope clear
3. **Always include context prompt** — "Read tasks.md first"
4. **Verify before marking done** — Check their work if critical

---

## Parallel Delegation

For multiple parallel tasks:

```
You see in tasks.md:
- [ ] Update API routes *(delegate)*
- [ ] Update frontend form *(delegate)*
- [ ] Add tests *(delegate)*

You can spawn 3 subagents simultaneously:
1. Subagent A → API routes
2. Subagent B → Frontend form
3. Subagent C → Tests

Wait for all, then update tasks.md with results.
```

---

## When Subagents Fail

If a subagent reports issues:

1. **Blocker found** → Add to tasks.md Context section
2. **Partial completion** → Note what's done, what's left
3. **Needs clarification** → You clarify and re-delegate or do yourself

---

## Quick Reference

```
DELEGATE when:
├── Task marked *(delegate)* or *(background)*
├── Independent (no dependencies)
├── Clear scope (one checklist item)
└── Doesn't need conversation context

DON'T DELEGATE when:
├── Task marked *(sequential)*
├── Depends on other tasks
├── Needs user's specific requirements
└── Modifies shared state (tasks.md, etc.)

ALWAYS in subagent prompt:
├── "Read agent_docs/tasks.md"
├── Specific single task
├── "Don't update tasks.md"
└── "Report back what you changed"
```
