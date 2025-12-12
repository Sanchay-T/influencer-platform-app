# Performance Optimization Plan: Scalable Creator Display

> **Status:** Planning Complete, Ready for Implementation
> **Created:** Dec 12, 2025
> **Priority:** High - User-facing performance issues

---

## Executive Summary

This plan addresses performance bottlenecks when displaying thousands of creators to multiple concurrent users. The current architecture struggles with large datasets (1000+ creators) due to full DOM rendering, lack of caching, and inefficient data fetching.

---

## Current State Problems

| Problem | Impact | Severity |
|---------|--------|----------|
| Full DOM rendering of all rows | Slow scrolling, high memory | Critical |
| No client-side caching | Refetch on every navigation | High |
| Max 100 creators per API call | 10 round-trips for 1000 creators | High |
| Polling instead of push | Unnecessary network requests | Medium |
| JSONB blob storage | Can't filter/sort at DB level | Medium |

---

## Implementation Phases

### Phase 1: Virtual Scrolling (Day 1) ⭐ HIGHEST IMPACT

**Goal:** Only render visible rows (~15) instead of all rows (1000+)

**Package:** `@tanstack/react-virtual`

**Files to modify:**
- `app/components/campaigns/keyword-search/search-results.jsx` - Main creator table
- `app/campaigns/[id]/client-page.tsx` - May need height constraints

**Implementation approach:**
```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: creators.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72, // Row height in pixels
  overscan: 5, // Buffer rows above/below viewport
});

// Only render virtual items
{rowVirtualizer.getVirtualItems().map((virtualRow) => (
  <TableRow
    key={virtualRow.key}
    style={{
      height: `${virtualRow.size}px`,
      transform: `translateY(${virtualRow.start}px)`,
    }}
  >
    {renderCreatorRow(creators[virtualRow.index])}
  </TableRow>
))}
```

**Expected improvement:**
- DOM nodes: 15,000+ → ~300
- Initial render: 2-3s → <100ms
- Scroll performance: Janky → 60fps

---

### Phase 2: React Query for Caching (Day 2)

**Goal:** Cache creator data, eliminate redundant fetches

**Package:** `@tanstack/react-query`

**Files to modify:**
- `app/providers.tsx` or create new - Add QueryClientProvider
- `app/campaigns/[id]/client-page.tsx` - Replace useState with useQuery
- `app/components/campaigns/keyword-search/search-results.jsx` - Use cached data

**Implementation approach:**
```jsx
// providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    },
  },
});

// In component
const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['creators', jobId],
  queryFn: ({ pageParam = 0 }) => fetchCreators(jobId, pageParam),
  getNextPageParam: (lastPage) => lastPage.pagination.nextOffset,
});
```

**Expected improvement:**
- Navigation back to campaign: 2s fetch → instant from cache
- Multiple components same data: N requests → 1 request
- Background refresh keeps data fresh

---

### Phase 3: Infinite Scroll with Prefetch (Day 2-3)

**Goal:** Auto-load more creators as user scrolls, no "Load more" button

**Files to modify:**
- `app/components/campaigns/keyword-search/search-results.jsx`

**Implementation approach:**
```jsx
// Combine with virtual scrolling
const { fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(...);

// Trigger fetch when scrolling near bottom
useEffect(() => {
  const lastItem = rowVirtualizer.getVirtualItems().at(-1);
  if (!lastItem) return;

  // If we're within 5 items of the end, fetch more
  if (lastItem.index >= creators.length - 5 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [rowVirtualizer.getVirtualItems()]);
```

---

### Phase 4: Server-Sent Events for Progress (Day 3-4)

**Goal:** Replace polling with push-based updates

**Files to create:**
- `app/api/v2/stream/route.ts` - SSE endpoint

**Implementation approach:**
```typescript
// SSE endpoint
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send progress updates
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Poll DB and push changes
      while (true) {
        const job = await getJobStatus(jobId);
        sendEvent('progress', { percent: job.progress, found: job.creatorsFound });
        if (job.status === 'completed') break;
        await sleep(2000);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

---

### Phase 5: Database Normalization (Future)

**Goal:** Enable DB-level filtering, sorting, full-text search

**Schema change:**
```sql
CREATE TABLE campaign_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scraping_jobs(id),
  platform VARCHAR(20) NOT NULL,
  username VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  followers INTEGER,
  email VARCHAR(255),
  bio TEXT,
  avatar_url TEXT,
  profile_url TEXT,
  raw_data JSONB, -- Full creator object for backward compat
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for common queries
  INDEX idx_job_followers (job_id, followers DESC),
  INDEX idx_job_email (job_id, email) WHERE email IS NOT NULL,
  UNIQUE (job_id, platform, username)
);
```

**Benefits:**
- `WHERE email IS NOT NULL` at DB level
- `ORDER BY followers DESC` at DB level
- Full-text search on bio
- Proper pagination with cursors

---

## Quick Wins Already Applied (Dec 12, 2025)

| Fix | Change |
|-----|--------|
| Hydration error | Sidebar email uses `mounted` state |
| API limit | Increased from 100 to 500 max, default 50→200 |
| V2 endpoint routing | Campaign page now uses `/api/v2/status` |
| Double-submit prevention | Form awaits onSubmit, guards with isLoading |
| Pagination display | Shows server total, not just loaded count |

---

## Files Reference

| File | Purpose |
|------|---------|
| `app/components/campaigns/keyword-search/search-results.jsx` | Main creator table (2800+ lines) |
| `app/campaigns/[id]/client-page.tsx` | Campaign detail, data fetching |
| `app/api/v2/status/route.ts` | V2 status endpoint |
| `app/components/layout/sidebar.jsx` | Sidebar with user info |

---

## Testing Checklist

- [ ] Virtual scroll renders only visible rows
- [ ] Scroll through 1000 creators at 60fps
- [ ] Navigate away and back - data cached
- [ ] Infinite scroll loads more automatically
- [ ] Progress updates without polling (SSE)
- [ ] Email filter works with virtual scroll
- [ ] Export CSV works with all creators

---

## Dependencies to Install

```bash
npm install @tanstack/react-virtual @tanstack/react-query
```

---

## Starter Prompt for Next Session

See bottom of this file for the prompt to use.
