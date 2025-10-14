# Future Automation Coverage

Use this checklist to capture what remains after wiring the current onboarding, campaign, list, and scrape flows. Each item should be backed by a script under `testing/api-suite/` that hits the *exact* production API instead of using bypasses.

## Profile & Settings
- [ ] `PATCH /api/profile` (update full name, business name, industry, optional fields)
- [ ] `GET /api/profile` assertions for profile fields after update (already exercised indirectly; add explicit assertions)
- [ ] `GET /api/subscription/status` (assert plan, status, trial fields)

## Billing & Stripe
- [ ] `POST /api/stripe/create-checkout` (generate checkout sessions)
- [ ] `POST /api/stripe/checkout-session` (if distinct) and success callbacks
- [ ] `POST /api/stripe/upgrade-direct` (plan swap with prorations)
- [ ] `GET /api/billing/status` (plan usage snapshot for billing screen)
- [ ] `POST /api/billing/sync-stripe` (reconcile Stripe state back into DB)
- [ ] Portal fallback (`/api/stripe/customer-portal` or equivalent)

## Campaign Lifecycle
- [ ] `GET /api/campaigns/:id` assertions for search jobs history (already partially in `campaigns-e2e`; expand checks)
- [ ] `PATCH /api/campaigns/:id` (rename, change description)
- [ ] `DELETE /api/campaigns/:id`
- [ ] `GET /api/campaigns/can-create` scenario tests (free plan vs upgraded)

## Lists / Creators
- [ ] `/api/lists/:id/share` (generate share link)
- [ ] `/api/lists/:id/duplicate`
- [ ] `/api/lists/:id/export`
- [ ] Collaborator management routes (`/api/lists/:id/share` POST variants, etc.)

## Dashboard & Analytics
- [ ] `GET /api/dashboard/overview`
- [ ] Any additional widgets (usage charts, plan usage cards)

## Exports & Jobs
- [ ] `/api/export/csv`
- [ ] `/api/jobs/process` / `/api/jobs/cleanup` (if exposed)
- [ ] `/api/diagnostics/system-health`

## Miscellaneous
- [ ] Admin/debug flows you rely on (e.g., `/api/debug/whoami`, `/api/debug/trial-testing`)
- [ ] Any marketing or auxiliary endpoints triggered from the UI

> **Guideline:** every new script should reuse `testing/api-suite/shared-e2e.ts` (`createContext()` + `requestJson()`) so Clerk auth and middleware remain identical to the front-end flow. These tests should be runnable locally with ngrok **or** in Codex Cloud CI by setting `SESSION_BASE_URL` / `CLERK_SESSION_BASE_URL`.
