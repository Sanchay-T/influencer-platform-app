# Fix Plan: Issue #60 - Highlight "FREE TRIAL" More Prominently

**GitHub:** https://github.com/Sanchay-T/influencer-platform-app/issues/60
**Type:** Improvement
**Priority:** High (conversion impact)

---

## Problem

1. Users confused about whether they're paying now or starting a free trial
2. After selecting a plan, users must scroll to find checkout button

## Solution

Add prominent FREE TRIAL banner, sticky CTA, and clear messaging.

---

## Files to Modify

### 1. `app/components/onboarding/payment-info-cards.tsx`

Add new `FreeTrialBanner` component:

```tsx
import { Clock, Lock, Shield, Sparkles } from 'lucide-react';

function getTrialEndDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FreeTrialBanner() {
  const chargeDate = getTrialEndDate();
  
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-teal-500/20 border-2 border-emerald-500/50 p-5">
      <div className="absolute top-2 right-3 text-emerald-400/60">
        <Sparkles className="h-5 w-5" />
      </div>
      
      <div className="flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg shadow-emerald-500/30">
          <Clock className="h-5 w-5" />
          7-DAY FREE TRIAL
        </div>
        
        <div className="space-y-1">
          <p className="text-emerald-100 font-semibold text-base">
            $0.00 due today — Start exploring now!
          </p>
          <p className="text-emerald-200/80 text-sm">
            You won't be charged until <span className="font-semibold text-emerald-100">{chargeDate}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-emerald-300/70 mt-1">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Cancel anytime
          </span>
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            No hidden fees
          </span>
        </div>
      </div>
    </div>
  );
}
```

### 2. `app/components/onboarding/payment-step.tsx`

Restructure layout:

```tsx
import { FreeTrialBanner, PaymentSecurityCard, TrialInfoCard } from './payment-info-cards';

return (
  <div className="space-y-6">
    {/* Prominent Free Trial Banner - FIRST */}
    <FreeTrialBanner />

    {/* Simplified header */}
    <div className="text-center">
      <p className="text-zinc-400 mb-4">Choose the plan that works for you:</p>
      <BillingCycleToggle billingCycle={billingCycle} onToggle={handleBillingCycleToggle} />
    </div>

    {/* Plan Selection */}
    <div className="grid gap-4">
      {PLAN_DISPLAY_CONFIGS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} ... />
      ))}
    </div>

    {/* Sticky CTA Section */}
    <div className="sticky bottom-0 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent pt-4 pb-2 -mx-4 px-4">
      {error && <Alert variant="destructive">...</Alert>}
      
      <Button
        onClick={handleStartTrial}
        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500"
        disabled={isLoading || !selectedPlan}
      >
        {isLoading ? "Redirecting..." : (
          <div className="flex flex-col items-center">
            <span>Start Free Trial →</span>
            <span className="text-xs font-normal">No charge today • Cancel anytime</span>
          </div>
        )}
      </Button>
    </div>

    {/* Info Cards - secondary */}
    <div className="space-y-4 pt-2">
      <TrialInfoCard />
      <PaymentSecurityCard />
    </div>
  </div>
);
```

---

## Visual Hierarchy

```
BEFORE:                          AFTER:
┌─────────────────────┐          ┌─────────────────────┐
│ Small gray text     │          │ ╔═══════════════╗   │
│ about free trial    │          │ ║ 7-DAY FREE    ║   │  ← BANNER
├─────────────────────┤          │ ║ TRIAL 🎉      ║   │
│ Plan Cards...       │          │ ║ $0 due today  ║   │
├─────────────────────┤          │ ╚═══════════════╝   │
│ Continue Button     │ ←SCROLL  ├─────────────────────┤
└─────────────────────┘          │ Plan Cards...       │
                                 ├─────────────────────┤
                                 │ [START FREE TRIAL]  │ ← STICKY
                                 └─────────────────────┘
```

---

## Testing Checklist

- [ ] Banner visible immediately on payment step
- [ ] Charge date displays correctly (7 days from today)
- [ ] CTA button stays visible (sticky)
- [ ] Mobile renders correctly
- [ ] Colors have sufficient contrast

---

## Estimated Effort

~2 hours
