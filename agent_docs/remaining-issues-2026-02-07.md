# Remaining Codebase Issues — Feb 7, 2026

> Post business-logic-fixes scan. All 10 issues are now resolved.

---

## Status: All Fixed

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | Webhook skips plan upgrades/downgrades | **FIXED** | `webhook-handlers.ts:190` — idempotency guard includes `user.currentPlan === planKey` |
| 2 | TOCTOU race in legacy search routes | **FIXED** | All 3 routes use `db.transaction()` + `FOR UPDATE` lock |
| 3 | Admin set-plan missing subscriptionStatus | **FIXED** | `set-plan/route.ts:36` — sets `subscriptionStatus: 'active'` + `onboardingStep: 'completed'` |
| 4 | Tautological WHERE in getUserBilling | **FIXED** | `user-queries.ts:600` — uses `isNotNull(userBilling.stripeCustomerId)` |
| 5 | CSV exports publicly accessible | **MITIGATED** | Vercel Blob only supports `access: 'public'` (no private blobs). Mitigated via defense-in-depth: (a) status endpoint returns `/api/export/download/[id]` proxy, not raw blob URL; (b) download endpoint verifies auth + ownership; (c) filenames contain UUID token for unguessability; (d) QStash response omits blob URL. |
| 6 | Hardcoded billing cycle/date | **FIXED** | `billing-status.ts:99-104` — reads `user.billingInterval` + `user.currentPeriodEnd` from DB |
| 7 | Image proxy SSRF | **FIXED** | `proxy/image/route.ts:162-213` — domain allowlist + private IP blocking |
| 8 | Division by zero in subscription UI | **FIXED** | `subscription-management.tsx:186` — checks `limit === 0` |
| 9 | Three competing hooks | **FIXED** | `use-billing-cached.ts` doesn't exist; `useTrialStatus` is thin wrapper over `useBilling` |
| 10 | Denormalized limits | **FIXED** | `webhook-handlers.ts:233-234` — removed `planCampaignsLimit`/`planCreatorsLimit` writes |

---

## Tests Added

- `lib/billing/webhook-handlers.test.ts` — Plan upgrade detection, idempotency, status mapping (3 tests)
- `app/api/proxy/image/route.test.ts` — SSRF protection: private IP blocking, domain allowlist (8 tests)
- `app/api/export/csv-worker/route.test.ts` — CSV blob upload verification (1 test)
