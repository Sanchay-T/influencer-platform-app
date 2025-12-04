# Database Operations Guide

This project uses **Drizzle ORM** with **PostgreSQL** (hosted on Supabase).

## Key Files

| File | Purpose |
|------|---------|
| `lib/db/schema.ts` | All table definitions |
| `lib/db/index.ts` | Database client |
| `lib/db/queries/user-queries.ts` | User CRUD (normalized tables) |
| `lib/db/queries/list-queries.ts` | List operations |
| `supabase/migrations/` | SQL migration files |
| `drizzle.config.ts` | Connection config |

---

## Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | Core identity (userId, email, name, onboardingStep) |
| `user_subscriptions` | Plan and trial status |
| `user_billing` | Stripe IDs and payment info |
| `user_usage` | Usage tracking (campaigns, creators) |
| `campaigns` | Campaign containers |
| `scraping_jobs` | Search runs with results |
| `creator_lists` | User-created lists |
| `creator_list_items` | Creators in lists |
| `creator_profiles` | Normalized creator directory |
| `events` | Event sourcing |
| `subscription_plans` | Plan limits from DB |

See `lib/db/schema.ts` for all fields.

---

## Normalized User Tables

User data is split across 4 tables (not a monolithic `user_profiles`):

```
users → user_subscriptions → user_billing → user_usage
```

Use `getUserProfile(userId)` from `lib/db/queries/user-queries.ts` to get joined data.

---

## What You CAN Do Autonomously

| Task | Notes |
|------|-------|
| Apply existing migrations | `npx drizzle-kit migrate` — non-interactive |
| Open Drizzle Studio | `npm run db:studio` |
| Query/verify data | Direct SQL via `npx tsx` |
| Edit schema.ts | Add tables, columns |

## What Requires Human

| Task | Why |
|------|-----|
| Generate migrations | `npx drizzle-kit generate` prompts for rename vs create |
| Push schema | `npx drizzle-kit push` has same prompts |

---

## Schema Change Workflow

1. Edit `lib/db/schema.ts`
2. Tell user: "Run `npx drizzle-kit generate`"
3. User answers prompts
4. Review SQL in `supabase/migrations/`
5. Run `npx drizzle-kit migrate`
6. Verify with query

---

## Commands

```bash
npm run db:studio        # Visual DB browser
npm run db:push          # Generate + run (INTERACTIVE)
npx drizzle-kit generate # Generate migration
npx drizzle-kit migrate  # Apply migrations
```

---

## To Explore

When working on database:
1. Read `lib/db/schema.ts` for all tables
2. Read `lib/db/queries/user-queries.ts` for user operations
3. Check existing migrations in `supabase/migrations/`
