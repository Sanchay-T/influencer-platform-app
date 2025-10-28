# Repository Guidelines

[# When you need to call tools from the shell, use this rubric:
- Find Files: `fd`
- Find Text: `rg` (ripgrep)
- Find Code Structure (TS/TSX): `ast-grep`
  - Default to TypeScript: `*.ts` → `ast-grep --lang ts -p '<pattern>'`
  - For other languages, set `--lang` appropriately (e.g., `--lang rust`).
- Select among matches: pipe to `fzf`
- JSON: `ja`
- YAML/XML: `yq`
]

## Development Best Practices
- Embrace test-driven development (TDD): write failing tests before implementing or refactoring functionality.
- Keep every source file under 300 lines. Split large implementations into composable, focused modules.
- Add breadcrumb-style comments that outline linkage and usage, enabling newcomers to trace logic similar to a blockchain ledger.
- Document how each major function or component is used elsewhere in the codebase and note any coupling or downstream effects.
- Maintain thorough inline comments that clarify intent, data flow, and integration points.
- Treat these guidelines as canonical across every branch and worktree; keep documentation synchronized when branching or rebasing.

## Project Structure & Modules
- `app/`: Next.js App Router surfaces, including dashboards, list management, onboarding flows, internal QA pages, and all API routes under `app/api/*`. Auth is enforced via `middleware.ts` (Clerk) with explicit exceptions for webhooks and internal tooling.
- `components/`: Shared UI outside the App Router (marketing site, email templates, standalone list widgets, shadcn primitives).
- `lib/`: Core services and domain logic: `db/` (Drizzle + Postgres queries), `services/` (plan validator, feature gating), `platforms/` (TikTok/Instagram/YouTube processors), `logging/` (centralized structured logging + Sentry integration), `config/` (environment/logging/monitoring validators), `auth/`, `email/`, `queue/`, `events/`, `jobs/`, `trial/`, `utils/`.
- `drizzle/`: Generated schema, relations, and migration metadata used by Drizzle ORM.
- `scripts/`: Operational tooling and diagnostics (env validation, logging checks, Stripe helpers, onboarding resets, deployment validation, etc.).
- `test-scripts/`: Script-driven test runners for usage/billing/session flows; pair these with TDD changes.
- `docs/`: Living technical notes for agents (e.g., enhanced scraping guides, testing references).
- `public/`, `types/`, `logs/`, `onboarding-logs/`: Static assets, shared TypeScript types, structured log output, and persisted onboarding telemetry.

## Expanded App Tree
```
app/
  layout.tsx  page.js  globals.css  global-error.tsx
  providers/
    toast-provider.tsx
  components/
    layout/          dashboard shell (header, sidebar, chrome)
    navigation/      primary nav, breadcrumbs, shortcuts
    dashboard/       widgets and cards backing /dashboard
    campaigns/       creation/search flows and shared modals
    billing/         subscription management components
    onboarding/      multi-step onboarding UI fragments
    shared/          cross-feature primitives and containers
    trial/           trial gating banners and helpers
    auth/            sign-in/sign-up primitives
  admin/
    email-testing/
    system-config/
    test-users/
    users/
  billing/
    page.tsx
  dashboard/
    page.jsx
  lists/
    page.tsx
    [id]/page.tsx
  profile/
    page.tsx
  campaigns/
    new/
    [id]/
    search/
  onboarding/
    step-1/
    step-2/
    complete/
    success/
  debug/
    trial-testing/
  theme-preview/
    campaign/  dashboard/  landing/  pricing/
  test/
    instagram-reels/
  test-comparison/
  test-subscription/
  sign-in/
    [[...sign-in]]/page.tsx
  sign-up/
    [[...sign-up]]/page.tsx
  sentry-example-page/
  types/
  utils/
  api/
    admin/{config,config/init,create-test-user,email-testing/{send,users,users-fast,users-cached},test-login,users/{promote,billing-status}}
    billing/{checkout,status,sync-stripe}
    campaigns/{route.ts,[id]/route.ts,can-create}
    debug/{clear-frontend-cache,complete-reset,job,stripe-prices,trial-testing,whoami}
    diagnostics/system-health/route.ts
    email/send-scheduled/route.ts
    export/csv/route.ts
    internal/session-exchange/route.ts
    jobs/{process,cleanup,[id]}/route.ts
    lists/{route.ts,[id]/route.ts}
    logs/onboarding/route.ts
    onboarding/{step-1,step-2,save-plan,complete,status}/route.ts
    profile/route.ts
    proxy/image/route.ts
    qstash/{process-scraping,process-results,test}/route.ts
    scraping/{tiktok,tiktok-similar,instagram,instagram-hashtag,instagram-reels,youtube,youtube-similar}/route.ts
    status/route.ts
    stripe/{webhook,create-checkout,checkout-success,checkout-upgrade,convert-now,create-subscription,customer-portal,save-payment-method,session,setup-intent,upgrade,upgrade-direct}
    subscription/status/route.ts
    test-logging/route.ts
    test-qstash/route.ts
    test-sentry/route.ts
    test/{auth-echo,instagram-reels,instagram-reels-enhanced,process-job,subscription}/route.ts
    usage/summary/route.ts
    validate-deployment/route.ts
    webhooks/{clerk,stripe}/route.ts
```

