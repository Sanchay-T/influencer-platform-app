# lib/services/CLAUDE.md — Domain Services
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md, lib/db/CLAUDE.md, lib/search-engine/CLAUDE.md.

## Scope
Stateless services implementing business rules: plans, billing, enforcement, feature gates, email scheduling, etc. API routes should call these instead of duplicating logic.

## Key Services
- `plan-validator.ts` — validates campaign/creator/enrichment limits; reads `user_usage` and plan metadata.
- `plan-enforcement.ts` — runtime guards before expensive work.
- `billing-service.ts` — Stripe sync, trial lifecycle, subscription changes, usage reset on invoices.
- `feature-gates.ts` — enable/disable features per plan or env.
- `email-service.ts` / `trial-email-triggers.ts` (may live in `email/`) — trial reminders & transactional email scheduling.

## Invariants
- Plan rules: campaigns = lifetime; creators/enrichments = monthly reset on renewal; trial = 7 days post-onboarding + 3-day grace.
- All service writes that span multiple tables must be transactional and idempotent (Stripe webhooks can repeat/out-of-order).
- Use structured logging with context `{ userId, requestId }`.
- Accept validated inputs; never trust raw request bodies.

## Patterns
- Services should be pure or thin wrappers; inject dependencies (db/logger/config) where possible for testability.
- Return typed result objects with status/enforcement info rather than throwing, unless truly exceptional.
- Feature additions: extend plan metadata/constants first, then enforce in validator.

## Update Rules
Update when plan logic, billing flows, or feature gating changes. Keep concise (<140 lines); log meaningful changes in `.claude/CLAUDE.md`.
