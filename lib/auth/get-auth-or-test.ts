import { auth as backendAuth } from '@/lib/auth/backend-auth'
import { headers } from 'next/headers'
import { verifyTestAuthHeaders } from '@/lib/auth/testable-auth'

export async function getAuthOrTest() {
  let headerStore: Headers | null = null
  try {
    headerStore = await headers()
  } catch {}

  if (headerStore) {
    const payload = verifyTestAuthHeaders(headerStore)
    if (payload?.userId) {
      return {
        userId: payload.userId,
        sessionId: `test_${payload.userId}`,
        sessionClaims: payload.email ? { email: payload.email } : undefined,
      }
    }

    const defaultBypassToken = process.env.AUTH_BYPASS_TOKEN || 'dev-bypass'
    const bypassHeaderName = process.env.AUTH_BYPASS_HEADER?.toLowerCase() || 'x-dev-auth'
    if (
      process.env.NODE_ENV !== 'production' &&
      defaultBypassToken &&
      headerStore.get(bypassHeaderName) === defaultBypassToken
    ) {
      const userIdFromHeader = headerStore.get('x-dev-user-id') || process.env.AUTH_BYPASS_USER_ID || 'dev-user'
      const emailFromHeader = headerStore.get('x-dev-email') || process.env.AUTH_BYPASS_EMAIL
      return {
        userId: userIdFromHeader,
        sessionId: 'bypass',
        sessionClaims: emailFromHeader ? { email: emailFromHeader } : undefined,
      }
    }
  }

  const bypassEnabled = process.env.ENABLE_AUTH_BYPASS === 'true'
  const bypassUserId = process.env.AUTH_BYPASS_USER_ID
  if (bypassEnabled && bypassUserId && process.env.NODE_ENV !== 'production') {
    return {
      userId: bypassUserId,
      sessionId: 'bypass',
      sessionClaims: process.env.AUTH_BYPASS_EMAIL
        ? { email: process.env.AUTH_BYPASS_EMAIL }
        : undefined,
    }
  }

  return await backendAuth()
}
