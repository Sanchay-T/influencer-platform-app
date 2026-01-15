# USE2-37: Implement Updated Pricing Framework

## Overview

Major pricing overhaul introducing new tiers with search limits, keyword limits, results caps, and an enrichment credits system.

## Key Decisions (Confirmed)

- **Config source:** Database (`subscription_plans` table) - not code
- **Enterprise overages:** Stripe metered billing
- **Auto-enrich triggers:** Both single creator save AND bulk save from search
- **Yearly discount:** 20% off (Growth: $2,390/yr, Scale: $7,670/yr, Enterprise: $33,600/yr)
- **Migration timing:** Immediate - existing users switch on next billing cycle

## Current State

**Existing Plans:**
- Glow Up: $99/mo, 3 campaigns, 1,000 creators/month
- Viral Surge: $249/mo, 10 campaigns, 10,000 creators/month
- Fame Flex: $499/mo, unlimited

**Current Limit Infrastructure:**
- Campaign creation limits: ✅ Working
- Monthly creator limits: ✅ Working (tracks `usageCreatorsCurrentMonth`)
- Trial search limits: ✅ Working (3 searches during trial)
- Per-search keyword limit: Hardcoded at 50 for all users
- Per-search result targets: Fixed at [100, 500, 1000] user choice
- Enrichment tracking: Schema exists (`enrichments_current_month`) but never incremented

## New Pricing Tiers (Confirmed)

| Feature | Growth ($249/mo) | Scale ($799/mo) | Enterprise ($3,500/mo) |
|---------|------------------|-----------------|------------------------|
| Monthly Searches | 20 | 50 | Unlimited |
| Keywords/Search | 3 | 7 | Unlimited |
| Results/Search | 500 | 2,000 | 10,000+ |
| Enrich Credits/Mo | 100 | 1,500 | 20,000 |
| Auto-Enrich | ❌ Manual only | On favorite/list | Everywhere |
| Overages | Blocked | Blocked | $0.015/extra |

## Migration Strategy (Confirmed)

Auto-map existing subscribers to new tiers:
- **Glow Up** ($99) → **Growth** ($249)
- **Viral Surge** ($249) → **Scale** ($799)
- **Fame Flex** ($499) → **Enterprise** ($3,500)

Note: This is a significant price increase. Consider:
- Honoring existing price until next renewal
- Grandfathering for X months
- Proactive communication to existing users

## Implementation Plan

### Phase 1: Database Schema Updates

**1.1 Update `subscription_plans` table (new columns):**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `monthly_searches_limit` | INTEGER | NULL | Max searches per month (-1 = unlimited) |
| `keywords_per_search_limit` | INTEGER | 3 | Max keywords per search (-1 = unlimited) |
| `results_per_search_limit` | INTEGER | 500 | Max results per search |
| `enrich_credits_limit` | INTEGER | 100 | Monthly enrichment credits |
| `auto_enrich_on_add_to_list` | BOOLEAN | false | Scale+ feature |
| `auto_enrich_everywhere` | BOOLEAN | false | Enterprise feature |
| `overage_rate_cents` | INTEGER | NULL | Enterprise: 1.5 cents = 150 |

**1.2 Insert new plan rows:**

```sql
INSERT INTO subscription_plans (plan_key, display_name, monthly_price, yearly_price,
  stripe_monthly_price_id, stripe_yearly_price_id, campaigns_limit, creators_limit,
  monthly_searches_limit, keywords_per_search_limit, results_per_search_limit,
  enrich_credits_limit, auto_enrich_on_add_to_list, auto_enrich_everywhere,
  overage_rate_cents, sort_order, is_active) VALUES
('growth', 'Growth', 24900, 239000, 'price_xxx', 'price_xxx', 5, 5000,
  20, 3, 500, 100, false, false, NULL, 1, true),
('scale', 'Scale', 79900, 767000, 'price_xxx', 'price_xxx', 20, 50000,
  50, 7, 2000, 1500, true, false, NULL, 2, true),
('enterprise', 'Enterprise', 350000, 3360000, 'price_xxx', 'price_xxx', -1, -1,
  -1, -1, 10000, 20000, true, true, 150, 3, true);
```
*(Prices in cents: 24900 = $249, 239000 = $2,390, etc.)*

**1.3 Update `user_usage` table:**
```sql
ALTER TABLE user_usage ADD COLUMN searches_current_month INTEGER DEFAULT 0;
-- enrichments_current_month already exists, just needs to be used
```

**1.4 Deprecate old plans:**
```sql
UPDATE subscription_plans SET is_active = false
WHERE plan_key IN ('glow_up', 'viral_surge', 'fame_flex');
```

**Files to modify:**
- `lib/db/schema.ts` - Add new columns to `subscriptionPlans` schema
- Migration file via `mcp__supabase__apply_migration`

