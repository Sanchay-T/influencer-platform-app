# Claude Code: Complete Capabilities Reference

## Platforms & Access Points

### 1. Terminal (CLI)

The core experience. Full local access with all tools.

```bash
claude                    # Start interactive session
claude "prompt"           # Start with initial prompt
claude -p "prompt"        # Headless mode (one-shot, exit after)
claude -c                 # Continue most recent session
claude --resume           # Browse and select past session
```

### 2. Claude Code on the Web (claude.ai/code)

Cloud execution with persistence.

**Key Features:**
- Tasks run asynchronously (even if you close browser/phone)
- Monitor from anywhere (web, iOS app, Android)
- Create PRs directly from web interface
- Full conversation history preserved

**Limitations:**
- GitHub repositories only (GitLab planned Q2 2026)
- Sessions expire after 24h continuous / 8h inactivity

### 3. Desktop App

Parallel local sessions with cloud integration.

**Features:**
- Git worktrees for isolated parallel work (`~/.claude-worktrees`)
- Launch cloud sessions directly ("remote environment" option)
- Automatic PATH extraction for dev tools
- Custom environment variables support

### 4. Mobile (iOS/Android Claude App)

Access Claude Code on the web from your phone.

**Capabilities:**
- Start new tasks
- Monitor running sessions
- Review results and PRs
- Continue conversations

---

## Session Management

### Moving Work Between Devices

#### Terminal → Cloud (Push)

```bash
# Prefix any message with & to send to cloud
& Fix the authentication bug and open a PR

# Or from command line
claude --remote "Fix the bug in src/auth"
```

Each `&` creates a new independent cloud session. Run many in parallel.

#### Cloud → Terminal (Teleport)

```bash
claude --teleport                 # Interactive session picker
claude --teleport <session-id>   # Resume specific session

# Or inside Claude Code:
/teleport                         # Same as above
/tp                               # Alias
```

**What happens during teleport:**
1. Verifies you're in correct repository
2. Fetches and checks out the branch
3. Loads full conversation history

**Requirements:**
- Clean git state (no uncommitted changes)
- Same repository (not a fork)
- Branch pushed to remote
- Same Claude account

### Background Tasks

```bash
/tasks                    # List all running cloud sessions
# Press 't' to teleport into one
```

---

## Slash Commands

### Built-in Commands

| Command | Purpose |
|---------|---------|
| `/help` | Show all commands |
| `/clear` | Clear conversation history |
| `/compact` | Compress context (manual trigger) |
| `/exit` | End session |
| `/rewind` | Undo changes (also: Esc + Esc) |
| `/teleport` (`/tp`) | Pull cloud session to terminal |
| `/tasks` | Monitor background sessions |
| `/config` | Adjust settings |
| `/permissions` | Manage tool permissions |
| `/allowed-tools` | Configure allowed tools |
| `/cost` | Show API usage |
| `/status` | Version and connectivity info |
| `/hooks` | Configure hooks interactively |
| `/agents` | Create subagents |
| `/install-github-app` | Set up GitHub integration |
| `/context` | View/manage context |
| `/memory` | Session memory management |

### Custom Commands

Create in `.claude/commands/` (project) or `~/.claude/commands/` (global).

**Structure:**
```markdown
---
description: What this command does
---

Your prompt template here.

Can include:
- $ARGUMENTS for user input
- Inline bash: $(git status)
```

**Examples from Boris:**
- `/commit-push-pr` — Stages, commits, pushes, creates PR
- `/test-and-commit` — Runs tests, commits only if passing

---

## CLI Flags Reference

### Session Control

| Flag | Purpose |
|------|---------|
| `-c` | Continue most recent conversation |
| `--resume` | Browse past sessions |
| `--resume <id>` | Resume specific session |
| `--teleport` | Pull cloud session |
| `--teleport <id>` | Pull specific cloud session |
| `-r <id> "prompt"` | Resume and send new prompt |

### Output & Automation

| Flag | Purpose |
|------|---------|
| `-p "prompt"` | Headless mode (non-interactive) |
| `--output-format json` | JSON output for scripting |
| `--output-format stream-json` | Streaming JSON |
| `--verbose` | Debug output |

### System Prompt

| Flag | Purpose |
|------|---------|
| `--system-prompt` | Remove defaults completely |
| `--system-prompt-file <path>` | Load from file |
| `--append-system-prompt "text"` | Add to defaults |

### Permissions

| Flag | Purpose |
|------|---------|
| `--dangerously-skip-permissions` | Skip all prompts (use carefully) |

### Other

| Flag | Purpose |
|------|---------|
| `@filename` | Reference files (tab-completion) |
| `!command` | Execute shell command in session |

---

## Plan Mode

Toggle with **Shift+Tab** (twice).

**In Plan Mode:**
- Claude can only read files and explore
- Cannot make changes
- Use for iterating on approach before execution

**Boris's Pattern:**
1. Start in Plan Mode
2. Iterate until plan is perfect
3. Switch to auto-accept mode
4. Claude executes plan (often one-shots it)

---

## Cloud Environment

### What's Available

- Full bash/shell
- Python, Node.js, language runtimes
- Git (through secure proxy)
- Development tools
- Network (disabled by default, configurable)

### Security Model

- Isolated VM per session
- Git credentials never enter sandbox
- Push restricted to current branch only
- Automatic cleanup after completion
- Audit logging

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+Tab` | Toggle auto-accept mode |
| `Shift+Tab` (twice) | Toggle plan mode |
| `Esc + Esc` | Rewind (undo) |
| `Tab` | Autocomplete files |

---

## Configuration Files

| File | Scope | Purpose |
|------|-------|---------|
| `~/.claude/settings.json` | Global | User-wide settings |
| `.claude/settings.json` | Project | Team settings (git) |
| `.claude/settings.local.json` | Project | Personal (gitignored) |
| `CLAUDE.md` | Project/Global | Auto-loaded documentation |
| `.claude/commands/` | Project | Custom slash commands |
| `.claude/agents/` | Project | Custom subagents |
| `.worktreeinclude` | Project | Files to copy to worktrees |

---

## Sources

- [Claude Code on the Web](https://code.claude.com/docs/en/claude-code-on-the-web)
- [CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Slash Commands](https://code.claude.com/docs/en/slash-commands)
- [Desktop](https://code.claude.com/docs/en/desktop)
- [Settings](https://code.claude.com/docs/en/settings)
