# Gemz Agent Notes

## Canonical Dev Command

Use this single command for local development:

```bash
npm run dev:ngrok
```

Notes:
- There is intentionally no `npm run dev` script in this repo. Use `dev:ngrok`.
- This starts a Next.js dev server on `LOCAL_PORT` (defaults to `3001`) and ensures an ngrok tunnel is up for that port.
- It assumes `ngrok` is installed and authenticated, and uses the permanent domain `usegemz.ngrok.app`.

## Background (macOS/Linux)

If you need it running in the background:

```bash
mkdir -p tmp logs
nohup npm run dev:ngrok > logs/dev-ngrok.log 2>&1 & echo $! > tmp/dev-ngrok.pid
```

Stop it:

```bash
kill $(cat tmp/dev-ngrok.pid)
```

## Delivery Standards

- Ship production-grade implementations that can scale beyond 1000 users; avoid MVP shortcuts.
- Optimize for long-term maintainability and operational reliability.
- Keep a single canonical implementation in the primary codepath; avoid duplicate logic paths.
- Delete legacy, dead, or duplicate paths as part of delivery to preserve one canonical implementation, but only when the user explicitly approves that deletion in the current task.
- Use direct, first-class integrations rather than glue layers or adapter wrappers.
- Keep one source of truth for business rules and policy (validation, enums, flags, constants, config).
- Define strict API invariants: required inputs must be validated up front; fail fast on invalid state.
- Use latest stable libraries and official docs. If unsure, verify with current sources before implementation.
- When web searching, prefer 2026 sources/docs unless an older version is explicitly needed.

## Change Safety

- Keep diffs scoped and intentional.
- If files change unexpectedly, assume parallel work and continue only when edits are clearly unrelated to touched files.
- Stop and ask the user when there is overlap, merge conflict risk, behavioral ambiguity, or breakage.
- Deletion is strict by default: do not delete, move, or overwrite existing files/code unless the user explicitly approves that deletion in the current task.
- If deletion is approved, prefer `trash` over `rm`.

## Codex Prompts and Skills

- Skills live in repo `.codex/skills` and global `~/.codex/skills`.
- If `$<myskill>` is not found locally, explicitly load `~/.codex/skills/<myskill>/SKILL.md` and required `references/` or `scripts/` files.
- Prompts live in `~/.codex/prompts/*.md`.

## Coding Style

- Target <=500 LOC per file change; hard cap 750 LOC (imports and types excluded).
- Keep UI/markup nesting <=3 levels.
- Extract components/helpers when JSX/template repetition grows, responsibilities combine, or conditionals/variants become complex.

## Security Guards

- Never expose secrets in code, logs, or commits; use environment variables or secret stores.
- Validate and sanitize untrusted input to prevent injection, path traversal, SSRF, and unsafe uploads.
- Enforce AuthN/AuthZ and tenant boundaries with least-privilege defaults.
- Be cautious with new dependencies and flag supply-chain or CVE risk before adoption.

## Git Operations

- Use `gh` CLI for GitHub operations (issues, PRs, releases).
- Ask before any `git push`.
- Prefer Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, etc.).

## Pull Requests

- Keep PR descriptions short and structured:
  - Why: 1-2 bullets
  - How: 1-3 bullets
  - Tests: commands run and results
- Create and manage PRs with `gh pr ...`.
- Avoid noise (logs/dumps); include only key context, risks, and screenshots when UX changes.

## Shell Usage

- Prefer built-in tools (`read_file`, `list_dir`, `grep_files`) over ad-hoc shell plumbing when available.
- For shell search, prefer `fd` (files), `rg` (text), `ast-grep` (syntax-aware), and `jq`/`yq` (structured data).
- Keep shell usage deterministic and non-interactive; limit output (for example with `head`) and choose a single consistent result.
