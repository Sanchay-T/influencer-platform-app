# Integration Ecosystem: Claude Products + Linear + GitHub + Granola

## Overview: Claude Max Subscription

Everything in the Claude ecosystem available with Max ($100/mo):

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAUDE MAX ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CLAUDE.AI (WEB)           CLAUDE DESKTOP        CLAUDE MOBILE │
│   ─────────────────         ─────────────         ───────────── │
│   • Chat & Projects         • Native app          • iOS/Android │
│   • Artifacts               • MCP servers         • Full access │
│   • Web search              • Local files         • Async tasks │
│   • File analysis           • System prompt       • Notifications│
│                                                                 │
│   CLAUDE CODE (CLI)         CLAUDE CODE (WEB)     CLAUDE SLACK  │
│   ─────────────────         ────────────────      ───────────── │
│   • Terminal agent          • Async execution     • Chat assist │
│   • Full file access        • Mobile monitoring   • Code agent  │
│   • Git operations          • PR creation         • Context-aware│
│   • Hooks & subagents       • Teleport to CLI     • Auto PRs    │
│                                                                 │
│   CLAUDE AGENT SDK          GITHUB APP            MCP PROTOCOL  │
│   ────────────────          ──────────            ──────────── │
│   • Python SDK              • @claude in PRs      • Tool connect│
│   • TypeScript SDK          • Auto implementation • Custom tools│
│   • Custom agents           • Code review         • Extensible  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Claude.ai (Web Interface)

**URL:** claude.ai

### Features
- **Projects** — Organize conversations with shared context
- **Artifacts** — Code, documents, diagrams in side panel
- **Web Search** — Real-time information retrieval
- **File Analysis** — Upload and analyze documents, images, code
- **Extended Thinking** — Deep reasoning mode

### Claude Code on Web
**URL:** claude.ai/code

- Async task execution in cloud
- Sessions persist even if you close browser
- Monitor from any device
- Create PRs directly
- Teleport sessions back to terminal

---

## 2. Claude Desktop App

**Platforms:** macOS (Intel/Apple Silicon), Windows (x64/ARM64)

### Features
- Native application performance
- **MCP Server Support** — Connect to external tools
- Local file access
- Custom environment variables
- Parallel sessions with Git worktrees

### MCP Integration
Model Context Protocol allows connecting:
- Linear (issue management)
- Slack (messaging)
- Databases
- Custom tools

---

## 3. Claude Mobile (iOS/Android)

### Features
- Full Claude access on mobile
- Claude Code on web access
- Start async tasks
- Monitor running sessions
- Review and approve PRs
- Push notifications

### Mobile Workflow
1. Start task from phone: "Fix the auth bug"
2. Claude Code runs in cloud
3. Get notified when complete
4. Review diff, merge PR — all from phone

---

## 4. Claude Code (CLI)

**Install:** `npm install -g @anthropic-ai/claude-code`

### Capabilities
- Full terminal-based coding agent
- Read/write/edit files
- Execute bash commands
- Git operations
- Run tests, builds, deployments

### Key Features
- **Hooks** — Automate on tool events
- **Subagents** — Specialized task delegation
- **Slash Commands** — Custom workflows
- **Plan Mode** — Iterate before execution
- **Session Management** — Resume, teleport

---

## 5. Claude for Slack

### Claude Chat in Slack
- @Claude in any channel or DM
- Search Slack history for context
- Answer questions using workspace knowledge
- Web search capabilities

### Claude Code in Slack
- @Claude with coding intent → full implementation
- Reads thread/channel context
- Auto-selects GitHub repository
- Posts progress updates
- Creates PRs with action buttons

### Routing Modes
| Mode | Behavior |
|------|----------|
| Code only | All mentions → Claude Code |
| Code + Chat | AI routes based on intent |

### Requirements
- Max plan for full Slack connector
- Slack admin approval
- GitHub connected

---

## 6. Claude Agent SDK

**Languages:** Python, TypeScript

### What It Is
Programmatic access to Claude Code capabilities for building custom agents.

### Capabilities
- Read and analyze files
- Edit code files
- Run bash commands
- Search repositories
- Define custom tools as functions
- In-process MCP server integration
- Full agent loop control

### Use Cases
- Custom CI/CD integrations
- Automated workflows
- Domain-specific agents
- Enterprise automation

---

## 7. GitHub Integration

### GitHub App
**Install:** `claude /install-github-app`

### Triggers
- @claude mentions in PR comments
- @claude mentions in issues
- Issue assignments
- Labels (e.g., "claude" label)

### Capabilities
- Code implementation from issue descriptions
- PR code review
- Bug fixes
- Refactoring
- Test generation

### GitHub Actions

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 8. MCP (Model Context Protocol)

**What It Is:** Open standard for connecting AI agents to external systems.

### How It Works
- Implement MCP once in your agent
- Unlocks ecosystem of integrations
- Bidirectional communication

### Available MCP Servers
- Linear (issue management)
- Slack (messaging)
- GitHub (code)
- Databases (PostgreSQL, etc.)
- Custom tools

### Configuration
```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-linear"]
    }
  }
}
```

---

## External Tools (Not Claude, But Integrate)

### Linear
- Issue tracking
- Native Slack integration (@Linear agent)
- Native GitHub integration (auto-link PRs)
- MCP server available

### Granola
- AI meeting notes
- Posts summaries to Slack
- Action item extraction

### GitHub
- Code hosting
- PR workflow
- Claude GitHub App integration

---

## Integration Chains (Claude Products Only)

### Chain 1: Slack → Code → PR

```
Slack: "@claude fix the auth bug"
    ↓
Claude Code in Slack detects coding intent
    ↓
Creates Claude Code session on web
    ↓
Posts progress to Slack thread
    ↓
Creates PR with "View Session" button
```

### Chain 2: Mobile → Cloud → Terminal

```
Phone: Start task at claude.ai/code
    ↓
Task runs async in cloud
    ↓
Get notification when complete
    ↓
Computer: `claude --teleport` to continue locally
```

### Chain 3: GitHub → Implementation

```
GitHub issue: "Add dark mode support"
    ↓
Comment: "@claude implement this"
    ↓
Claude Code analyzes issue + codebase
    ↓
Opens PR with implementation
```

### Chain 4: CLI → Cloud (Parallel)

```
Terminal: & Fix bug A
Terminal: & Implement feature B
Terminal: & Write tests for C
    ↓
3 parallel cloud sessions running
    ↓
/tasks to monitor all
    ↓
/teleport to pull any back
```

---

## Sources

- [Claude Code Documentation](https://code.claude.com/docs)
- [Claude Code in Slack](https://code.claude.com/docs/en/slack)
- [Claude Desktop](https://code.claude.com/docs/en/desktop)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python)
- [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [MCP Protocol](https://code.claude.com/docs/en/mcp)
