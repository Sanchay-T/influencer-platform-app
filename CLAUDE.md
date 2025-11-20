# CLAUDE.md

## Who You Are
You are an AI coding assistant working on **Gemz**, a high-performance influencer discovery platform.
**Stack:** Next.js 15 (App Router), Supabase (Postgres), Drizzle ORM, Clerk (Auth), Stripe (Billing), QStash (Background Jobs), Tailwind CSS + Shadcn UI.

## Instruction Hierarchy
1. **Folder-local `CLAUDE.md` / `AGENTS.md`**: Highest priority.
2. **Root `CLAUDE.md`** (this file): Global tool-specific behavior.
3. **Root `AGENTS.md`**: Global architecture and invariants.

> **Rule:** When instructions conflict, prefer the closest file to the code you’re editing.

## Navigation & Repo Map
- **`app/`**: Next.js App Router.
  - `layout.tsx`: Global providers (`ClerkProvider`, `ToastProvider`, `AuthLogger`).
  - `api/`: Backend routes. **Note:** Middleware protects most routes.
- **`lib/`**: Core Logic.
  - `db/`: Drizzle schema (`schema.ts`) and queries.
  - `services/`: Business logic (Billing, Scraping, Search).
- **`components/`**: Shared UI (Shadcn primitives).
- **`scripts/`**: Ops tools (`validate-deployment.js`, `db:migrate`).

## Environment & Development
- **Package Manager:** `npm`
- **Dev Server:** `npm run dev` (or `npm run dev:wt2`).
- **Database:** Drizzle ORM.
  - **Generate:** `npm run db:generate` (after schema changes).
  - **Migrate:** `npm run db:migrate` (apply changes).
  - **Studio:** `npm run db:studio` (view data).
- **Secrets:** `.env.local` is the source of truth. **NEVER** commit secrets.

## Architecture & Patterns
### 1. Database (Drizzle)
- **Normalized Users:** User data is split into `users`, `userSubscriptions`, `userBilling`, `userUsage`, `userSystemData`. **Do not** assume a monolithic user table.
- **Event Sourcing:** Critical state changes (subscriptions, onboarding) are tracked in the `events` table.
- **Background Jobs:** Uses `backgroundJobs` table and QStash.

### 2. Authentication (Clerk)
- **Middleware:** `middleware.ts` defines public routes (`/`, `/sign-in`, `/api/webhooks/*`).
- **Server:** Use `auth()` from `@clerk/nextjs/server`.
- **Client:** Use `useAuth()` or `useUser()`.

### 3. Coding Standards
- **File Size:** Keep files under **300 lines**.
- **Type Safety:** Strict TypeScript. No `any`.
- **Styling:** Tailwind CSS with `cn()` utility.
- **Components:** Functional components, `lucide-react` icons.

## TDD Workflow
1. **Locate/Create Test:** Use `test-scripts/` for logic or `app/test/` for UI.
2. **Run Test:** `npx tsx test-scripts/my-feature.test.ts`.
3. **Implement:** Write minimal code.
4. **Verify:** Run script again.

## High-Risk Zones (Caution!)
- **Billing:** `lib/stripe`, `userBilling` table. **Test thoroughly.**
- **Schema:** `lib/db/schema.ts`. **Always** run migrations.
- **Scraping:** `lib/platforms`. Fragile external dependencies.
- **Auth:** `middleware.ts`. **Do not** expose private routes.

## Do Not
- **Do not** hardcode secrets.
- **Do not** use `console.log` in production (use `lib/logging`).
- **Do not** bypass the normalized user model (always join tables if needed).
