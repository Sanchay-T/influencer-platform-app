# Frontend Guide (WT‑1)

Scope: This document is for UI/UX designers and frontend engineers performing a UI overhaul in the WT‑1 worktree only. No backend changes are expected.

## Tech & Conventions
- Stack: Next.js 15 (App Router), React 18, Tailwind CSS, shadcn/ui, lucide-react, react-hot-toast.
- Layout: `app/layout.tsx` provides `ClerkProvider`, global styles, and `ToastProvider`.
- Shell: `app/components/layout/dashboard-layout.jsx` + `sidebar.jsx` compose the main app frame.
- Primitives: `components/ui/*` (shadcn/ui). Prefer composition over modification.
- Theming: Tokens in `app/globals.css` (CSS variables) and `tailwind.config.mjs` (uses tokens via `hsl(var(--...))`).

## URLs & Pages
- `/` → `app/page.js`: Landing (signed-out) and dashboard (signed-in). Hosts onboarding modal.
- `/sign-in`, `/sign-up` → Clerk pages (`app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`).
- `/billing` → `app/billing/page.tsx`: Billing UI and subscription management.
- `/pricing` → `app/pricing/page.tsx`: Plan overview/pricing cards.
- `/profile` → `app/profile/page.tsx`: Profile settings (basic layout).
- `/onboarding/step-1|step-2|complete|success` → Step pages; also surfaced via onboarding modal on `/`.
- `/campaigns/new` → `app/campaigns/new/page.jsx`: Campaign create form.
- `/campaigns/[id]` → `app/campaigns/[id]/page.tsx` + `client-page.tsx`: Campaign details and results.
- `/admin/users` → `app/admin/users/page.tsx`: Admin user tools.
- `/admin/system-config` → `app/admin/system-config/page.tsx`: Config UI.
- `/admin/email-testing` → `app/admin/email-testing/page.tsx`: Email test UI.
- `/admin/test-users` → `app/admin/test-users/page.tsx`: Seed/test helpers.
- `/debug/performance` → `app/debug/performance/page.tsx`: Perf dashboard.
- `/debug/trial-testing` → `app/debug/trial-testing/page.tsx`: Trial debug UI.
- `/test-comparison`, `/test-subscription` → Utility pages for manual QA.

## Core UI Building Blocks
- Dashboard layout: `app/components/layout/dashboard-layout.jsx` (container, spacing) and `sidebar.jsx` (nav links, user info, admin section).
- Campaigns: `app/components/campaigns/*` (cards, lists, forms, search/similar results, export button).
- Onboarding: `app/components/onboarding/*` (modal, payment-step, stripe form).
- Billing: `app/components/billing/*` (status card, portal button, upgrade CTA).
- Trial: `app/components/trial/*` (status, indicators, skeletons).
- Primitives: `components/ui/{button,card,input,select,table,badge,progress,...}.tsx`.

## Theming & Styling
- Edit tokens in `app/globals.css` under `:root` and `.dark`.
- Tailwind classes drive layout/spacing; prefer utilities over inline styles.
- Keep spacing consistent (e.g., `container p-8` in dashboard main). Border radius via `--radius`.

## UI Overhaul Guidelines (No Backend Changes)
- Do: modify JSX structure, Tailwind classes, shadcn/ui props, and component composition.
- Don’t: change API routes, server actions, `lib/*` logic, or DB types.
- Keep accessibility (aria, roles, focus states) and responsive breakpoints.
- Reuse primitives; avoid duplicating styles; add variants to shadcn components if needed.

## Local Run (WT‑1)
- Start: `npm run dev:wt1` (uses `.env.worktree` and `LOCAL_PORT`).
- Auth: Clerk must be configured locally to view authenticated pages.

For backend/system details, see: `AGENTS.md`.

## UI/UX Handbook (Current State, WT‑1)

For a comprehensive, implementation‑level guide to the current UI system (theme tokens, layout, navigation, tables, trial sidebar, page/component map, and patterns), see:

- docs/ui-ux-handbook.md

This handbook is the source of truth for building new screens and maintaining parity across the app.
