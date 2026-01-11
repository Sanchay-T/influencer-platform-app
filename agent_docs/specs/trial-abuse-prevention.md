# Spec: Trial Abuse Prevention

## Overview
Prevent users from abusing the 7-day free trial by detecting repeated card usage and blocking disposable emails.

## Protection Layers

| Layer | What it blocks | Where it runs |
|-------|---------------|---------------|
| **Disposable Email Blocking** | Temp emails (mailinator, 10minutemail, etc.) | At checkout (before Stripe) |
| **Card Fingerprinting** | Same card used for multiple trials | In Stripe webhook (after checkout) |

## User Experience

### Normal User (First Trial)
```
Signs up → Onboarding → Checkout → Trial starts → Success page says "Trial started!"
```

### Disposable Email User
```
Signs up → Onboarding → Checkout page →
ERROR: "Please use a permanent email address to start your trial."
Cannot proceed until they change email.
```

### Card Abuse User (Same Card, Different Account)
```
Signs up → Onboarding → Checkout → Card entered →
Stripe creates trial → Webhook detects card fingerprint →
Trial ended immediately, charged →
Success page says: "Your card was previously used for a trial.
Your Glow Up subscription is now active. Charged $99/month.
Contact support@usegemz.io if this is an error."
```

## Implementation

### Part 1: Database Schema

**File:** `lib/db/schema.ts`

Add new table:
```typescript
// Trial abuse prevention - tracks card fingerprints
export const trialCardFingerprints = pgTable('trial_card_fingerprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardFingerprint: text('card_fingerprint').notNull().unique(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  userId: text('user_id').notNull(),
  email: text('email'),
  planAttempted: varchar('plan_attempted', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Index for fast lookups
// CREATE UNIQUE INDEX idx_card_fingerprint ON trial_card_fingerprints(card_fingerprint);
```

Run migration after adding.

### Part 2: Disposable Email Blocking

**File:** `lib/billing/disposable-emails.ts`

```typescript
/**
 * Disposable Email Detection
 *
 * Blocks known temporary/disposable email domains.
 * List sourced from: https://github.com/disposable-email-domains/disposable-email-domains
 */

// Top 100 most common disposable domains (expand as needed)
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  '10minutemail.com',
  'throwaway.email',
  'fakeinbox.com',
  'trashmail.com',
  'temp-mail.org',
  'dispostable.com',
  'mailnesia.com',
  'mintemail.com',
  'tempr.email',
  'discard.email',
  'spamgourmet.com',
  'mytemp.email',
  'mohmal.com',
  'tempinbox.com',
  'mailcatch.com',
  'yopmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'getnada.com',
  'emailondeck.com',
  'temp-mail.io',
  'fakemailgenerator.com',
  // ... add more as needed
]);

/**
 * Check if an email is from a disposable domain
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;

  const domain = email.toLowerCase().split('@')[1];
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Get user-friendly error message for disposable emails
 */
export function getDisposableEmailError(): string {
  return 'Please use a permanent email address. Temporary or disposable emails are not allowed for free trials.';
}
```

### Part 3: Checkout Validation

**File:** `lib/billing/checkout-service.ts`

Add disposable email check before creating checkout:

```typescript
import { isDisposableEmail, getDisposableEmailError } from './disposable-emails';

export class CheckoutService {
  static async createOnboardingCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const { userId, email, plan, interval, existingCustomerId, redirectOrigin } = params;

    // NEW: Block disposable emails
    if (isDisposableEmail(email)) {
      throw new Error(getDisposableEmailError());
    }

    // ... rest of existing code
  }
}
```

**File:** `app/api/billing/checkout/route.ts` (or wherever checkout is called)

Handle the error and return user-friendly message:

```typescript
try {
  const result = await CheckoutService.createOnboardingCheckout(params);
  return NextResponse.json(result);
} catch (error) {
  if (error.message.includes('disposable email')) {
    return NextResponse.json(
      { error: 'disposable_email', message: error.message },
      { status: 400 }
    );
  }
  throw error;
}
```

### Part 4: Card Fingerprint Detection (Webhook)

**File:** `lib/billing/trial-fingerprint.ts`

