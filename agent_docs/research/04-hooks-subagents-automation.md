# Hooks, Subagents & Automation

## Hooks

Hooks are shell scripts that run at specific points in Claude Code's workflow.

### Available Hook Events

| Event | When It Fires | Can Block? |
|-------|---------------|------------|
| `PreToolUse` | Before tool execution | Yes |
| `PostToolUse` | After tool completion | No |
| `UserPromptSubmit` | When user submits prompt | Yes |
| `PermissionRequest` | When permission dialog shown | Yes |
| `Stop` | When Claude finishes responding | No |
| `SubagentStop` | When subagent finishes | No |
| `SessionEnd` | When session terminates | No |
| `PreCompact` | Before context compression | No |

### Hook Configuration

Location: `.claude/settings.json` or `~/.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "your-script.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Matcher Patterns

| Pattern | Matches |
|---------|---------|
| `Edit|Write` | Edit OR Write tools |
| `Bash(git commit:*)` | Bash with git commit commands |
| `*` or empty | Everything |

### Hook Input/Output

**Input:** JSON via stdin
```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "old_string": "...",
    "new_string": "..."
  }
}
```

**Output:** JSON to stdout
```json
{
  "continue": true,
  "warning": "Optional warning message"
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, continue |
| 2 | Block action, send error to Claude |
| Other | Error, but continue |

### PreToolUse Input Modification (v2.0.10+)

Hooks can modify tool inputs before execution:

```json
{
  "decision": "allow",
  "modified_input": {
    "file_path": "/modified/path.ts"
  }
}
```

Use cases:
- Transparent sandboxing
- Security enforcement (dry-run flags)
- Convention adherence (commit message formatting)

---

## Your Current Gemz Hooks

### 1. Auto-Lint (PostToolUse)

**File:** `.claude/hooks/lint.sh`

**Trigger:** After Edit, Write, or Morph edit

**What it does:**
- Extracts file path from tool input
- If TypeScript/JavaScript file: runs `npx biome check --write`
- Prevents linting issues before commits

### 2. File Length Check (PostToolUse)

**File:** `.claude/hooks/check-length.sh`

**Trigger:** After Edit/Write

**What it does:**
- Checks if file exceeds 300 lines
- Shows warning if over limit
- Reminds Claude to split large files

**Output examples:**
- `⚠️ auth.ts: 342 lines (+42 over limit). Split this file.`
- `📊 api.ts: 275/300 lines`

### 3. Pre-Compact State Save (PreCompact)

**File:** `.claude/hooks/pre-compact.sh`

**Trigger:** Before context compression

**What it does:**
1. Gathers current state (git status, recent commits, modified files)
2. Spawns Sonnet to update `tasks.md` with:
   - Completed checklist items
   - Exact next action
   - Current context
3. Adds compaction marker to `monologue.md`

**Purpose:** Ensures continuity across context compactions. Next agent reads `tasks.md` and knows exactly what to do.

---

## Subagents

Subagents are specialized AI assistants with isolated context.

### Why Use Subagents?

1. **Context isolation** — Verbose operations (tests, logs) stay in subagent context
2. **Specialized expertise** — Different system prompts for different tasks
3. **Tool restrictions** — Limit what each agent can do

### Built-in Subagents

| Agent | Purpose | Tools |
|-------|---------|-------|
| `Explore` | Read-only codebase search | Read, Glob, Grep |
| `Plan` | Research for plan mode | Read, Glob, Grep |
| `general-purpose` | Complex multi-step tasks | All |

### Creating Custom Subagents

**Location:** `.claude/agents/` (project) or `~/.claude/agents/` (global)

**Structure:** Markdown with YAML frontmatter

```markdown
---
name: code-simplifier
description: Simplifies code structure without changing functionality
tools:
  - Read
  - Edit
  - Glob
  - Grep
---

# Code Simplifier

You are a code simplification specialist. Your job is to make code more readable and maintainable without changing its behavior.

## Guidelines
- Prefer composition over inheritance
- Extract repeated code into functions
- Use descriptive variable names
- Remove dead code
- Simplify complex conditionals

## Process
1. Read the file
2. Identify simplification opportunities
3. Make incremental changes
4. Verify behavior unchanged
```

### Creating via Slash Command

```bash
/agents
```

Interactive wizard for creating subagents.

### How Delegation Works

Claude decides whether to delegate based on:
1. **Description field** — Clear descriptions trigger automatic delegation
2. **Task complexity** — Complex multi-step tasks → general-purpose
3. **Tool requirements** — Read-only tasks → Explore

### Best Practices

1. **Clear, non-overlapping roles** — Each agent should have distinct responsibility
2. **Minimal tool access** — Only give tools the agent needs
3. **No nesting** — Subagents cannot spawn other subagents
4. **Explicit invocation** — Can call by name when needed

---

## Automation Patterns

### Pattern 1: Auto-Format on Edit

```json
{
  "PostToolUse": [{
    "matcher": "Edit|Write",
    "hooks": [{
      "type": "command",
      "command": "npx prettier --write \"$CLAUDE_FILE_PATH\""
    }]
  }]
}
```

### Pattern 2: Test Before Commit

```json
{
  "PreToolUse": [{
    "matcher": "Bash(git commit:*)",
    "hooks": [{
      "type": "command",
      "command": "npm test || exit 2"
    }]
  }]
}
```

Exit 2 blocks the commit if tests fail.

### Pattern 3: Security Audit on Sensitive Files

```json
{
  "PreToolUse": [{
    "matcher": "Edit",
    "hooks": [{
      "type": "command",
      "command": "bash check-sensitive-file.sh"
    }]
  }]
}
```

### Pattern 4: GitButler Integration

Post changes to GitButler for automatic branch management:

```json
{
  "PostToolUse": [{
    "matcher": "Edit|Write",
    "hooks": [{
      "type": "command",
      "command": "gitbutler-hook.sh"
    }]
  }]
}
```

### Pattern 5: Ralph Wiggum Loop

For long-running autonomous tasks:

1. Create `/ralph-loop` command
2. Stop hook checks for completion promise
3. If not complete → feed prompt back
4. Iterate until `<promise>COMPLETE</promise>`

---

## CI/CD Integration

### Headless Mode

```bash
claude -p "Fix the TypeScript errors" --output-format json
```

### GitHub Actions

```yaml
- uses: anthropics/claude-code-action@beta
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Triggers on:
- @claude mentions in PR comments
- Issue assignments
- Labels

### Remote Environment Detection

In hooks, check if running in cloud:

```bash
if [ "$CLAUDE_CODE_REMOTE" = "true" ]; then
  # Cloud-specific behavior
fi
```

---

## Sources

- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Subagents](https://code.claude.com/docs/en/sub-agents)
- [Headless Mode](https://code.claude.com/docs/en/headless)
- [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [GitButler Hooks](https://docs.gitbutler.com/features/ai-integration/claude-code-hooks)