## API Routes — Summaries
- admin/*: system configuration bootstrap, test-user provisioning, email testing utilities, auth sanity checks, admin promotions, and billing status snapshots.
- billing/*: Stripe checkout session creation, billing status resolution, and `sync-stripe` to reconcile Stripe state back into Postgres.
- campaigns (root, [id], can-create): CRUD entry points for campaign metadata plus entitlement checks for campaign creation.
- debug/*: internal diagnostics including cache resets, full environment resets, job inspection, price listing, trial verification, and a `whoami` identity echo.
- diagnostics/system-health: liveness/config check across database, Stripe, QStash, and environment wiring.
- email/send-scheduled: enqueue and dispatch scheduled Resend emails.
- export/csv: generate creator/job exports for download via CSV.
- internal/session-exchange: dev-only Clerk session minting via `SESSION_EXCHANGE_KEY` for agent tooling.
- jobs/process|cleanup|[id]: queue tick processor, stuck-job cleanup, and job detail retrieval.
- lists/*: CRUD for saved influencer lists bound to the authenticated user.
- logs/onboarding: append, read, and clear onboarding telemetry persisted to `onboarding-logs`.
- onboarding/*: capture onboarding steps, selected plans, and completion state.
- profile: read/update the current user profile record.
- proxy/image: cached image proxy for creator avatars/thumbnails.
- qstash/*: verify Upstash signatures, dispatch scraping jobs, and consolidate scraping results.
- scraping/*: TikTok/Instagram/YouTube ingestion endpoints, including enhanced hashtag and reels scrapers.
- status: real-time database/plan diagnostics for environment validation.
- stripe/*: customer lifecycle (checkout, upgrades, direct conversion, payment method management) and webhook handling for billing events.
- subscription/status: lightweight subscription snapshot for the active user session.
- test routes: auth echo, Instagram reels comparisons, job-processing smoke tests, and subscription plan experiments.
- test-logging/test-qstash/test-sentry: instrumentation probes for structured logging, QStash verification, and Sentry capture.
- usage/summary: per-user usage limits and remaining quota derived from `PlanValidator`.
- validate-deployment: orchestrates environment/logging/monitoring validators and optional markdown reporting for pre/post deploy checks.
- webhooks/clerk|stripe: inbound identity and billing webhooks with Clerk/Svix signature verification.

## Architecture Overview
- Frontend: Next.js 15 App Router with Clerk auth, Tailwind UI, and shadcn primitives; dashboard, lists, and trial surfaces live under `app/` with reusable building blocks in `app/components/*` and `components/*`.
- Data: Drizzle ORM over Postgres via `lib/db`, with query helpers in `lib/db/queries` and audit trails in the `events` table.
- Logging & Observability: Centralized structured logging in `lib/logging` with Sentry integration, environment/monitoring validators in `lib/config`, and deployment validation surfaced through `/api/validate-deployment` plus `npm run validate:deployment`.
- Billing: Stripe integration handled through `lib/stripe`, `app/api/billing/*`, `app/api/stripe/*`, and webhook reconciliation in `app/api/webhooks/stripe`.
- Identity & Auth: Clerk middleware, dev session exchange (`app/api/internal/session-exchange`), and auth helpers under `lib/auth`.
- Jobs & Scraping: Upstash QStash orchestrates scraping jobs via `/api/qstash/*` with platform-specific processors in `lib/platforms/*`.

## Frontend Overview
- `app/layout.tsx` wires ClerkProvider, ToastProvider, and global instrumentation; `global-error.tsx` provides user-friendly error boundaries.
- `app/components/layout/dashboard-layout.jsx` and `sidebar.jsx` define the authenticated shell; `app/components/navigation` hosts top-level tabs and breadcrumbs.
- Feature bundles live in dedicated folders (`app/components/dashboard`, `campaigns`, `lists`, `trial`, `shared`) to keep pages under 300 lines.
- Auth flows use dynamic routes under `app/sign-in/[[...sign-in]]` and `app/sign-up/[[...sign-up]]`.
- Internal QA/UAT pages (`app/test*`, `app/theme-preview/*`) provide controlled scenarios without touching production data.
- Root `components/` contains marketing and email UI (React Email templates, marketing landing sections, shared UI primitives).

## Build, Test, and Development
- Local dev entry point: `npm run dev` (port is resolved via `scripts/dev-with-port.js`).
- Alternate worktree-aware start: `npm run dev:wt2` (loads `.env.local` then `.env.worktree`; safe to use on any branch if you need per-worktree overrides).
- Pre-flight checks: `npm run validate:deployment`, `npm run config:validate:all`, and `npm run pre:deploy` bundle environment/logging/monitoring validation.
- Health checks: `npm run health:check` and `npm run health:check:detailed` hit the diagnostics routes; `npm run logs:onboarding` tails onboarding telemetry.
- Database: `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`, and supporting scripts in `scripts/` (e.g., `setup-local-db.sh`, `seed-subscription-plans.js`).
- Stripe/billing tooling: `scripts/upgrade-user-to-fame-flex.ts`, `scripts/analyze-billing-system.js`, and targeted reset scripts ensure safe plan migrations.

## Coding Style & Conventions
- TypeScript-first; React components in PascalCase; filenames in kebab-case.
- Keep domain logic in `lib/*`, UI in `app/components/*` or root `components/*`.
- ESLint via `eslint-config-next`; use 2-space indentation and maintain ordered imports.

## Testing Guidelines
- Follow TDD: add or extend a script under `test-scripts/` (or `scripts/*` when more appropriate) before implementing behavior.
- Prefer deterministic Node runners (e.g., `test-scripts/billing-status-cache-test.ts`, `scripts/test-logging-system.js`) and capture artifacts under `logs/` when needed.
- Use internal QA pages under `app/test*` for manual verification while keeping guardrails in place.
- Remove ad-hoc instrumentation once assertions pass; keep log volume manageable via the centralized logger.

## Commit & PR Guidelines
- Imperative commit messages (“Add…”, “Refactor…”, “Fix…”); avoid vague summaries.
- PRs must include: summary, repro steps, UI screenshots (when applicable), linked issues, migration notes, and validation evidence (tests or scripts executed).

## Security & Configuration
- Never commit secrets. `.env.local` holds the baseline configuration; optional `.env.worktree` overrides are respected by `npm run dev:wt2` but apply universally.
- Required environment keys include (non-exhaustive): `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ADMIN_EMAILS`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `SESSION_EXCHANGE_KEY`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`.
- Run `npm run validate:deployment` (or `npm run config:validate:all`) after touching configuration to catch logging/monitoring drift before deploying.

## Automated API Testing

Headless backend tests (no UI login) are supported via the automation headers. See [`docs/automation-api-testing.md`](docs/automation-api-testing.md) for the required env vars, tunnel options, and sample scripts.


DO THIS < THIS IS QUITE IMPORTANT :

 If you need a public endpoint (QStash callbacks, teammates, browsers):
      1. Launch a tunnel inside the container (LocalTunnel or cloudflared—no manual login needed).

         npx localtunnel --port 3002 --subdomain youralias
         # or
         cloudflared tunnel --url http://localhost:3002 --no-autoupdate
      2. Set both env vars to the generated HTTPS domain:

         NEXT_PUBLIC_SITE_URL=https://youralias.loca.lt
         AUTOMATION_BASE_URL=https://youralias.loca.lt
         Every service—including automation scripts—will now hit that public URL.
         (If you use Codex’s built-in port forwarding, grab the forwarded URL and set the env vars to that.)

  That’s the only real “choice” you have to make in the Codex environment.
