# Gemz Linear Issues - Master Implementation Plan

> Generated: 2026-01-23
> Source: Linear project scan via MCP

## Overview

16 pending tasks from the Gemz Linear project, organized by priority and category.

---

## Quick Wins (1-2 hours each)

### USE2-42: Google Analytics Zero Data (HIGH)
**Problem:** GA4 showing zero data due to env var naming
**Fix:** Rename `GA4_MEASUREMENT_ID` → `NEXT_PUBLIC_GA4_MEASUREMENT_ID`

**Files:**
- `.env.local` - Add `NEXT_PUBLIC_` prefix
- Vercel dashboard - Update production env var

**Verification:** Check GA4 Real-time reports within 30 seconds

---

### USE2-48: Email Sender Address (HIGH)
**Problem:** Default fallback is `hello@gemz.io` (wrong domain)
**Fix:** Change to `support@usegems.io`

**Files:**
- `/lib/email/email-service.ts` (line 39) - Update default
- `.env.local` - Set `EMAIL_FROM_ADDRESS=support@usegems.io`

**Verification:** Send test email, verify "From" address

---

### USE2-45: Logo White Background (LOW)
**Problem:** Logo has white background instead of transparent
**Fix:** Use remove.bg or similar to make PNG transparent

**Files:**
- `/public/images/untitled-20design.png` - Replace with transparent version

---

## Dashboard & UI (4-6 hours)

### USE2-43: Dashboard Empty State (HIGH)
**Problem:** Dummy data in charts for new users

**Current Dummy Data:**
- `AnimatedBarChart`: Hardcoded TikTok/Instagram/YouTube stats
- `AnimatedSparkline`: Hardcoded 14-day activity

**Solution:** Show empty state with CTA for new users

**Files:**
- `/app/components/dashboard/animated-bar-chart.tsx` - Default to `[]`, add empty state
- `/app/components/dashboard/animated-sparkline.tsx` - Default to `[]`, add empty state
- `/app/dashboard/_components/dashboard-page-client.tsx` - Add welcome CTA card

**Changes:**
```tsx
// AnimatedBarChart - change default
items = []  // was: [{ label: 'TikTok', value: 62 }, ...]

// Add empty state
if (items.length === 0) {
  return <div>No platform data yet</div>;
}
```

---

### USE2-44: Campaign Interface Restructuring (MEDIUM)
**Problem:** Too cluttered with runs sidebar and duplicate buttons

**Changes:**
1. Remove left sidebar (RunRail)
2. Add "Runs" tab (rename from Activity)
3. Remove campaign-level export
4. Single "New Search" button

**Files:**
- `/app/campaigns/[id]/client-page.tsx` - Remove 2-column layout, add Runs tab
- `/app/campaigns/[id]/components/RunsView.tsx` - NEW: Grid layout for runs

---

## Trial & Billing (1-2 weeks)

### USE2-34: Blurred Results Trial UX (HIGH - In Progress)
**Problem:** Only shows 5 blurred rows - doesn't demonstrate value

**Current:** 25 clear + 5 blurred (TRIAL_CLEAR_LIMIT=25, BLURRED_ROWS_TO_SHOW=5)
**Target:** 25 clear + display "500-1000 more available" (fake count)

**Solution:** Keep rendering 5 blurred rows for performance, but display fake high count in overlay

**Files:**
- `/app/components/campaigns/keyword-search/components/TrialUpgradeOverlay.tsx` - Add `displayCount` prop
- `/app/components/campaigns/keyword-search/components/CreatorTableView.tsx` - Generate fake count (500-1000)
- `/app/components/campaigns/keyword-search/components/CreatorGalleryView.tsx` - Same logic

---

### USE2-35: Cache Searches for Trial Users (HIGH)
**Problem:** Running expensive API calls for trial users who may not convert

**Solution:** Pre-cache popular searches, serve to trial users with "last updated" disclaimer

