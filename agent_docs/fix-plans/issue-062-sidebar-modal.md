# Fix Plan: Issue #62 - Sidebar Modal Instead of Navigation

**GitHub:** https://github.com/Sanchay-T/influencer-platform-app/issues/62
**Type:** Improvement
**Priority:** Medium

---

## Problem

When trial users click "Upgrade" in the sidebar, they're navigated to `/billing` page and must scroll to find upgrade options.

## Solution

Replace navigation with inline modal.

---

## File to Modify

### `app/components/trial/trial-sidebar-compact.tsx`

#### 1. Update Imports

```tsx
// Add:
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { StartSubscriptionModal } from '@/app/components/billing/start-subscription-modal';
import { clearBillingCache } from '@/lib/hooks/use-billing';
import { useStartSubscription } from '@/lib/hooks/use-start-subscription';
```

#### 2. Add Constants (after imports)

```tsx
const PLAN_PRICES: Record<string, number> = {
  growth: 199,
  scale: 599,
  pro: 1999,
  glow_up: 99,
  viral_surge: 249,
  fame_flex: 499,
};

const PLAN_NAMES: Record<string, string> = {
  growth: 'Growth',
  scale: 'Scale',
  pro: 'Pro',
  glow_up: 'Glow Up',
  viral_surge: 'Viral Surge',
  fame_flex: 'Fame Flex',
};
```

#### 3. Update Status Type

```tsx
type Status = {
  // ... existing fields
  currentPlan?: string;  // ADD THIS
};
```

#### 4. Add State and Hooks (inside component)

```tsx
const [showStartModal, setShowStartModal] = useState(false);
const router = useRouter();
const {
  startSubscription,
  openPortal,
  isLoading: isStartingSubscription,
} = useStartSubscription();

const handleConfirmStartSubscription = async () => {
  const result = await startSubscription();

  if (result.success) {
    setShowStartModal(false);
    toast.success('Subscription started! Welcome aboard.');
    clearBillingCache();
    router.refresh();
  } else {
    toast.error(
      <div className="flex flex-col gap-2">
        <span>{result.error}</span>
        <button
          onClick={() => {
            toast.dismiss();
            openPortal();
          }}
          className="text-pink-400 hover:text-pink-300 text-sm underline text-left"
        >
          Update payment method
        </button>
      </div>,
      { duration: 8000 }
    );
  }
};
```

#### 5. Update Status State in useEffect

```tsx
currentPlan: data.currentPlan,  // ADD to newStatus object
```

#### 6. Replace Link with Button + Modal

```tsx
// FROM:
<Link href="/billing?upgrade=1" className="block">
  <Button className="w-full text-sm">Upgrade Now</Button>
</Link>

// TO:
<Button
  className="w-full text-sm"
  onClick={() => setShowStartModal(true)}
  disabled={isStartingSubscription}
>
  Start Subscription
</Button>

{/* Add Modal at end of component, before closing </div> */}
{status.currentPlan && status.currentPlan !== 'free' && (
  <StartSubscriptionModal
    open={showStartModal}
    onOpenChange={setShowStartModal}
    planName={PLAN_NAMES[status.currentPlan] || status.currentPlan}
    amount={PLAN_PRICES[status.currentPlan] || 0}
    onConfirm={handleConfirmStartSubscription}
    isLoading={isStartingSubscription}
  />
)}
```

---

## Flow Change

```
BEFORE:                         AFTER:
Click "Upgrade Now"             Click "Start Subscription"
       ↓                               ↓
Navigate to /billing            Modal appears inline
       ↓                               ↓
Scroll to find options          Confirm in modal
       ↓                               ↓
Click button                    Done!
```

---

## Testing Checklist

- [ ] Modal opens on click (no navigation)
- [ ] Plan name and price shown correctly
- [ ] Successful subscription → toast + refresh
- [ ] Error → toast with "Update payment" link
- [ ] "View Billing Details" link still works

---

## Estimated Effort

~1 hour
