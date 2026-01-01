# Search Progress UX Analysis

> **Purpose**: Document every component, hook, and data flow related to search progress UI.
> **Created**: Jan 1, 2026
> **Status**: Investigation complete — needs debugging

---

## Table of Contents

1. [Overview — What's Broken](#overview--whats-broken)
2. [Progress Bar & Spinner](#1-progress-bar--spinner)
3. [Bio & Email Data Flow](#2-bio--email-data-flow)
4. [Job Status & Polling](#3-job-status--polling)
5. [Creator Data Structure](#4-creator-data-structure)
6. [Known Mismatches & Issues](#5-known-mismatches--issues)
7. [Debug Checklist](#6-debug-checklist)

---

## Overview — What's Broken

**User-reported issues:**
1. Progress bar behavior inconsistent
2. Spinner doesn't stop when expected
3. Bio & Email columns show "No bio" / "No email" even for enriched creators
4. State doesn't reflect correctly in UI

---

## 1. Progress Bar & Spinner

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `app/components/campaigns/keyword-search/search-progress.jsx` | Main progress UI | 289 (bar), 259 (spinner) |
| `app/components/campaigns/keyword-search/search-progress-helpers.ts` | clampProgress, computeStage | 100-195 |
| `lib/query/hooks/useJobPolling.ts` | Unified polling hook | 88-246 |
| `lib/query/hooks/useJobStatus.ts` | React Query polling | 112-184 |
| `lib/query/hooks/useJobRealtime.ts` | Supabase WebSocket | 63-194 |

### Progress Bar Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ /api/v2/status?jobId=xxx                                         │
│ ─────────────────────────                                        │
│ Returns: {                                                       │
│   status: 'searching' | 'enriching' | 'completed' | ...         │
│   progress: {                                                    │
│     keywordsCompleted: 5,                                        │
│     keywordsDispatched: 10,                                      │
│     creatorsFound: 500,                                          │
│     creatorsEnriched: 250,                                       │
│     percentComplete: 37.5   ← THIS drives progress bar           │
│   }                                                              │
│ }                                                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ useJobPolling(jobId)                                             │
│ ────────────────────                                             │
│ Merges:                                                          │
│   - useJobRealtime (WebSocket, preferred)                        │
│   - useJobStatus (HTTP polling, fallback)                        │
│                                                                  │
│ Returns: {                                                       │
│   progress: Math.min(100, percentComplete),  ← CAPPED at 100     │
│   status,                                                        │
│   isActive,                                                      │
│   isTerminal                                                     │
│ }                                                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ SearchProgress component                                         │
│ ────────────────────────                                         │
│ State:                                                           │
│   displayProgress = clampProgress(progress)  ← Never decreases   │
│                                                                  │
│ Render:                                                          │
│   <Progress value={displayProgress} />                           │
│   {isSuccess ? <CheckCircle/> : <Loader2 animate-spin/>}        │
└──────────────────────────────────────────────────────────────────┘
```

### Spinner Visibility Logic

**File**: `search-progress.jsx` lines 250-260

```jsx
{isSuccess ? (
  <CheckCircle2 />        // ✓ Done
) : displayStatus === 'timeout' ? (
  <AlertCircle />         // ⚠️ Timeout
) : displayStatus === 'error' ? (
  <AlertCircle />         // ⚠️ Error
) : error ? (
  <RefreshCcw />          // 🔄 Network error
) : (
  <Loader2 animate-spin/> // 🔄 SPINNER (default)
)}
```

**Spinner shows when**: None of the terminal conditions are met
**Spinner stops when**: `isSuccess === true` OR status is `timeout`/`error`

### Status Values

| Status | Phase | Spinner? | Progress Bar? |
|--------|-------|----------|---------------|
| `pending` | waiting | ✅ Yes | Shows 0% |
| `dispatching` | waiting | ✅ Yes | Shows ~0-5% |
| `searching` | active | ✅ Yes | 0-50% |
| `enriching` | active | ✅ Yes | 50-100% |
| `completed` | done | ❌ No (checkmark) | 100% |
| `partial` | done | ❌ No (checkmark) | 100% |
| `error` | done | ❌ No (alert) | Stays at last % |
| `timeout` | done | ❌ No (alert) | Stays at last % |

---

## 2. Bio & Email Data Flow

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `hooks/useBioEnrichment.ts` | Hydrate + fallback fetch | 61-233 |
| `components/BioLinksCell.tsx` | Renders bio | 68 ("No bio") |
| `components/CreatorTableRow.tsx` | Table row | 151, 280-289, 375 |
| `utils/email-handlers.ts` | getBioDataForCreator, getBioEmailForCreator | 16-141 |

### Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ V2 ENRICH-WORKER (server-side)                                   │
│ ───────────────────────────────                                  │
│ File: lib/search-engine/v2/workers/enrich-worker.ts              │
│                                                                  │
│ 1. Load creators from job_creators WHERE enriched=false          │
│ 2. Call adapter.enrich() (Instagram/TikTok/YouTube)              │
│ 3. Set: {                                                        │
│      bioEnriched: true,                                          │
│      bioEnrichedAt: '2026-01-01...',                            │
│      bio_enriched: {                                             │
│        biography: 'Creator bio text...',                         │
│        bio_links: [{url, title}],                                │
│        external_url: 'https://...',                              │
│        extracted_email: 'email@example.com',                     │
│        fetched_at: '2026-01-01...'                              │
│      },                                                          │
│      creator: { ...creator, emails: ['email@example.com'] }      │
│    }                                                             │
│ 4. UPDATE job_creators SET creatorData=..., enriched=true        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ /api/v2/status?jobId=xxx                                         │
│ ───────────────────────                                          │
│ File: app/api/v2/status/route.ts                                 │
│                                                                  │
│ SELECT creatorData FROM job_creators WHERE jobId = ?             │
│ Returns: results: [{ creators: [NormalizedCreator, ...] }]       │
│                                                                  │
│ Each creator has:                                                │
│   - bio_enriched.biography                                       │
│   - bio_enriched.bio_links                                       │
│   - bio_enriched.extracted_email                                 │
│   - creator.emails (array)                                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ useBioEnrichment(creators, jobStatus, jobId, platform)           │
│ ──────────────────────────────────────────────────────           │
│ File: hooks/useBioEnrichment.ts                                  │
│                                                                  │
│ STEP 1: HYDRATE (lines 91-123)                                   │
│   - Loop through creators                                        │
│   - If creator.bio_enriched?.fetched_at exists:                  │
│     - Extract to bioData state by owner.id or handle             │
│                                                                  │
│ STEP 2: FALLBACK FETCH (lines 141-231)                          │
│   - Only if job is complete AND creators missing bio_enriched    │
│   - POST /api/creators/fetch-bios (Instagram)                    │
│   - POST /api/creators/fetch-tiktok-bios (TikTok)                │
│   - Updates bioData state with results                           │
│                                                                  │
│ Returns: { bioData: BioDataMap, isLoading: boolean }             │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ getBioDataForCreator(creator, bioData)                           │
│ ──────────────────────────────────────                           │
│ File: utils/email-handlers.ts lines 57-107                       │
│                                                                  │
│ 1. Instagram: Check bioData[owner.id]                            │
│ 2. TikTok: Check bioData[handle]                                 │
│ 3. Fallback: Extract from raw creator fields                     │
│                                                                  │
│ Returns: { biography, bio_links, external_url, extracted_email } │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ CreatorTableRow → BioLinksCell                                   │
│ ──────────────────────────────                                   │
│ File: components/BioLinksCell.tsx                                │
│                                                                  │
│ Props: bio, bioLinks, externalUrl, isLoading                     │
│                                                                  │
│ Renders:                                                         │
│   - If isLoading: "Fetching bio..."                              │
│   - If !hasContent: "No bio" (line 68)                           │
│   - Else: bio text + links                                       │
└──────────────────────────────────────────────────────────────────┘
```

### "No bio" / "No email" Root Causes

**"No bio" appears when:**
1. `bio_enriched.fetched_at` doesn't exist (V2 worker didn't run)
2. `bio_enriched.biography` is null/empty
3. bioData state not hydrated (hook didn't find data)

**"No email" appears when:**
1. `creator.emails` array is empty
2. `bio_enriched.extracted_email` is null
3. No email found in bio text via regex

---

## 3. Job Status & Polling

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `lib/query/hooks/useJobPolling.ts` | Unified state | 88-246 |
| `lib/query/hooks/useJobStatus.ts` | HTTP polling | 112-184 |
| `lib/query/hooks/useJobRealtime.ts` | WebSocket | 63-194 |
| `app/campaigns/[id]/hooks/useCampaignJobs.ts` | Campaign state | 467-519 |
| `app/api/v2/status/route.ts` | Status API | 30-295 |

### Polling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               useJobPolling (SINGLE SOURCE OF TRUTH)         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │  useJobRealtime     │    │  useJobStatus           │    │
│  │  (WebSocket)        │    │  (HTTP Polling)         │    │
│  │                     │    │                         │    │
│  │  - Supabase channel │    │  - React Query          │    │
│  │  - Real-time push   │    │  - 2s interval          │    │
│  │  - Preferred        │    │  - Fallback             │    │
│  └─────────────────────┘    └─────────────────────────┘    │
│              ↓                         ↓                    │
│         ┌────────────────────────────────────┐             │
│         │  MERGE LOGIC (lines 103-126)       │             │
│         │  Priority: Realtime > Polling      │             │
│         │  Returns unified status/progress   │             │
│         └────────────────────────────────────┘             │
│                          ↓                                  │
│  Consumers:                                                │
│    - SearchProgress (progress bar)                         │
│    - useCampaignJobs (sidebar)                            │
│    - RunRail (run list)                                    │
└─────────────────────────────────────────────────────────────┘
```

### Status Transition

```
Database (scrapingJobs.status):
  pending → processing → completed/error/timeout

API maps to UI status:
  pending                    → 'dispatching'
  processing + no enrichment → 'searching'
  processing + enriching     → 'enriching'
  completed                  → 'completed'
  completed + error          → 'partial'
  error                      → 'error'
  timeout                    → 'timeout'
```

### Polling Stop Conditions

**File**: `useJobStatus.ts` line 135

```typescript
refetchInterval: (query) => {
  const status = query.state.data?.status;
  // Stop polling for terminal statuses
  if (status === 'completed' || status === 'partial' ||
      status === 'error' || status === 'timeout') {
    return false;  // Stop polling
  }
  return 2000;  // Continue every 2s
}
```

---

## 4. Creator Data Structure

### NormalizedCreator (V2 Format)

```typescript
// File: lib/search-engine/v2/core/types.ts

interface NormalizedCreator {
  platform: 'TikTok' | 'YouTube' | 'Instagram';
  id: string;
  mergeKey: string;

  creator: {
    username: string;
    name: string;
    followers: number;
    avatarUrl: string;
    bio: string;
    emails: string[];      // ← ARRAY of emails
    verified: boolean;
    uniqueId?: string;     // TikTok
    instagramUserId?: string; // Instagram
  };

  // Bio enrichment fields (BOTH exist for compatibility)
  bioEnriched?: boolean;            // camelCase flag
  bioEnrichedAt?: string;           // Timestamp
  bio_enriched?: {                  // snake_case object
    biography: string | null;
    bio_links: Array<{url?, lynx_url?, title?}>;
    external_url: string | null;
    extracted_email: string | null; // ← SINGLE email
    fetched_at: string;
    error?: string;
  };

  // Legacy fields
  content: ContentInfo;
  hashtags: string[];
  video?: {...};
}
```

### Field Duality Issue

| Field | Format | Contains |
|-------|--------|----------|
| `bioEnriched` | camelCase | `boolean` flag |
| `bio_enriched` | snake_case | Full enrichment object |
| `creator.emails` | Array | All extracted emails |
| `bio_enriched.extracted_email` | String | First email only |

**Both `bioEnriched` and `bio_enriched` are written by enrichment adapters.**

---

## 5. Known Mismatches & Issues

### Issue 1: Bio Not Showing for Old Runs

**Symptom**: "No bio" for completed runs
**Cause**: Old runs created before V2 enrichment was working
**Location**: `useBioEnrichment.ts` fallback logic

**Check**: Does `creator.bio_enriched?.fetched_at` exist?
- If NO → V2 worker never ran for this creator
- Fallback should trigger client-side fetch

### Issue 2: Email Extraction Fragmented

**Symptom**: Emails exist in DB but show "No email"
**Cause**: Multiple paths for email storage

**Email locations to check**:
1. `creator.creator.emails` (array)
2. `bio_enriched.extracted_email` (single)
3. `contact_email` (legacy)
4. `metadata.contactEmails` (legacy)

### Issue 3: Spinner Doesn't Stop

**Symptom**: Spinner keeps spinning after job completes
**Cause**: `isSuccess` never becomes true

**Check**:
- Is status transitioning to 'completed'/'partial'?
- Is polling stopping?
- Is Realtime connected?

### Issue 4: Progress Goes Above 100%

**Symptom**: Progress shows >100%
**Fixed in**: `clampProgress()` and `Math.min(100, ...)`
**Files**: `search-progress-helpers.ts:100-104`, `useJobStatus.ts:147`

---

## 6. Debug Checklist

### Enable Debug Logging

```javascript
// In browser console:
localStorage.setItem('debug_job_status', 'true');
// Reload page
```

### Check 1: API Response

```bash
# In browser Network tab, find:
GET /api/v2/status?jobId=xxx

# Check response:
{
  status: "completed",  // Should be terminal
  progress: { percentComplete: 100 },
  results: [{ creators: [...] }]  // Should have bio_enriched
}
```

### Check 2: Creator Has bio_enriched

```javascript
// In browser console after loading a run:
const creators = /* from API response */;
creators[0].bio_enriched  // Should have fetched_at
creators[0].creator.emails  // Should have emails array
```

### Check 3: Hydration Working

```javascript
// Look for console log:
// "[GEMZ-BIO] Fallback: fetching bios for old run"
// OR hydration should populate bioData
```

### Check 4: Polling Stopping

```javascript
// Look for console logs:
// "[useJobPolling] Terminal state reached"
// "[useJobStatus] Polling stopped"
```

---

## File Reference Index

| Category | File | Key Lines |
|----------|------|-----------|
| **Progress UI** | `search-progress.jsx` | 45 (displayProgress), 289 (bar), 259 (spinner) |
| **Progress Helpers** | `search-progress-helpers.ts` | 100 (clamp), 106 (computeStage) |
| **Polling Hook** | `useJobPolling.ts` | 103 (merge), 134 (progress), 211 (onComplete) |
| **Status Hook** | `useJobStatus.ts` | 74 (fetch), 135 (interval), 147 (cap) |
| **Realtime Hook** | `useJobRealtime.ts` | 99 (subscribe), 135 (reconnect) |
| **Bio Hook** | `useBioEnrichment.ts` | 91 (hydrate), 141 (fallback) |
| **Bio Cell** | `BioLinksCell.tsx` | 68 ("No bio") |
| **Table Row** | `CreatorTableRow.tsx` | 151 (bioEmail), 280 (props), 375 ("No email") |
| **Email Utils** | `email-handlers.ts` | 16 (getBioEmail), 57 (getBioData), 112 (hasAnyEmail) |
| **Status API** | `status/route.ts` | 189 (map status), 220 (progress calc) |
| **Enrich Worker** | `enrich-worker.ts` | 165 (adapter.enrich), 214 (DB update) |
| **Instagram Adapter** | `instagram-enrichment.ts` | 114 (bio_enriched), 135 (return) |
| **Types** | `types.ts` | 18 (CreatorInfo), 88 (NormalizedCreator) |
| **Statuses** | `statuses.ts` | 49 (UI_JOB_STATUS), 165 (isActiveStatus) |

---

## Next Steps

1. **Add debug logging** to trace exact data flow
2. **Check a specific creator** in DB to verify bio_enriched exists
3. **Verify V2 workers ran** for the job in question
4. **Test fresh search** to see if NEW runs work correctly

---

*Last updated: Jan 1, 2026*
