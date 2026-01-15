# Analytics Debugging - Handoff Document

## Problem Statement

User wants full-funnel analytics tracking (signup → onboarding → trial → purchase → product usage) visible in GA4 and Meta Pixel dashboards. User reports "nothing showing up" but investigation revealed data IS flowing.

---

## What We Verified

### Google Analytics 4 ✅ WORKING
- **Property:** usegemz.io (ID: G-ZG4F8W3RJD)
- **Data Stream:** Correctly configured, "Receiving traffic in past 48 hours"
- **Realtime:** Showed 1 active user during testing
- **Last 7 days:** 59 users, 541 events
- **Screenshot evidence:** GA4 Home showed activity chart Jan 8-14

### Meta Pixel ✅ RECEIVING DATA
- **Pixel ID:** 852153531055002
- **Events received:**
  - PageView: 351 events (last received ~1hr ago at time of check)
  - Lead: 2 events (last received ~2hrs ago at time of check)
- **Setup:** 50% complete in Meta Events Manager (needs event configuration)

### Code Verification ✅
- Ran browser automation on usegemz.io production
- `typeof gtag` = function (loaded)
- `typeof fbq` = function (loaded)
- dataLayer has GA4 configs for both G-ZG4F8W3RJD and AW-17841436850
- No console errors

---

## What We Implemented

Created a unified analytics tracking system that sends events to GA4 + Meta + LogSnag.

### New Files
- `lib/analytics/events.ts` - Type-safe event definitions
- `lib/analytics/track.ts` - Unified tracking layer

### Modified Files
| File | Change |
|------|--------|
| `app/components/auth/auth-logger.tsx` | Added sign-in tracking for returning users |
| `app/components/onboarding/onboarding-modal.tsx` | Added step 1, 2 completion tracking |
| `app/components/onboarding/payment-step.tsx` | Added step 3 + checkout intent tracking |
| `app/api/export/csv/route.ts` | Added export tracking |
| `app/api/campaigns/route.ts` | Switched to unified tracker |
| `app/api/lists/route.ts` | Switched to unified tracker |
| `lib/search-engine/runner.ts` | Switched to unified tracker |
| `app/components/billing/upgrade-button.tsx` | Added upgrade intent tracking |

### Events Now Tracked
| Event | GA4 | Meta | LogSnag |
|-------|-----|------|---------|
| Sign up | sign_up | Lead | ✅ |
| Sign in | login | - | - |
| Onboarding steps 1-3 | onboarding_step_X | - | - |
| Onboarding complete | complete_registration | CompleteRegistration | - |
| Trial started | begin_trial | StartTrial | ✅ |
| Purchase | purchase | Purchase | ✅ |
| Campaign created | campaign_created | - | ✅ |
| Search completed | search | - | ✅ |
| List created | list_created | - | ✅ |
| CSV export | export | - | - |
| Upgrade clicked | begin_checkout | InitiateCheckout | - |

---

## Unresolved / Next Steps

### 1. Deploy Changes
The code changes haven't been deployed yet. Need to:
```bash
git add -A && git commit -m "feat: add full-funnel analytics tracking"
git push origin HEAD
```

### 2. Verify After Deploy
Walk through user journey and check:
- GA4 Realtime for new events
- Meta Events Manager > Test Events

### 3. Configure GA4 Key Events
In GA4 Admin → Events → Mark as "Key events":
- sign_up
- begin_trial
- purchase
- campaign_created

### 4. Complete Meta Pixel Setup
Meta Events Manager shows "50% complete" - need to:
- Configure standard events in Meta Business Suite
- Verify events in Test Events mode
- Consider Conversions API for server-side tracking

### 5. Debugging If Still Not Working
Run this in browser console on usegemz.io:
```javascript
console.log('fbq loaded:', typeof fbq !== 'undefined');
console.log('gtag loaded:', typeof gtag !== 'undefined');
if (typeof fbq !== 'undefined') {
  fbq('track', 'ViewContent', {test: true});
  console.log('✅ Test event sent to Meta');
}
```

---

## Key URLs

- **GA4 Dashboard:** https://analytics.google.com/analytics/web/?authuser=1#/a379766064p518920479/realtime/overview
- **Meta Events Manager:** https://business.facebook.com/events_manager2/list/pixel/852153531055002/overview
- **Production Site:** https://usegemz.io

---

## Git Status

Branch: `test-trial-feature`
Changes: Staged but not committed

Files changed:
- lib/analytics/events.ts (new)
- lib/analytics/track.ts (new)
- app/components/auth/auth-logger.tsx
- app/components/onboarding/onboarding-modal.tsx
- app/components/onboarding/payment-step.tsx
- app/api/export/csv/route.ts
- app/api/campaigns/route.ts
- app/api/lists/route.ts
- lib/search-engine/runner.ts
- app/components/billing/upgrade-button.tsx
