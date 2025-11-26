# lib/services/CLAUDE.md — Business Logic Services

## What This Directory Contains

The `lib/services/` directory contains the business logic layer. Services are stateless classes or modules that encapsulate domain logic. They sit between API routes and the database layer, handling validation, enforcement, and complex operations.

Every service follows the pattern: receive request context (userId, requestId), perform business logic, log events, return result.

---

## Directory Structure

```
lib/services/
├── plan-validator.ts       → Plan limit validation (campaigns, creators)
├── plan-enforcement.ts     → Runtime limit enforcement
├── billing-service.ts      → Stripe operations, trial management
├── feature-gates.ts        → Feature flag management
├── trial-status-calculator.ts → Trial end date calculation
├── creator-enrichment.ts   → Enrichment API integration
└── image-cache.ts          → Avatar/image caching
```

---

## Core Services

### PlanValidator (`plan-validator.ts`)

**The most critical service for revenue protection.** Validates user actions against plan limits.

**Class: `PlanValidator`**

**`validateCampaignCreation(userId: string, requestId: string): Promise<ValidationResult>`**
Checks if user can create a new campaign based on their plan's campaign limit.

```typescript
import { PlanValidator } from '@/lib/services/plan-validator';

const validation = await PlanValidator.validateCampaignCreation(userId, requestId);
if (!validation.allowed) {
  return NextResponse.json({
    error: validation.reason,
    upgradeRequired: true
  }, { status: 403 });
}
```

**`validateCreatorLimit(userId: string, count: number, requestId: string): Promise<ValidationResult>`**
Checks if user can discover `count` more creators this month.

```typescript
const validation = await PlanValidator.validateCreatorLimit(userId, 500, requestId);
// validation.allowed: boolean
// validation.reason: string (if denied)
// validation.remainingCreators: number
// validation.adjustedCount: number (clamped to remaining)
```

**`getActiveUserPlan(userId: string): Promise<PlanConfig>`**
Returns the full plan configuration for a user.

```typescript
const plan = await PlanValidator.getActiveUserPlan(userId);
// plan.name: 'Viral Surge'
// plan.key: 'viral_surge'
// plan.campaignsLimit: 10
// plan.creatorsLimit: 10000
// plan.features: { export: true, enrichment: true, ... }
```

To grep: `PlanValidator`, `validateCampaignCreation`, `validateCreatorLimit`, `getActiveUserPlan`

---

### PlanEnforcement (`plan-enforcement.ts`)

Runtime enforcement and usage tracking. Called after operations complete.

**Class: `PlanEnforcement`**

**`incrementUsage(userId: string, field: 'creators' | 'campaigns' | 'enrichments', amount: number): Promise<void>`**
Increments usage counters after resource creation.

```typescript
await PlanEnforcement.incrementUsage(userId, 'creators', 50);
```

**`checkAndResetMonthlyUsage(userId: string): Promise<void>`**
Checks if billing cycle has passed and resets monthly counters.

To grep: `PlanEnforcement`, `incrementUsage`, `checkAndResetMonthlyUsage`

---

### BillingService (`billing-service.ts`)

Handles all Stripe interactions and subscription management.

**Functions:**

**`createCheckoutSession(userId: string, planId: string): Promise<{ url: string }>`**
Creates a Stripe Checkout session for plan purchase.

```typescript
import { createCheckoutSession } from '@/lib/services/billing-service';
const { url } = await createCheckoutSession(userId, 'viral_surge');
// Redirect user to url
```

**`handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void>`**
Processes successful checkout. Sets `currentPlan`, starts trial, schedules emails.

**`handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void>`**
Handles plan changes, cancellations, payment method updates.

**`handleInvoicePaid(invoice: Stripe.Invoice): Promise<void>`**
Resets monthly usage counters when payment succeeds.

**`getCustomerPortalUrl(userId: string): Promise<string>`**
Gets Stripe Customer Portal URL for subscription management.

To grep: `createCheckoutSession`, `handleCheckoutCompleted`, `handleInvoicePaid`, `getCustomerPortalUrl`

---

### TrialStatusCalculator (`trial-status-calculator.ts`)

Calculates trial states and UI display information.

**Class: `TrialStatusCalculator`**

**`calculate(user: UserProfile): TrialStatus`**
Returns trial status with days remaining, urgency level, and UI styling.

```typescript
import { TrialStatusCalculator } from '@/lib/services/trial-status-calculator';

const status = TrialStatusCalculator.calculate(user);
// status.isInTrial: boolean
// status.daysRemaining: number
// status.urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
// status.displayText: 'Trial ends in 3 days'
// status.badgeColor: 'yellow' | 'orange' | 'red'
```

To grep: `TrialStatusCalculator`, `urgencyLevel`, `daysRemaining`

---

### FeatureGates (`feature-gates.ts`)

Feature flag management for gradual rollouts and A/B testing.

**Class: `FeatureGates`**

**`isEnabled(feature: string, userId?: string): boolean`**
Checks if a feature is enabled, optionally for a specific user.

```typescript
import { FeatureGates } from '@/lib/services/feature-gates';

if (FeatureGates.isEnabled('new_search_ui', userId)) {
  // Show new UI
}
```

**`getFeatures(userId: string): Record<string, boolean>`**
Returns all feature flags for a user.

To grep: `FeatureGates`, `isEnabled`, `getFeatures`

---

### CreatorEnrichmentService (`creator-enrichment.ts`)

Enriches creator profiles with follower counts and engagement data.

**Function: `enrichCreators(creators: Creator[], platform: string): Promise<EnrichedCreator[]>`**

```typescript
import { enrichCreators } from '@/lib/services/creator-enrichment';

const enriched = await enrichCreators(creators, 'instagram');
// Each creator now has: followerCount, engagementRate, avgLikes, avgComments
```

Uses Influencers.Club API. Handles failures gracefully—returns original data if enrichment fails.

To grep: `enrichCreators`, `CreatorEnrichmentService`, `influencersClubApi`

---

### ImageCache (`image-cache.ts`)

Caches avatar and profile images to reduce external requests.

**Functions:**
- `getCachedImage(url: string): Promise<string | null>`
- `cacheImage(url: string, data: Buffer): Promise<void>`

To grep: `ImageCache`, `getCachedImage`, `cacheImage`

---

## Service Patterns

### Logging Pattern
All services should log using `BillingLogger`:

```typescript
import BillingLogger from '@/lib/loggers/billing-logger';

await BillingLogger.logAccess('DENIED', {
  requestId,
  userId,
  resource: 'campaign',
  reason: 'Plan limit exceeded'
});
```

### Error Handling Pattern
Services should throw typed errors:

```typescript
if (!user) {
  throw new ServiceError('USER_NOT_FOUND', `User ${userId} not found`);
}
```

### Validation Pattern
Always validate input, return structured results:

```typescript
return {
  allowed: false,
  reason: 'Monthly creator limit exceeded',
  current: user.usageCreatorsCurrentMonth,
  limit: user.planCreatorsLimit,
  upgradeRequired: true
};
```

---

## Next in Chain

- For database queries these services call, see `lib/db/CLAUDE.md`
- For API routes that call these services, see `app/api/CLAUDE.md`
- For search-specific services, see `lib/search-engine/CLAUDE.md`
