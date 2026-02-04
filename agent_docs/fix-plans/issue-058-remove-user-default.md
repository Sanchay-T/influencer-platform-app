# Fix Plan: Issue #58 - Remove "User" Default from Name Field

**GitHub:** https://github.com/Sanchay-T/influencer-platform-app/issues/58
**Type:** Bug
**Priority:** High (affects all new users)

---

## Problem

During onboarding, the Full Name field is pre-populated with "User" instead of being empty. This happens because user creation functions fallback to "User" or "New User" when no name is provided from Clerk.

## Root Cause

1. User signs up via Clerk → `user.created` webhook fires
2. Webhook or `ensureUserProfile` creates DB record with `fullName: 'User'` or `'New User'`
3. Onboarding modal loads existing data including this default name
4. User sees "User" in the name field instead of empty

---

## Files to Modify

### 1. `lib/db/queries/user-queries.ts` (Line ~358)

**Current:**
```typescript
fullName: fullName || 'User',
```

**Change to:**
```typescript
fullName: fullName || null,
```

### 2. `app/api/webhooks/clerk/route.ts` (Line ~333)

**Current:**
```typescript
const fullName = `${firstName} ${lastName}`.trim() || 'New User';
```

**Change to:**
```typescript
const fullName = `${firstName} ${lastName}`.trim() || null;
```

### 3. `app/api/billing/status/route.ts` (Line ~75)

**Current:**
```typescript
const fullName =
    `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User';
```

**Change to:**
```typescript
const fullName =
    `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null;
```

### 4. `scripts/sync-clerk-users-to-db.ts` (Line ~72)

**Current:**
```typescript
${fullName || 'User'},
```

**Change to:**
```typescript
${fullName || null},
```

---

## Files to Leave Unchanged

These are UI display fallbacks (not input data):
- `app/admin/users/page.tsx:249` - Toast message fallback
- `app/admin/users/page.tsx:266` - Table display fallback

---

## Testing Checklist

- [ ] Create new Clerk account with no name → verify onboarding shows empty name field
- [ ] Create new Clerk account with name → verify name is pre-filled correctly
- [ ] Verify admin users page still displays "User" fallback for users without names
- [ ] Run existing tests to ensure no regressions

---

## Estimated Effort

~30 minutes (simple string replacements)
