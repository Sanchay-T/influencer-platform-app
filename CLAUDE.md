# CLAUDE.md — Instructions for You (Claude Code)

## Project Overview
You are working on **Gemz** (usegems.io) — an AI-powered influencer discovery platform that helps businesses find, organize, and export creators across TikTok, Instagram, and YouTube.

- **Stack:** Next.js 15 (App Router), TypeScript, Supabase + Drizzle ORM, Clerk auth, Stripe billing, QStash, Resend
- **Features:** Keyword search, Similar creator search, Campaign management, List organization, CSV export, Trial/subscription billing
- **Deployment:** Vercel → usegems.io
- **Dev Server:** `npm run dev:ngrok` (canonical local dev command)

## Your Behavior

### Canonical Policy Alignment
`AGENTS.md` and this file are intended to be aligned. If they diverge, update this file to match `AGENTS.md` and keep behavior consistent.

- Ship production-grade implementations that can scale beyond 1000 users; avoid MVP shortcuts.
- Optimize for long-term maintainability and reliability.
- Keep a single canonical implementation in the primary codepath; avoid duplicate logic paths.
- Delete legacy, dead, or duplicate paths as part of delivery only when the user explicitly approves deletion in the current task.
- Use direct, first-class integrations; avoid adapter/glue layers.
- Keep one source of truth for business rules and policy.
- Define strict API invariants: validate required inputs up front and fail fast.
- Use latest stable libraries and official docs; when web searching, prefer 2026 sources/docs unless an older version is explicitly needed.

### Mandatory Self-Checks
You MUST follow these rules on every task:

1. **Verify changes compile before committing**
   - Run `pnpm typecheck` after any code changes
   - Fix all type errors before proceeding

2. **Run tests after modifying code**
   - Run `pnpm test` for affected areas
   - Never commit with failing tests

