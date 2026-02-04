# Fix Plan: Issue #59 - Redesign Business Category Selection

**GitHub:** https://github.com/Sanchay-T/influencer-platform-app/issues/59
**Type:** Improvement
**Priority:** Medium

---

## Problem

Users have to scroll down to select business category. Need to show category options more prominently with clickable chips.

## Solution

Add business category chips to Step 1 of onboarding, auto-populate descriptions in Step 2.

---

## Files to Create

### 1. `lib/constants/business-categories.ts` (NEW)

```typescript
export interface BusinessCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  {
    id: 'beauty',
    label: 'Beauty & Skincare',
    icon: 'Sparkles',
    description: "We're a [sustainable/luxury/budget-friendly] beauty brand targeting [demographic]. We look for beauty influencers who promote [clean living/makeup tutorials/skincare routines]."
  },
  {
    id: 'fitness',
    label: 'Fitness & Wellness',
    icon: 'Dumbbell',
    description: "We're a fitness [apparel/supplement/equipment] company. We want to work with fitness influencers, yoga instructors, and wellness coaches."
  },
  {
    id: 'fashion',
    label: 'Fashion & Apparel',
    icon: 'Shirt',
    description: "We're a [sustainable/luxury/streetwear] fashion brand. We look for style influencers who showcase [ethical fashion/trendy outfits/casual wear]."
  },
  {
    id: 'tech',
    label: 'Tech & SaaS',
    icon: 'Laptop',
    description: "We're a tech company building [productivity/consumer/B2B] products. We're seeking tech reviewers, productivity experts, and entrepreneurs."
  },
  {
    id: 'food',
    label: 'Food & Beverage',
    icon: 'UtensilsCrossed',
    description: "We're a [healthy/gourmet/snack] food brand. We look for food influencers, recipe creators, and lifestyle bloggers."
  },
  {
    id: 'travel',
    label: 'Travel & Hospitality',
    icon: 'Plane',
    description: "We're a travel [brand/agency/hotel]. We want to work with travel influencers and lifestyle creators."
  },
  {
    id: 'finance',
    label: 'Finance & Fintech',
    icon: 'Wallet',
    description: "We're a [fintech/investment/banking] company. We look for finance educators and business influencers."
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'MoreHorizontal',
    description: "Describe your brand and the type of influencers you want to work with..."
  }
];
```

### 2. `app/components/onboarding/category-icon.tsx` (NEW)

```typescript
import * as LucideIcons from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = LucideIcons[name as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;
  return Icon ? <Icon className={className} /> : null;
}
```

---

## Files to Modify

### 3. `app/components/onboarding/step-1-info.tsx`

Add `businessCategory` prop and chip selector:

```tsx
// Add to props
businessCategory: string;
onBusinessCategoryChange: (value: string) => void;

// Add UI after Business Name field
<div className="space-y-3">
  <Label>Business Category</Label>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {BUSINESS_CATEGORIES.map((category) => (
      <button
        key={category.id}
        type="button"
        onClick={() => onBusinessCategoryChange(category.id)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
          businessCategory === category.id
            ? "bg-primary/20 border-primary text-primary"
            : "bg-zinc-800/30 border-zinc-700/50"
        )}
      >
        <CategoryIcon name={category.icon} className="h-4 w-4" />
        {category.label}
      </button>
    ))}
  </div>
</div>
```

### 4. `app/components/onboarding/step-2-brand.tsx`

Add `businessCategory` prop, auto-populate description:

```tsx
useEffect(() => {
  if (businessCategory && !brandDescription) {
    const category = BUSINESS_CATEGORIES.find(c => c.id === businessCategory);
    if (category) onBrandDescriptionChange(category.description);
  }
}, [businessCategory]);
```

### 5. `app/components/onboarding/onboarding-modal.tsx`

Add state and wire to API:

```tsx
const [businessCategory, setBusinessCategory] = useState('');

// In step-1 API call:
body: JSON.stringify({
  fullName: fullName.trim(),
  businessName: businessName.trim(),
  industry: businessCategory,  // Maps to DB field
}),
```

---

## Testing Checklist

- [ ] Category chips visible without scrolling
- [ ] Selection persists through steps
- [ ] Step 2 auto-fills description
- [ ] Industry saved to DB
- [ ] Mobile responsive (2 cols)

---

## Estimated Effort

~3.5 hours