```typescript
/**
 * Trial Card Fingerprint Detection
 *
 * Detects and blocks users who try to get multiple trials with the same card.
 */

import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { trialCardFingerprints } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { StripeClient } from './stripe-client';

const logger = createCategoryLogger(LogCategory.BILLING);

export interface FingerprintCheckResult {
  isAbuse: boolean;
  existingRecord?: {
    usedByUserId: string;
    usedAt: Date;
    email: string | null;
  };
}

/**
 * Check if a card fingerprint has been used for a trial before.
 */
export async function checkCardFingerprint(
  fingerprint: string
): Promise<FingerprintCheckResult> {
  const existing = await db.query.trialCardFingerprints.findFirst({
    where: eq(trialCardFingerprints.cardFingerprint, fingerprint),
  });

  if (existing) {
    return {
      isAbuse: true,
      existingRecord: {
        usedByUserId: existing.userId,
        usedAt: existing.createdAt,
        email: existing.email,
      },
    };
  }

  return { isAbuse: false };
}

/**
 * Save a card fingerprint for future abuse detection.
 */
export async function saveCardFingerprint(data: {
  fingerprint: string;
  stripeCustomerId: string;
  userId: string;
  email?: string;
  plan?: string;
}): Promise<void> {
  await db.insert(trialCardFingerprints).values({
    cardFingerprint: data.fingerprint,
    stripeCustomerId: data.stripeCustomerId,
    userId: data.userId,
    email: data.email,
    planAttempted: data.plan,
  });

  logger.info('Card fingerprint saved for trial tracking', {
    userId: data.userId,
    metadata: { fingerprintPrefix: data.fingerprint.slice(0, 8) },
  });
}

/**
 * End a trial immediately by calling Stripe API.
 * This charges the customer right away.
 */
export async function endTrialImmediately(subscriptionId: string): Promise<void> {
  const stripe = StripeClient.getRawStripe();

  await stripe.subscriptions.update(subscriptionId, {
    trial_end: 'now', // This ends the trial and starts billing
  });

  logger.info('Trial ended immediately due to abuse detection', {
    metadata: { subscriptionId },
  });
}

/**
 * Get the card fingerprint from a subscription's payment method.
 */
export async function getCardFingerprintFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const paymentMethodId = subscription.default_payment_method;

  if (!paymentMethodId || typeof paymentMethodId !== 'string') {
    return null;
  }

  const stripe = StripeClient.getRawStripe();
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  return paymentMethod.card?.fingerprint || null;
}
```

### Part 5: Update Webhook Handler

**File:** `lib/billing/webhook-handlers.ts`

Add fingerprint check in `handleSubscriptionChange`:

```typescript
import { trackTrialAbuseBlocked } from '@/lib/analytics/logsnag';
import {
  checkCardFingerprint,
  endTrialImmediately,
  getCardFingerprintFromSubscription,
  saveCardFingerprint,
} from './trial-fingerprint';

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  eventType: string
): Promise<WebhookResult> {
  // ... existing code until after user is found and plan is extracted ...

  // ═══════════════════════════════════════════════════════════════
  // NEW: CARD FINGERPRINT ABUSE DETECTION (only for trialing)
  // ═══════════════════════════════════════════════════════════════

  let trialWasBlocked = false;

  if (subscription.status === 'trialing') {
    const fingerprint = await getCardFingerprintFromSubscription(subscription);

    if (fingerprint) {
      const { isAbuse, existingRecord } = await checkCardFingerprint(fingerprint);

      if (isAbuse) {
        // ABUSE DETECTED
        logger.warn('Trial abuse detected - same card used before', {
          userId: user.userId,
          metadata: {
            fingerprintPrefix: fingerprint.slice(0, 8),
            originalUser: existingRecord?.usedByUserId,
            originalDate: existingRecord?.usedAt,
          },
        });

        // End trial immediately (charges the customer)
        await endTrialImmediately(subscription.id);
        trialWasBlocked = true;

        // Track in LogSnag with notification
        await trackTrialAbuseBlocked({
          email: user.email || 'unknown',
          originalEmail: existingRecord?.email || 'unknown',
          plan: planKey,
        });

      } else {
        // First time - save fingerprint
        await saveCardFingerprint({
          fingerprint,
          stripeCustomerId: subscription.customer as string,
          userId: user.userId,
          email: user.email,
          plan: planKey,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Continue with existing code...
  // ═══════════════════════════════════════════════════════════════

  // ... rest of existing handler ...

  // Add to return details
  return {
    success: true,
    userId: user.userId,
    action: trialWasBlocked ? 'trial_abuse_blocked' : 'subscription_updated',
    details: {
      eventType,
      planKey,
      subscriptionStatus: subscription.status,
      trialWasBlocked,
    },
  };
}
```

### Part 6: LogSnag Event for Abuse

**File:** `lib/analytics/logsnag.ts`

Add new tracking function:

