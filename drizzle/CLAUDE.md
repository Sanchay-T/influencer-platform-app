# drizzle/CLAUDE.md — Migrations
Last updated: 2025-11-27
Imports: ../lib/db/CLAUDE.md, ../CLAUDE.md.

## Scope
Generated SQL migrations and Drizzle config. Schema source of truth stays in `lib/db/schema.ts`.

## Commands
- `npm run db:generate` → emit migrations from schema changes.
- `npm run db:migrate` → apply migrations.
- `npm run db:studio` → inspect data.

## Guardrails
- Don’t hand-edit generated `.sql` unless fixing a broken migration; prefer regenerating.
- Keep `drizzle.config.ts` aligned with schema location.
- Never commit secrets; avoid destructive migrations on prod without backup/plan.
