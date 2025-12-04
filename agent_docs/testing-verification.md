# Testing & Verification Guide

This guide covers how you can test features and verify fixes.

## Test Auth System

You can test API endpoints without Clerk using test auth headers.

### Key Files

| File | Purpose |
|------|---------|
| `lib/auth/testable-auth.ts` | Signs/verifies test headers |
| `lib/auth/get-auth-or-test.ts` | Auth resolution (test → Clerk) |
| `app/api/admin/e2e/create-test-user/route.ts` | Creates test user |
| `app/api/admin/e2e/set-plan/route.ts` | Sets plan for test user |
| `app/api/admin/e2e/user-state/route.ts` | GET state / DELETE cleanup |

---

## Test User Workflow

1. **Create test user** — POST `/api/admin/e2e/create-test-user`
2. **Set plan** — PATCH `/api/admin/e2e/set-plan`
3. **Build auth headers** — Use `lib/auth/testable-auth.ts`
4. **Make API calls** — Include `x-test-auth` + `x-test-signature`
5. **Cleanup** — DELETE `/api/admin/e2e/user-state`

See `lib/tests/agent-auth.js` for header generation example.

---

## What You Can Test

| Works | Notes |
|-------|-------|
| Auth validation | Test headers bypass Clerk |
| Input validation | Standard API behavior |
| Campaign creation | Requires user with active plan |
| Search initiation | Requires plan + campaign |

---

## Prompts to Use

- "Test TikTok keyword search for 'fitness influencer'"
- "Verify campaign creation after my fix"
- "Debug why Instagram search returns 403"

---

## Before Claiming Done

1. **Lint** — `npx biome check --write <files>`
2. **Type check** — `npx tsc --noEmit`
3. **Test the feature** — Use test auth or browser
4. **Tell user how to verify in UI**

---

## Visual Flow

```
You → API (localhost:3001) → PostgreSQL
         ↓
      QStash (via ngrok)
         ↓
      External APIs (ScrapeCreators, Apify)
         ↓
      Results saved
```

---

## To Explore

When testing:
1. Read `lib/auth/testable-auth.ts` for header generation
2. Read E2E endpoints in `app/api/admin/e2e/`
3. Check `lib/tests/agent-auth.js` for example usage
