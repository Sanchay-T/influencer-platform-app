# Current Gemz Setup

What's already configured in this repository.

---

## Hooks

### `.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|mcp__morph-mcp__edit_file",
        "hooks": [
          { "command": "lint.sh", "timeout": 30 },
          { "command": "check-length.sh", "timeout": 3 }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          { "command": "pre-compact.sh", "timeout": 180 }
        ]
      }
    ]
  }
}
```

### Hook Scripts

| Script | Purpose |
|--------|---------|
| `lint.sh` | Auto-runs Biome on TS/JS files after edits |
| `check-length.sh` | Warns when files exceed 300 lines |
| `pre-compact.sh` | Saves state to `tasks.md` before context clears |

---

## Slash Commands

Located in `.claude/commands/`:

| Command | Purpose |
|---------|---------|
| `/new` | Generate PRD + task from user request |
| `/done` | Archive current task, extract template |
| `/status` | Show current progress |
| `/orient` | Get oriented at session start |
| `/split` | Create a file split plan |
| `/health` | Run codebase health check |

---

## Memory System

### Task Tracking Files

| File | Purpose |
|------|---------|
| `agent_docs/tasks.md` | **Primary** — Checklist + exact next action |
| `agent_docs/current-task.md` | Full PRD/spec for current task |
| `agent_docs/monologue.md` | Audit trail |
| `agent_docs/templates/` | Reusable patterns |
| `agent_docs/archive/` | Completed tasks |

### How It Works

1. **PreCompact hook** spawns Sonnet to update `tasks.md` before context clears
2. After compact, agent reads `tasks.md` to know what to do
3. Checklist items marked as complete
4. "Next Action" tells exactly what file/function/step is next

---

## CLAUDE.md Structure

The main `CLAUDE.md` includes:

- Project overview (Gemz/UseGems.io)
- Session continuity instructions (memory system)
- Tech stack (Next.js 15, Clerk, Drizzle, Stripe, etc.)
- User journey documentation
- Commands reference
- Folder structure
- Code rules:
  - Server Components default
  - No `any` types
  - Drizzle inferred types
  - 300-line file limit
  - Biome linting
- Git workflow
- Testing verification

---

## Linear Integration

**Team:** Gemz (ID: `9757fde8-86b2-493f-8b7e-565ef49db4f5`)

**Statuses:**
- Backlog
- Todo
- In Progress
- Done
- Canceled
- Duplicate

**No projects created yet.**

---

## MCP Servers

From global settings, the following MCP servers are available:

| Server | Purpose |
|--------|---------|
| `linear-server` | Linear issue management |
| `claude-in-chrome` | Browser automation |
| `morph-mcp` | Fast file editing |
| `warpgrep` | Semantic code search |

---

## What's NOT Set Up Yet

1. **GitHub App** — Not installed (`claude /install-github-app` not run)
2. **Linear ↔ Slack integration** — Not configured
3. **Linear ↔ GitHub integration** — Not configured
4. **Claude Code in Slack** — Requires Claude Team/Enterprise
5. **GitHub Actions workflow** — Created but not pushed

---

## Delegation Guide

From `agent_docs/delegation.md`:

- Only delegate tasks marked `*(delegate)*` in tasks.md
- Always tell subagent: "Read agent_docs/tasks.md first"
- Subagents report back — YOU update tasks.md

---

## Code Annotations

From `templates/_code-annotations.md`:

| Annotation | Purpose |
|------------|---------|
| `@context` | Why this exists |
| `@why` | Non-obvious decisions |
| `@gotcha` | Edge cases, pitfalls |
| `@todo(TASK-X)` | Linked to task |
| `@see` | Reference to docs |

---

## Testing

### API Testing
- Test auth system available for API testing without Clerk
- E2E with real Clerk: `npx tsx testing/api-suite/sandbox/e2e-clerk-sandbox.ts`

### Verification Checklist
1. Lint (`npx biome check --write <files>`)
2. Type check
3. Test the feature
4. Tell user how to verify in UI
