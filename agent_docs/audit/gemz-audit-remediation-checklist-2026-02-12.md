# Gemz Audit Remediation Checklist (2026-02-12)

Status legend:
- [ ] Not started
- [x] Done
- (Use notes like `IN PROGRESS`, `BLOCKED`, `NEEDS DECISION` inline when useful.)

Verification expectation (after each patch):
- Run `npm run dev:ngrok`
- Use `agent-browser` against `https://usegemz.ngrok.app/...` to confirm behavior
- Capture a screenshot in `tmp/verify-<issue>.png` when it’s a web-visible change

---

## P0 — Fix Immediately (Security + Data Integrity)

### Security

- [x] #1 Open SSRF proxy — `/api/proxy/image` fetches any URL
  - File: `app/api/proxy/image/route.ts`
  - Patch: Added SSRF protections (block private/reserved IPs, non-standard ports, redirect validation) + blocked non-image responses.
  - Verification: `agent-browser` screenshots captured in `tmp/verify-ssrf-*.png`.

- [x] #2 Unauthenticated infra endpoint — `/api/validate-deployment` exposes infra details
  - File: `app/api/validate-deployment/route.ts`
  - Patch: Disabled endpoint in production (`404` for GET + POST).
  - Verification: `tmp/verify-validate-deployment-dev.png` (dev redirects to auth via middleware, expected).

- [x] #3 CORS wildcard `*` on ALL API routes via `vercel.json` headers
  - File: `vercel.json`
  - Patch: Removed global wildcard CORS headers.

- [x] #4 Admin CORS `*` on OPTIONS handler
  - Files:
  - `app/api/admin/config/route.ts`
  - `app/api/admin/config/init/route.ts`
  - Patch: Removed explicit OPTIONS handlers (no wildcard CORS).

- [x] #5 `SKIP_QSTASH_SIGNATURE` not gated by `NODE_ENV` (works in prod)
  - Patch: Centralized signature verification logic in `lib/queue/qstash-signature.ts` (fail-closed outside dev/test).
  - Files updated:
  - `app/api/v2/worker/search/route.ts`
  - `app/api/v2/worker/dispatch/route.ts`
  - `app/api/v2/worker/enrich/route.ts`
  - `app/api/export/csv-worker/route.ts`
  - `app/api/qstash/process-search/route.ts`
  - `app/api/email/send-scheduled/route.ts` (also removed attacker-controlled `source === 'admin-testing'` signature bypass)
  - Tests: `lib/queue/qstash-signature.test.ts`
  - Verification: with `VERIFY_QSTASH_SIGNATURE=true` in dev, missing signature returns `401` (tested on `/api/v2/worker/search` + `/api/email/send-scheduled`).

- [x] #6 DLQ handler swallows signature verification failure — processes anyway
  - File: `app/api/qstash/dead-letter/route.ts`
  - Patch: Fail closed on invalid/missing signature (no "catch and proceed anyway").
  - Verification: with `VERIFY_QSTASH_SIGNATURE=true` in dev, missing signature returns `401`.

- [x] #7 E2E routes accessible if `ENABLE_AUTH_BYPASS=true` in prod
  - Files:
  - `app/api/admin/e2e/*`
  - `middleware.ts`
  - Patch:
  - Added centralized guard `lib/auth/e2e-guards.ts` (hard-disable in production, returns `404`).
  - `middleware.ts` only treats `/api/admin/e2e/*` as public when `NODE_ENV !== 'production'`.

- [x] #8 CSV exports stored as access: `public` on Vercel Blob
  - Files:
  - `app/api/export/csv-worker/route.ts`
  - `app/api/export/status/[id]/route.ts`
  - `app/api/export/download/[id]/route.ts` (new)
  - `lib/export/csv-encryption.ts` (new)
  - Patch: Encrypt exports before upload + decrypt behind authenticated download endpoint (client never sees Blob URL).
  - Verification: `tmp/verify-csv-export-status.png` (status now returns `/api/export/download/<id>`).

- [x] #9 Admin pages have NO access control — any auth’d user can navigate to `/admin/*`
  - Files:
  - `app/admin/**`
  - `app/admin/layout.tsx` (new)
  - Patch: Added server-side admin guard in `app/admin/layout.tsx` (`isAdminUser()` + `notFound()`).

