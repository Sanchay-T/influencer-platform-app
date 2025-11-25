# lib/auth/CLAUDE.md — Authentication System

## What This Directory Contains

The `lib/auth/` directory handles all authentication concerns. It provides a unified auth interface that works in both production (Clerk) and development (test headers). Every API route uses this system via `getAuthOrTest()`.

The key innovation here is the **test bypass system**: in development, you can skip Clerk entirely using HTTP headers, enabling CLI testing and automation without real user sessions.

---

## Directory Structure

```
lib/auth/
├── get-auth-or-test.ts     → Main auth resolver (THE function to use)
├── backend-auth.ts         → Clerk server-side wrapper
├── testable-auth.ts        → Test header verification
├── admin-utils.ts          → Admin role checking
└── types.ts                → Auth type definitions
```

---

## The Main Function: `getAuthOrTest()`

**File: `get-auth-or-test.ts`**

This is THE function every API route calls. It returns `{ userId, sessionId, email }` or `null` if unauthenticated.

```typescript
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';

export async function POST(req: Request) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // userId is now guaranteed to exist
}
```

**Resolution Order:**
1. **Test Headers** (dev only) — Checks `x-test-user-id` and `x-test-email` headers
2. **Dev Bypass Header** (dev only) — Checks `x-dev-auth: dev-bypass` with `x-dev-user-id`
3. **Environment Bypass** (dev only) — Checks `ENABLE_AUTH_BYPASS=true` with `AUTH_BYPASS_USER_ID`
4. **Clerk Auth** (always) — Falls back to `auth()` from `@clerk/nextjs/server`

**Security:** All bypass methods are disabled when `NODE_ENV === 'production'`.

To grep: `getAuthOrTest`, `x-test-user-id`, `x-dev-auth`, `ENABLE_AUTH_BYPASS`

---

## Test Bypass Methods

### Method 1: Test Headers (Recommended)

Pass `x-test-user-id` and optionally `x-test-email` in request headers:

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "x-test-user-id: user_test123" \
  -H "x-test-email: test@example.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Campaign"}'
```

**File: `testable-auth.ts`**

Function `extractTestAuth(headers: Headers): TestAuthResult | null` extracts and validates test headers.

```typescript
// Returns:
{
  userId: 'user_test123',
  email: 'test@example.com',
  isTestAuth: true
}
```

To grep: `extractTestAuth`, `x-test-user-id`, `x-test-email`

### Method 2: Dev Bypass Header

Pass `x-dev-auth: dev-bypass` with `x-dev-user-id`:

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: user_test123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Campaign"}'
```

To grep: `x-dev-auth`, `x-dev-user-id`, `dev-bypass`

### Method 3: Environment Variable Bypass

Set in `.env.local`:
```bash
ENABLE_AUTH_BYPASS=true
AUTH_BYPASS_USER_ID=user_test123
AUTH_BYPASS_EMAIL=test@example.com
```

This automatically authenticates all requests as the specified user. Useful for local development when you don't want to pass headers.

To grep: `ENABLE_AUTH_BYPASS`, `AUTH_BYPASS_USER_ID`

---

## Backend Auth (`backend-auth.ts`)

Wrapper around Clerk's server-side `auth()` function.

**Function: `getBackendAuth(): Promise<AuthResult>`**

```typescript
import { getBackendAuth } from '@/lib/auth/backend-auth';

const auth = await getBackendAuth();
// auth.userId: string | null
// auth.sessionId: string | null
// auth.sessionClaims: Record<string, any>
```

This is what `getAuthOrTest()` falls back to in production.

To grep: `getBackendAuth`, `@clerk/nextjs/server`

---

## Admin Utilities (`admin-utils.ts`)

Functions for checking admin status.

**Function: `isAdmin(userId: string): Promise<boolean>`**
Checks if user has `isAdmin: true` in the `users` table.

```typescript
import { isAdmin } from '@/lib/auth/admin-utils';

if (!await isAdmin(userId)) {
  return NextResponse.json({ error: 'Admin required' }, { status: 403 });
}
```

**Function: `requireAdmin(userId: string): Promise<void>`**
Throws if user is not an admin.

To grep: `isAdmin`, `requireAdmin`, `isAdmin: true`

---

## Type Definitions (`types.ts`)

```typescript
interface AuthResult {
  userId: string | null;
  sessionId: string | null;
  email: string | null;
  isTestAuth: boolean;
}

interface TestAuthResult {
  userId: string;
  email: string | null;
  isTestAuth: true;
}
```

To grep: `AuthResult`, `TestAuthResult`

---

## Middleware (`middleware.ts` at repo root)

While not in this directory, the Clerk middleware is critical to understand:

```typescript
// middleware.ts
export default clerkMiddleware();

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

**Public Routes** (no auth required):
- `/` — Landing page
- `/sign-in`, `/sign-up` — Auth pages
- `/api/webhooks/*` — External webhooks (Stripe, Clerk)

All other routes require authentication.

To grep: `clerkMiddleware`, `publicRoutes`, `middleware.ts`

---

## Common Patterns

### Basic API Route Auth

```typescript
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... handle authenticated request
}
```

### Admin-Only Route

```typescript
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { isAdmin } from '@/lib/auth/admin-utils';

export async function POST(req: Request) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!await isAdmin(userId)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }
  // ... handle admin request
}
```

### Client-Side Auth (React)

```typescript
'use client';
import { useAuth, useUser } from '@clerk/nextjs';

function MyComponent() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  // ...
}
```

To grep: `useAuth`, `useUser`, `@clerk/nextjs`

---

## Security Notes

- **Never** skip auth validation in API routes
- **Never** expose test bypass in production (automatically disabled)
- **Always** verify webhook signatures instead of user auth for webhooks
- **Always** use `getAuthOrTest()` not raw `auth()` from Clerk

---

## Next in Chain

- For API routes using this auth, see `app/api/CLAUDE.md`
- For admin-related endpoints, see `app/api/admin/`
