# Code Review & Security Review

## Overview

Claude Code provides automated code review and security review capabilities at multiple levels:
1. **Slash commands** — Run locally during development
2. **GitHub Actions** — Automated on every PR
3. **Built-in plugins** — Extensible review capabilities

---

## Slash Commands

### `/security-review`

Comprehensive security analysis of pending changes.

```bash
/security-review
```

**What it checks:**
- Authentication & authorization issues
- Data exposure risks
- Cryptographic issues
- Input validation problems
- Business logic flaws
- Configuration security
- Supply chain vulnerabilities
- Code execution risks
- Cross-site scripting (XSS)

**Anthropic uses this internally** to secure Claude Code itself. It has caught real vulnerabilities before shipping.

### `/code-review`

Automated code review using multiple specialized agents.

```bash
/code-review
```

**How it works:**
1. Launches 4 review agents in parallel
2. Each agent scores issues for confidence
3. Outputs only issues with confidence ≥80%

**Categories reviewed:**
- Code quality
- Best practices
- Performance
- Maintainability
- Security (overlaps with security-review)

---

## GitHub Actions

### Claude Code Security Review Action

**Repository:** [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)

**What it does:**
- Automatically reviews every PR for security vulnerabilities
- Uses Claude for deep semantic analysis
- Lower false positives than traditional static analysis
- Provides detailed explanations and fix suggestions

**Setup:**

```yaml
name: Security Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  security-review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-security-review@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Real example from Anthropic:**
> Built a feature relying on a local HTTP server. The action identified a remote code execution vulnerability exploitable through DNS rebinding. Fixed before merge.

### Claude Code Action (General Purpose)

**Repository:** [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)

**Capabilities:**
- Intelligent mode detection
- Interactive code assistant
- Code review with improvement suggestions
- Code implementation for fixes
- PR/Issue integration

**Triggers:**
- @claude mentions in PR comments
- Issue assignments
- Labels
- PR opened/synchronized

**Setup:**

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, labeled]

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

## Code Review Plugin

Built-in plugin for structured code review.

**Location:** `plugins/code-review/` in Claude Code installation

**Usage:**
```bash
/code-review --pr 123
```

**Features:**
- Multi-agent parallel review
- Confidence scoring
- Categorized feedback
- Actionable suggestions

---

## Best Practices

### When to Use Each

| Scenario | Tool |
|----------|------|
| Before committing | `/security-review`, `/code-review` |
| Every PR (automated) | GitHub Actions |
| Quick check | `/security-review` |
| Deep review | `/code-review` with multiple agents |

### Configuration

**Security review customization:**
- Add organization-specific requirements
- Customize in `.claude/security-rules.md`

**Code review thresholds:**
- Adjust confidence threshold (default 80%)
- Filter by category

### Integration with Workflow

1. **Pre-commit hook** — Run security review before commit
2. **PR automation** — GitHub Action reviews automatically
3. **Slack notification** — Get alerted on critical issues

---

## Security Issues Detected

| Category | Examples |
|----------|----------|
| Authentication | Missing auth checks, weak session handling |
| Authorization | Privilege escalation, IDOR |
| Data exposure | Logging secrets, PII leaks |
| Cryptography | Weak algorithms, hardcoded keys |
| Input validation | SQL injection, command injection |
| Business logic | Race conditions, bypass vulnerabilities |
| Configuration | Debug mode in production, weak CORS |
| Supply chain | Vulnerable dependencies, typosquatting |
| Code execution | Eval injection, unsafe deserialization |
| XSS | Reflected XSS, stored XSS, DOM XSS |

---

## Sources

- [Claude Code Security Review Action](https://github.com/anthropics/claude-code-security-review)
- [Claude Code Action](https://github.com/anthropics/claude-code-action)
- [Anthropic Blog: Automate Security Reviews](https://www.anthropic.com/news/automate-security-reviews-with-claude-code)
- [Claude Help: Automated Security Reviews](https://support.claude.com/en/articles/11932705-automated-security-reviews-in-claude-code)
