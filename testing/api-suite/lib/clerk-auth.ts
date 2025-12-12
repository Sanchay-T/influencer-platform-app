/**
 * Clerk E2E Auth Helper
 *
 * Creates REAL Clerk users and sessions for E2E testing.
 * Uses Clerk Backend API to:
 * 1. Create a test user
 * 2. Create a session
 * 3. Get a session token (valid 60 seconds)
 * 4. Delete the user after test
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
const CLERK_API_URL = 'https://api.clerk.com/v1'

if (!CLERK_SECRET_KEY) {
  throw new Error('CLERK_SECRET_KEY is required for E2E tests')
}

interface ClerkUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

interface ClerkSession {
  id: string
  userId: string
  status: string
}

interface ClerkTestUser {
  user: ClerkUser
  sessionId: string
  sessionToken: string
}

/**
 * Make a request to Clerk Backend API
 */
async function clerkRequest<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<T> {
  const { method = 'GET', body } = options

  const response = await fetch(`${CLERK_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Clerk API error (${response.status}): ${error}`)
  }

  return response.json()
}

/**
 * Create a test user in Clerk
 */
export async function createClerkTestUser(testId: string): Promise<ClerkUser> {
  // Use example.com - a reserved domain per RFC 2606 that Clerk accepts
  const email = `test-${Date.now()}@example.com`

  console.log(`   → Creating Clerk user: ${email}`)

  const user = await clerkRequest<ClerkUser>('/users', {
    method: 'POST',
    body: {
      email_address: [email],
      first_name: 'E2E',
      last_name: 'Test User',
      // Skip email verification for test users
      skip_password_checks: true,
      skip_password_requirement: true,
    },
  })

  console.log(`   ✓ Clerk user created: ${user.id}`)
  return user
}

/**
 * Create a session for a user
 */
export async function createClerkSession(userId: string): Promise<ClerkSession> {
  console.log(`   → Creating Clerk session for: ${userId}`)

  const session = await clerkRequest<ClerkSession>('/sessions', {
    method: 'POST',
    body: {
      user_id: userId,
    },
  })

  console.log(`   ✓ Clerk session created: ${session.id}`)
  return session
}

/**
 * Get a session token (JWT) for API calls
 * Note: Clerk session tokens are valid for 60 seconds
 */
export async function getClerkSessionToken(sessionId: string): Promise<string> {
  const response = await clerkRequest<{ jwt: string }>(
    `/sessions/${sessionId}/tokens`,
    { method: 'POST' }
  )

  return response.jwt
}

/**
 * Delete a Clerk user (cleanup)
 */
export async function deleteClerkUser(userId: string): Promise<void> {
  console.log(`   → Deleting Clerk user: ${userId}`)

  await clerkRequest(`/users/${userId}`, { method: 'DELETE' })

  console.log(`   ✓ Clerk user deleted`)
}

/**
 * Complete setup: Create user, session, and get token
 * Returns everything needed for authenticated API calls
 */
export async function setupClerkTestUser(testId: string): Promise<ClerkTestUser> {
  // 1. Create user
  const user = await createClerkTestUser(testId)

  // 2. Create session
  const session = await createClerkSession(user.id)

  // 3. Get session token
  const sessionToken = await getClerkSessionToken(session.id)

  return {
    user: {
      id: user.id,
      email: `test-${Date.now()}@example.com`,
      firstName: 'E2E',
      lastName: 'Test User',
    },
    sessionId: session.id,
    sessionToken,
  }
}

/**
 * Cleanup: Delete user and invalidate session
 */
export async function cleanupClerkTestUser(userId: string): Promise<void> {
  try {
    await deleteClerkUser(userId)
  } catch (error) {
    console.error('   ⚠️ Clerk cleanup failed:', error)
  }
}

/**
 * Build Authorization header from session token
 */
export function buildClerkAuthHeaders(sessionToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${sessionToken}`,
  }
}

/**
 * Refresh session token (call before it expires in 60s)
 */
export async function refreshSessionToken(sessionId: string): Promise<string> {
  return getClerkSessionToken(sessionId)
}
