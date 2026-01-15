# Research: Maximum Productivity Workflow

Research on Claude Max subscription products and integrations for designing a unified productivity system.

---

## Documents

| File | Contents |
|------|----------|
| [00-problem-statement.md](./00-problem-statement.md) | What you want to solve, Claude Max products list |
| [01-claude-code-capabilities.md](./01-claude-code-capabilities.md) | All Claude Code features: platforms, commands, CLI flags |
| [02-integration-ecosystem.md](./02-integration-ecosystem.md) | Full Claude Max ecosystem + external integrations |
| [03-boris-workflow.md](./03-boris-workflow.md) | Boris Cherny's workflow (creator of Claude Code) |
| [04-hooks-subagents-automation.md](./04-hooks-subagents-automation.md) | Hooks, subagents, automation patterns |
| [05-current-gemz-setup.md](./05-current-gemz-setup.md) | What's already configured in this repo |
| [06-code-security-review.md](./06-code-security-review.md) | Code review & security review features |
| [07-obsidian-claude-integration.md](./07-obsidian-claude-integration.md) | Obsidian + Claude workflows, MCP setup, community patterns |

---

## Claude Max Subscription ($100/mo) — All Products

### Chat & Interface
| Product | Platform | Key Features |
|---------|----------|--------------|
| **Claude.ai** | Web | Projects, Artifacts, Web Search, File Analysis, Extended Thinking |
| **Claude Desktop** | macOS/Windows | MCP servers, Local files, Native performance |
| **Claude Mobile** | iOS/Android | Full access, Async tasks, Push notifications |

### Coding & Development
| Product | Access | Key Features |
|---------|--------|--------------|
| **Claude Code CLI** | Terminal | Full agent, Hooks, Subagents, Slash commands, Git |
| **Claude Code Web** | claude.ai/code | Async execution, Mobile monitoring, Teleport, PR creation |
| **Claude Code Slack** | Slack workspace | @Claude → full implementation, Context-aware, Auto PRs |

### Building & Integration
| Product | Language | Key Features |
|---------|----------|--------------|
| **Claude Agent SDK** | Python/TypeScript | Custom agents, Tool definition, Full control |
| **GitHub App** | GitHub | @claude in PRs/issues, Code review, Implementation |
| **MCP Protocol** | Any | Connect to Linear, Slack, DBs, Custom tools |

---

## Session Management & Handoff

### Moving Work Between Devices

| From | To | Method |
|------|-----|--------|
| Terminal | Cloud | `& your task` prefix |
| Cloud | Terminal | `/teleport` or `--teleport` |
| Web | Mobile | Auto-sync (same account) |
| Mobile | Terminal | Start on phone → teleport later |

### Parallel Execution

```bash
& Task A          # Runs in cloud
& Task B          # Runs in cloud (parallel)
& Task C          # Runs in cloud (parallel)

/tasks            # Monitor all
/teleport         # Pull one back
```

---

## Key Workflows Discovered

### Boris Cherny's Setup (Creator of Claude Code)
- 15+ parallel Claude sessions
- Opus 4.5 only (fewer iterations = faster)
- Plan mode first → auto-execute
- Verification loops = 2-3x quality
- Slash commands for daily workflows

### Integration Chains

**Slack → Code → PR:**
```
@claude fix the bug → Claude Code session → PR created
```

**Mobile → Cloud → Terminal:**
```
Phone task → Async cloud → /teleport to continue
```

**GitHub → Implementation:**
```
Issue comment @claude → Full implementation → PR opened
```

---

## External Tools (Not Claude, Integrate Via MCP/Native)

| Tool | Purpose | Integration |
|------|---------|-------------|
| **Linear** | Issue tracking | MCP server, native Slack/GitHub |
| **GitHub** | Code hosting | GitHub App, Actions |
| **Slack** | Communication | Claude for Slack, Claude Code for Slack |
| **Granola** | Meeting notes | Posts to Slack |

---

## Sources

- [Claude Code Docs](https://code.claude.com/docs)
- [Claude Code on Web](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Claude Code in Slack](https://code.claude.com/docs/en/slack)
- [Claude Desktop](https://code.claude.com/docs/en/desktop)
- [Claude Agent SDK (Python)](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Agent SDK (TypeScript)](https://github.com/anthropics/claude-agent-sdk-typescript)
- [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [MCP Protocol](https://code.claude.com/docs/en/mcp)
- [Security Review](https://www.anthropic.com/news/automate-security-reviews-with-claude-code)
- [Boris Cherny's Workflow](https://twitter.com/bcherny)
