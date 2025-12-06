# lib/db/CLAUDE.md — Database
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md, ../../drizzle/CLAUDE.md.

## Scope
Drizzle ORM schema, DB connection, and query helpers. Source of truth for the normalized data model.

## Source Files
- `schema.ts` — full schema (users split across 5 tables; campaigns/scraping_jobs/results; legacy search_jobs/results; creator lists).
- `index.ts` — DB client with pooling.
- `queries/*` — domain-specific query helpers (e.g., `queries/user-queries.ts`).
- `migrations` live in `drizzle/` (generated from `schema.ts`).

## Invariants
- Normalized users: `users`, `user_subscriptions`, `user_billing`, `user_usage`, `user_system_data`; join only the tables you need.
- Event sourcing: major state changes should emit to `events` table (see services).
- Two job schemas exist: current `scraping_jobs/results` and legacy `search_jobs/results`; prefer scraping_* tables and mark legacy usage explicitly.
- Transactions for multi-table writes; avoid long-lived connections (Supabase pool ≈15).
- Schema ↔ migration parity: after schema edits run `npm run db:generate` then `npm run db:migrate`.
- RLS enforced in Supabase; keep queries scoped to user_id where applicable.

## Index & Performance Notes
- Critical indexes on user_id/status/created_at for campaigns, jobs, results; maintain uniqueness on creator dedup keys.
- Be mindful of JSONB queries on `scraping_results` — paginate and project only needed fields.

## Patterns
- Use typed Drizzle queries; avoid raw SQL unless necessary (wrap in helper).
- Prefer small query helpers in `queries/` instead of inlining SQL in routes/services.
- Soft deletes preferred; never hard-delete users.

## Update Rules
Document any schema or query pattern change here and in `.claude/CLAUDE.md` changelog. Keep concise (<140 lines).
