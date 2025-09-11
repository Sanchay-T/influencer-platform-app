import { auth as clerkAuth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { verifyTestAuthHeaders } from '@/lib/auth/testable-auth'

export async function getAuthOrTest() {
  try {
    const h = await headers()
    const payload = verifyTestAuthHeaders(h)
    if (payload?.userId) {
      return {
        userId: payload.userId,
        sessionId: `test_${payload.userId}`,
        sessionClaims: payload.email ? { email: payload.email } : undefined,
      }
    }
  } catch {}
  return await clerkAuth()
}
