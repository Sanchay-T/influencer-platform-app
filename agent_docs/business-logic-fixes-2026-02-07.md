# Business Logic Fixes — Feb 7, 2026

Deep-scan audit found 10 real bugs affecting billing accuracy, data integrity, and UX. All fixed with 18 regression tests against the real dev DB.

---

## Fixes

### A. Campaign creation atomicity
**Files:** `lib/billing/usage-tracking.ts`, `app/api/campaigns/route.ts`

**Bug:** Campaign insert and usage counter increment were separate DB operations. A crash between them left the counter out of sync — campaign exists but counter not incremented.

**Fix:** `incrementCampaignCount` now accepts an optional Drizzle transaction parameter. The campaigns POST handler wraps both the insert and the counter bump in a single `db.transaction()`. Backward compatible — callers without a tx still get the internal transaction.

---

### B. Enrichment counter never incremented
**Files:** `lib/services/creator-enrichment.ts`, `lib/billing/index.ts`

**Bug:** `incrementEnrichmentCount()` existed and worked, but was never called. The enrichment service checked limits (comparing `enrichmentsCurrentMonth` against the plan cap) but never incremented, so every user had unlimited enrichments.

**Fix:** Added `incrementEnrichmentCount` to the billing barrel export. Wired it into `creator-enrichment.ts` after `persistEnrichment` succeeds, replacing the TODO comment.

---

### C. can-create misleading error metadata
**File:** `app/api/campaigns/can-create/route.ts`

**Bug:** Catch block logged `failureMode: 'fail-open'` but actually returned `{ allowed: false }` (fail-closed). Misleading for anyone reading logs during an incident.

**Fix:** Changed metadata to `failureMode: 'fail-closed'` and `securityNote: 'Validation failure prevents campaign creation as a safety measure'`.

---

### D. refreshListStats race condition
**File:** `lib/db/queries/list-queries.ts`

**Bug:** `updateListItems()` and `removeListItems()` called `refreshListStats(listId)` *after* the transaction committed. Concurrent requests could modify items between the commit and the refresh, producing incorrect stats.

**Fix:** `refreshListStats` now accepts an optional tx parameter. Calls moved inside the existing transactions in both functions.

---

### E. addCreatorsToList — no input validation
**File:** `lib/db/queries/list-queries.ts`

**Bug:** `platform`, `externalId`, and `handle` went straight into the INSERT with zero validation. Empty strings, undefined, or invalid platform values produced garbage rows.

**Fix:** Added Zod schema validating `platform` as `z.enum(['tiktok', 'instagram', 'youtube'])`, `externalId` and `handle` as `z.string().trim().min(1)`, with sensible defaults for optional fields. Validated at the top of the function before any DB work.

---

### F. Activity logging uses wrong logger
**File:** `lib/db/queries/list-queries.ts`

**Bug:** The fire-and-forget activity log `.catch()` in `addCreatorsToList` used `structuredConsole.error` instead of the structured category logger. Errors weren't routed through the logging pipeline.

**Fix:** Added `createCategoryLogger(LogCategory.LIST)` (including the new `LIST` category in constants/types) and replaced the `structuredConsole.error` call.

---

### G. Campaign detail loads full creator arrays
**File:** `app/api/campaigns/[id]/route.ts`

**Bug:** The Drizzle query included `creators: true` in the results relation. For campaigns with many jobs, this loaded thousands of creator records into a single JSON response. The sidebar only needed `processedResults` (already on the job row), and actual creator data was fetched via the paginated `/api/v2/status` endpoint.

**Fix:** Removed `creators: true` from the results columns. Results now only return `id`, `jobId`, and `createdAt`.

---

### H. Email filter doesn't reset pagination
**File:** `app/components/campaigns/keyword-search/search-results.jsx`

**Bug:** When `showEmailOnly` toggled, `currentPage` stayed at whatever page the user was on. If filtered results had fewer pages, user saw an empty page.

