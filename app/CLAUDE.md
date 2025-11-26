# app/CLAUDE.md — Frontend & API Routes

## What This Directory Contains

The `app/` directory is the Next.js 15 App Router structure. It contains all frontend pages, layouts, and backend API routes. This is where users interact with Gemz—the dashboard, onboarding flow, campaign creation, billing management, and creator lists.

This directory uses React Server Components by default. Client Components must have `"use client"` at the top.

---

## Directory Structure & Navigation

```
app/
├── layout.tsx              → Root layout (ClerkProvider, ToastProvider)
├── page.tsx                → Landing page (public)
├── dashboard/page.tsx      → Main dashboard (authenticated)
├── campaigns/              → Campaign management
│   ├── page.tsx            → Campaign list
│   └── [id]/page.tsx       → Single campaign view
├── lists/                  → Creator lists
│   ├── page.tsx            → All lists
│   └── [id]/page.tsx       → Single list view
├── billing/page.tsx        → Subscription management
├── profile/page.tsx        → User profile settings
├── onboarding/             → 2-step onboarding flow
│   ├── step-1/page.tsx     → Personal info
│   ├── step-2/page.tsx     → Business details + plan selection
│   └── complete/page.tsx   → Payment & completion
├── admin/                  → Admin-only pages
│   ├── users/page.tsx      → User management
│   └── system-config/      → System configuration
├── api/                    → Backend API routes (see api/CLAUDE.md)
├── components/             → Feature-specific components
└── providers/              → React Context providers
```

---

## Key Files & Their Functions

### Root Layout (`layout.tsx`)
The global layout wraps the entire application. It provides:
- `ClerkProvider` — Authentication context
- `ToastProvider` — Toast notifications (`useToast()` hook)
- `AuthLogger` — Client-side auth event logging

To grep: `ClerkProvider`, `ToastProvider`, `AuthLoggerProvider`

### Dashboard (`dashboard/page.tsx`)
The main authenticated view. Shows:
- Campaign count and usage statistics
- Recent search activity
- Quick actions (create campaign, view lists)

Uses `getDashboardStats()` from `lib/dashboard/stats.ts` for data.

### Campaigns (`campaigns/page.tsx`, `campaigns/[id]/page.tsx`)
- List page fetches campaigns via `GET /api/campaigns`
- Detail page shows job progress, creator results
- Uses `CampaignList`, `CampaignCard`, `JobProgressBar` components

To grep: `CampaignList`, `CampaignCard`, `useCampaign`

### Onboarding Flow (`onboarding/`)
Multi-step flow captured in three pages:
1. **step-1**: `OnboardingStep1Form` component collects name, validates email
2. **step-2**: `OnboardingStep2Form` collects business info, shows plan selector
3. **complete**: `StripePaymentForm` redirects to Stripe Checkout

API calls: `POST /api/onboarding/step-1`, `POST /api/onboarding/step-2`, `POST /api/stripe/create-checkout`

To grep: `OnboardingStep1Form`, `OnboardingStep2Form`, `useOnboarding`

### Creator Lists (`lists/`)
- List page: `CreatorListGrid` component showing all saved lists
- Detail page: `CreatorListView` with drag-and-drop buckets (backlog, contacted, responded)
- Export: `ExportButton` triggers CSV download

To grep: `CreatorListGrid`, `CreatorListView`, `useCreatorList`

### Billing (`billing/page.tsx`)
Displays subscription status, plan limits, and upgrade options:
- `SubscriptionStatus` component shows current plan
- `UsageDisplay` shows monthly creator usage vs limit
- `UpgradeButton` opens Stripe Customer Portal

Uses `GET /api/billing/status` for data. To grep: `SubscriptionStatus`, `UsageDisplay`

---

## Feature-Specific Components (`app/components/`)

Components are organized by feature domain:

```
app/components/
├── auth/                → Login forms, auth guards
├── billing/             → Subscription UI, upgrade prompts
│   └── access-guard-overlay.tsx → Blocks UI if plan limit hit
├── campaigns/           → Campaign cards, search forms
├── dashboard/           → Dashboard widgets, stats cards
├── trial/               → Trial countdown, urgency indicators
│   └── trial-sidebar-compact.tsx → Trial status in sidebar
├── onboarding/          → Multi-step form components
│   └── stripe-payment-form.tsx → Stripe Checkout integration
└── lists/               → Creator list management UI
```

**Key Component Files:**
- `access-guard-overlay.tsx` — Function `AccessGuardOverlay({ userId })` checks limits via `PlanValidator`
- `trial-sidebar-compact.tsx` — Function `TrialSidebarCompact()` shows days remaining
- `stripe-payment-form.tsx` — Function `StripePaymentForm({ planId })` creates checkout session

---

## Providers (`app/providers/`)

React Context providers that wrap the app:

- `ToastProvider` — Provides `useToast()` hook for notifications
- `AuthLoggerProvider` — Logs auth events client-side
- `ConsoleProxy` — Intercepts `console.log` for structured logging

To grep: `ToastProvider`, `useToast`, `AuthLoggerProvider`

---

## Routing Patterns

### Dynamic Routes
- `[id]` segments capture parameters: `campaigns/[id]` → `params.id`
- Access via `params` prop in Server Components or `useParams()` in Client Components

### Protected Routes
Most routes are protected by Clerk middleware (`middleware.ts` at repo root).

Public routes: `/`, `/sign-in`, `/sign-up`, `/api/webhooks/*`

All other routes require authentication. The middleware redirects unauthenticated users to `/sign-in`.

### API Routes
Backend logic lives in `app/api/`. Each route exports async functions:
- `GET(request: Request)` — Read operations
- `POST(request: Request)` — Create/mutate operations
- `DELETE(request: Request)` — Delete operations

See `app/api/CLAUDE.md` for detailed API documentation.

---

## Client vs Server Components

**Server Components (default):**
- Fetch data directly with `await db.query()`
- No `"use client"` directive
- Cannot use hooks like `useState`, `useEffect`

**Client Components:**
- Must have `"use client"` at top of file
- Can use React hooks and browser APIs
- Fetch data via API routes or SWR

**Pattern:** Keep data fetching in Server Components, pass data as props to Client Components for interactivity.

---

## Logging in Frontend

Never use bare `console.log`. Use structured logging:

```typescript
import { structuredConsole } from '@/lib/logging/console-proxy';
structuredConsole.log('User action', { userId, action: 'click' });
```

This ensures client-side logs are formatted consistently and can be filtered.

---

## Next in Chain

- For API route details, see `app/api/CLAUDE.md`
- For backend business logic, see `lib/CLAUDE.md`
- For shared UI components (Shadcn), see `components/CLAUDE.md`
