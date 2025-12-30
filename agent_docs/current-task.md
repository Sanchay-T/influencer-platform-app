# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** Fix Search Progress UX — Keyword Search Reliability
**Branch:** `fix/search-progress-ux`
**Status:** Investigation Phase
**Started:** Dec 30, 2025
**Updated:** Dec 30, 2025

---

## Problem Statement

The keyword search progress UI for Instagram and TikTok is unreliable in production. While the backend correctly finds and stores 1000 creators, the frontend fails to display them properly, requiring a full browser refresh to see correct results.

**Critical Insight:** Works perfectly in local development, breaks only in production (usegems.io) and UAT (sorz.ai).

---

## Symptoms Observed

### Primary Issues
| # | Symptom | Details |
|---|---------|---------|
| 1 | Progress freezes at random % | No consistent freeze point, varies each time |
| 2 | Spinner keeps spinning forever | Loading indicators never stop |
| 3 | Partial results displayed | Shows 200-800 creators instead of 1000 |
| 4 | Only full browser refresh fixes | Navigation within app doesn't help |
| 5 | Job status stuck on "Processing" | Even after refresh with 1000 creators visible |

### Secondary Issues
| # | Symptom | Details |
|---|---------|---------|
| 6 | Bio fetch spinners stuck | Row-level, global, and header spinners all affected |
| 7 | Spinner coordination failure | "Finding more creators..." disappears but other spinners remain |

### Observed Patterns
- **Timing:** Breaks at 1-2 minutes into search
- **Platforms:** Both TikTok and Instagram equally affected
- **Environment:** Production only (local dev works perfectly)
- **UI State:** Fully interactive (not a JS crash)
- **New Searches:** Also break in same pattern
- **Creator Request:** Testing with 1000 creators

---

## Environment Comparison

| Environment | Domain | Behavior |
|-------------|--------|----------|
| Local Development | localhost:3001 | Works perfectly - all 1000 creators display |
| Production | usegems.io | Breaks - partial results, stuck spinners |
| UAT | sorz.ai | Breaks - same issues as production |

**Same code, same configuration across all environments.**

---

## User Preferences for Fix

| Aspect | Preference |
|--------|------------|
| Debug Logging | Yes, add console logs |
| Trade-off Priority | Reliability > Real-time updates |
| Polling Interval | Slower (3-5s) acceptable if more reliable |
| Manual Fallback | No - focus on auto-updates only |

---

## Root Cause Hypotheses

### High Probability (Production-Specific)
1. **Vercel serverless timing** - Polling may hit function timeout limits
2. **Network latency creates race conditions** - Longer round-trips in production
3. **QStash webhook latency** - Workers complete but status updates delayed
4. **Redis cache serving stale data** - Production uses Redis, local uses in-memory

### Medium Probability (State Management)
5. **Polling terminates prematurely** - `SearchProgress` stops before job truly completes
6. **Terminal state detection broken** - Backend returns "completed" but frontend doesn't recognize it
7. **Spinner state not cleaned up** - Multiple independent spinners don't coordinate

### Lower Probability
8. **Clerk auth token issues** - Long-running polls may hit token expiration
9. **React Query cache issues** - Stale cache not invalidating

---

## Technical Investigation Areas

### 1. Polling Logic (`search-progress.jsx:133-394`)
- [ ] Check terminal state detection (completed/error/timeout)
- [ ] Verify polling interval logic (1.5s -> 2s -> 3s)
- [ ] Check retry limits (`generalRetryRef`, `authRetryRef`)
- [ ] Add debug logging to identify where polling stops

### 2. State Management (`useCreatorSearch.ts:384-498`)
- [ ] Verify `stillProcessing` is set to false on completion
- [ ] Check `handleSearchComplete` callback execution
- [ ] Verify creator merge logic doesn't overwrite with empty data
- [ ] Check if `setCreators` is properly batching updates

### 3. Status Mapping (`api/v2/status/route.ts:163-185`)
- [ ] Verify `UI_JOB_STATUS` values match frontend expectations
- [ ] Check `progressPercent` calculation
- [ ] Verify Redis cache behavior for completed jobs

