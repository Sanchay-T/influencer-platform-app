# CLAUDE.md

## Context
This folder (`scripts/`) contains operational, maintenance, and analysis scripts.
- **Languages:** TypeScript (`.ts`) and JavaScript (`.js`).
- **Execution:** Run via `tsx` (TypeScript) or `node` (JavaScript).

## Patterns
- **Standalone:** Scripts should be self-contained.
- **Env Vars:** Check for `process.env.DATABASE_URL` or similar at the start.
- **Logging:** Use `console.log` for output.
- **Exit Codes:** Use `process.exit(1)` for errors.

## Types
- **`reset-*.ts`**: Destructive reset scripts (Use with CAUTION).
- **`test-*.js`**: Integration/Smoke tests.
- **`analyze-*.js`**: Data analysis and reporting.
- **`seed-*.js`**: Database seeding.

## Do Not
- **Do not** import from `app/` (Next.js specific code).
- **Do not** run destructive scripts in production without confirmation.
- **Do not** leave hardcoded secrets in scripts.
