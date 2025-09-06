# UI/UX Handbook (WT‑1)

This handbook documents the current state of the WT‑1 frontend so a new UI/UX engineer can confidently extend and maintain the UI. It covers theme tokens, layout and navigation, shared components, page maps, styling patterns (tables, forms, skeletons), and notes on animations and consistency.

Use this as the practical reference for building new features—copy existing patterns and stay aligned with the design language.

- Stack: Next.js (App Router), React 18, Tailwind, shadcn/ui, lucide-react
- Auth: Clerk (`middleware.ts` enforces auth; admin via `NEXT_PUBLIC_ADMIN_EMAILS`)
- Data/UI split: domain logic in `lib/*`, UI in `app/components/*` + shadcn primitives in `components/ui/*`
- Primary accent: pink (brand accent applied globally)

---

## Theme & Tokens

- Tokens live in `app/globals.css` under `:root`.
  - Primary (accent): pink
    - `--primary: 330 81% 60%` (maps to `text-primary`, `bg-primary`, Button default)
    - `--ring: 330 81% 50%` (focus rings, e.g., search input)
  - Background/foreground: dark zinc theme
  - Radius: `--radius` used by shadcn

- Tailwind mapping: `tailwind.config.mjs`
  - Uses CSS variables via `hsl(var(--...))`
  - Don’t hardcode colors when tokens exist; prefer `text-primary`, `bg-primary`, or variant props on components.

- House utilities: `app/globals.css`
  - `.table-row`: shared hover + divider behavior for table rows
  - `.table-row-hover`: alias utility used in some tables

Guidelines
- Prefer tokenized colors (primary/pink) via shadcn component variants when possible.
- For explicit accents: use `text-pink-400`, `bg-pink-600`, `hover:bg-pink-500` for parity with the project style.
- Keep CTAs consistent: Button default variant (pink) for primary actions.

---

## Layout & Navigation

- Root layout: `app/layout.tsx`
  - Wraps the app with `ClerkProvider`, global styles, `ToastProvider`
  - Imports `AuthLogger` and `NavigationLogger` for client logging

- Shell components (always present):
  - `app/components/layout/dashboard-layout.jsx`
    - Fixed sidebar + sticky top header
    - Content area scrolls; gutters: `px-6 md:px-8` (keep consistent across pages)
  - `app/components/layout/sidebar.jsx`
    - Navigation list, admin section, trial indicator block, user chip
  - `app/components/layout/dashboard-header.jsx`
    - Tabs: Dashboard, Campaigns, Influencers
    - Active tab underline: `border-pink-400` (matches project)
    - Search input: subtle pink focus ring and border

Spacing & Structure
- Use the layout gutters (`px-6 md:px-8`). Avoid nested center wrappers unless intentionally constrained.
- Each page should start with a clear header (title + optional subtitle/actions) aligned with the sidebar gutter.

---

## Shared Primitives (shadcn/ui)

- `components/ui/*`: Button, Card, Input, Select, Table, Badge, Progress, etc.
- Variants are already themed via tokens (primary → pink). For primary CTAs, use `variant="default"` or explicitly `className="bg-pink-600 hover:bg-pink-500"` when needed for parity.

---

## Styling Patterns

### Cards (dark)
- Container: `bg-zinc-900/80 border border-zinc-700/50`
- Titles: `text-zinc-100` or use CardTitle; descriptions: `text-zinc-400`

### Tables (project parity)
- Container: `rounded-lg border border-zinc-800 bg-zinc-900/30`
- Header row: `border-b border-zinc-800`
- Header cells: `px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider`
- Body: `divide-y divide-zinc-800`
- Cells: `px-6 py-4`
- Row hover: add `className="table-row"` to `TableRow`
- Link accents inside tables: `text-pink-400 hover:text-pink-300 hover:underline`

### Buttons
- Primary: `variant="default"` (pink via token) or `bg-pink-600 hover:bg-pink-500`
- Outline/ghost: keep dark borders (`border-zinc-700/50`) + hover `bg-zinc-800/50`

### Search Inputs
- `bg-zinc-800/60 border-zinc-700/50 focus:border-pink-400/60 focus:ring-2 focus:ring-pink-500/20 transition-all`

### Skeletons/Loading
- Use dark skeletons; avoid light/blue shades. Example: `EnhancedTrialSidebarSkeleton`

### Animations
- Subtle chart animations on the dashboard:
  - `app/components/dashboard/animated-sparkline.tsx` (SVG path dashoffset)
  - `app/components/dashboard/animated-bar-chart.tsx` (bar width tween)
  - `app/components/dashboard/radial-progress.tsx` (stroke dashoffset)
- Avoid heavy animation; use CSS transitions and small motion for liveliness.

