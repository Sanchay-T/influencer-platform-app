# Repository Guidelines

Scope: This guide applies to the WT‑2 worktree only. Treat all local instructions as WT‑2 specific.

## Project Structure & Modules
- `app/`: Next.js App Router pages and API routes. Auth enforced via `middleware.ts` (Clerk) with admin and webhook exceptions.
- `lib/`: Core services: `db/` (Drizzle + Postgres), `stripe/`, `queue/qstash.ts`, `events/`, `jobs/`, `platforms/` (TikTok/Instagram/YouTube processors), `utils/`.
- `drizzle/`: Generated schema/relations and migration metadata.
- `scripts/`: Operational scripts (includes `dev-with-port.js`).
- `tests/`, `test-scripts/`: Script‑driven test and research runners.
- `public/`, `components/`, `types/`: UI assets and shared types.

## Expanded App Tree (WT‑2)
```
app/
  layout.tsx  page.js  globals.css
  providers/
    toast-provider.tsx
  components/
    auth/  billing/  campaigns/  debug/  layout/  navigation/  onboarding/  trial/
    search-results.jsx  subscription-status-modern.tsx
  admin/
    users/  email-testing/  system-config/  test-users/
  billing/page.tsx   pricing/page.tsx   profile/page.tsx
  onboarding/
    step-1/  step-2/  complete/  success/
  campaigns/
    new/  [id]/  search/
  sign-in/  sign-up/  debug/
  api/
    admin/
      config/route.ts  config/init/route.ts
      create-test-user/route.ts
      email-testing/{send,users,users-fast,users-cached}/route.ts
      test-login/route.ts
      users/{promote,billing-status}/route.ts
    billing/{checkout,status}/route.ts
    campaigns/{route.ts,[id]/route.ts}
    debug/{job,trial-testing,stripe-prices}/route.ts
    diagnostics/system-health/route.ts
    email/send-scheduled/route.ts
    export/csv/route.ts
    jobs/{process,cleanup,[id]}/route.ts
    onboarding/{step-1,step-2,save-plan,complete,status}/route.ts
    profile/route.ts
    proxy/image/route.ts
    qstash/{process-scraping,process-results,test}/route.ts
    scraping/{tiktok,tiktok-similar,instagram,instagram-hashtag,youtube,youtube-similar}/route.ts
    stripe/{webhook,create-subscription,setup-intent,save-payment-method,upgrade,create-checkout,customer-portal,session}/route.ts
    subscription/status/route.ts
    test-logging/route.ts  test-qstash/route.ts  test/process-job/route.ts
```

## API Routes — Summaries
- admin/config: read/update system config; `config/init`: bootstrap defaults.
- admin/create-test-user: provision test accounts for QA.
- admin/email-testing/*: send and fetch test email data for debugging.
- admin/test-login: helper to validate Clerk auth in admin context.
- admin/users/promote: elevate a user to admin; billing-status: admin billing snapshot.
- billing/checkout: create Stripe Checkout sessions; status: return user billing/trial status.
- campaigns (root, [id]): CRUD/read for campaign info and fetch by ID.
- debug/*: internal diagnostics for jobs, trials, and Stripe price listings.
- diagnostics/system-health: liveness/config checks across subsystems.
- email/send-scheduled: enqueue/send scheduled emails (Resend).
- export/csv: export creators/results as CSV by job or campaign.
- jobs/process|cleanup|[id]: process a job tick, cleanup stalled jobs, and fetch a job.
- onboarding/step-1|step-2|save-plan|complete|status: capture onboarding data, plan selection, completion, and status.
- profile: read/update current user profile.
- proxy/image: cached image proxy for avatars/thumbnails.
- qstash/process-scraping: verifies Upstash signature, dispatches platform handlers, logs raw API data, stores results; process-results: consolidate results; test: sanity hook.
- scraping/*: TikTok/Instagram/YouTube search endpoints that call platform handlers and persist results.
- stripe/webhook: validate signature and update user plan/events/jobs; create-subscription|setup-intent|save-payment-method|upgrade|create-checkout|customer-portal|session: billing operations.
- subscription/status: public subscription state for current user.
- test-logging, test-qstash, test/process-job: lightweight test/debug routes.

## Architecture Overview
- Frontend: Next.js 15 (App Router), Clerk auth, Tailwind UI components.
- Data: Drizzle ORM over Postgres (`DATABASE_URL`). Event‑sourced audit trail in `events` table.
- Billing: Stripe (`STRIPE_SECRET_KEY`, plan price IDs, `STRIPE_WEBHOOK_SECRET`). Webhook drives user profile updates and background jobs.
- Jobs: Upstash QStash (`QSTASH_TOKEN`, signing keys) triggers `/api/qstash/*` handlers. Platform processors live under `lib/platforms/*`.

## Frontend Overview (WT‑1)
- Stack: Next.js App Router, React 18, Tailwind, shadcn/ui, lucide-react, react-hot-toast.
- Layout: `app/layout.tsx` wraps pages with `ClerkProvider`, `ToastProvider`, and optional loggers.
- Shell: `app/components/layout/dashboard-layout.jsx` and `sidebar.jsx` define the core app frame.
- Components: Reusable primitives under `components/ui/*` (shadcn), feature blocks under `app/components/*`.
- Theming: Design tokens in `app/globals.css` (CSS variables) + Tailwind config in `tailwind.config.mjs`.
- For a UI overhaul without backend changes, see the dedicated guide: [Frontend Guide](frontend.md).
- Scope UI-only edits to: `app/*`, `components/*`, `public/*`, `app/globals.css`, and `tailwind.config.mjs`.

## Build, Test, and Development
- Start WT‑2 (preferred for agents): `npm run dev:wt2` (loads `.env.local` then `.env.worktree`, uses `LOCAL_PORT` or `PORT`). Hot reload is enabled; no restart needed for code changes.
- Start default: `npm run dev`. Build: `npm run build`. Prod: `npm start`. Lint: `npm run lint`.
- DB: `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`.
- Examples: `npm run test:tiktok-similar`, `npm run test:tiktok-similar-api` (script‑driven tests).

## Coding Style & Conventions
- TypeScript first; React components in PascalCase; files kebab‑case.
- Keep domain logic in `lib/*`; UI in `app/components/*`.
- ESLint via `eslint-config-next`; use 2‑space indent; keep imports ordered.

## Testing Guidelines
- No Jest/Vitest; use Node scripts under `tests/` or `test-scripts/`.
- Prefer deterministic inputs; log outputs to `logs/` when applicable.
- Name tests descriptively (e.g., `tiktok-similar-search-test.js`).

## Commit & PR Guidelines
- Imperative messages (“Add…”, “Refactor…”, “Fix…”); avoid vague commits.
- PRs include: summary, repro steps, screenshots for UI, linked issues, and migration notes.

## Security & Configuration (WT‑2)
- Never commit secrets. `.env.local`: full set (mirrors main). `.env.worktree`: WT‑2 overrides (e.g., `LOCAL_PORT=3002`).
- Required keys include: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ADMIN_EMAILS`, Stripe keys/price IDs, `QSTASH_*` tokens/keys.
- Start WT‑2: `npm run dev:wt2`. Override port: `PORT=3005 npm run dev:wt2`.