```typescript
export async function trackTrialAbuseBlocked(data: {
  email: string;
  originalEmail: string;
  plan: string;
}): Promise<void> {
  await track({
    channel: 'billing',
    event: 'Trial Abuse Blocked',
    icon: '🚫',
    description: `${data.email} tried to reuse card (original: ${data.originalEmail})`,
    tags: {
      email: data.email,
      originalEmail: data.originalEmail,
      plan: data.plan,
    },
    notify: true,  // Push notification to admin
  });
}
```

### Part 7: Success Page Message

**File:** `app/onboarding/success/page.tsx`

Add logic to detect and display abuse message:

```typescript
// Fetch subscription status
const subscriptionStatus = user?.subscriptionStatus;
const wasTrialBlocked = searchParams?.trial_blocked === 'true';

// Determine message to show
const isActiveNotTrialing = subscriptionStatus === 'active';
const showAbuseMessage = isActiveNotTrialing && /* just completed checkout */;

return (
  <div>
    {showAbuseMessage ? (
      <div className="...">
        <h1>Your subscription is now active</h1>
        <p>
          Your card was previously used for a free trial.
          Your {planName} subscription is now active and you've been charged ${planPrice}/month.
        </p>
        <p className="text-sm text-muted-foreground">
          If you believe this is an error, please contact{' '}
          <a href="mailto:support@usegemz.io">support@usegemz.io</a>
        </p>
      </div>
    ) : (
      <div className="...">
        <h1>Your trial has started!</h1>
        <p>Enjoy 7 days of full access to {planName}.</p>
      </div>
    )}
  </div>
);
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CHECKOUT INITIATED                          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  Is email disposable?    │
                    └──────────────────────────┘
                          │              │
                        Yes              No
                          │              │
                          ▼              ▼
              ┌─────────────────┐   ┌─────────────────────┐
              │  BLOCK          │   │  Proceed to Stripe  │
              │  "Use permanent │   │  Checkout           │
              │   email"        │   └─────────────────────┘
              └─────────────────┘              │
                                               ▼
                              ┌────────────────────────────┐
                              │  User enters card in       │
                              │  Stripe Checkout           │
                              └────────────────────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────┐
                              │  Stripe creates subscription│
                              │  with status = 'trialing'   │
                              └────────────────────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────┐
                              │  Webhook:                   │
                              │  customer.subscription.     │
                              │  created                    │
                              └────────────────────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────┐
                              │  Get card fingerprint      │
                              │  from payment method       │
                              └────────────────────────────┘
                                               │
                                               ▼
                    ┌──────────────────────────────────────┐
                    │  Does fingerprint exist in database? │
                    └──────────────────────────────────────┘
                          │                          │
                        Yes                          No
                          │                          │
                          ▼                          ▼
              ┌─────────────────────┐    ┌─────────────────────┐
              │  ABUSE DETECTED     │    │  Save fingerprint   │
              │                     │    │  to database        │
              │  1. End trial       │    └─────────────────────┘
              │     immediately     │                │
              │  2. Charge customer │                ▼
              │  3. Log to LogSnag  │    ┌─────────────────────┐
              │     (notify admin)  │    │  Continue normally  │
              └─────────────────────┘    │  Trial starts       │
                          │              └─────────────────────┘
                          ▼                          │
              ┌─────────────────────┐                ▼
              │  Success page shows:│    ┌─────────────────────┐
              │  "Card was used     │    │  Success page shows:│
              │   before. Charged   │    │  "Trial started!"   │
              │   $X. Contact       │    └─────────────────────┘
              │   support if error" │
              └─────────────────────┘
```

## Testing

### Test Case 1: Normal User
1. Create new account with fresh email
2. Go through onboarding
3. Complete checkout with new card
4. Verify: Trial starts, fingerprint saved in DB

### Test Case 2: Disposable Email
1. Try to checkout with `test@mailinator.com`
2. Verify: Error shown, cannot proceed

### Test Case 3: Card Abuse
1. Complete trial with Card A
2. Create new account with different email
3. Try checkout with same Card A
4. Verify: Trial ends immediately, charged, message shown

### Test Case 4: Different Card, Same Email
1. Complete trial with Card A
2. Same user tries with Card B
3. Verify: Card B works (different fingerprint)

## Database Migration

```sql
-- Run after deploying schema changes
CREATE TABLE IF NOT EXISTS trial_card_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_fingerprint TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  plan_attempted VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trial_fingerprints_user ON trial_card_fingerprints(user_id);
```

## Success Criteria

- [ ] Disposable emails blocked at checkout with clear error
- [ ] Card fingerprint saved after first successful trial
- [ ] Same card on new account → Trial ended, charged immediately
- [ ] Success page shows appropriate message for each case
- [ ] LogSnag notification fires on abuse detection
- [ ] Admin can see abuse attempts in LogSnag dashboard
