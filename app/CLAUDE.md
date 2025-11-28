# app/CLAUDE.md — App Router
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md, app/api/CLAUDE.md, TESTING.md.

## Scope
Everything in Next.js App Router: layouts, pages, route groups, feature-scoped components under `app/components`, and API routes under `app/api`. Server Components by default; add `"use client"` only where interactivity is required.

## Key Entry Points
- `layout.tsx` — wraps app with `ClerkProvider`, toast provider, global styles.
- `page.tsx` — marketing landing (public).
- `dashboard/page.tsx` — authenticated home.
- Feature routes: `campaigns/`, `lists/`, `billing/`, `profile/`, `onboarding/`, `admin/`.
- Providers: `app/providers/*` (toast, auth logger, console proxy).
- API subtree: see `app/api/CLAUDE.md`.

## Routing & Auth
- Middleware protects everything except public routes (`/`, `/sign-in`, `/sign-up`, `/api/webhooks/*`); always assume authenticated context in dashboard pages.
- Use dynamic segments `[id]` with `params` in Server Components; client-side use `useParams()`.
- Keep data fetching in Server Components; pass data to Client Components for interactivity.

## Patterns & Do/Don’t
- Prefer server data loaders over client fetching; if client-side fetching is needed use SWR/hooks.
- Client components must start with `"use client"` and avoid server-only imports.
- No `console.log`; use structured console proxy if needed on the client.
- Reuse shared primitives from `/components/ui`; avoid duplicating UI atoms inside `app/`.
- Plan/usage gating UI: use existing guards (e.g., access-guard overlay) instead of ad-hoc checks.

## Testing & Manual Verification
- Backend logic: see `app/api/CLAUDE.md` tests.
- Manual UI smoke: `app/test/` pages.
- Run `npm run smoke:test` before shipping significant UI/API changes.

## Update Rules
- Keep this file concise (<120 lines). Update when routes, providers, or auth surface change; add dated note in `.claude/CLAUDE.md` changelog.
