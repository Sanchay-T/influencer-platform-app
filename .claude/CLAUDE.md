# Influencer Platform — Project Memory (Concise)
Last updated: 2025-12-03
Scope: High-signal context for LLMs and teammates. Read before coding; update when behavior changes.

## Purpose & Use
- Why this file: prevents context drift, encodes safety rails (auth, logging, limits, idempotency).
- How to use: skim sections in order; follow invariants; borrow patterns from noted files/scripts.
- When to update: new provider, schema change, auth/billing flow change, limits change, critical script added. Add a short dated delta in “Changelog”.

## Product Snapshot
- B2B influencer discovery SaaS for brands/agencies; platforms: Instagram, YouTube, TikTok; keyword + similar search; campaigns, saved lists, CSV export.
- Plans: glow_up (3 campaigns / 1k creators), viral_surge (10 / 10k), fame_flex (unlimited). Trial: 7 days after onboarding completion + 3-day grace. Creators/enrichments reset monthly; campaigns are lifetime.

## Architecture (what runs where)
- Frontend: Next.js 15 App Router (React 18 Server Components), TypeScript strict, Tailwind + Radix UI, SWR, Framer Motion.
- Backend (in Next API routes): Clerk auth (`getAuthOrTest`), Drizzle ORM on Supabase PG, Stripe checkout + portal + webhooks, Upstash QStash jobs, Resend email, Influencers.Club enrichment; structured logging + Sentry.
- Search providers (current dispatch order): TikTok keyword; YouTube keyword; YouTube similar; Instagram similar; Instagram ScrapeCreators runner (`runner='instagram_scrapecreators'`); Instagram v2 (`runner='instagram_v2'`); Instagram US Reels v2 (`runner='instagram_us_reels'`); Instagram legacy reels; Google SERP. SystemConfig controls API call limits and continuation delays per platform. Providers now filter creators by minimum likes before dedupe.

## Data Model (normalized, critical tables)
- Users split: `users` (identity/onboarding/admin), `user_subscriptions` (plans/trial), `user_billing` (Stripe), `user_usage` (limits & counters), `user_system_data` (webhooks/events metadata). Event sourcing via `events` for major state changes.
- Search: `campaigns`, `scraping_jobs` (status/params/target), `scraping_results` (creators JSONB).
- Creators: `creator_profiles` (dedup), `creator_lists`, `creator_list_items`, collaborators.
- Policies: RLS enforced in Supabase; indexes on user_id/status/timestamps; keep connections ≤15.

## Non-Negotiable Invariants
- Auth first: every API route calls `getAuthOrTest`; middleware protects by default.
- Logging: use `lib/logging` with categories; no `console.log` in server code.
- Limits: validate via plan enforcement before creating work; creators/enrichments monthly, campaigns lifetime.
- Idempotency: webhooks (Stripe, Clerk) and QStash jobs must handle duplicates and concurrency.
- Data hygiene: no hard-deleting users; migrations idempotent; use transactions for multi-table writes.
- IG runner: prefer `instagram_us_reels` v2; call out explicitly in requests.

## Key Flows (short)
- Onboarding → Trial: signup (Clerk) → webhooks create normalized records → onboarding steps → checkout; trial starts when onboarding completes; trial_status `pending→active→converted/expired`; grace 3 days after trial end.
- Billing: Stripe webhooks can arrive out of order—always idempotent checks before mutating plan/state.
- Search job lifecycle: API validates auth & limits → create `scraping_jobs` → QStash POST to process → provider dispatch per platform → append results → update processed counts → schedule continuation if more → frontend polls `/api/jobs/[id]`.

## Operations Toolkit (most-used)
- **Semantic code search**: `mgrep "natural language query"` — use via Bash for exploratory searches; requires `mgrep watch` running in terminal
- Dev server with tunnel: `npm run dev:ngrok` (permanent URL: `usegemz.ngrok.app`). Set `NEXT_PUBLIC_SITE_URL` to tunnel URL.
- View user signup logs: `npx tsx scripts/view-user-logs.ts <email>` or `--list`
- Inspect user state: `node scripts/inspect-user-state.js <email>`
- Reset onboarding (dev/test): `node scripts/reset-user-onboarding.js <email>`
- Find user id: `node scripts/find-user-id.js <email>`
- Sync Stripe plans: `node scripts/seed-subscription-plans.js`
- Smoke/config: `npm run smoke:test`, `npm run validate:deployment`

## Gotchas (keep top of mind)
- Stripe webhook: use `/api/stripe/webhook` only; `/api/webhooks/stripe` is deprecated (returns 410). Webhook handlers now throw errors to trigger Stripe retries on failure.
- QStash jobs can run concurrently; ensure provider + persistence are idempotent; timeouts must be enforced manually. `process-results` endpoint schedules follow-ups.
- Instagram keyword runners: prefer `instagram_scrapecreators` or `instagram_v2`/`instagram_us_reels` explicitly; legacy reels still present for fallback only.
- Usage counters: campaigns don’t reset; creators/enrichments reset monthly on renewal date.
- Supabase connections limited (≈15); avoid leaks; structured logging only; runner uses console.warn in prod for diagnostics—documented exception.

## Testing & Validation
- Backend: `test-scripts/` TDD utilities; prefer writing failing test first.
- UI manual: `app/test/` pages.
- Pre-merge health: `npm run smoke:test`; deployment config: `npm run validate:deployment`.

## Update Rules (keep lean)
- Keep this file < ~200 lines; link to deeper docs instead of pasting long snippets.
- When you change a rule/flow/provider/schema, add a 1–3 bullet entry under Changelog with date + impact.
- Remove stale sections promptly; prefer bullets over prose; keep examples minimal.

## Changelog
- 2025-12-03: Added mgrep semantic code search tool; use via Bash (`mgrep "query"`) for natural language codebase exploration; requires `mgrep watch` running.
- 2025-12-03: Critical signup/payment hardening: (1) webhook handlers throw errors for Stripe retry, (2) NULL currentPlan preserved (not coerced to 'free'), (3) plan limits from DB not hardcoded, (4) sensitive routes require auth, (5) onboarding/complete idempotent + requires payment, (6) dashboard race condition fixed. Added user session logging (`lib/logging/user-session-logger.ts`, `scripts/view-user-logs.ts`), webhook idempotency (`lib/webhooks/`), permanent ngrok domain (`usegemz.ngrok.app`). Deprecated `/api/webhooks/stripe`.
- 2025-11-27: Rewritten concise memory; IG provider list updated (scrapecreators, v2, US Reels) + SystemConfig delays; added Stripe dual webhook note and likes filter mention.
