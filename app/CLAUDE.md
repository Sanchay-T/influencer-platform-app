# CLAUDE.md

## Context
This folder (`app/`) contains the Next.js App Router application.
- **Layouts:** `layout.tsx` (Global), `dashboard-layout.jsx` (Authenticated).
- **Pages:** `page.tsx` (Server Components by default).
- **Components:** Feature-specific UI in `components/`.

## Patterns
- **Client Components:** Add `"use client"` at the top. Use for interactivity (state, effects).
- **Logging:** Use `structuredConsole.log` (from `@/lib/logging/console-proxy`) in Client Components.
- **Auth:** Use `useAuth()` or `useUser()` in Client Components.
- **Access Control:** Wrap sensitive UI with `AccessGuardOverlay` or check `PlanValidator` in Server Components.

## Navigation
- **`api/`**: Backend routes (see `app/api/CLAUDE.md`).
- **`components/`**: Feature-specific components (Dashboard, Campaigns, Billing).
- **`providers/`**: React Context providers (Toast, AuthLogger).

## Do Not
- **Do not** use `console.log` directly. Use `structuredConsole`.
- **Do not** fetch data in Client Components if possible. Use Server Components.
- **Do not** put complex logic in `page.tsx`. Move it to `lib/` or `components/`.
- **Do not** ignore hydration errors. Fix them by ensuring server/client match.
