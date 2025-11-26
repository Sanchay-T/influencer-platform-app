# CLAUDE.md — Root Navigation Guide

## What This Project Is

This is **Gemz**, a B2B SaaS influencer discovery platform built with Next.js 15 (App Router). Brands and agencies use it to find creators across Instagram, TikTok, and YouTube. The platform has tiered subscription plans (Glow Up, Viral Surge, Fame Flex), a 7-day trial system, and background job processing for search operations.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Drizzle ORM, Clerk (auth), Stripe (billing), QStash (background jobs), Tailwind CSS, Shadcn UI.

---

## Directory Tree & Navigation Chain

This root file is the entry point. Each major folder has its own CLAUDE.md that provides deeper context. Follow this chain:

```
CLAUDE.md (you are here)
├── TESTING.md             → TDD workflow, test templates, testing guide ⭐
├── CONSTRAINTS.md         → Hard rules that must never be violated
├── DECISIONS.md           → Decision trees for common scenarios
├── AGENT_OPTIMIZATION.md  → Agent coding optimization system
├── app/CLAUDE.md          → Frontend pages, layouts, API routes
│   └── app/api/CLAUDE.md  → All backend API endpoints
├── lib/CLAUDE.md          → Core business logic, services, utilities
│   ├── lib/db/CLAUDE.md   → Database schema, queries, migrations
│   ├── lib/services/CLAUDE.md → Business logic (billing, plans, validation)
│   ├── lib/search-engine/CLAUDE.md → Search job processing & providers
│   └── lib/auth/CLAUDE.md → Authentication & test bypass system
├── components/CLAUDE.md   → Shared UI components (Shadcn primitives)
├── scripts/CLAUDE.md      → CLI tools, testing scripts, migrations
└── .claude/CLAUDE.md      → Extended project memory (detailed reference)
```

---

## Critical Files You Must Know

### Authentication
- `lib/auth/get-auth-or-test.ts` — **THE** auth resolver. Every API route calls `getAuthOrTest()` which returns `{ userId, sessionId }`. Supports test header bypass in development.
- `middleware.ts` — Clerk middleware defining public routes (`/`, `/sign-in`, `/api/webhooks/*`).

### Database
- `lib/db/schema.ts` — Drizzle schema. **Source of truth**. Users are normalized across 5 tables: `users`, `userSubscriptions`, `userBilling`, `userUsage`, `userSystemData`.
- `lib/db/queries/user-queries.ts` — Functions `getUserProfile(userId)` and `updateUserProfile(userId, changes)` that handle the 5-table join.

### Business Logic
- `lib/services/plan-validator.ts` — Class `PlanValidator` with methods `validateCampaignCreation()`, `validateCreatorLimit()`, `getActiveUserPlan()`.
- `lib/services/billing-service.ts` — Stripe integration, trial management, subscription handling.

### Search Engine
- `lib/search-engine/runner.ts` — Function `runSearchJob(jobId)` dispatches to providers based on platform. Entry point for all search processing.
- `lib/search-engine/job-service.ts` — Class `SearchJobService` manages job lifecycle, result persistence, QStash continuations.

### API Routes
- `app/api/campaigns/route.ts` — `POST` creates campaigns + scraping jobs. `GET` lists user campaigns.
- `app/api/webhooks/stripe/route.ts` — Handles `checkout.session.completed`, `subscription.updated`, `invoice.payment_succeeded`.
- `app/api/qstash/process-search/route.ts` — QStash callback that processes search jobs.

---

## Commands

```bash
npm run dev              # Start development server (port 3000)
npm run dev:wt2          # Start on port 3002
npm run db:generate      # Generate Drizzle migrations after schema changes
npm run db:migrate       # Apply migrations to database
npm run db:studio        # Open Drizzle Studio to view data
```

---

## Environment Variables

Secrets live in `.env.local` (never commit). Key variables:
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_*` — Clerk auth configuration
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe billing
- `QSTASH_*` — Upstash QStash for background jobs
- `ENABLE_AUTH_BYPASS=true` — Development-only auth bypass

---

## Data Flow Patterns

### Search Job Lifecycle
1. Frontend calls `POST /api/campaigns` → creates `scrapingJobs` record
2. Job published to QStash → calls `POST /api/qstash/process-search`
3. `runSearchJob()` dispatches to appropriate provider
4. Provider fetches results → stored in `scrapingResults` table
5. Frontend polls `GET /api/jobs/[id]` for progress

### User Authentication
1. Request hits `middleware.ts` (Clerk)
2. API route calls `getAuthOrTest()` from `lib/auth/get-auth-or-test.ts`
3. In dev: checks `x-test-user-id` header or `ENABLE_AUTH_BYPASS` env var
4. In prod: falls back to Clerk `auth()`

### Billing Events
1. Stripe webhook fires → `POST /api/webhooks/stripe`
2. Event verified via `stripe.webhooks.constructEvent()`
3. Handler updates `userSubscriptions`, `userBilling`, `userUsage` tables
4. For `invoice.payment_succeeded`: resets monthly usage counters

---

## Naming Conventions

- **Plan keys:** lowercase with underscores → `glow_up`, `viral_surge`, `fame_flex`
- **Status enums:** `pending`, `active`, `completed`, `error`, `expired`
- **Job status:** `pending` → `processing` → `completed` | `error` | `timeout`
- **Tables:** camelCase in code (`userSubscriptions`), snake_case in SQL

---

## Test-Driven Development (TDD) — MANDATORY

**Every new feature MUST follow the TDD workflow.** See `TESTING.md` for complete guide.

### The Red-Green-Refactor Cycle

```
1. RED    → Write a failing test first
2. GREEN  → Write minimal code to pass
3. REFACTOR → Clean up while tests pass
```

### Quick Test Commands

```bash
# Run all tests
npm test

# Run specific test file
node --test lib/services/__tests__/plan-validator.test.ts

# Run tests matching pattern
node --test --test-name-pattern="validateCampaignCreation"
```

### Test File Location Rules

| Code Location | Test Location |
|---------------|---------------|
| `lib/services/billing-service.ts` | `lib/services/__tests__/billing-service.test.ts` |
| `app/api/campaigns/route.ts` | `app/api/campaigns/__tests__/route.test.ts` |
| `lib/search-engine/runner.ts` | `lib/search-engine/__tests__/runner.test.ts` |

### Agent TDD Checklist (Before Every Feature)

```
□ 1. Read TESTING.md for patterns
□ 2. Find existing tests in same area
□ 3. Write failing test FIRST
□ 4. Implement minimal code to pass
□ 5. Refactor if needed
□ 6. Run full test suite
□ 7. Commit tests WITH implementation
```

---

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
