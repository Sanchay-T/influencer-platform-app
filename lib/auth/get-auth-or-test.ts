import { structuredConsole } from '@/lib/logging/console-proxy';
import { auth as backendAuth } from '@/lib/auth/backend-auth'
import { headers } from 'next/headers'
import { verifyTestAuthHeaders } from '@/lib/auth/testable-auth'
import { authLogger } from '@/lib/logging'

export async function getAuthOrTest() {
  // Breadcrumb: Resolve auth context -> prefer test headers/bypass -> fall back to Clerk auth.
  const requestId = `auth_ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const isProd = process.env.NODE_ENV === 'production'
  const emitConsoleTrace = process.env.AUTH_TRACE_CONSOLE === 'true'
  const emitDevTrace = (message: string, extra: Record<string, unknown>) => {
    if (isProd) return
    const context = { requestId, ...extra }
    // Breadcrumb: Surface raw auth resolver payloads during local debugging.
    if (emitConsoleTrace) {
      structuredConsole.log(`🔐 [AUTH-TRACE] ${message}`, context)
    }
    authLogger.debug(message, context)
  }

  let headerStore: Headers | null = null
  try {
    headerStore = await headers()
  } catch {}

  if (headerStore) {
    const payload = verifyTestAuthHeaders(headerStore)
    if (payload?.userId) {
      emitDevTrace('Auth resolved via test headers', {
        resolver: 'verifyTestAuthHeaders',
        userId: payload.userId,
        email: payload.email ?? 'NO_EMAIL',
      })
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
      emitDevTrace('Auth resolved via dev bypass header', {
        resolver: 'headerBypass',
        userId: userIdFromHeader,
        email: emailFromHeader ?? 'NO_EMAIL',
        bypassHeader: bypassHeaderName,
      })
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
    emitDevTrace('Auth resolved via .env bypass', {
      resolver: 'envBypass',
      userId: bypassUserId,
      email: process.env.AUTH_BYPASS_EMAIL ?? 'NO_EMAIL',
    })
    return {
      userId: bypassUserId,
      sessionId: 'bypass',
      sessionClaims: process.env.AUTH_BYPASS_EMAIL
        ? { email: process.env.AUTH_BYPASS_EMAIL }
        : undefined,
    }
  }

  const authResult = await backendAuth()

  if (!isProd) {
    const sessionClaims = authResult.sessionClaims as Record<string, unknown> | undefined
    const sanitizedClaims = sessionClaims
      ? Object.fromEntries(
          Object.entries(sessionClaims).map(([key, value]) => {
            const lowerKey = key.toLowerCase()
            const isSensitive = lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')
            return [key, isSensitive ? '[REDACTED]' : value]
          }),
        )
      : undefined
    const emailClaimValue = sessionClaims ? sessionClaims['email'] : undefined
    const emailVerifiedClaimValue = sessionClaims ? sessionClaims['email_verified'] : undefined

    emitDevTrace('Auth resolved via Clerk backendAuth()', {
      resolver: 'clerkAuth',
      userId: authResult.userId ?? 'NO_USER',
      sessionId: authResult.sessionId ?? 'NO_SESSION',
      claimKeys: sessionClaims ? Object.keys(sessionClaims) : [],
      emailClaim: typeof emailClaimValue === 'string' ? emailClaimValue : 'NO_EMAIL',
      emailVerifiedClaim:
        typeof emailVerifiedClaimValue === 'boolean' ? emailVerifiedClaimValue : 'UNKNOWN',
      sanitizedClaims,
    })
  }

  return authResult
}
