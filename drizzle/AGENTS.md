# AGENTS.md

## Overview
The `drizzle/` directory is used for database migrations and schema management artifacts.

## Structure
- **`meta/`**: Drizzle Kit metadata.
- **`*.sql`**: Migration files.
- **`schema.ts`**: (Check `lib/db/schema.ts` first).

## Key Rules
1. **Schema First:** Always modify `lib/db/schema.ts` first, then generate migrations.
2. **Atomic Migrations:** Keep migrations small and focused.
3. **Verification:** Always verify migrations locally before pushing.
4. **Config:** Respect `drizzle.config.ts` settings (e.g., `strict: false` for some environments).

## Workflow
1. Modify `lib/db/schema.ts`.
2. Run `npm run db:generate`.
3. Review generated SQL.
4. Run `npm run db:migrate`. to apply changes to the database.
- **Type Safety:** Use Drizzle's type inference to ensure type safety in your queries.
