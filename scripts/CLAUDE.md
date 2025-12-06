# scripts/CLAUDE.md — Ops & Helper Scripts
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md.

## Scope
CLI tools for local dev, debugging, data maintenance, and provider testing. Scripts are Node/TS (`tsx` or `node`) unless noted.

## Common Daily Scripts
- `npm run dev:ngrok` or `npm run dev:wt2` — start dev server (tunnel/port 3002).
- `node scripts/inspect-user-state.js <email>` — view normalized user + billing + usage.
- `node scripts/reset-user-onboarding.js <email>` — reset onboarding for a test user.
- `node scripts/find-user-id.js <email>` — resolve user id.

## Provider / Search Testing
- `node scripts/test-instagram-keyword-comparison.js "<kw>"` — compare IG keyword providers.
- `node scripts/quick-test-instagram-apis.js` — smoke IG APIs.
- `node scripts/test-instagram-keyword.js "<kw>"` — single provider check.
- `node scripts/test-scrapecreators-direct.mjs "<kw>"` — exercise scrapecreators runner directly.
- `node scripts/test-parallel-scrapecreators.mjs "<kw>"` — parallel scrapecreators load test.
- `node scripts/test-parallel-direct.mjs "<kw>"` — generic parallel runner test.

## Billing / Plans / Usage
- `node scripts/seed-subscription-plans.js` — sync Stripe price/plan metadata.
- `node scripts/analyze-billing-system.js` — inspect billing health.
- `npm run report:founder` — monthly metrics report.

## Database & Migrations
- `npm run db:generate` → generate migrations from schema.
- `npm run db:migrate` → apply migrations.
- `npm run db:reset:schema` → destructive reset (handle with care).

## Data Export / Quality Reports
- `node scripts/export-results-csv.mjs --job <id>` — export scraping results to CSV.
- `node scripts/generate-quality-report.mjs` / `-v2` — run quality scoring on results.
- `node scripts/fetch-reels-final.mjs` / `fetch-reels-with-links.mjs` — fetch reel data snapshots.
- `node scripts/generate-quality-report-v2.mjs` — improved quality scoring.

## Deployment / Validation
- `node scripts/validate-deployment.js` or `npm run validate:deployment` — config/monitoring checks.
- `npm run smoke:test` — lightweight sanity suite.

## Usage Notes
- Prefer `tsx` for TypeScript; ensure required env vars are set (see `.env.local` list in root/.claude).
- Do not commit secrets or generated data outputs.
- When a script mutates data (billing, usage, migrations), log a short note in `.claude/CLAUDE.md` changelog if behavior changes.

## Update Rules
Keep list focused on actively maintained scripts. Remove dead entries; add new ones with one-line purpose and invocation.
