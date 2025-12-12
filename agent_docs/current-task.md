# Current Task — What You're Working On NOW

> This file is your active memory. Update it before every commit.
> When you start a new session, read this first to know where you left off.

---

**Task:** Tech Debt Cleanup — Monolith Breakup
**Branch:** `UAT`
**Status:** 🟡 IN PROGRESS
**Started:** Dec 12, 2025
**Updated:** Dec 12, 2025 — 12:30 PM

---

## Quick Context

We audited and fact-checked the codebase. The keyword-search refactor is DONE (2893 → 480 lines). Now we're applying the same pattern to remaining monoliths.

**Priority order:**
1. `similar-search/search-results.jsx` (742 lines) ⭐ START HERE
2. `client-page.tsx` (1574 lines)
3. `list-detail-client.tsx` (1123 lines)
4. Legacy provider cleanup

---

## Completed This Session (Dec 12, 2025)

### Major Accomplishments
1. **Keyword-search refactor** - 2893 → 480 lines
   - Extracted 12 components, 6 hooks, 7 utils
   - Commit: `76a3cacb6`

2. **Pagination scroll UX** - Fixed across all 4 search-results components
   - Page navigation scrolls to results top (not page top)
   - Page size change scrolls to results top

3. **Auto-fetch pages** - Replaced "Load more" button
   - New hook: `useAutoFetchAllPages`
   - Automatically fetches remaining pages in background

4. **Codebase audit** - Fact-checked external analysis
   - `any` usage: 260 total, mostly in loggers (acceptable)
   - console.log: 86 raw vs 995 structured (92% adoption)
   - Legacy vs V2: All 3 platforms have both (need cleanup)

---

## Next Phase: similar-search Refactor ⭐

**Why:** It's 742 lines doing the same thing keyword-search did. Same pattern applies.

**Reference structure (keyword-search after refactor):**
```
keyword-search/
├── search-results.jsx (480 lines - orchestrator)
├── components/
│   ├── CreatorTableRow.tsx
│   ├── CreatorGalleryCard.tsx
│   ├── PaginationControls.tsx
│   └── ... (12 files)
├── hooks/
│   ├── useCreatorSearch.ts
│   ├── useAutoFetchAllPages.ts
│   └── ... (6 files)
└── utils/
    ├── creator-utils.ts
    ├── enrichment-applier.ts
    └── ... (7 files)
```

**Target structure for similar-search:**
```
similar-search/
├── search-results.jsx (~300 lines)
├── components/
│   ├── SimilarResultsTable.tsx (may reuse keyword-search components)
│   ├── SimilarResultsGallery.tsx
│   └── ...
├── hooks/
│   ├── useSimilarSearch.ts
│   └── ...
└── utils/
    └── ... (many can be shared with keyword-search)
```

---

## Extraction Plan for similar-search

### Step 1: Identify what's already extracted
- `SimilarResultsTable` - exists in `results-table.tsx`
- `SimilarResultsGallery` - exists in `results-gallery.tsx`
- `useViewPreferences` - exists
- `deriveInitialStateFromSearchData` - exists in `utils/initial-state.ts`

### Step 2: What needs extraction
Looking at the 742-line file:
- [ ] `normalizePlatform`, `extractEmails`, `hasContactEmail`, `formatFollowers` → utils
- [ ] `resolveInitials`, `resolvePreviewImage` → utils
- [ ] `ensureProxiedImage`, `renderProfileLink` → utils (may share with keyword-search)
- [ ] Pagination logic (`getPageNumbers`, `handlePageChange`) → could use shared PaginationControls
- [ ] Row mapping (`pageRows` useMemo) → utils

### Step 3: What can be reused from keyword-search
- `PaginationControls` component
- `creator-utils.ts` (extractEmails, formatFollowers)
- `profile-link.ts` (buildProfileLink)

---

## Fact-Checked Audit Summary

| Claim | Verdict | Data |
|-------|---------|------|
| Large monolithic files | ✅ TRUE | 3 files over 1000 lines |
| Widespread `any` | ❌ EXAGGERATED | Mostly in loggers, not business logic |
| console.log chaos | ⚠️ PARTIAL | 92% using structured logging |
| Legacy/V2 overlap | ✅ TRUE | All 3 platforms have both |
| keyword-search monster | ✅ WAS TRUE | Already refactored to 480 lines |

---

## Reference Files

| For | Read |
|-----|------|
| Current target | `app/components/campaigns/similar-search/search-results.jsx` |
| Reference pattern | `app/components/campaigns/keyword-search/` |
| Shared utils | `app/components/campaigns/keyword-search/utils/` |
| Campaign page (next) | `app/campaigns/[id]/client-page.tsx` |

---

## Previous Task: Keyword-Search Refactor (COMPLETE ✅)

Successfully reduced from 2893 to 480 lines by extracting:
- 12 components
- 6 hooks
- 7 utility files

Commit: `76a3cacb6`
