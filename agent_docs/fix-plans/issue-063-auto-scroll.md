# Fix Plan: Issue #63 - Auto-scroll to Checkout Button

**GitHub:** https://github.com/Sanchay-T/influencer-platform-app/issues/63
**Type:** Improvement
**Priority:** Medium

---

## Problem

After selecting a plan, users must manually scroll down to find the "Continue to Secure Checkout" button.

## Solution

Add ref to checkout button, auto-scroll on plan selection.

---

## File to Modify

### `app/components/onboarding/payment-step.tsx`

#### 1. Update React Import (Line 6)

```tsx
// FROM:
import { useState } from 'react';

// TO:
import { useRef, useState } from 'react';
```

#### 2. Add Ref Declaration (after line 22)

```tsx
// Ref for auto-scrolling to checkout button after plan selection
const checkoutButtonRef = useRef<HTMLDivElement>(null);
```

#### 3. Update `handlePlanSelect` Function (lines 28-39)

```tsx
const handlePlanSelect = (planId: string) => {
  OnboardingLogger.logStep3(
    'PLAN-SELECT',
    'User selected a plan',
    userId,
    {
      planId,
      billingCycle,
      planName: PLAN_DISPLAY_CONFIGS.find((p) => p.id === planId)?.name,
    },
    sessionId
  );
  setSelectedPlan(planId);
  setError('');

  // Auto-scroll to checkout button after plan selection
  setTimeout(() => {
    checkoutButtonRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, 100);
};
```

#### 4. Attach Ref to Checkout Button Container (around line 153)

```tsx
// FROM:
{/* Action Button */}
<div className="space-y-3">
  <Button

// TO:
{/* Action Button */}
<div ref={checkoutButtonRef} className="space-y-3">
  <Button
```

---

## Implementation Notes

| Aspect | Detail |
|--------|--------|
| `setTimeout` delay | 100ms allows React state update before scrolling |
| `block: 'center'` | Centers button in viewport |
| `behavior: 'smooth'` | Native CSS smooth scroll |

---

## Testing Checklist

- [ ] Select a plan → view scrolls smoothly to checkout button
- [ ] Checkout button centered/visible after scroll
- [ ] Works on mobile viewports
- [ ] Works when switching between plans
- [ ] No scroll jank or flicker

---

## Estimated Effort

~15 minutes (4 lines of code)
