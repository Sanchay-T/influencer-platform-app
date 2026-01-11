# Spec: Google Analytics 4 Integration

## Overview
Add GA4 tracking to usegemz.io for traffic analytics and key conversion events.

## Measurement ID
`G-ZG4F8W3RJD`

## Scope

### Automatic Tracking (handled by GA4)
- Page views (all routes)
- Session duration
- Bounce rate
- Traffic sources

### Custom Conversion Events
| Event | Trigger Location | Parameters |
|-------|------------------|------------|
| `sign_up` | Clerk webhook (user.created) | `method: 'clerk'` |
| `begin_trial` | Stripe webhook (subscription.created with status=trialing) | `plan_name`, `value` |
| `purchase` | Stripe webhook (subscription.updated with status=active) | `plan_name`, `value`, `currency` |

## Implementation

### 1. Add GA4 Script to Layout

**File:** `app/layout.tsx`

Add after existing Google Ads script:
```tsx
{/* Google Analytics 4 */}
<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-ZG4F8W3RJD"
  strategy="afterInteractive"
/>
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-ZG4F8W3RJD');
  `}
</Script>
```

### 2. Create GA4 Event Helper

**File:** `lib/analytics/google-analytics.ts`

```typescript
/**
 * Google Analytics 4 Event Tracking
 *
 * @context Server-side event tracking for key conversions.
 * Uses GA4 Measurement Protocol for server-side events.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Client-side tracking (for browser)
export function trackGA4Event(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

// Specific conversion events
export function trackGA4Signup(): void {
  trackGA4Event('sign_up', { method: 'clerk' });
}

export function trackGA4TrialStart(planName: string, value: number): void {
  trackGA4Event('begin_trial', {
    plan_name: planName,
    value: value,
    currency: 'USD',
  });
}

export function trackGA4Purchase(planName: string, value: number): void {
  trackGA4Event('purchase', {
    plan_name: planName,
    value: value,
    currency: 'USD',
    transaction_id: `txn_${Date.now()}`,
  });
}
```

### 3. Add Tracking Calls

**Signup tracking** - Already handled by LogSnag in Clerk webhook. Add GA4 call alongside.

**Trial/Purchase tracking** - Already handled by LogSnag in `lib/billing/webhook-handlers.ts`. Add GA4 calls alongside.

Note: Since webhooks are server-side, we need to either:
- Use GA4 Measurement Protocol (server-side API), OR
- Track on client-side success page

**Decision:** Track on success page (simpler, reliable)

**File:** `app/onboarding/success/page.tsx`
- Already has access to subscription status
- Add GA4 event call based on status

## Testing

1. Deploy to Vercel
2. Open usegemz.io in incognito
3. Check GA4 Real-time view for:
   - Page view on homepage
   - Events after signup/trial

## Success Criteria

- [ ] GA4 shows page views in real-time
- [ ] `sign_up` event fires on new user creation
- [ ] `begin_trial` event fires when trial starts
- [ ] `purchase` event fires when subscription becomes active