---

## Page & Component Map (Routes → Files)

Dashboard
- Route: `/dashboard`
- File: `app/dashboard/page.jsx`
- Uses: `DashboardLayout`, `DashboardHeader`, Cards + Animated charts

Campaigns
- Home (list): `/` → `app/page.js`
  - Components: `app/components/campaigns/CampaignList.jsx`, `campaign-card.jsx`
- New: `/campaigns/new` → `app/campaigns/new/page.jsx`
  - Components: `campaign-form.jsx`
- Similar Search: `/campaigns/search/similar` → `app/campaigns/search/similar/page.jsx`
  - Components: `similar-search-form.jsx`, `similar-search/search-results.jsx`, `breadcrumbs.jsx`
- Keyword Search: `/campaigns/search/keyword` → `app/campaigns/search/keyword/page.jsx`
  - Components: `keyword-search/keyword-search-form.jsx`, `keyword-review.jsx`, `search-results.jsx`, `search-progress.jsx`
- Campaign Detail: `/campaigns/[id]` → `app/campaigns/[id]/page.tsx` + `client-page.tsx`
  - Summary Card (dark), Completed Runs (dark list), Embedded results (keyword/similar)

Billing & Plans
- Billing: `/billing` → `app/billing/page.tsx`
  - Components: `components/billing/subscription-management`, `subscription-status-card.tsx`
- Pricing: `/pricing` → `app/pricing/page.tsx`
  - Plan cards with dark theme and pink CTAs

Profile
- Route: `/profile` → `app/profile/page.tsx`
  - Trial cards: `components/trial/trial-status-card-user.tsx`, `subscription-status-card.tsx`

Admin
- Users: `/admin/users` → `app/admin/users/page.tsx`
  - Dark table with uppercase headers and hover rows; actions: Make Admin / Upgrade Plan (placeholder)
- System Config: `/admin/system-config` → `app/admin/system-config/page.tsx`

Trial Sidebar (Sidebar block)
- Component: `app/components/trial/enhanced-trial-sidebar-indicator.tsx`
  - Dark container, pink accent icons and progress, pink badges/CTA; no gradient overlays
- Skeleton: `app/components/trial/enhanced-trial-sidebar-skeleton.tsx`

Other
- Breadcrumbs: `app/components/breadcrumbs.jsx`
- Logging: `app/components/auth/auth-logger.tsx`, `app/components/navigation/navigation-logger.tsx`

---

## Current Accent & Consistency

- Primary accent is pink (globally tokenized). Apply pink for:
  - Active tab underline, search input focus ring
  - CTA buttons (dashboard, lists, pricing, campaign start)
  - Link accents in tables (profile links, email links)
  - Trial sidebar badges, progress, and CTAs

- Avoid: red/amber/blue gradients and light backgrounds in core UI. Use dark tints if semantics are needed, but prefer pink parity for brand consistency.

---

## Building New Screens

1) Start with `DashboardLayout` so sidebar + header are fixed. Add a page header block inside (title + subtitle).
2) Use dark card containers for sections: `bg-zinc-900/80 border border-zinc-700/50`.
3) For tables, follow the table style guide above (uppercase headers, padding, hover row, dark container).
4) For CTAs, use Button default (pink) or explicit pink classes; outline buttons get dark borders.
5) Inputs: use dark bg, with pink focus ring and animated border.
6) Keep gutters consistent (`px-6 md:px-8`); avoid nesting extra wrappers.
7) Keep interactions subtle (CSS transitions, small animated accents).

---

## Accessibility & Performance

- Ensure keyboard accessibility: clickable containers (cards) should be buttons/links or support Enter/Space.
- Maintain adequate contrast on dark backgrounds (use zinc text + pink accent minds contrast).
- Prefer CSS animations over heavy JS timers; charts use lightweight SVG.

---

## Known Areas & Notes

- Some onboarding/debug/test pages still use older light/blue/green styles. When touching these, apply the same dark/pink scheme.
- Middleware: `middleware.ts` controls auth and admin access—be mindful when linking to admin routes.

---

## Quick Reference (Key Files)

- Theme tokens: `app/globals.css`
- Tailwind mapping: `tailwind.config.mjs`
- Layout: `app/components/layout/{dashboard-layout.jsx, sidebar.jsx, dashboard-header.jsx}`
- Trial sidebar: `app/components/trial/enhanced-trial-sidebar-indicator.tsx`
- Tables: see search results under `app/components/campaigns/**/*/search-results.*`
- Cards & primitives: `components/ui/*`
- Charts: `app/components/dashboard/*`

If you follow these patterns and reuse the referenced components/styles, your new screens will match the current system without surprises.