**New Files:**
- `/lib/billing/trial-search-cache.ts` - Cache service
- Migration for `trial_search_cache` table

**Schema:**
```sql
trial_search_cache (
  id, keywords, keyword_hash, platform, region,
  cached_results JSONB, result_count,
  last_refreshed, created_at
)
```

**Integration:** Modify `/lib/search-engine/v2/workers/dispatch.ts` to check cache for trial users

---

### USE2-36: Trial Fallback - A/B Test (MEDIUM - In Progress)
**Problem:** Complex solution takes time, need quick validation

**Solution:** Feature flag to disable blur entirely for A/B test
- Variant A (control): 3 searches, 25 clear + blur
- Variant B (test): 3 searches, full results (no blur)

**Files:**
- `/app/components/campaigns/keyword-search/search-results.jsx` - Add feature flag
- `.env.local` - `NEXT_PUBLIC_TRIAL_BLUR=true|false`

---

### USE2-37: Updated Pricing Framework (HIGH) ⚠️ BLOCKED
**Problem:** Need new pricing tiers with enrichment credits

**New Tiers:**
| Plan | Price | Searches | Results/Search | Enrich Credits |
|------|-------|----------|----------------|----------------|
| Growth | $249/mo | 20 | 500 | 100 |
| Scale | $799/mo | 50 | 2,000 | 1,500 |
| Enterprise | $3,500/mo | Unlimited | 10,000 | 20,000 |

**Blocked by:** USE2-39 (pricing discrepancy resolution)

**Files when unblocked:**
- `/lib/billing/plan-config.ts` - New plan definitions
- `/lib/db/schema.ts` - Add search/enrichment limits to schema
- `/lib/billing/access-validation.ts` - New validation functions
- `/lib/billing/usage-tracking.ts` - NEW: Track search/enrichment usage
- Stripe dashboard - Create new products/prices

---

### USE2-39: Reconcile Pricing Discrepancy (HIGH) ⚠️ NEEDS DECISION
**Problem:** Meeting says $199/6k, USE2-37 says $249/Growth

**Options:**
1. $199/mo is correct (more competitive)
2. $249/mo is correct (better margins)
3. Two sub-tiers: Starter $199, Growth $249

**Action:** Get stakeholder decision before implementing USE2-37

---

### USE2-41: Grandfather Existing Users (MEDIUM)
**Problem:** Keep existing users on old pricing when new pricing launches

**Recommended Approach:** Don't migrate Stripe subscriptions
- Old users keep old price IDs in Stripe
- New users get new price IDs
- No database changes needed

**Files:**
- `/lib/billing/plan-config.ts` - Support both LEGACY_PLANS and CURRENT_PLANS
- `/lib/billing/webhook-handlers.ts` - Map both old and new price IDs

---

## Integrations (4-6 hours)

### USE2-47: Add Intercom Chat Widget (MEDIUM)
**Problem:** No customer support chat

**Solution:** Add Intercom script to layout

**Files:**
- `.env.local` - Add `NEXT_PUBLIC_INTERCOM_APP_ID`
- `/app/layout.tsx` - Add Intercom script (after line 218)
- `/app/components/intercom/intercom-user.tsx` - NEW: User identification

---

### USE2-46: Homepage Discount Banner (MEDIUM)
**Problem:** Need 50% off for first 50 users

**Solution:** Stripe promotion code with max redemptions

**Steps:**
1. Create Stripe coupon "FOUNDERS50" (50% off, max 50 redemptions)
2. Auto-apply to Viral Surge checkouts
3. Hide banner when 50 redemptions reached

**Files:**
- `/lib/billing/promotion-codes.ts` - NEW: Check availability
- `/lib/billing/checkout-service.ts` - Auto-apply promo code
- `/app/(marketing)/marketing-landing.tsx` - Conditionally show banner

---

## Search Features (2-3 weeks)

