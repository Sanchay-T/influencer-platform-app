# Gemz Full-Stack Audit Report (2026-02-12)

This is a verbatim copy of the audit report pasted into this workspace on 2026-02-12.

```text
Gemz Full-Stack Audit Report

  9 agents | ~200+ files audited | 9 areas covered

  ---
  Aggregate Findings
  ┌────────────────────┬──────────┬─────────────┬───────────┬──────────────┐
  │        Area        │ Critical │ Improvement │ Tech Debt │ Working Well │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Dashboard          │ 4        │ 6           │ 6         │ 6            │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Campaigns          │ 5        │ 8           │ 10        │ 10           │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Lists              │ 3        │ 5           │ 6         │ 8            │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Account/Settings   │ 4        │ 7           │ 6         │ 7            │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Sidebar/Navigation │ 3        │ 7           │ 6         │ 6            │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Billing/Plans      │ 6        │ 7           │ 8         │ 9            │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ API/Backend        │ 7        │ 8           │ 5         │ 8            │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Database           │ 5        │ 9           │ 9         │ 10           │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ Code Quality       │ 8        │ 9           │ 11        │ 10           │
  ├────────────────────┼──────────┼─────────────┼───────────┼──────────────┤
  │ TOTALS             │ 45       │ 66          │ 67        │ 74           │
  └────────────────────┴──────────┴─────────────┴───────────┴──────────────┘
  ---
  P0 — Fix Immediately (Security + Data Integrity)

  These can cause money loss, data exposure, or security breaches:

  Security Vulnerabilities
  #: 1
  Issue: Open SSRF proxy — /api/proxy/image fetches any URL, no allowlist
  File: app/api/proxy/image/route.ts
  Risk: Attackers probe internal infra, cloud metadata
  ────────────────────────────────────────
  #: 2
  Issue: Unauthenticated infra endpoint — /api/validate-deployment exposes env vars, DB config, memory
  File: app/api/validate-deployment/route.ts
  Risk: Information disclosure
  ────────────────────────────────────────
  #: 3
  Issue: CORS wildcard * on ALL API routes via vercel.json headers
  File: vercel.json:28
  Risk: Cross-origin attacks on auth'd endpoints
  ────────────────────────────────────────
  #: 4
  Issue: Admin CORS * on OPTIONS handler
  File: app/api/admin/config/route.ts:239
  Risk: Same
  ────────────────────────────────────────
  #: 5
  Issue: SKIP_QSTASH_SIGNATURE not gated by NODE_ENV — works in production
  File: 6+ QStash route files
  Risk: Forged webhook payloads
  ────────────────────────────────────────
  #: 6
  Issue: DLQ handler swallows signature verification failure — processes anyway
  File: app/api/qstash/dead-letter/route.ts:66
  Risk: Forged dead-letter messages
  ────────────────────────────────────────
  #: 7
  Issue: E2E routes accessible if ENABLE_AUTH_BYPASS=true in prod
  File: app/api/admin/e2e/*
  Risk: Arbitrary user creation/deletion
  ────────────────────────────────────────
  #: 8
  Issue: CSV exports stored as access: 'public' on Vercel Blob
  File: app/api/export/csv-worker/route.ts:175
  Risk: Creator data exposed via URL
  ────────────────────────────────────────
  #: 9
  Issue: Admin pages have NO access control — any auth'd user can navigate to /admin/*
  File: app/admin/**
  Risk: Full admin panel access
  ────────────────────────────────────────
  #: 10
  Issue: NEXT_PUBLIC_ADMIN_EMAILS ships admin identities to every browser
  File: lib/hooks/use-admin.ts
  Risk: Information disclosure
  Data Integrity / Business Logic Bugs
  ┌─────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────┬─────────────────────────────────────────┐
  │  #  │                                       Issue                                       │                 File                  │                 Impact                  │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼─────────────────────────────────────────┤
  │ 11  │ Usage tracking race condition (TOCTOU) — validate then increment are separate ops │ lib/billing/usage-tracking.ts         │ Users exceed plan limits                │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼─────────────────────────────────────────┤
  │ 12  │ getUserBilling self-referential WHERE — eq(col, col) always true                  │ lib/db/queries/user-queries.ts:510    │ Returns wrong billing records           │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼─────────────────────────────────────────┤
  │ 13  │ Admin set-plan doesn't set subscriptionStatus                                     │ app/api/admin/users/set-plan/route.ts │ Admin-assigned plans don't grant access │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼─────────────────────────────────────────┤
  │ 14  │ Campaign creation + usage increment not atomic                                    │ app/api/campaigns/route.ts:56-78      │ Counter drift on crash                  │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼─────────────────────────────────────────┤
  │ 15  │ Reconciliation cron not in vercel.json — never runs                               │ vercel.json                           │ Stale billing state never corrected     │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼─────────────────────────────────────────┤
  │ 16  │ Missing cron route — /api/cron/trial-reminders doesn't exist, daily 404           │ vercel.json                           │ Silent failure every day                │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼─────────────────────────────────────────┤
  │ 17  │ ignoreBuildErrors: true + ignoreDuringBuilds: true                                │ next.config.mjs                       │ Broken TS/lint ships to prod            │
  └─────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────┴─────────────────────────────────────────┘
  ---
  P1 — Fix Soon (Broken UX + Reliability)

  Broken User-Facing Features
  ┌─────┬────────────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────┐
  │  #  │                                             Issue                                              │             File              │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 18  │ Fake chart data — AnimatedBarChart always renders hardcoded mock numbers users think are real  │ dashboard-page-client.tsx:209 │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 19  │ Broken sparkline — only 1 data point, renders as useless dot                                   │ dashboard-page-client.tsx:189 │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 20  │ handleCancelDelete crashes — called without required event arg, throws TypeError               │ lists-page-client.tsx:301     │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 21  │ Broken link — similar search navigates to non-existent /campaigns/search/similar/results (404) │ similar-creator-form.jsx:29   │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 22  │ Sidebar active state broken — uses === exact match, sub-routes never highlight                 │ sidebar.jsx:106               │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 23  │ collaboratorCount hardcoded to 0 everywhere                                                    │ list-queries.ts:233           │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 24  │ SearchProgress race condition — hasCompletedRef doesn't reset on jobId change                  │ search-progress.jsx:112       │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ 25  │ No error.tsx or loading.tsx anywhere — crashes show blank pages, no loading indicators         │ entire app                    │
  └─────┴────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────┘
  Performance
  ┌─────┬──────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────┐
  │  #  │                                    Issue                                     │                File                │
  ├─────┼──────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ 26  │ Telemetry fetches ALL rows, computes stats in JS — should be SQL aggregation │ dashboard-queries.ts:173           │
  ├─────┼──────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ 27  │ User profile fetched 2-6x per request — redundant getUserProfile calls       │ billing-status.ts, entitlements.ts │
  ├─────┼──────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ 28  │ No pagination on lists — loads ALL lists and ALL items                       │ list-queries.ts:196                │
  ├─────┼──────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ 29  │ No rate limiting on any API route                                            │ all 75+ routes                     │
  ├─────┼──────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ 30  │ 4 missing indexes on list tables (activities, notes, exports)                │ schema.ts                          │
  └─────┴──────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────┘
  ---
  P2 — Improve (Quality + Maintainability)

  Code Quality

  - 21 .jsx files should be .tsx (core layout, campaigns, sidebar)
  - Duplicate linting tools — both ESLint and Biome configured with overlapping rules
  - Sentry source maps disabled — prod errors have unreadable stack traces
  - @playwright/test (180MB) in production dependencies
  - 7+ unused npm packages — plyr-react, serpapi, swr, @tanstack/react-virtual, csv-parse, @supabase/ssr, puppeteer
  - 20+ coverage threshold at 20% — effectively enforces nothing

  Tech Debt to Clean Up

  - Deprecated DB tables still in schema: jobCreatorKeys, searchJobs, searchResults, subscriptionPlans
  - Dual write to scrapingResults (JSONB) + jobCreators (normalized)
  - Inconsistent userId — older tables use Clerk ID, newer use internal UUID FK
  - No FK from campaigns/scrapingJobs to users — orphan risk
  - Legacy scraping GET endpoints — dead code, superseded by v2
  - shouldVerifySignature() copy-pasted across 6 files — should be single import
  - Spanish comments and error messages scattered throughout
  - Mock NBA data file never imported — dead code
  - CampaignCounter component exported but never used
  - Share/Duplicate UI missing — backend fully built, no frontend buttons
  - listExports records created but no worker processes them — returns 202, nothing happens

  Files to Delete

  - Untitled (334-line mystery file)
  - backup.tar.gz (empty/corrupt)
  - tmp/ directory
  - scripts/mock-nba-data.js
  - 12 Python scripts in a Node.js project
  - 8+ one-off analysis scripts
  - app/theme-preview/* (5 dev-only pages shipping to prod)
  - app/debug/trial-testing/page.tsx (prod-accessible debug page)

  ---
  What's Working Well (74 items)

  The codebase has genuinely solid foundations:

  - Auth layering — Clerk + test auth + admin checks with clear precedence chain
  - Webhook handlers — both Stripe and Clerk use signature verification, idempotency, and proper retry semantics
  - V2 search engine — clean dispatch/search/enrich pipeline with QStash fan-out
  - Error resilience — Promise.allSettled with fallbacks on dashboard, timeouts on RSC data fetching
  - Billing architecture — clean module separation, trial derivation from Stripe state, disposable email blocking, trial abuse prevention
  - User creation — idempotent with onConflictDoNothing, handles concurrent webhook/request races
  - DB connection pooling — proper serverless config, PgBouncer detection, retry wrappers
  - Optimistic UI — lists have rollback on failure across create/delete/drag/pin operations
  - Logging system — 12-module structured logging with Sentry integration, used in 177+ files
  - Accessibility — sidebar has ARIA attributes, keyboard nav, proper dialog semantics

  ---
  Recommended Fix Order

  1. Security first — Lock down the open proxy, unauthenticated endpoints, CORS, QStash signature bypass, admin pages, public CSV blobs
  2. Data integrity — Fix the usage race condition, getUserBilling bug, admin set-plan, add reconciliation cron
  3. Build safety — Remove ignoreBuildErrors, enable source maps, move playwright to devDeps
  4. Broken UX — Fix the crash, fake charts, broken links, sidebar highlighting, add error/loading boundaries
  5. Performance — SQL aggregation, user profile caching, list pagination, missing indexes
  6. Cleanup — Delete dead files, deprecated tables, unused deps, consolidate JSX to TSX

  Want me to start fixing any of these? I'd recommend tackling the P0 security issues first.


⏺ All agents shut down. Let me clean up the team.

⏺ 8 teammates shut down gracefully

⏺ Waiting for the last agent to shut down. The full audit report is already delivered above — 45 critical issues, 66 improvements, 67 tech debt items, 74 things working well
  across all 9 areas.

  Ready to start fixing whenever you want. I'd recommend starting with P0 security issues (the open SSRF proxy, unauthenticated endpoints, CORS wildcard, QStash signature
  bypass).

✻ Worked for 8m 15s

⏺ Teammate @codequality-auditor shut down gracefully

⏺ Team fully cleaned up. All 9 audit agents have completed and shut down.

  To recap what you have: a 178-item audit across your entire Gemz app. The full report is above with prioritized fix order. The most urgent things are:

  Security (fix today):
  - Open SSRF proxy at /api/proxy/image
  - Unauthenticated /api/validate-deployment exposing infra details
  - CORS * on all API routes
  - QStash signature bypass possible in production
  - Admin pages accessible to any logged-in user
  - Public CSV blob URLs with creator data

  Data integrity (fix this week):
  - Usage tracking race condition lets users exceed limits
  - getUserBilling WHERE clause bug (eq(col, col))
  - Admin set-plan doesn't actually grant access
  - Reconciliation cron never runs
  - Trial-reminders cron hits 404

  Build safety (fix this week):
  - ignoreBuildErrors: true — broken TypeScript ships to prod
  - Sentry source maps disabled

  Want me to start tackling any of these?
