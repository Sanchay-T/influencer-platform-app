# Testing & Verification Guide

This guide covers how you can test features and verify fixes.

## E2E Testing with Real Clerk Auth (Recommended)

For true end-to-end testing with real Clerk JWT tokens (no auth bypass):

```bash
npx tsx testing/api-suite/sandbox/e2e-clerk-sandbox.ts --skip-search
```

### What It Does

1. Creates a **real Clerk user** via Clerk Backend API
2. Creates a **real session** with JWT tokens (60-second expiry, auto-refresh)
3. Creates the user in our database (mirrors webhook flow)
4. Runs tests with **real `Authorization: Bearer <JWT>` headers**
5. Cleans up both Clerk and database after

### Key Files

| File | Purpose |
|------|---------|
| `testing/api-suite/lib/clerk-auth.ts` | Clerk Backend API helper (create user, session, get JWT) |
| `testing/api-suite/sandbox/e2e-clerk-sandbox.ts` | True E2E test with real auth |
| `testing/api-suite/sandbox/complete-sandbox.ts` | Comprehensive test (with auth bypass) |
| `testing/api-suite/sandbox/onboarding-sandbox.ts` | Onboarding-specific tests |

### Tests Included

| Test | What It Verifies |
|------|------------------|
| Profile Creation | User profile is returned correctly |
| Onboarding Flow | Steps 1-3 complete successfully |
| Campaign Creation | User can create campaigns (requires active plan) |
| List Creation | User can create creator lists |

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. Clerk Backend API: POST /users                          │
│     → Creates real user: user_36hMH6B7t72JV0Gz7tX5mUKZJA9  │
├─────────────────────────────────────────────────────────────┤
│  2. Clerk Backend API: POST /sessions                       │
│     → Creates session: sess_36hMH5F5p3IF9heZxIoUbCjajgo    │
├─────────────────────────────────────────────────────────────┤
│  3. Clerk Backend API: POST /sessions/{id}/tokens           │
│     → Gets JWT: eyJhbGciOiJSUzI1NiIs...                    │
├─────────────────────────────────────────────────────────────┤
│  4. Database: Insert into users, user_subscriptions, etc.   │
│     → Mirrors webhook flow (Backend API doesn't trigger)   │
├─────────────────────────────────────────────────────────────┤
│  5. Run tests with real Authorization headers               │
│     → Every request validated by Clerk middleware          │
├─────────────────────────────────────────────────────────────┤
│  6. Cleanup: Delete from database + Clerk                   │
│     → No test data left behind                             │
└─────────────────────────────────────────────────────────────┘
```

### Token Refresh

Clerk session tokens expire in 60 seconds. The test automatically refreshes tokens every 50 seconds using an interval timer. This is handled in `startTokenRefresh()` and `stopTokenRefresh()`.

---

## Test Auth System (Auth Bypass)

For faster testing without creating real Clerk users, use test auth headers.

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
1. Read `testing/api-suite/lib/clerk-auth.ts` for Clerk Backend API helper
2. Read `testing/api-suite/sandbox/e2e-clerk-sandbox.ts` for true E2E test
3. Read `lib/auth/testable-auth.ts` for test header generation
4. Read E2E endpoints in `app/api/admin/e2e/`