### 4. Bio Enrichment (`useBioEnrichment.ts`)
- [ ] Check `isLoading` state resolution
- [ ] Verify completion detection for bio fetch

### 5. Component Coordination
- [ ] `SearchLoadingStates.tsx` - spinner cleanup
- [ ] `ResultsContainer.tsx` - progress bar state
- [ ] `SearchResultsHeader.tsx` - inline progress indicator

---

## Files to Investigate/Modify

| File | Lines | Purpose |
|------|-------|---------|
| `search-progress.jsx` | 552 | Fix polling termination, add debug logs |
| `hooks/useCreatorSearch.ts` | 559 | Fix state transitions and completion handling |
| `components/SearchLoadingStates.tsx` | 131 | Ensure proper spinner cleanup |
| `components/ResultsContainer.tsx` | 63 | Coordinate progress indicators |
| `hooks/useBioEnrichment.ts` | - | Fix bio loading state |
| `api/v2/status/route.ts` | 271 | Verify status response format |

---

## Implementation Plan

### Phase 1: Add Debug Logging
- [ ] Add verbose console logs to polling loop
- [ ] Log state transitions (stillProcessing, isFetching, isLoading)
- [ ] Log terminal state detection points
- [ ] Log creator merge operations
- [ ] Log API response status values

### Phase 2: Identify Root Cause
- [ ] Deploy with logging to production
- [ ] Run 1000 creator search
- [ ] Capture console logs during failure
- [ ] Identify exact point where polling/state breaks

### Phase 3: Fix Polling Termination
- [ ] Ensure all terminal states detected (completed, error, timeout, partial)
- [ ] Verify status string comparison is case-insensitive
- [ ] Handle V2 status values (UI_JOB_STATUS enum)
- [ ] Add timeout safety net for stuck polls

### Phase 4: Fix State Management
- [ ] Ensure `stillProcessing` is set to false on any terminal state
- [ ] Clean up all spinner states on terminal state
- [ ] Verify creator merge preserves existing data
- [ ] Add final "completion fetch" to guarantee all data loaded

### Phase 5: Improve Reliability
- [ ] Increase polling interval (3-5s) for production
- [ ] Add exponential backoff on network errors
- [ ] Add redundant completion check after polling stops

### Phase 6: Test & Verify
- [ ] Test in UAT (sorz.ai)
- [ ] Test in production (usegems.io)
- [ ] Verify all 1000 creators display
- [ ] Verify all spinners stop on completion
- [ ] Verify no regression in local dev

---

## Acceptance Criteria

- [ ] Search completes and shows all 1000 requested creators without manual refresh
- [ ] All spinners (progress, bio, enrichment) stop when job completes
- [ ] Job status correctly shows "Completed" when done
- [ ] Works reliably in production (usegems.io and sorz.ai)
- [ ] No regression in local development
- [ ] Creator count increments smoothly during search

---

## Testing Instructions

### Enable Debug Logging
```javascript
localStorage.setItem('gemz_debug_polling', 'true')
```

### Console Logs to Monitor
- `[GEMZ-POLL]` - Polling status and progress
- `[GEMZ-CREATORS]` - Creator merge operations
- `[CREATOR-SEARCH]` - State transitions

### Test Procedure
1. Enable debug logging in browser console
2. Start 1000 creator TikTok keyword search
3. Watch console for state transitions
4. Note when/where polling stops
5. Check if "completed" status is ever received
6. Check final creator count vs expected

---

## Reference: Current Code Flow

```
User clicks "Submit Campaign"
    ↓
/api/v2/dispatch → creates job, queues QStash worker
    ↓
Redirect to search-results.jsx with jobId
    ↓
SearchProgress component starts polling /api/v2/status
    ↓
onIntermediateResults → merges creators into state
onProgress → updates progress display
    ↓
On terminal state (completed/error/timeout):
    onComplete → sets stillProcessing=false, final fetch
    ↓
SearchLoadingStates hides, results display
```

**Current Issue:** Something in this flow breaks in production, likely at the polling/state transition step.

---

## Previous Task (Paused)

**Task:** Tech Debt Cleanup — Monolith Breakup
**Branch:** `UAT`
**Status:** Paused for this hotfix

The similar-search refactor and other monolith cleanup is on hold while we fix this critical UX issue.