**Fix:** Added `useEffect(() => { setPage(1); }, [showEmailOnly]);` after the email filter hook.

---

### I. Trial blur uses page-local index
**File:** `app/components/campaigns/keyword-search/components/CreatorTableView.tsx`

**Bug:** `isBlurred={isTrialUser && index >= trialClearLimit}` used the index within the current page. Page 2 row 0 had index 0 and appeared unblurred even though it was global row 50+. Currently dormant (trial users can't paginate), but wrong.

**Fix:** Added `startIndex` prop to `CreatorTableView`. Blur now uses `(startIndex + index) >= trialClearLimit`. `visibleRows` slicing also accounts for `startIndex`. Parent passes `startIndex={(currentPage - 1) * itemsPerPage}`.

---

### J. CSV export polls with no backoff
**File:** `app/components/campaigns/export-button.tsx`

**Bug:** Constant 2-second polling interval for up to 5 minutes = 150 requests. No backoff.

**Fix:** Exponential backoff starting at 2s, growing by 1.5x, capped at 30s. Over 5 minutes this produces ~25 requests instead of 150.

```
2s → 3s → 4.5s → 6.75s → 10.1s → 15.2s → 22.8s → 30s → 30s → ...
```

---

## Test Infrastructure

Vitest was previously deleted. Recreated from scratch:

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Two environments: `node` (backend), `jsdom` (components). Path aliases matching tsconfig. 30s timeout. |
| `lib/test-utils/setup.ts` | Loads `.env.local` / `.env.development`, verifies `DATABASE_URL` |
| `lib/test-utils/db-helpers.ts` | Real-DB factories: `createTestUser`, `createTestCampaign`, `createTestList`, `createTestCreatorProfile` — each returns a `cleanup()` function |
| `package.json` | `"test": "vitest run"`, `"test:watch": "vitest"` |

## Test Files

| File | Tests | Fixes Covered |
|------|-------|--------------|
| `lib/test-utils/smoke.test.ts` | 1 | DB connectivity |
| `app/api/campaigns/route.test.ts` | 1 | A (atomicity) |
| `lib/services/creator-enrichment.test.ts` | 2 | B (enrichment counter) |
| `app/api/campaigns/can-create/route.test.ts` | 2 | C (log metadata) |
| `lib/db/queries/list-queries.test.ts` | 5 | D (stats race), E (validation) |
| `app/api/campaigns/[id]/route.test.ts` | 2 | G (payload size) |
| `app/components/campaigns/keyword-search/components/CreatorTableView.test.tsx` | 4 | I (blur index) |
| `app/components/campaigns/export-button.test.tsx` | 1 | J (poll backoff) |
| **Total** | **18** | |

## Changed Files (source, not tests)

```
lib/billing/usage-tracking.ts          # Fix A: tx parameter on incrementCampaignCount
app/api/campaigns/route.ts             # Fix A: atomic transaction
lib/billing/index.ts                   # Fix B: export incrementEnrichmentCount
lib/services/creator-enrichment.ts     # Fix B: call incrementEnrichmentCount
app/api/campaigns/can-create/route.ts  # Fix C: log metadata
lib/db/queries/list-queries.ts         # Fix D, E, F: stats tx, Zod validation, logger
lib/logging/constants.ts               # Fix F: LIST category
lib/logging/types.ts                   # Fix F: LIST category
app/api/campaigns/[id]/route.ts        # Fix G: remove creators from results
app/components/.../search-results.jsx  # Fix H, I: pagination reset, startIndex prop
app/components/.../CreatorTableView.tsx # Fix I: startIndex-aware blur
app/components/.../export-button.tsx   # Fix J: exponential backoff
package.json                           # test scripts
vitest.config.ts                       # test config
```

## Verification

```
pnpm test       → 18/18 passing (8 files)
pnpm typecheck  → no new errors (pre-existing: stripe API version, ErrorInfo.digest, server-console-bridge)
```
