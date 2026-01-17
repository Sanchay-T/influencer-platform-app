# Session: LogSnag Tracking & Clerk Webhook Fix

**Date:** January 18, 2026
**Branch:** `feat/sentry-observability-improvements` → merged to `main`
**PR:** #41

---

## Problem Statement

LogSnag was showing garbage user data for searches:
```
w (user-user_2zhhdikxpk8nc3dmj1b6dmkri6w@example.com): instagram keyword found 502 creators
```

Instead of:
```
Sanchay Thalnerkar (thalnerkarsanchay17@gmail.com): instagram keyword found 502 creators
```

---

## Root Causes Identified

### 1. Clerk Webhook Not Configured (MAIN ISSUE)

**Problem:** The production Clerk webhook had:
- No events subscribed (user.created, user.updated were unchecked)
- Wrong URL: `https://usegemz.io/...` instead of `https://www.usegemz.io/...`

**Result:** When users signed up, Clerk never notified the app, so users were never created in the database.

### 2. Legacy Code Using Wrong Function

**Problem:** `lib/search-engine/runner.ts` was using `getUserProfile()` directly instead of `getUserDataForTracking()`.

```typescript
// BAD - old code
const user = await getUserProfile(job.userId);
email: user?.email || 'unknown'  // Returns garbage if user not in DB

// GOOD - fixed code
const userData = await getUserDataForTracking(job.userId);
email: userData.email || 'unknown'  // Fetches from Clerk if not in DB
```

### 3. Server-Only Code in Client Bundle

**Problem:** `getUserDataForTracking()` used server-only imports (`clerkBackendClient`) but was in `track.ts` which client components imported.

**Result:** Build error: `'server-only' cannot be imported from a Client Component module`

---

## Fixes Applied

### Fix 1: Clerk Webhook Configuration

**Location:** Clerk Dashboard → Webhooks

1. Updated webhook URL from `https://usegemz.io/api/webhooks/clerk` to `https://www.usegemz.io/api/webhooks/clerk`
2. Enabled events:
   - `user.created`
   - `user.updated`

### Fix 2: Created Server-Only Tracking Module

**New file:** `lib/analytics/track-server-utils.ts`

```typescript
import 'server-only';
import { clerkBackendClient } from '@/lib/auth/backend-auth';
import { getUserProfile } from '@/lib/db/queries/user-queries';

export async function getUserDataForTracking(userId: string): Promise<{ email: string; name: string }> {
  const profile = await getUserProfile(userId);

  if (profile && !isFallbackEmail(profile.email)) {
    return { email: profile.email || '', name: profile.fullName || '' };
  }

  // Fetch from Clerk if DB has fallback/missing data
  const clerk = await clerkBackendClient();
  const clerkUser = await clerk.users.getUser(userId);
  return {
    email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
    name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim()
  };
}
```

### Fix 3: Updated All Import Paths

Changed imports in these files from `@/lib/analytics/track` to `@/lib/analytics/track-server-utils`:

- `lib/search-engine/runner.ts`
- `lib/search-engine/v2/workers/dispatch.ts`
- `lib/search-engine/v2/core/job-status.ts`
- `app/api/scraping/tiktok/route.ts`
- `app/api/scraping/instagram-scrapecreators/route.ts`
- `app/api/scraping/youtube/route.ts`
- `app/api/scraping/youtube-similar/route.ts`
- `app/api/scraping/similar-discovery/route.ts`

### Fix 4: Synced Existing Users to Production DB

**Script:** `scripts/sync-clerk-users-to-db.ts`

```bash
npx tsx scripts/sync-clerk-users-to-db.ts --prod --apply
```

**Result:** 13 users synced including:
- `blaine@castmagic.io` (Blaine Bolus)
- `appsumo.abe@gmail.com` (Abe Challah)
- `eisett@appsumo.com` (Erika Isett)
- And 10 more...

---

## Additional Sentry Observability Improvements

Also included in this PR:

### Trace Propagation
**File:** `sentry.client.config.ts`

```typescript
tracePropagationTargets: [
  'localhost',
  /^https:\/\/usegems\.io/,
  /^https:\/\/usegemz\.ngrok\.app/,
  /^https:\/\/.*\.vercel\.app/,
  /^\/api\//,
],
```

### Breadcrumbs in Polling Hooks
**Files:** `lib/query/hooks/useJobStatus.ts`, `lib/query/hooks/useJobPolling.ts`

Added Sentry breadcrumbs for:
- Job polling initialization
- Fetch requests
- Progress updates
- Job completion

### User Context from Clerk
**File:** `app/components/auth/auth-logger.tsx`

```typescript
Sentry.setUser({
  id: user.id,
  email: user.primaryEmailAddress?.emailAddress,
  username: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
});
```

### Enhanced Error Boundary
**File:** `components/ui/error-boundary.tsx`

- Added component name extraction from stack trace
- Added React context to Sentry captures

---

## New Scripts Created

| Script | Purpose |
|--------|---------|
| `scripts/sync-clerk-users-to-db.ts` | Backfill Clerk users to database |
| `scripts/find-corrupted-userids.ts` | Find users with lowercased/corrupted userIds |
| `scripts/check-clerk-user.ts` | Debug script to verify user exists in Clerk |
| `scripts/find-userid-in-db.ts` | Search for userId across database tables |

---

## Environment Configuration Discovered

| Environment | Clerk | Database | LogSnag |
|-------------|-------|----------|---------|
| Local (.env.local) | `sk_test_...` | ap-south-1 (Supabase) | Shared |
| Production (Vercel) | `sk_live_...` | us-east-1 (Supabase) | Shared |

**Note:** Local and production use different Clerk instances and different databases, but share the same LogSnag channel. This caused dev test data to appear in production LogSnag.

---

## Verification Steps

1. **Webhook working:**
   - Sign up with new account on `www.usegemz.io`
   - Check Clerk dashboard → Webhooks → should show successful delivery
   - Check database → user should be created

2. **LogSnag showing correct data:**
   - Run a search with existing account
   - Check LogSnag → should show real name and email

3. **All users synced:**
   ```bash
   npx tsx scripts/sync-clerk-users-to-db.ts --prod
   # Should show "Found 0 users missing from database"
   ```

---

## Files Changed

### New Files
- `lib/analytics/track-server-utils.ts`
- `lib/sentry/client-utils.ts`
- `app/api/analytics/track/route.ts`
- `app/api/test/sentry/route.ts`
- `scripts/sync-clerk-users-to-db.ts`
- `scripts/find-corrupted-userids.ts`
- `scripts/check-clerk-user.ts`
- `scripts/find-userid-in-db.ts`
- `agent_docs/sentry-integration-report.md`

### Modified Files
- `lib/analytics/track.ts` - Removed server-only code
- `lib/search-engine/runner.ts` - Use getUserDataForTracking
- `lib/search-engine/v2/workers/dispatch.ts` - Updated import
- `lib/search-engine/v2/core/job-status.ts` - Updated import
- `sentry.client.config.ts` - Added trace propagation
- `lib/query/hooks/useJobStatus.ts` - Added breadcrumbs
- `lib/query/hooks/useJobPolling.ts` - Added breadcrumbs
- `app/components/auth/auth-logger.tsx` - Added Sentry user context
- `components/ui/error-boundary.tsx` - Enhanced error capture
- All API route files - Updated imports and added Sentry tracking

---

## Lessons Learned

1. **Always verify webhook configuration in production** - Events must be explicitly subscribed
2. **Domain redirects break webhooks** - `usegemz.io` → `www.usegemz.io` causes 307 redirect, Clerk doesn't follow redirects
3. **Separate server-only code** - Functions using backend APIs must be in separate modules from client-importable code
4. **Sync existing users after fixing webhooks** - Historical users won't retroactively get database records