### Phase 2: Plan Configuration Updates (Database-Driven)

**2.1 Create plan query functions:**
```typescript
// lib/db/queries/plan-queries.ts (new file)
export async function getPlanByKey(planKey: string): Promise<SubscriptionPlan>
export async function getActivePlans(): Promise<SubscriptionPlan[]>
export async function getPlanLimits(planKey: string): Promise<PlanLimits>
```

**2.2 Update plan-config.ts to read from DB:**
- Keep `PlanLimits` type but extend with new fields
- Add `fetchPlanConfig()` that queries `subscription_plans` table
- Cache results (plans rarely change)
- Fallback to hardcoded defaults if DB query fails

**2.3 Update access-validation.ts:**
- Replace hardcoded plan lookups with DB queries
- Use new limit columns for validation

**Files to modify:**
- `lib/billing/plan-config.ts` - Add DB query integration, extend types
- `lib/db/queries/plan-queries.ts` - New query functions
- `lib/billing/access-validation.ts` - Use DB-driven limits

### Phase 3: Search Limit Enforcement

**3.1 Monthly search counter:**
- Add `incrementSearchCount()` to usage-tracking.ts
- Call after job creation in dispatch.ts
- Add to monthly reset logic

**3.2 Keywords-per-search limit:**
- Update `validateDispatchRequest()` in validation.ts
- Check user's plan limit instead of hardcoded 50
- Return appropriate error message

**3.3 Results-per-search limit:**
- Update `VALID_TARGETS` to be plan-dependent
- Cap target selection based on plan limit
- Update dispatch validation

**Files to modify:**
- `lib/billing/usage-tracking.ts` - Add search counter
- `lib/billing/access-validation.ts` - Add `validateSearchLimits()`
- `lib/search-engine/v2/workers/validation.ts` - Plan-aware limits
- `lib/search-engine/v2/workers/dispatch.ts` - Call new validation
- `app/api/cron/reset-monthly-usage/route.ts` - Reset search count

### Phase 4: Enrichment Credit System

**4.1 Credit tracking:**
- Implement `incrementEnrichmentCount()` in usage-tracking.ts
- Call from enrichment service after successful enrichment
- Include in monthly reset (already in cron job scope)

**4.2 Plan-based enrichment behavior:**
- Growth: Manual enrich only, block when credits exhausted
- Scale: Auto-enrich on favorite/add-to-list, block when exhausted
- Enterprise: Auto-enrich everywhere, track overages via Stripe metered billing

**4.3 Auto-enrich hook locations (confirmed from codebase):**

| Action | File | Hook Location |
|--------|------|---------------|
| Single/Bulk save to list | `app/api/lists/[id]/items/route.ts` | After `addCreatorsToList()` (line ~35) |
| Pin/favorite creator | `lib/db/queries/list-queries.ts` | In `updateListItems()` when `pinned=true` |

**4.4 Auto-enrich flow:**
```
User adds creator to list
  → API: POST /api/lists/{id}/items
  → Check plan: auto_enrich_on_add_to_list?
  → If yes && credits remaining: queue enrichment
  → If no credits: skip (Growth/Scale) or track overage (Enterprise)
```

**Files to modify:**
- `lib/services/creator-enrichment.ts` - Credit checking, auto-enrich decision logic
- `lib/billing/usage-tracking.ts` - Add `incrementEnrichmentCount()`, `getEnrichmentCreditsRemaining()`
- `app/api/lists/[id]/items/route.ts` - Add auto-enrich trigger after save
- `lib/db/queries/list-queries.ts` - Add auto-enrich trigger on pin (if pinned = favorite)

### Phase 5: Stripe Dashboard Setup (Manual Steps)

**5.1 Create Products (Stripe Dashboard > Products)**

| Product Name | Type | Prices to Create |
|--------------|------|------------------|
| Gemz Growth | Recurring | $249/mo, $2,390/yr (20% off) |
| Gemz Scale | Recurring | $799/mo, $7,670/yr (20% off) |
| Gemz Enterprise | Recurring | $3,500/mo, $33,600/yr (20% off) |
| Enrichment Overage | Metered | $0.015 per unit |

**5.2 For Each Subscription Product:**
1. Go to Products > + Add product
2. Name: "Gemz Growth" (or Scale/Enterprise)
3. Pricing model: Standard pricing
4. Price 1: $249, Recurring, Monthly
5. Price 2: $1,990, Recurring, Yearly
6. Add metadata: `plan_key: growth` (or `scale`/`enterprise`)
7. Save and copy the Price IDs (starts with `price_`)

**5.3 For Enrichment Overage (Metered):**
1. Go to Products > + Add product
2. Name: "Enrichment Overage"
3. Pricing model: **Metered billing**
4. Price: $0.015 per unit
5. Billing scheme: Per unit
6. Usage aggregation: Sum of usage values
7. Save and copy the Price ID

