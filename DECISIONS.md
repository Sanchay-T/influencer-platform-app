# DECISIONS.md — Decision Trees for Common Scenarios

This file removes ambiguity by providing clear decision trees for choosing between similar options.

---

## Service Selection

### PlanValidator vs BillingService vs PlanEnforcement

```
┌─────────────────────────────────────────────────────────────────────────┐
│ What do you need to do?                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ CHECK if user     │   │ GET billing data  │   │ TRACK usage       │
│ can do something  │   │ or sync Stripe    │   │ after action      │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
   PlanValidator              BillingService            PlanEnforcement
```

**PlanValidator** — Use for permission checks
```typescript
// Can user create a campaign?
PlanValidator.validateCampaignCreation(userId, requestId)

// Can user search for N creators?
PlanValidator.validateCreatorLimit(userId, count, requestId)

// Does user have a specific feature?
PlanValidator.hasFeature(userId, 'export')

// Get full plan configuration
PlanValidator.getActiveUserPlan(userId)
```

**BillingService** — Use for Stripe data and billing state
```typescript
// Get billing state with caching (30s TTL)
BillingService.getBillingStateWithCache(userId)

// Get fresh billing state (always hits DB)
BillingService.getBillingState(userId)

// Sync after webhook event
BillingService.reconcileWithStripe(userId)

// Create checkout session
BillingService.createCheckoutSession(userId, planId)

// Get customer portal URL
BillingService.getCustomerPortalUrl(userId)
```

**PlanEnforcement** — Use after successful operations
```typescript
// Increment usage counters
PlanEnforcement.incrementUsage(userId, 'creators', count)
PlanEnforcement.incrementUsage(userId, 'campaigns', 1)
PlanEnforcement.incrementUsage(userId, 'enrichments', count)

// Reset monthly usage (called by invoice.payment_succeeded webhook)
PlanEnforcement.resetMonthlyUsage(userId)
```

---

## Cached vs Fresh Data

```
┌─────────────────────────────────────────────────────────────────────────┐
│ What's the context?                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ Displaying UI     │   │ Charging money or │   │ After Stripe      │
│ (dashboard, stats)│   │ limiting action   │   │ webhook           │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
   USE CACHED               USE FRESH                USE RECONCILE

getBillingStateWithCache()  getBillingState()    reconcileWithStripe()
getUserProfile() is OK      PlanValidator.*      Full Stripe sync
```

**Why this matters:**
- Cached: Fast, reduces DB load, acceptable staleness for display
- Fresh: Accurate, prevents over-billing or over-limiting
- Reconcile: Authoritative, handles race conditions

---

## Logging Level Selection

```
┌─────────────────────────────────────────────────────────────────────────┐
│ What type of event are you logging?                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌─────────┬─────────┬─────────┬─────────┬─────────┐
    │         │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼         ▼
┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│Dev debug││Normal   ││Unusual  ││Operation││System   │
│details  ││operation││but OK   ││failed   ││down     │
└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
logger.   logger.   logger.   logger.   logger.
 debug()   info()    warn()    error()   critical()
```

**logger.debug()** — Dev-only, filtered in production
```typescript
logger.debug('Parsing request body', { bodySize: 1024 }, LogCategory.API);
```

**logger.info()** — Normal operations, always visible
```typescript
logger.info('Campaign created', { userId, campaignId }, LogCategory.API);
```

**logger.warn()** — Something unusual but handled
```typescript
logger.warn('Rate limit approaching', { userId, remaining: 5 }, LogCategory.PERFORMANCE);
```

**logger.error()** — Operation failed (sends to Sentry)
```typescript
logger.error('Database query failed', error, { query }, LogCategory.DATABASE);
```

**logger.critical()** — System-level failure
```typescript
logger.critical('Stripe webhook verification failed', error, {}, LogCategory.PAYMENT);
```

---

## Search Provider Selection

```
┌─────────────────────────────────────────────────────────────────────────┐
│ What platform and search type?                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────────┐
            │                       │                           │
            ▼                       ▼                           ▼
      INSTAGRAM                  TIKTOK                     YOUTUBE
            │                       │                           │
    ┌───────┴───────┐               │               ┌───────────┴───────────┐
    │               │               │               │                       │
    ▼               ▼               ▼               ▼                       ▼
 Keyword         Similar         Keyword         Keyword                 Similar
    │               │               │               │                       │
    ▼               ▼               ▼               ▼                       ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐           ┌─────────┐
│instagram│   │instagram│   │ tiktok  │   │ youtube │           │ youtube │
│us_reels │   │_similar │   │_keyword │   │_keyword │           │_similar │
│ (v2) ✓  │   │         │   │         │   │         │           │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘           └─────────┘
```

