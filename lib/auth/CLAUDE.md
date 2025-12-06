# lib/auth/CLAUDE.md — Auth & Test Bypass
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md, ../../app/api/CLAUDE.md.

## Scope
Unified auth for production (Clerk) and development (test headers/bypass). Every API route must call `getAuthOrTest()` first.

## Core APIs
- `get-auth-or-test.ts` → `getAuthOrTest(): Promise<{ userId | null; sessionId | null; email | null; isTestAuth: boolean }>`
- `backend-auth.ts` → Clerk wrapper (`getBackendAuth`)
- `testable-auth.ts` → parses dev headers
- `admin-utils.ts` → `isAdmin`, `requireAdmin`

## Resolution Order (dev only for bypass)
1) Test headers: `x-test-user-id`, optional `x-test-email`  
2) Dev bypass header: `x-dev-auth: dev-bypass` + `x-dev-user-id`  
3) Env bypass: `ENABLE_AUTH_BYPASS=true` with `AUTH_BYPASS_USER_ID`  
4) Clerk `auth()` fallback (always)  
Bypass paths are automatically disabled when `NODE_ENV === 'production'`.

## Usage Patterns
```ts
const { userId } = await getAuthOrTest();
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```
- Admin endpoints: `if (!await isAdmin(userId)) return 403`.
- Webhooks: skip user auth; verify signatures instead.

## Do / Don’t
- Do centralize all auth in this module; never call Clerk directly from routes.
- Do log auth context via structured logger (not console).
- Don’t leak dev bypass into prod; avoid caching auth objects across requests.

## Update Rules
Update when header names, bypass logic, or Clerk config changes. Keep examples short; point to root `.claude/CLAUDE.md` for global invariants.
