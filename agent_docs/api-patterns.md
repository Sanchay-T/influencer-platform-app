# API Patterns

This document covers API route conventions. Read this when creating or modifying API routes.

## Route Structure

```
app/api/
├── campaigns/        # Campaign CRUD
├── lists/            # List CRUD
├── scraping/         # Search endpoints (tiktok, youtube, instagram, etc.)
├── profile/          # User profile
├── webhooks/stripe/  # Stripe webhooks
└── admin/e2e/        # Test endpoints
```

---

## Auth Pattern

All protected routes use `getAuthOrTest()` from `lib/auth/get-auth-or-test.ts`.

Returns `{ userId }` or null. Check for null and return 401.

---

## Response Patterns

| Type | Format |
|------|--------|
| Success | `{ data: result }` |
| Error | `{ error: 'message' }` |
| With details | `{ error: 'message', details: { ... } }` |

---

## Status Codes

| Code | Use |
|------|-----|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 400 | Bad request |
| 401 | Not authenticated |
| 403 | Not authorized (plan limit) |
| 404 | Not found |
| 500 | Server error |

---

## Resource Ownership

Always include `userId` in queries:

```typescript
where: and(eq(campaigns.id, id), eq(campaigns.userId, userId))
```

---

## Plan Validation

Before creating resources, use `PlanValidator` from `lib/services/plan-validator.ts`:

- `validateCampaignCreation(userId)`
- `validateCreatorSearch(userId, count)`

Return 403 if `!result.allowed`.

---

## Logging

Use `lib/logging/` for structured logging. See `createCategoryLogger()`.

---

## Test Auth

For API testing without Clerk, use test headers:
- `x-test-auth` — base64 payload
- `x-test-signature` — HMAC signature

See `lib/auth/testable-auth.ts` for signing and `@agent_docs/testing-verification.md` for usage.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/auth/get-auth-or-test.ts` | Auth resolution |
| `lib/services/plan-validator.ts` | Plan limit checks |
| `lib/logging/index.ts` | Logging utilities |

---

## To Explore

When creating API routes:
1. Read existing routes in `app/api/` for patterns
2. Read `lib/auth/get-auth-or-test.ts` for auth
3. Read `lib/services/plan-validator.ts` for validation
