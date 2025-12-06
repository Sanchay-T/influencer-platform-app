# lib/CLAUDE.md — Core Logic
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md, lib/db/CLAUDE.md, lib/auth/CLAUDE.md, lib/services/CLAUDE.md, lib/search-engine/CLAUDE.md.

## Scope
Backend/business layer consumed by API routes and server components: auth, DB schema + queries, services, search engine, logging, queue, email, config.

## Map
```
lib/
├ auth/            → unified auth + test bypass
├ db/              → Drizzle schema + queries + migrations glue
├ services/        → plan/billing/feature logic
├ search-engine/   → job runner + providers
├ logging/         → structured logging (no console.log)
├ queue/           → QStash wrapper
├ email/           → Resend + templates
├ stripe/          → Stripe client helpers
├ instagram-us-reels/ → v2 IG pipeline building blocks
└ utils/, hooks/, config/ → shared helpers
```

## Invariants
- No `console.log`; always use `lib/logging` with categories.
- DB access goes through Drizzle types; keep schema in sync with migrations (source of truth: `lib/db/schema.ts`).
- All multi-table writes in transactions; keep connections minimal (Supabase pool ≈15).
- Services enforce plans/limits; search/billing/auth should never reimplement logic ad hoc.
- Idempotency everywhere: webhooks, job processing, Stripe sync.

## Key Entry Points
- Auth: `auth/get-auth-or-test.ts`.
- DB: `db/schema.ts`, `db/index.ts`, `db/queries/*`.
- Services: `services/plan-validator.ts`, `services/billing-service.ts`, `services/plan-enforcement.ts`, `services/feature-gates.ts`.
- Search: `search-engine/runner.ts`, `search-engine/job-service.ts`, `search-engine/providers/*`.
- Logging: `logging/logger.ts`, `logging/index.ts`.
- Queue: `queue/qstash.ts`.
- Email: `email/email-service.ts`, `email/trial-email-triggers.ts`.

## Patterns
- Keep modules small and focused; prefer pure functions or thin classes.
- Export typed interfaces for inputs/outputs; avoid `any`.
- Provider-style design: inject config/services into runners for testability.
- Structured errors → log with context `{ userId, jobId, requestId }` and return safe messages.

## Update Rules
When changing schema, auth flows, plan logic, or runner dispatch, update the relevant sub-CLAUDE and add a dated note in `.claude/CLAUDE.md`. Keep this file under ~150 lines and point readers to subdirectories for detail.
