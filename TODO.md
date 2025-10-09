# Fix Big Bugs – Implementation Checklist

## Context & Guardrails
- Goal: ship investor-ready stability. Nothing regresses the current happy path (sign-up → Stripe checkout → dashboard access).
- Guideline: treat the existing behaviour as production. Every change must have:
  - Explicit fallback if a dependency is missing or service errors.
  - A manual test plan noted and executed before merge.
  - Rollback clarity (single feature flag or isolated commit).

## Workstream A – Email Pipeline Safety
1. **Cancel abandonment email on successful onboarding** ✅
   - Update `/api/onboarding/complete` to call `cancelAbandonmentEmail`.
   - Ensure Stripe success handler also cancels it (covers pay-first flows).
   - Tests: manual – complete onboarding via Stripe test mode, confirm `emailScheduleStatus.abandonment.status === 'cancelled'`.
   - Risk: Low (pure server change). Guard with try/catch logging; no user-facing impact.

2. **Require Resend API key at startup** ✅
   - Add validation when instantiating `Resend`; throw descriptive error if unset.
   - Provide noop fallback for local dev (optional flag) to avoid breaking teammate workflows.
   - Tests: run `npm run lint` + spot-check local dev with mock key.
   - Risk: Low. Failure surface is early and descriptive.

3. **Stop scheduling emails when `NEXT_PUBLIC_SITE_URL` is missing** ✅
   - Convert the silent localhost fallback into a hard error (shared helper).
   - Tests: `node -e "require('./lib/email/email-service')"` with env unset → expect throw; re-run with env set.
   - Risk: Low. Matches production expectations; we’ll document dev override.

4. **QStash signature enforcement** ✅
   - Make `/api/email/send-scheduled` enforce signatures even for admin tests (allow override only via secure flag).
   - Tests: curl without signature → 401; with valid Upstash signature (or mocked verify) → 200.
   - Risk: Medium (route affects queued emails). Deploy behind env toggle if timeline tight.

## Workstream B – Onboarding Safeguards (Non-breaking alignment)
1. **Guard `/api/onboarding/complete` with Stripe presence**
   - Require `stripeCustomerId`, `stripeSubscriptionId`, and `intendedPlan`.
   - Return 400 with actionable `code` (`MISSING_STRIPE_DATA`).
   - Tests: (a) Current happy path via success page → still 200. (b) Manual POST with missing IDs → 400.
   - Risk: Low; matches real flow assumptions.

2. **Handle guard errors on `/onboarding/complete` page**
   - Show inline error + “Return to plan selection” CTA instead of redirecting home.
   - Manual test: simulate guard failure (comment out checkout) and ensure message appears.
   - Risk: Low; only affects unhappy path.

3. **(Optional) Feature flag for guard**
   - Introduce `ONBOARDING_ENFORCE_STRIPE=1` env gate so we can disable quickly if telemetry flags issues.
   - Tests: toggle flag, ensure behaviour switches.
   - Risk: None (toggle only).

## Workstream C – QA & Verification
1. **Manual smoke run**
   - Fresh Clerk user → Step 1/2 → select plan → Stripe test payment → back to dashboard.
   - Verify: abandonment email cancelled, `trialStatus` active, `/profile` shows correct plan.

2. **Regression checklist**
   - Existing dashboard load for paid/trial users.
   - Stripe webhook still reconciles (spot-check logs).
   - Scheduled trial emails still enqueue (check onboarding logs file).

3. **Documentation touchpoints**
   - Update README/Docs with new env requirements (Resend key, site URL).
   - Note feature flag usage if added.

## Dependencies & Coordination
- Confirm Stripe test keys available.
- Coordinate with “code-termina” agent before merging into `feat/small-fixes`.
- Keep commits scoped per workstream to allow partial rollback if needed.

## Workstream D – Instagram US Reels Integration
- [x] Wire the Instagram 1.0 pipeline into the modular search runner (provider + runner detection).
- [x] Expose the “Instagram 1.0 (US Reels)” option in keyword search and route submissions to `/api/scraping/instagram-us-reels`.
- [x] Enforce caption/transcript keyword matching with matched-term metadata and UI chips/snippets.
- [ ] Add automated coverage (integration test or smoke script) for the new pipeline path.
- [ ] Add retention/pruning policy for `logs/instagram-us-reels` snapshots once finalised.
- [ ] Run end-to-end QA in the campaign UI (pagination, CSV export, dedupe) after SERP quotas are verified.
