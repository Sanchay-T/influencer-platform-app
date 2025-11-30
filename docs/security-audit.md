# Security Audit & Failure Point Analysis (feat/small-fixes)

## Critical Flow Maps

### Authentication Flow
- **Entry**: `middleware.ts` runs for app and API routes; marks `/api/qstash/*`, `/api/scraping/*`, `/api/proxy/*`, `/api/export/*`, `/api/email/send-scheduled` as webhook routes with permissive CORS and no auth, and exempts `/api/campaigns*` + `/api/admin*` from middleware auth (they must self-enforce).【F:middleware.ts†L12-L61】
- **Auth enforcement**: Non-public routes call Clerk’s `auth()` and enforce admin email allowlist for `/api/admin*` only when middleware runs (i.e., not for webhook or exempted routes).【F:middleware.ts†L63-L89】
- **Failure cases**: If Clerk is down, `auth()` will throw; middleware catches nothing, so requests will 500. No offline fallback.

### User Creation Flow (Clerk Webhook)
- **Entry**: `/api/webhooks/clerk` verifies Svix signature then dispatches on event type.【F:app/api/webhooks/clerk/route.ts†L18-L120】
- **Processing**: `user.created` checks for existing profile and, if absent, inserts a `userProfiles` row with free plan, trial active, onboarding pending, and zero limits.【F:app/api/webhooks/clerk/route.ts†L192-L306】
- **Failures**: No transaction; insert failure bubbles to 500 response, retry possible via webhook. If insert partially fails (e.g., DB outage), nothing rolls back.

### Onboarding → Trial Flow
- **Entry**: Users submit step 1 info via `/api/onboarding/step-1` (Clerk auth).【F:app/api/onboarding/step-1/route.ts†L1-L64】
- **Processing**: Updates or creates `userProfiles`, sets `onboardingStep` to `info_captured`, and schedules welcome/abandonment emails. No plan activation yet.【F:app/api/onboarding/step-1/route.ts†L65-L196】
- **Trial Start**: Trials start in Clerk webhook (`trialStartDate`/`trialEndDate`) regardless of onboarding completion.【F:app/api/webhooks/clerk/route.ts†L237-L306】
- **Failure modes**: Users can abandon after step 1; `onboardingStep` stays `info_captured` and trial clock keeps running.

### Payment/Subscription Flow (Stripe Webhook)
- **Entry**: `/api/stripe/webhook` validates signature then branches on Stripe events.【F:app/api/stripe/webhook/route.ts†L1-L44】
- **Subscription created**: Determines plan, finds user by `stripeCustomerId`, writes plan limits and subscription status directly to `userProfiles`, and queues onboarding-completion job (with emergency fallback if job queue fails).【F:app/api/stripe/webhook/route.ts†L46-L195】
- **Subscription updated**: Overwrites plan/status and trial markers; applies hardcoded plan limits (not from DB) and sets cancel date when `cancel_at_period_end` is true.【F:app/api/stripe/webhook/route.ts†L196-L277】
- **Other events**: Delete/trial_end/payment events update status fields without idempotency or ordering checks.【F:app/api/stripe/webhook/route.ts†L278-L412】
- **Failure modes**: Older Stripe events can overwrite newer state; job queue failures trigger direct DB updates that may diverge from intended flow.

### Search Job Flow (QStash)
- **Entry**: `/api/qstash/process-scraping` accepts POST without authentication (middleware webhook exemption). Signature verification is skipped whenever the `Host` header includes `ngrok`/`localhost` or NODE_ENV is `development`, allowing unsigned requests in those cases.【F:app/api/qstash/process-scraping/route.ts†L110-L170】
- **Processing**: Parses `jobId` from body and proceeds to run platform handlers (not shown here); no deduplication at entry.
- **Failure modes**: Duplicate deliveries or forged requests can reprocess jobs; logging writes request/response bodies to disk per `searchType`, growing unbounded.

## Findings

### 1) Critical Vulnerabilities (Fix Immediately)
- **QStash signature bypass via spoofed Host**: The webhook treats any request whose `Host` header contains `ngrok` or `localhost` as development and skips signature verification, even in production. Attackers can send unsigned requests with a forged Host to enqueue arbitrary scraping jobs or exfiltrate data. Require strict environment-based gating and verify signatures unconditionally for production deployments.【F:app/api/qstash/process-scraping/route.ts†L122-L170】

- **Public webhook surfaces permissive CORS without auth**: `middleware.ts` marks `/api/qstash/*`, `/api/scraping/*`, `/api/proxy/*`, `/api/export/*`, and `/api/email/send-scheduled` as webhook routes, adds `Access-Control-Allow-Origin: *`, and returns early before auth. Combined with the signature bypass above, this widens the attack surface for cross-origin abuse. Tighten route scopes and enforce auth/signatures per route intent.【F:middleware.ts†L12-L61】

