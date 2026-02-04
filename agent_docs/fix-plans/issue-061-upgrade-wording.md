# Fix Plan: Issue #61 - Streamline Upgrade/Subscription Wording

**GitHub:** https://github.com/Sanchay-T/influencer-platform-app/issues/61
**Type:** Improvement
**Priority:** Low (UX polish)

---

## Problem

Inconsistent wording confuses users:
- Sidebar: "Upgrade Now"
- Blurred results: "Start Your Subscription"
- Billing page: "Start Your Subscription"

## Solution

Standardize all upgrade CTAs to **"Start Subscription"**.

---

## Files to Modify

### 1. `app/components/trial/trial-sidebar-compact.tsx` (Line 183)

```tsx
// FROM:
<Button className="w-full text-sm">Upgrade Now</Button>

// TO:
<Button className="w-full text-sm">Start Subscription</Button>
```

### 2. `app/components/billing/access-guard-overlay.tsx` (Line 117)

```tsx
// FROM:
<Button className="bg-pink-600 hover:bg-pink-500 text-white">Upgrade Now</Button>

// TO:
<Button className="bg-pink-600 hover:bg-pink-500 text-white">Start Subscription</Button>
```

### 3. `app/components/layout/dashboard-header.jsx` (Line 107)

```tsx
// FROM:
Upgrade

// TO:
Subscribe
```

---

## Files Already Consistent ✅

No changes needed:
- `TrialUpgradeOverlay.tsx` - "Start Your Subscription"
- `app/billing/page.tsx` - "Start Your Subscription"
- `start-subscription-modal.tsx` - "Start Subscription"

---

## Files to Leave Unchanged

Different context (plan-to-plan upgrades):
- `upgrade-button.tsx` - "Upgrade to {plan.name}" (for existing subscribers)
- `app/admin/users/page.tsx` - "Upgrade Plan" (admin tool)

---

## Summary

| Location | Before | After |
|----------|--------|-------|
| Trial sidebar | "Upgrade Now" | "Start Subscription" |
| Access guard overlay | "Upgrade Now" | "Start Subscription" |
| Dashboard header | "Upgrade" | "Subscribe" |

**Total: 3 files, 3 lines**

---

## Testing Checklist

- [ ] All CTAs show "Start Subscription" or "Subscribe"
- [ ] Plan upgrade buttons still say "Upgrade to X"
- [ ] No broken links or functionality

---

## Estimated Effort

~15 minutes (find and replace)
