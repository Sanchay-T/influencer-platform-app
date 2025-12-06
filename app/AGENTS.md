# AGENTS.md

## Overview
The `app/` directory houses the Next.js App Router application. It is organized by feature (Dashboard, Campaigns, Billing) and uses a mix of Server and Client Components.

## Structure
- **`(marketing)`**: Public landing pages.
- **`admin/`**: Internal admin tools (User management, System config).
- **`api/`**: Backend API routes.
- **`components/`**: Feature-specific UI components.
  - `layout/`: `Sidebar`, `DashboardHeader`.
  - `dashboard/`: Widgets.
  - `campaigns/`: Campaign management UI.
  - `billing/`: `AccessGuardOverlay`, subscription UI.
- **`providers/`**: Global providers (`ToastProvider`, `ClientConsoleBridge`).

## Key Rules
1. **Server First:** Default to Server Components. Use Client Components only when necessary (interactivity, browser APIs).
2. **Access Control:**
   - **Routes:** Protected by `middleware.ts`.
   - **UI:** Gated by `AccessGuardOverlay` (checks trial/subscription status).
3. **State Management:**
   - URL state is preferred (search params).
   - Local state (`useState`) for UI interactions.
   - Server Actions for mutations.
4. **Styling:** Tailwind CSS. Use `cn()` for conditional classes.
5. **Logging:** Client-side logs must use `structuredConsole` to be captured by the `ClientConsoleBridge`.
