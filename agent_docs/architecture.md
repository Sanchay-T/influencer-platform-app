# Architecture Overview

This document describes the system architecture. Read this when you need to understand how pieces fit together.

## High-Level Structure

```
app/           → Next.js pages and API routes
lib/           → Core business logic
components/ui/ → Shared UI components (shadcn)
```

---

## Domain Boundaries

| Domain | Location | Purpose |
|--------|----------|---------|
| Auth | `lib/auth/` | Clerk + test auth |
| Database | `lib/db/` | Drizzle ORM, schema, queries |
| Onboarding | `lib/onboarding/` | State machine, email hooks |
| Stripe | `lib/stripe/` | Payments, subscriptions |
| Search Engine | `lib/search-engine/` | Creator discovery providers |
| Services | `lib/services/` | Billing, plans, feature gates |
| Logging | `lib/logging/` | Structured logging |

---

## External Services

| Service | Purpose |
|---------|---------|
| Clerk | Authentication |
| Stripe | Payments, subscriptions |
| Supabase | PostgreSQL database |
| QStash | Background job queue |
| ScrapeCreators | TikTok/Instagram/YouTube scraping |
| Apify | Instagram similar search |
| Influencers Club | Similar creator discovery |
| Resend | Transactional emails |
| Sentry | Error tracking |

---

## Auth Flow

See `lib/auth/get-auth-or-test.ts` for resolution order:
1. Test headers (`x-test-auth`)
2. Dev bypass header
3. Clerk session
4. Env bypass fallback

---

## User Data Structure

User data is split across normalized tables:
- `users` — identity
- `user_subscriptions` — plan/trial
- `user_billing` — Stripe info
- `user_usage` — usage tracking

Use `getUserProfile()` from `lib/db/queries/user-queries.ts` to get joined data.

---

## Data Flows

**User Signs Up:**
```
Clerk → /api/profile → Onboarding → Stripe checkout → Webhook → Dashboard
```

**User Runs Search:**
```
API route → Plan validation → Job in DB → QStash → Provider runs → Results saved
```

---

## Key Files to Know

| When Working On | Read These |
|-----------------|------------|
| Auth | `lib/auth/get-auth-or-test.ts` |
| Database | `lib/db/schema.ts` |
| Onboarding | `lib/onboarding/schemas.ts`, `lib/onboarding/flow.ts` |
| Billing | `lib/services/plan-validator.ts` |
| Search | `lib/search-engine/runner.ts` |
