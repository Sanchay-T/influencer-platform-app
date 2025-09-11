// Dev/test wrapper for Clerk server SDK.
// In development with ENABLE_TEST_AUTH=true, this module overrides `auth()`
// to return a synthetic user when valid signed test headers are present.
// All other exports are forwarded to the real SDK.

import * as actual from './clerk-server-actual'
import { headers } from 'next/headers'
import { verifyTestAuthHeaders } from './testable-auth'

export * from './clerk-server-actual'

export async function auth() {
  const enabled = process.env.ENABLE_TEST_AUTH === 'true' && process.env.NODE_ENV !== 'production'
  if (enabled) {
    try {
      const h = headers()
      const payload = verifyTestAuthHeaders(h)
      if (payload?.userId) {
        // Minimal shape used across the app: userId + sessionClaims.email
        return {
          userId: payload.userId,
          sessionId: `test_${payload.userId}`,
          sessionClaims: payload.email ? { email: payload.email } : undefined,
          getToken: async () => null,
        }
      }
    } catch {
      // Fall through to real auth
    }
  }
  return await (actual as any).auth()
}