3. **Check git status before and after operations**
   - `git status` before starting work (know what's dirty)
   - `git status` after commits (verify clean state)
   - `git diff` before committing (review your changes)

4. **Analyze errors before proceeding**
   - If a command fails, read the full error output
   - Understand WHY it failed
   - Fix the root cause, don't just retry

5. **Never commit secrets**
   - No `.env` files
   - No API keys or tokens
   - No credentials in code
   - Check `git diff` for accidental inclusions

6. **Respect parallel edits safely**
   - If files change unexpectedly, continue only when edits are clearly unrelated to touched files
   - Stop and ask the user when there is overlap, merge-conflict risk, ambiguity, or breakage

7. **Respect strict deletion controls**
   - Do not delete, move, or overwrite existing files/code unless the user explicitly approves that deletion in the current task
   - If deletion is approved, prefer `trash` over `rm`

### Self-Correction
When you make a mistake and get corrected, immediately update this file with a rule to prevent it:
```
DO NOT: [the mistake you made]
DO: [the correct approach]
```
End every correction with: "Now update CLAUDE.md so you don't make that mistake again."

### When Things Go Wrong
When an approach isn't working — tests keep failing, types won't resolve, the design feels forced — **stop and re-plan**. Switch to plan mode (shift+tab) and rethink the approach. Don't keep pushing deeper into a failing path.

### Code Style
- You must use TypeScript strict mode
- You must handle errors explicitly, never swallow them
- You must write tests for new features
- You prefer server components unless client interactivity is needed
- You use Drizzle ORM patterns already in the codebase
- No `any` types - use proper typing or `unknown` with type guards
- No `console.log` in production code - use the logging utilities in `lib/logging/`
- Prefer `type` over `interface`; never use `enum` (use string literal unions instead)
- Target <=500 LOC per file change; hard cap 750 LOC (imports and types excluded)
- Keep UI/markup nesting <=3 levels; extract components/helpers when complexity grows

### Security Guards
- Validate and sanitize untrusted input to prevent injection, path traversal, SSRF, and unsafe uploads
- Enforce AuthN/AuthZ and tenant boundaries with least-privilege defaults
- Be cautious with new dependencies and flag supply-chain/CVE risk before adoption

### Database Migrations (Drizzle)
The migration workflow:
```bash
1. Edit lib/db/schema.ts              # make your schema change
2. npx drizzle-kit generate           # generates SQL + snapshot in supabase/migrations/
3. Review the generated SQL            # check for destructive operations (DROP, etc.)
4. npx drizzle-kit migrate            # applies to local DB
5. git add supabase/migrations/       # commit the migration files (always push these!)
```

**Migration files MUST be committed and pushed to git.** They are no longer gitignored. Every schema change must include the generated migration SQL + snapshot so that deploys and other environments stay in sync.

- Migrations run automatically on Vercel deploy (`build` script runs `drizzle-kit migrate` before `next build`)
- Migration files live in `supabase/migrations/` and **must be committed to git**
- Always review generated SQL — if you renamed a column, Drizzle generates DROP + CREATE (data loss). Hand-edit to `ALTER TABLE ... RENAME COLUMN` instead.
- Never manually edit `_journal.json` or snapshot files — only `drizzle-kit generate` should touch those
- Config: `drizzle.config.ts`, schema: `lib/db/schema.ts`, output: `supabase/migrations/`

### Project Structure
- `app/` — Next.js App Router pages and API routes
- `app/api/` — API route handlers
- `components/` — React components (shared in `components/ui/`)
- `lib/` — Core business logic
- `lib/db/` — Drizzle schema and queries
- `lib/hooks/` — Client-side React hooks (billing, trial status, admin, onboarding)
- `lib/services/` — Business services (billing, search, etc.)
- `lib/auth/` — Clerk integration helpers
- `scripts/` — Utility and maintenance scripts
- `supabase/migrations/` — Drizzle migration files (committed to git)
- `supabase/migrations-archive/` — Pre-baseline legacy migrations (reference only)

### Before Making Changes
1. Read the relevant existing code first
2. Check for similar patterns in the codebase
3. Run `pnpm typecheck` before committing
4. Run `pnpm lint` before committing (or `npx biome check --write <files>`)
5. Keep diffs scoped and intentional

### Testing
- Run `pnpm test` to execute tests
- Add tests for new API routes
- Add tests for complex business logic
- Use the test auth system for API testing without Clerk

### Pull Requests
- Keep PR descriptions short and structured:
  - Why: 1-2 bullets
  - How: 1-3 bullets
  - Tests: commands run and results
- Use `gh pr ...` for PR creation and management
- Avoid noise in PRs; include key context, risks, and screenshots when UX changes

### Git Workflow
```bash
# Before starting
git status
git checkout -b fix/short-description  # or feat/, refactor/

# After changes
git diff                               # Review changes
pnpm typecheck && pnpm lint           # Verify quality
git add <specific-files>              # Stage intentionally
git commit -m "fix: description"      # Commit with prefix
# Ask user before pushing
# git push origin HEAD
```

Commit prefixes: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`, `test:`
Ask before any `git push`.

GitHub operations should use `gh` CLI (`gh issue ...`, `gh pr ...`, `gh release ...`).

### Codex Prompts and Skills
- Skills live in repo `.codex/skills` and global `~/.codex/skills`
- If `$<myskill>` is not found locally, load `~/.codex/skills/<myskill>/SKILL.md` plus required `references/`/`scripts/`
- Prompts live in `~/.codex/prompts/*.md`

## Project Notes
- Main docs in `agent_docs/` - read `tasks.md` first for current work
- Maintain notes in `.claude/notes/` for each task
- Update after every PR

## Learned Rules

### DO NOT / DO
<!-- Add rules here as you learn from corrections -->

DO NOT: Use `console.log` for debugging in production code
DO: Use `lib/logging/` utilities or remove debug statements before committing

DO NOT: Commit without running typecheck
DO: Always run `pnpm typecheck` before any commit

DO NOT: Use `any` type
DO: Use proper TypeScript types or `unknown` with type guards

DO NOT: Ignore failing tests
DO: Fix tests or code before proceeding

DO NOT: Rename or remove columns in schema.ts without reviewing the generated SQL
DO: After `drizzle-kit generate`, check for DROP statements — hand-edit to RENAME if needed

DO NOT: Manually edit migration files in `supabase/migrations/meta/`
DO: Only use `drizzle-kit generate` to create/update migrations and snapshots

DO NOT: Duplicate billing logic in new hooks — `useBilling()` is the single source of truth
DO: For trial-specific UI, use `useTrialStatus()` (thin wrapper over `useBilling` in `lib/hooks/use-trial-status.ts`)

DO NOT: Run `pnpm build` without a `DATABASE_URL` — the build script runs `drizzle-kit migrate` first
DO: Ensure `.env.local` (or the target env file) has `DATABASE_URL` set before building

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

---
*This file is yours to update. When you learn something, write it down.*

## Shell Usage

- Prefer built-in tools (`read_file`, `list_dir`, `grep_files`) over ad-hoc shell plumbing when available.
- For shell search, prefer `fd` for files, `rg` for text, `ast-grep` for syntax-aware search, and `jq`/`yq` for structured extraction.
- Keep shell usage deterministic and non-interactive; limit output and pick one consistent result when multiple matches exist.