**Instagram Keyword (use v2 pipeline):**
```typescript
// Explicitly request v2 pipeline
const jobParams = {
  platform: 'instagram',
  keywords: ['fitness'],
  searchParams: {
    runner: 'instagram_us_reels'  // 👈 Required for v2
  }
};
```

**Instagram Similar:**
```typescript
const jobParams = {
  platform: 'instagram',
  targetUsername: 'fitness_guru'  // 👈 No keywords, has target
};
```

**TikTok/YouTube Keyword:**
```typescript
const jobParams = {
  platform: 'tiktok',  // or 'youtube'
  keywords: ['cooking tips']
};
```

**YouTube Similar:**
```typescript
const jobParams = {
  platform: 'youtube',
  targetUsername: 'MrBeast'
};
```

---

## User Query Pattern Selection

```
┌─────────────────────────────────────────────────────────────────────────┐
│ What user data do you need?                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ Full profile      │   │ Just need to      │   │ Check specific    │
│ (billing, usage,  │   │ UPDATE user data  │   │ field quickly     │
│ subscription)     │   │                   │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
getUserProfile(userId)  updateUserProfile()      Still use getUserProfile()
                        userId, { changes }      then access the field
```

**Why always use getUserProfile():**
- Joins all 5 user tables automatically
- Returns consistent, complete data
- Handles null/undefined safely
- Type-safe with `UserProfileComplete`

---

## Error Response Selection

```
┌─────────────────────────────────────────────────────────────────────────┐
│ What went wrong?                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌─────────┬─────────┬─────────┬─────────┬─────────┐
    │         │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼         ▼
┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│No auth  ││Bad input││Plan     ││Resource ││System   │
│token    ││or format││limit hit││missing  ││failure  │
└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
  401       400       403       404       500
Unauthorized Bad Request Forbidden Not Found Internal
```

**401 Unauthorized:**
```typescript
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**400 Bad Request:**
```typescript
if (!body.name || body.name.length > 100) {
  return NextResponse.json({
    error: 'Validation failed',
    details: [{ field: 'name', message: 'Name is required (1-100 chars)' }]
  }, { status: 400 });
}
```

**403 Forbidden (Plan Limit):**
```typescript
if (!validation.allowed) {
  return NextResponse.json({
    error: validation.reason,
    code: 'PLAN_LIMIT_EXCEEDED',
    upgradeRequired: true,
    currentUsage: validation.current,
    limit: validation.limit
  }, { status: 403 });
}
```

**404 Not Found:**
```typescript
if (!campaign) {
  return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
}
```

**500 Internal Server Error:**
```typescript
catch (error) {
  logger.error('Operation failed', error, { userId });
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

---

## Database Operation Selection

```
┌─────────────────────────────────────────────────────────────────────────┐
│ What database operation do you need?                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ Single table      │   │ Multiple tables   │   │ Complex query     │
│ simple query      │   │ (need atomicity)  │   │ with relations    │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
   db.select()              db.transaction()        db.query.table
   db.insert()              (async (tx) => {        .findMany({
   db.update()                await tx...             with: {...}
   db.delete()              })                      })
```

**Simple single-table query:**
```typescript
const campaigns = await db.select()
  .from(campaigns)
  .where(eq(campaigns.userId, userId))
  .orderBy(desc(campaigns.createdAt));
```

**Multi-table transaction:**
```typescript
await db.transaction(async (tx) => {
  const [campaign] = await tx.insert(campaigns).values({ userId, name }).returning();
  await tx.insert(scrapingJobs).values({ userId, campaignId: campaign.id });
});
```

**Query with relations:**
```typescript
const campaignWithJobs = await db.query.campaigns.findFirst({
  where: eq(campaigns.id, campaignId),
  with: {
    scrapingJobs: {
      orderBy: desc(scrapingJobs.createdAt)
    }
  }
});
```

---

## Summary Quick Reference

| Scenario | Use This |
|----------|----------|
| Check plan limits before action | `PlanValidator.validate*()` |
| Display billing info on UI | `BillingService.getBillingStateWithCache()` |
| Before charging or limiting | `BillingService.getBillingState()` |
| After Stripe webhook | `BillingService.reconcileWithStripe()` |
| Track usage after success | `PlanEnforcement.incrementUsage()` |
| Get full user data | `getUserProfile(userId)` |
| Update user data | `updateUserProfile(userId, changes)` |
| Instagram keyword search | Set `runner: 'instagram_us_reels'` |
| Dev logging | `logger.debug()` |
| Normal operation logging | `logger.info()` |
| Error logging | `logger.error()` |
