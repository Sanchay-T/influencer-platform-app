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
- `app/`: Next.js App Router.
  - `api/`: Backend routes (protected by `middleware.ts`).
  - `components/`: Feature-specific UI.
- `lib/`: Core Domain Logic.
  - `db/`: Drizzle ORM setup. **Schema is normalized** (users, billing, usage, etc.).
  - `services/`: Business logic (e.g., `PlanValidator`, `ScrapingService`).
  - `logging/`: Centralized structured logging.
- `components/`: Shared UI primitives (Shadcn).
- `drizzle/`: Database migrations.
- `scripts/`: Ops tools (`validate-deployment.js`, `init-logging-config.js`).
- `test-scripts/`: TDD scripts.

## Key Invariants
1. **Normalized User Data:** User data is NOT in a single table. It is spread across `users`, `userSubscriptions`, `userBilling`, `userUsage`, and `userSystemData`. Always join or query the specific table needed.
2. **Event Sourcing:** Major state changes (subscription upgrades, onboarding completion) MUST be recorded in the `events` table.
3. **Middleware Protection:** All API routes are protected by default unless explicitly listed in `middleware.ts`.
4. **Structured Logging:** Use `lib/logging` for all logs. Do not use `console.log` in production code.

## Testing Guidelines
- **Script-Based TDD:** Use `test-scripts/` for backend logic.
- **UI Testing:** Use `app/test/` pages for manual verification.
- **Smoke Tests:** Run `npm run smoke:test` before major PRs.

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

## Persistent preferences (Codex)
- Keep each source file under 300 lines; favor modular, minimal code over inline repetition.
- Per-user structured logging with PII masking and event sourcing for major state changes.
- Prefer lean E2E coverage over unit-test clutter; use it to validate onboarding flows.
- Onboarding is paid-only: card required, no free/no-card trial path.