- **Stripe webhook is non-idempotent and order-unsafe**: Subscription updates overwrite plan limits/status with whatever payload arrives, without checking event age or replay. A delayed `customer.subscription.updated` or `deleted` can revert a user from paid to canceled (or vice versa), desyncing access and billing. Implement idempotency storage keyed by Stripe event ID and ignore out-of-order events based on `created` timestamps or versioning.【F:app/api/stripe/webhook/route.ts†L196-L347】

### 2) High-Risk Failure Points (Fix Before Scale)
- **Onboarding/trial desync**: Trial starts in the Clerk webhook before onboarding begins; if onboarding fails or is abandoned, trial expires while `onboardingStep` remains `info_captured`, blocking access without recovery logic. Add reconciliation to pause/extend trials or auto-complete onboarding when payment succeeds.【F:app/api/webhooks/clerk/route.ts†L237-L306】【F:app/api/onboarding/step-1/route.ts†L65-L196】

- **Webhook database updates lack transactions**: Clerk and Stripe handlers perform multiple writes (profile creation, plan updates, job queue enqueue) without transactions or compensating actions. Partial failures can leave inconsistent billing flags vs. plan limits. Wrap multi-step flows in transactions or add retryable compensations.【F:app/api/webhooks/clerk/route.ts†L192-L306】【F:app/api/stripe/webhook/route.ts†L46-L210】

- **Unbounded raw API logging**: QStash handler writes full request/response bodies to `logs/api-raw/<searchType>` without size limits or sanitization, allowing a malicious job to fill disk or log sensitive data. Add size caps, redact PII, and move to rotating storage.【F:app/api/qstash/process-scraping/route.ts†L16-L69】

### 3) Medium-Risk / Technical Debt
- **Admin gating depends on Clerk availability**: `middleware.ts` relies on Clerk for admin email checks; if Clerk fails, the middleware returns 500 for all non-public routes, causing outage. Consider cached admin list or graceful degradation.【F:middleware.ts†L63-L89】

- **Plan limit definitions duplicated**: Stripe webhook hardcodes plan limits while also pulling `subscription_plans` in the create path, risking divergent limits between create and update flows. Centralize limit lookups to avoid mismatches in long-running subscriptions.【F:app/api/stripe/webhook/route.ts†L104-L195】【F:app/api/stripe/webhook/route.ts†L196-L247】

## Flow Diagrams (Textual)
- **Auth**: Request → `middleware.ts` route matching → (public? bypass) / (webhook? CORS + bypass) / (exempted API? bypass) / (else Clerk `auth()` → optional admin email check) → route handler → response. Failure: Clerk error → 500; missing session → redirect/401.【F:middleware.ts†L12-L89】
- **User Creation**: Svix-verified Clerk webhook → `handleUserCreated` → check existing profile → insert default profile + trial → log plan change → response. Failure: DB insert error → 500, retried by Clerk; no transaction rollbacks.【F:app/api/webhooks/clerk/route.ts†L18-L306】
- **Onboarding/Trial**: User PATCH `/api/onboarding/step-1` (auth) → validate input → update/create profile `onboardingStep=info_captured` → schedule emails → trial already running from Clerk webhook. Failure: abandonment leaves `info_captured` with ticking trial.【F:app/api/onboarding/step-1/route.ts†L1-L196】【F:app/api/webhooks/clerk/route.ts†L237-L306】
- **Subscription**: Stripe webhook (signature-checked) → branch on event → update `userProfiles` limits/status, maybe queue job → response. Failure: No idempotency/ordering; job queue failure triggers emergency DB update path.【F:app/api/stripe/webhook/route.ts†L1-L210】
- **Search Job**: QStash POST (no auth) → optional signature verification (skipped for certain Hosts) → parse `jobId` → process platform handlers → write raw logs. Failure: forged/duplicate jobs processed; disk growth from logging.【F:app/api/qstash/process-scraping/route.ts†L110-L170】【F:app/api/qstash/process-scraping/route.ts†L16-L69】

## Recommendations (Quick Fixes)
1. Enforce QStash signature verification in all non-dev environments and reject requests with unexpected Hosts; consider Upstash middleware that independently fetches signing keys.【F:app/api/qstash/process-scraping/route.ts†L122-L170】
2. Add Stripe webhook idempotency table keyed by `event.id` and ignore stale events based on `created` timestamps; move plan limit lookups to a shared helper to avoid mismatches.【F:app/api/stripe/webhook/route.ts†L196-L347】
3. Wrap Clerk/Stripe webhook DB writes in transactions or add compensating retry jobs; ensure onboarding completion aligns with trial/payment status to prevent stuck users.【F:app/api/webhooks/clerk/route.ts†L192-L306】【F:app/api/stripe/webhook/route.ts†L46-L210】
4. Rate-limit and authenticate scraping endpoints; cap or redact raw API logging to prevent disk exhaustion and leakage.【F:middleware.ts†L12-L61】【F:app/api/qstash/process-scraping/route.ts†L16-L69】