**5.4 Environment Variables to Add:**
```
# New plan price IDs
STRIPE_GROWTH_MONTHLY_PRICE_ID=price_xxx
STRIPE_GROWTH_YEARLY_PRICE_ID=price_xxx
STRIPE_SCALE_MONTHLY_PRICE_ID=price_xxx
STRIPE_SCALE_YEARLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_xxx

# Metered overage
STRIPE_ENRICHMENT_OVERAGE_PRICE_ID=price_xxx
```

**5.5 Code Updates:**

**Files to modify:**
- `lib/billing/stripe-client.ts` - Add price ID mappings for new plans
- `lib/billing/checkout-service.ts` - Create checkout with new price IDs
- `lib/billing/webhook-handlers.ts` - Map incoming price IDs to plan keys
- `lib/billing/usage-tracking.ts` - Report metered usage to Stripe for Enterprise

**Stripe API for Metered Billing (in code):**
```typescript
// When Enterprise user exceeds 20k enrichments, report overage
await stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId, // from subscription metadata
  { quantity: overageCount, action: 'increment' }
);
```

### Phase 6: UI/UX Updates

**6.1 Pricing page:**
- Update with new tiers and features
- Show search limits, keyword limits, enrichment credits

**6.2 Account settings:**
- Display credit usage (searches, enrichments)
- Show remaining credits
- Progress bars for usage

**6.3 Upgrade prompts:**
- Show when approaching limits
- Context-aware messaging (search limit vs enrich limit)

**Files to modify:**
- `app/components/` pricing components
- `app/components/` account/billing components
- `app/api/` usage status endpoints

## Verification Plan

**1. Database verification:**
```sql
-- Check new plans exist with correct limits
SELECT plan_key, monthly_searches_limit, keywords_per_search_limit,
       results_per_search_limit, enrich_credits_limit
FROM subscription_plans WHERE is_active = true;
```

**2. Search limit tests:**
- Create test user on Growth plan
- Verify 4th keyword rejected (limit is 3)
- Verify 21st search blocked (limit is 20)
- Verify results capped at 500

**3. Enrichment credit tests:**
- Growth user: manual enrich works, auto-enrich disabled
- Scale user: auto-enrich triggers on list add
- Enterprise user: auto-enrich works, overages reported to Stripe

**4. Stripe checkout flow:**
- Test checkout for each new tier
- Verify webhook updates `user_subscriptions.current_plan`
- Verify metered billing records for Enterprise overages

**5. UI verification:**
- Pricing page shows Growth/Scale/Enterprise
- Account settings shows usage stats (searches, enrichments)
- Upgrade prompts appear at 80% usage

## Dependencies

- **Stripe dashboard access** - to create 4 new products before Phase 5 code
- **Environment variables** - new price IDs added after Stripe setup

## Recommended Implementation Order

```
Phase 1-2: Schema + DB queries (foundation)
     ↓
Phase 5 (partial): Create Stripe products manually
     ↓
Phase 3: Search limit enforcement
     ↓
Phase 4: Enrichment credit system
     ↓
Phase 5 (code): Stripe integration code
     ↓
Phase 6: UI updates
```

**Note:** Stripe products should be created BEFORE writing code that references them. This prevents "price_xxx" placeholder issues.

## Stripe Dashboard Checklist (Your Manual Steps)

Before implementation can proceed to Phase 5 code, you need to:

- [ ] Create "Gemz Growth" product with $249/mo and $2,390/yr prices
- [ ] Create "Gemz Scale" product with $799/mo and $7,670/yr prices
- [ ] Create "Gemz Enterprise" product with $3,500/mo and $33,600/yr prices
- [ ] Create "Enrichment Overage" metered product at $0.015/unit
- [ ] Copy all 7 price IDs to `.env.local`
- [ ] Add metadata `plan_key: growth|scale|enterprise` to each subscription product

---

## Detailed Clarifications

### Auto-Enrich Logic (Deep Dive)

**When does auto-enrich trigger?**

| User Action | Growth | Scale | Enterprise |
|-------------|--------|-------|------------|
| Manual "Enrich" button click | ✅ Yes | ✅ Yes | ✅ Yes |
| Add single creator to list | ❌ No | ✅ Auto | ✅ Auto |
| Bulk save from search results | ❌ No | ✅ Auto | ✅ Auto |
| Pin/favorite a creator | ❌ No | ✅ Auto | ✅ Auto |

**Enrichment flow in code:**

