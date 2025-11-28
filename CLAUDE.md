# CLAUDE.md — Root Guide (Concise)
Last updated: 2025-11-27
Imports: .claude/CLAUDE.md (project memory), CONSTRAINTS.md, TESTING.md, DECISIONS.md, AGENT_OPTIMIZATION.md.

## Purpose
Entry point for the whole repo. Use this file to route to deeper notes, remember invariants, and grab the handful of commands/env keys you need to work safely.

## What This Project Is
Gemz: B2B influencer discovery SaaS (Instagram, YouTube, TikTok) with keyword/similar search, campaigns, saved lists, CSV export, tiered plans (glow_up, viral_surge, fame_flex), 7-day trial + 3-day grace. Stack: Next.js 15 App Router, TS strict, Tailwind/Radix, Supabase + Drizzle, Clerk, Stripe, QStash, Resend, Sentry, structured logging.

## Navigation Chain
```
CLAUDE.md (here)
├ .claude/CLAUDE.md → full project memory & invariants
├ TESTING.md        → TDD workflow, patterns
├ CONSTRAINTS.md    → must-not-break rules
├ DECISIONS.md      → decision trees
├ app/CLAUDE.md     → pages/layouts/providers
│   └ app/api/CLAUDE.md → API routes (backend)
├ lib/CLAUDE.md     → core logic/services/db/search/auth
│   ├ lib/db/CLAUDE.md
│   ├ lib/services/CLAUDE.md
│   ├ lib/search-engine/CLAUDE.md
│   └ lib/auth/CLAUDE.md
├ components/CLAUDE.md → shared UI primitives
├ scripts/CLAUDE.md    → CLI + ops tools
└ drizzle/CLAUDE.md    → migrations
```

## Non-Negotiables
- Auth first: every API route uses `getAuthOrTest()`; middleware defaults to protected.
- Logging: use `lib/logging` categories; no `console.log` in server code (search runner uses a documented console.warn diagnostic).
- Normalized users: 5-table split; never assume single user table.
- Plan enforcement: campaign= lifetime, creators/enrichments = monthly reset; validate before work.
- Idempotency: webhooks (Stripe/Clerk) and QStash job processing must handle duplicates/order issues; Stripe has two webhook paths (`/api/webhooks/stripe`, `/api/stripe/webhook`)—ensure only one is configured in Stripe.

## Critical Entry Points
- Auth: `lib/auth/get-auth-or-test.ts`, `middleware.ts`.
- DB schema: `lib/db/schema.ts`; migrations in `drizzle/`.
- Search: `lib/search-engine/runner.ts`, `lib/search-engine/job-service.ts`; providers include `instagram_scrapecreators`, `instagram_v2`, `instagram_us_reels`, legacy reels, Google SERP.
- Billing: `lib/services/billing-service.ts`, Stripe webhooks (`app/api/webhooks/stripe/route.ts` and `app/api/stripe/webhook/route.ts`).
- Campaign/job API: `app/api/campaigns/route.ts`, `app/api/qstash/process-search/route.ts`, `app/api/qstash/process-results/route.ts`.

## Core Commands
`npm run dev` (3000) | `npm run dev:wt2` (3002) | `npm run db:generate` | `npm run db:migrate` | `npm run db:studio` | `npm run smoke:test` | `npm run validate:deployment`

## Env Keys (never commit secrets)
`DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLERK_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `QSTASH_*`, `ENABLE_AUTH_BYPASS` (dev), `NEXT_PUBLIC_ADMIN_EMAILS`, `SENTRY_DSN`, Stripe price IDs.

## Update Rules
Keep this file lean (<150 lines). Link out instead of duplicating. When you change auth, plans, schema, or job flow, update here and add a dated note in `.claude/CLAUDE.md` changelog.

## What NOT To Do

- **Never** skip writing tests — TDD is mandatory for all new features
- **Never** use `console.log` — use `lib/logging` loggers
- **Never** modify `lib/db/schema.ts` without running `db:generate` + `db:migrate`
- **Never** query user data without using `getUserProfile()` — it handles the 5-table join
- **Never** hardcode secrets — use `.env.local`
- **Never** skip auth validation in API routes — always call `getAuthOrTest()`

---

## Next Steps

### Before Writing Any Code
1. `TESTING.md` — **READ FIRST** - TDD workflow and test templates
2. `CONSTRAINTS.md` — Hard rules you must never violate
3. `DECISIONS.md` — Decision trees for common choices

### For Understanding the Codebase
1. `app/CLAUDE.md` — Frontend structure and pages
2. `lib/CLAUDE.md` — Core business logic
3. `scripts/CLAUDE.md` — CLI tools for development and testing

### For Advanced Optimization
- `AGENT_OPTIMIZATION.md` — Complete agent coding system
- `.claude/CLAUDE.md` — Extended project memory and architecture decisions