### USE2-18: Brand/Competitor Search Mode (MEDIUM)
**Problem:** Generic keyword search doesn't optimize for brand mentions

**Solution:** Dedicated brand search with optimized keyword expansion

**Files:**
- `/app/campaigns/search/brand/page.jsx` - NEW: Brand search form
- `/lib/search-engine/v2/workers/dispatch.ts` - Add `searchMode` field
- `/lib/db/schema.ts` - Add `search_mode` to scrapingJobs

**Brand-specific keywords:** `@brand`, `#brand`, "brand review", "brand unboxing", "brand haul"

---

### USE2-19: Search v1 Radio Buttons (MEDIUM)
**Problem:** Need explicit mode selection before search

**Solution:** Radio button UI to select Keyword / Brand / Similar before configuring

**Files:**
- `/app/campaigns/search/page.tsx` - Refactor to radio button selector
- No backend changes

---

### USE2-20: Search v2 AI Smart Search (MEDIUM)
**Problem:** Single smart search box that understands intent

**Solution:** Chat-like interface with AI intent detection

**New Files:**
- `/app/campaigns/search/smart/page.tsx` - Smart search UI
- `/lib/ai/search-intent-analyzer.ts` - Intent detection
- `/lib/ai/search-conversation-manager.ts` - Conversation flow
- `/app/api/search/smart/route.ts` - API endpoint

---

## Social Sharing (1 week)

### USE2-24-27: Social Sharing for Free Month
**Problem:** Need viral growth mechanism

**Flow:**
1. User sees CTA: "Get a free month by sharing"
2. User shares on social media
3. User uploads screenshot/link as evidence
4. Admin reviews and approves
5. Free month applied as Stripe credit

**New Files:**
- `/lib/db/schema.ts` - Add `social_sharing_submissions`, `social_sharing_rewards` tables
- `/app/components/billing/social-sharing-cta.tsx` - CTA component
- `/app/components/billing/social-sharing-modal.tsx` - Upload modal
- `/app/api/social-sharing/submit/route.ts` - Submission API
- `/lib/billing/social-sharing-rewards.ts` - Reward granting
- `/app/admin/social-sharing/page.tsx` - Admin approval UI

---

## Security (Immediate)

### USE2-49: Account Security Audit (URGENT)
**Problem:** Remove Gabe from all accounts

**Tasks:**
1. Audit all third-party integrations
2. Transfer ownership where necessary
3. Invalidate previous API keys
4. Add Brooke's phone for 2FA on critical accounts

**Note:** This is a manual/operational task, not code changes

---

## Priority Order

1. **USE2-49** - Security audit (URGENT, manual)
2. **USE2-42** - GA fix (30 min)
3. **USE2-48** - Email sender (30 min)
4. **USE2-43** - Dashboard empty state (2 hrs)
5. **USE2-39** - Get pricing decision (BLOCKING)
6. **USE2-36** - A/B test setup (1 day)
7. **USE2-34** - Blurred results UI (2 days)
8. **USE2-47** - Intercom (2 hrs)
9. **USE2-35** - Search caching (1 week)
10. **USE2-37** - New pricing (after USE2-39)
11. **USE2-41** - Grandfathering (after USE2-37)
12. **USE2-18/19** - Search modes (3-4 days)
13. **USE2-44** - Campaign restructure (1 day)
14. **USE2-46** - Discount banner (4 hrs)
15. **USE2-20** - AI smart search (1 week)
16. **USE2-24-27** - Social sharing (1 week)
17. **USE2-45** - Logo fix (15 min)

---

## Verification Checklist

After implementation:
- [ ] **GA4:** Real-time reports show data
- [ ] **Email:** Test emails arrive from correct address
- [ ] **Dashboard:** New users see empty state + CTA
- [ ] **Trial blur:** Shows high count (500-1000)
- [ ] **Intercom:** Chat widget appears for logged-in users
- [ ] **Pricing:** New/existing users on correct plans
