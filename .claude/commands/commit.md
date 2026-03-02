---
name: commit
description: Analyze changes and create a structured commit
---

You are creating a commit for the Gemz codebase. Follow this structured flow:

## Step 1: Gather Context
Run these commands in parallel:
- `git status` — see all changed/untracked files
- `git diff --cached` — see staged changes
- `git diff` — see unstaged changes
- `git log --oneline -5` — recent commit style

## Step 2: Analyze Changes
Review ALL staged and unstaged changes. Determine:
- **What changed**: files modified, added, removed
- **Why it changed**: the purpose/intent of the changes
- **Category**: pick the right commit prefix:
  - `feat:` — new functionality
  - `fix:` — bug fix
  - `refactor:` — restructuring without behavior change
  - `perf:` — performance improvement
  - `chore:` — maintenance, dependencies, config
  - `docs:` — documentation only
  - `test:` — adding or updating tests
  - `style:` — formatting, whitespace (no logic change)

## Step 3: Pre-commit Checks
Run these before committing:
1. `pnpm typecheck` — must pass with no errors
2. `npx biome check --write .` — fix any lint issues

If either fails, fix the issues first. Do NOT commit with errors.

## Step 4: Stage & Commit
- Stage specific files (avoid `git add -A` to prevent accidental inclusions)
- NEVER stage `.env`, `*.pem`, `*.key`, credentials, or secrets
- Create commit with a HEREDOC message:

```bash
git commit -m "$(cat <<'EOF'
<prefix>: <concise summary of what changed>

<optional body: bullet points explaining why, not what>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

## Step 5: Verify
Run `git status` to confirm clean state. Report the commit hash and summary.

## Rules
- Keep the subject line under 72 characters
- Focus on WHY, not WHAT (the diff shows what)
- One logical change per commit — if changes are unrelated, suggest splitting
- Never use `--no-verify` or skip hooks
- Never amend unless explicitly asked
- Never push unless explicitly asked