- [x] #10 `NEXT_PUBLIC_ADMIN_EMAILS` ships admin identities to every browser
  - Files:
  - `lib/hooks/use-admin.ts`
  - `app/api/admin/me/route.ts` (new)
  - `lib/auth/admin-utils.ts`
  - Patch: Client derives `isAdmin` from server (`/api/admin/me`); allowlist is server-only `ADMIN_EMAILS` (fallback supported for migration).

### Data Integrity / Business Logic

- [ ] #11 Usage tracking race condition (TOCTOU) — validate then increment are separate ops
  - File: `lib/billing/usage-tracking.ts`

- [x] #12 `getUserBilling` self-referential WHERE (`eq(col, col)` always true)
  - File: `lib/db/queries/user-queries.ts`
  - Patch: Replace self-equality check with `isNotNull(userBilling.stripeCustomerId)`.
  - Test: `testing/__tests__/billing/get-user-billing.test.ts`

- [x] #13 Admin set-plan doesn’t set `subscriptionStatus`
  - File: `app/api/admin/users/set-plan/route.ts`
  - Patch: Set `subscriptionStatus: 'active'` and `onboardingStep: 'completed'` when admin assigns a plan.
  - Test: `testing/__tests__/billing/admin-set-plan-route.test.ts`

- [ ] #14 Campaign creation + usage increment not atomic
  - File: `app/api/campaigns/route.ts:56-78`

- [ ] #15 Reconciliation cron not in `vercel.json` — never runs
  - File: `vercel.json`

- [ ] #16 Missing cron route — `/api/cron/trial-reminders` doesn’t exist, daily 404
  - File: `vercel.json`

- [ ] #17 `ignoreBuildErrors: true` + `ignoreDuringBuilds: true`
  - File: `next.config.mjs`

---

## P1 — Fix Soon (Broken UX + Reliability)

### Broken User-Facing Features

- [ ] #18 Fake chart data — AnimatedBarChart renders hardcoded mock numbers
  - File: `dashboard-page-client.tsx:209`

- [ ] #19 Broken sparkline — only 1 data point
  - File: `dashboard-page-client.tsx:189`

- [ ] #20 `handleCancelDelete` crashes — called without required event arg
  - File: `lists-page-client.tsx:301`

- [ ] #21 Broken link — similar search navigates to missing route
  - File: `similar-creator-form.jsx:29`

- [ ] #22 Sidebar active state broken — exact match so subroutes never highlight
  - File: `sidebar.jsx:106`

- [ ] #23 `collaboratorCount` hardcoded to 0
  - File: `list-queries.ts:233`

- [ ] #24 SearchProgress race — `hasCompletedRef` doesn’t reset on `jobId` change
  - File: `search-progress.jsx:112`

- [ ] #25 No `error.tsx` / `loading.tsx` anywhere
  - File: entire app

### Performance

- [ ] #26 Telemetry fetches ALL rows; computes stats in JS
  - File: `dashboard-queries.ts:173`

- [ ] #27 User profile fetched 2-6x per request
  - File: `billing-status.ts`, `entitlements.ts`

- [ ] #28 No pagination on lists
  - File: `list-queries.ts:196`

- [ ] #29 No rate limiting on API routes
  - File: all routes

- [ ] #30 Missing indexes on list tables
  - File: `schema.ts`

---

## P2 — Improve (Quality + Maintainability)

### Code Quality

- [ ] Convert core `.jsx` to `.tsx` (21 files)
- [ ] Decide ESLint vs Biome ownership and de-duplicate rules
- [ ] Re-enable Sentry source maps
- [ ] Move `@playwright/test` out of production `dependencies`
- [ ] Remove unused npm packages
- [ ] Raise coverage thresholds (current 20% is effectively off)

### Tech Debt

- [ ] Remove deprecated tables and dead code paths
- [ ] Resolve dual-write patterns (JSONB + normalized)
- [ ] Standardize user ID (Clerk vs internal UUID)
- [ ] Add missing FKs to prevent orphans
- [ ] De-duplicate `shouldVerifySignature()` helpers
- [ ] Normalize language (Spanish comments/messages)
- [ ] Build missing UI affordances for already-built backend features

### Cleanup Targets

- [ ] Delete `Untitled`
- [ ] Delete `backup.tar.gz`
- [ ] Delete/lock down `tmp/` (do not ship)
- [ ] Delete `scripts/mock-nba-data.js`
- [ ] Review/remove Python scripts and one-off analysis scripts
- [ ] Remove `app/theme-preview/*` from prod output
- [ ] Remove/lock down `app/debug/trial-testing/page.tsx`
