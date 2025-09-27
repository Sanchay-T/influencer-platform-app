# Client Workload Audit — 2025-09-27

> Status: Client logging is now gated by `NEXT_PUBLIC_CLIENT_LOG_LEVEL` with production defaulting to `warn`; remaining items track future deferrals.

## Where We Fetch
- `app/dashboard/page.tsx`: now hydrates via RSC + shared `getDashboardOverview`, removing the client `useEffect` fetch that previously blocked paint on every navigation; marked `revalidate = 0` to keep it request-bound.
- `app/components/billing/subscription-management.tsx`: calls `/api/billing/status` and `/api/stripe/customer-portal` sequentially, then schedules a TTL-based refetch. Because the component renders on most authenticated routes, this fan-out happens for every visit.
- `app/components/campaigns/search/search-results.tsx`: when `jobId` is present, kicks off `fetch('/api/scraping/tiktok?jobId=…')` immediately and keeps data in client state even if the server already has a completed export.
- `app/components/campaigns/export-button.tsx`: delegates export to the client without lazy-loading the heavy CSV helper; `useComponentLogger` and `toast` load even when the button is never pressed.
- `app/lists/page.tsx`: now preloads summaries via `getListSummaries` in an RSC wrapper, so the client shell starts with data and no longer fires an initial fetch on mount.
- `app/lists/[id]/page.tsx`: server-hydrated with `getListDetailCached`; the client component only re-fetches if the route is accessed without preloaded data or after mutations.

## Polling & Loaders
- `app/components/campaigns/search/search-results.tsx`: continues polling every 5s until completion, logging on every in-flight cycle. Multiple open tabs therefore poll in parallel.
- `app/components/billing/subscription-management.tsx`: TTL refetch runs regardless of viewport visibility, which means background tabs keep hitting the API.
- `app/dashboard/page.tsx`: server-rendered snapshot removes redundant fetches; follow-up is only needed if we add client-side refresh controls.

## Logging Hotspots
- `lib/logging/react-logger.ts`: previously logged mounts/updates at `debug`/`info`/`warn` in production with unconditional `JSON.stringify`; refactor now routes through `shouldEmitClientLog` to avoid that cost, so downstream cleanup focuses on consumer components.
- `app/components/billing/subscription-management.tsx`: replaced noisy console traces with guarded `componentLogger.logInfo` calls so fetch diagnostics stay dev-only.
- `app/components/campaigns/search/search-results.tsx`: button handlers use both `userActionLogger` and `componentLogger`, doubling log volume for simple clicks.
- `campaignLogger` usage inside polling loop writes to the logger on every retry; on long-running jobs this produces dozens of info-level entries per user.

## Client Payloads
- Shared logging hooks (`useComponentLogger`, `useUserActionLogger`, `useApiLogger`) instantiate Clerk context and `logger` utilities for every client bundle that imports them, regardless of whether logging is enabled.
- `app/components/campaigns/search/search-results.tsx` pulls in multiple Lucide icons, heavy table chrome, and logging utilities in the initial chunk; the same chunk is served to users simply skimming result summaries.
- `app/components/billing/subscription-management.tsx` ships the entire logging stack and customer-portal buttons on all authenticated pages even when billing is hidden behind feature flags.

## Immediate Opportunities
1. Gate client logging behind an environment-aware minimum level (`NEXT_PUBLIC_CLIENT_LOG_LEVEL`) and default production to `warn` so mount/update chatter is suppressed.
2. Lazily compute expensive log context only if the message will be emitted, avoiding unconditional `JSON.stringify` work.
3. Move subscription and campaign polling onto visibility-aware hooks (`usePageVisibility`, `useInterval`) so background tabs pause.
4. Defer bulk UI imports (`lucide-react`, heavy tables) with dynamic imports or smaller icons when the view is outside the default fold.
5. Replace console traces in billing with structured logs guarded by the new log level threshold to keep prod consoles clean.
6. Extract polling into SWR or React Query with deduplication so concurrent tabs share responses instead of multiplying requests.