```
POST /api/lists/{id}/items (add creator to list)
  │
  ├─► addCreatorsToList() completes successfully
  │
  └─► NEW: triggerAutoEnrich(userId, creatorIds)
        │
        ├─► Get user's plan from DB
        ├─► Check: plan.auto_enrich_on_add_to_list?
        │     └─► If false (Growth): SKIP, return early
        │
        ├─► Check: credits remaining?
        │     ├─► Growth/Scale: If 0, SKIP (hard block)
        │     └─► Enterprise: Continue (will track overage)
        │
        ├─► Queue enrichment jobs (async, via QStash)
        │
        └─► Increment enrichments_current_month
              └─► Enterprise only: If > limit, report to Stripe
```

**What gets enriched?**
- Creator profile from Influencers.Club API
- Returns: email, detailed follower counts, engagement rates, brand collaborations, cross-platform handles

**Credit consumption:**
- 1 enrichment = 1 credit
- Credits deducted AFTER successful enrichment (not on attempt)
- Failed enrichments don't consume credits

---

### Migration Handling (Deep Dive)

**How existing users transition:**

```
Current State                    New State
─────────────────────────────────────────────────────────
Glow Up ($99/mo)     ──────►     Growth ($249/mo)
  • 3 campaigns                    • 5 campaigns
  • 1,000 creators/mo              • 5,000 creators/mo
  • No search limits               • 20 searches/mo
                                   • 100 enrich credits

Viral Surge ($249/mo) ──────►    Scale ($799/mo)
  • 10 campaigns                   • 20 campaigns
  • 10,000 creators/mo             • 50,000 creators/mo
  • No search limits               • 50 searches/mo
                                   • 1,500 enrich credits

Fame Flex ($499/mo)   ──────►    Enterprise ($3,500/mo)
  • Unlimited                      • Unlimited
  • No search limits               • Unlimited searches
                                   • 20,000 enrich credits
```

**Technical migration steps:**

1. **Stripe webhook receives `customer.subscription.updated`:**
   - Old price_id detected
   - Map to new plan_key using lookup table

2. **Update user_subscriptions:**
   ```sql
   UPDATE user_subscriptions
   SET current_plan = 'growth'  -- or 'scale'/'enterprise'
   WHERE current_plan = 'glow_up';
   ```

3. **No code migration needed** because:
   - Limits come from `subscription_plans` table (new rows)
   - User's `current_plan` references new plan_key
   - Usage counters stay the same (don't reset on migration)

4. **Stripe handles price change:**
   - On next billing cycle, Stripe charges new price
   - No proration needed (immediate change = next cycle)

**Edge case: Mid-cycle migration**
- User keeps current limits until cycle ends
- New limits apply when new billing period starts
- We track `subscription_renewal_date` for this

---

### Stripe Metered Billing (Deep Dive)

**How Enterprise overages work:**

```
Enterprise User: 20,000 credits/month included
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Enrichment #20,001 requested                       │
│                                                     │
│  1. Check: enrichments_current_month >= 20,000?     │
│     └─► YES, this is an overage                     │
│                                                     │
│  2. Perform enrichment (don't block Enterprise)     │
│                                                     │
│  3. Report to Stripe:                               │
│     stripe.subscriptionItems.createUsageRecord(     │
│       subscriptionItemId,                           │
│       { quantity: 1, action: 'increment' }          │
│     )                                               │
│                                                     │
│  4. Increment enrichments_current_month             │
└─────────────────────────────────────────────────────┘
```

**Stripe metered billing setup:**

1. **When user subscribes to Enterprise:**
   - Create subscription with 2 items:
     - Main subscription price (flat $3,500/mo)
     - Metered overage price ($0.015/unit)
   - Store `subscription_item_id` for overage line item

2. **Overage reporting (real-time):**
   ```typescript
   // lib/billing/overage-service.ts
   export async function reportEnrichmentOverage(userId: string, count: number) {
     const user = await getUserBilling(userId);

     // Only report if Enterprise AND over limit
     if (user.plan !== 'enterprise') return;
     if (user.enrichmentsThisMonth <= 20000) return;

     await stripe.subscriptionItems.createUsageRecord(
       user.overageSubscriptionItemId,
       {
         quantity: count,
         action: 'increment',
         timestamp: Math.floor(Date.now() / 1000)
       }
     );
   }
   ```

3. **Stripe handles billing:**
   - At end of billing period, Stripe tallies usage
   - Invoice includes: $3,500 base + (overage_count × $0.015)
   - No manual invoicing needed

**Monthly reset behavior:**
- Stripe resets metered usage automatically at billing cycle
- Our `enrichments_current_month` resets via cron job
- Both should align (use billing cycle date, not calendar month)

**What user sees:**
```
Account Settings
────────────────
Enrichment Credits: 20,847 / 20,000 used
                    └─► 847 overage credits @ $0.015 = $12.71

Next invoice estimate: $3,500.00 + $12.71 = $3,512.71
```
