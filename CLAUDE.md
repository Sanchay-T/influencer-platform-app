# CLAUDE.md — Instructions for You (Claude Code)

## Project Overview
You are working on **Gemz** (usegems.io) — an AI-powered influencer discovery platform that helps businesses find, organize, and export creators across TikTok, Instagram, and YouTube.

- **Stack:** Next.js 15 (App Router), TypeScript, Supabase + Drizzle ORM, Clerk auth, Stripe billing, QStash, Resend
- **Features:** Keyword search, Similar creator search, Campaign management, List organization, CSV export, Trial/subscription billing
- **Deployment:** Vercel → usegems.io

## Your Behavior

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

### Project Structure
- `app/` — Next.js App Router pages and API routes
- `app/api/` — API route handlers
- `components/` — React components (shared in `components/ui/`)
- `lib/` — Core business logic
- `lib/db/` — Drizzle schema and queries
- `lib/services/` — Business services (billing, search, etc.)
- `lib/auth/` — Clerk integration helpers
- `scripts/` — Utility and maintenance scripts

### Before Making Changes
1. Read the relevant existing code first
2. Check for similar patterns in the codebase
3. Run `pnpm typecheck` before committing
4. Run `pnpm lint` before committing (or `npx biome check --write <files>`)

### Testing
- Run `pnpm test` to execute tests
- Add tests for new API routes
- Add tests for complex business logic
- Use the test auth system for API testing without Clerk

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
git push origin HEAD                  # Push to remote
```

Commit prefixes: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`, `test:`

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

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

---
*This file is yours to update. When you learn something, write it down.*
