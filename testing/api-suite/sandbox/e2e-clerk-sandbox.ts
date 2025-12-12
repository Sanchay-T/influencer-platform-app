#!/usr/bin/env tsx
/**
 * TRUE E2E Sandbox Test with REAL Clerk Auth
 *
 * This test uses REAL Clerk authentication:
 * 1. Creates a real user in Clerk
 * 2. Creates a real session
 * 3. Gets a real JWT token
 * 4. Uses that token for all API calls
 * 5. Cleans up Clerk user after
 *
 * This is the REAL DEAL - no auth bypass, no test headers.
 *
 * Usage: npx tsx testing/api-suite/sandbox/e2e-clerk-sandbox.ts
 * Options:
 *   --skip-search    Skip the V2 search (faster test)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import crypto from 'crypto'

config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../../../lib/db'
import {
  users,
  userSubscriptions,
  userBilling,
  userUsage,
  campaigns,
  scrapingJobs,
  scrapingResults,
  creatorLists,
  creatorListItems,
} from '../../../lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  setupClerkTestUser,
  cleanupClerkTestUser,
  buildClerkAuthHeaders,
  refreshSessionToken,
} from '../lib/clerk-auth'

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.SESSION_BASE_URL || 'http://localhost:3001'
const NGROK_URL = process.env.NGROK_DOMAIN ? `https://${process.env.NGROK_DOMAIN}` : null
const TEST_ID = `e2e-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

const args = process.argv.slice(2)
const SKIP_SEARCH = args.includes('--skip-search')
const PLATFORM = args.find(a => a.startsWith('--platform='))?.split('=')[1] || 'tiktok'
const TARGET = parseInt(args.find(a => a.startsWith('--target='))?.split('=')[1] || '25')

interface E2EUser {
  clerkUserId: string
  sessionId: string
  sessionToken: string
  email: string
  dbUserId?: string // UUID from our database
}

interface TestResult {
  step: string
  passed: boolean
  duration: number
  details?: unknown
  error?: string
}

// ============================================================================
// Token refresh handling (Clerk tokens expire in 60s)
// ============================================================================

let currentToken: string = ''
let sessionId: string = ''
let tokenRefreshInterval: NodeJS.Timeout | null = null

function startTokenRefresh(sid: string) {
  sessionId = sid
  // Refresh token every 50 seconds (before 60s expiry)
  tokenRefreshInterval = setInterval(async () => {
    try {
      currentToken = await refreshSessionToken(sessionId)
      console.log('   ↻ Token refreshed')
    } catch (error) {
      console.error('   ⚠️ Token refresh failed:', error)
    }
  }, 50000)
}

function stopTokenRefresh() {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval)
    tokenRefreshInterval = null
  }
}

// ============================================================================
// API Helpers
// ============================================================================

async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; label?: string; baseUrl?: string } = {}
): Promise<T> {
  const { method = options.body ? 'POST' : 'GET', body, label = path, baseUrl = BASE_URL } = options

  const headers: Record<string, string> = {
    ...buildClerkAuthHeaders(currentToken),
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${label} failed (${response.status}): ${text}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : undefined
}

// ============================================================================
// Setup & Teardown
// ============================================================================

async function setupE2EUser(): Promise<E2EUser> {
  console.log(`\n🔐 Setting up REAL Clerk user...`)

  // 1. Create user in Clerk
  const clerkUser = await setupClerkTestUser(TEST_ID)

  // Store token for API calls
  currentToken = clerkUser.sessionToken
  startTokenRefresh(clerkUser.sessionId)

  console.log(`   ✓ Clerk user: ${clerkUser.user.id}`)
  console.log(`   ✓ Session: ${clerkUser.sessionId}`)
  console.log(`   ✓ Token: ${clerkUser.sessionToken.slice(0, 20)}...`)

  // 2. Create user in our database (Clerk Backend API doesn't trigger webhooks)
  console.log(`\n📦 Creating user in database...`)
  
  const [dbUser] = await db.insert(users).values({
    userId: clerkUser.user.id,
    email: clerkUser.user.email,
    fullName: null,
    businessName: null,
    onboardingStep: 'pending',
  }).returning()

  if (!dbUser) {
    throw new Error('Failed to create database user')
  }

  // Create required related records
  await db.insert(userSubscriptions).values({
    userId: dbUser.id,
    currentPlan: null,
    subscriptionStatus: 'inactive',
    trialStatus: 'pending',
  }).onConflictDoNothing()

  await db.insert(userBilling).values({
    userId: dbUser.id,
    stripeCustomerId: null,
  }).onConflictDoNothing()

  await db.insert(userUsage).values({
    userId: dbUser.id,
    usageCampaignsCurrent: 0,
    usageCreatorsCurrentMonth: 0,
    usageResetDate: new Date(),
  }).onConflictDoNothing()

  console.log(`   ✓ Database user created: ${dbUser.id}`)

  return {
    clerkUserId: clerkUser.user.id,
    sessionId: clerkUser.sessionId,
    sessionToken: clerkUser.sessionToken,
    email: clerkUser.user.email,
    dbUserId: dbUser.id,
  }
}

async function cleanupE2EUser(user: E2EUser): Promise<void> {
  console.log(`\n🧹 Cleaning up E2E user: ${user.clerkUserId}`)

  stopTokenRefresh()

  try {
    // 1. Delete from our database first (if user was created via webhook)
    if (user.dbUserId) {
      // Delete in reverse order of dependencies
      const lists = await db.query.creatorLists.findMany({
        where: eq(creatorLists.ownerId, user.dbUserId),
        columns: { id: true },
      })
      for (const list of lists) {
        await db.delete(creatorListItems).where(eq(creatorListItems.listId, list.id))
      }
      await db.delete(creatorLists).where(eq(creatorLists.ownerId, user.dbUserId))

      const jobs = await db.query.scrapingJobs.findMany({
        where: eq(scrapingJobs.userId, user.clerkUserId),
        columns: { id: true },
      })
      for (const job of jobs) {
        await db.delete(scrapingResults).where(eq(scrapingResults.jobId, job.id))
      }
      await db.delete(scrapingJobs).where(eq(scrapingJobs.userId, user.clerkUserId))
      await db.delete(campaigns).where(eq(campaigns.userId, user.clerkUserId))

      await db.delete(userUsage).where(eq(userUsage.userId, user.dbUserId))
      await db.delete(userBilling).where(eq(userBilling.userId, user.dbUserId))
      await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, user.dbUserId))
      await db.delete(users).where(eq(users.id, user.dbUserId))

      console.log('   ✓ Database cleanup complete')
    }

    // 2. Delete from Clerk
    await cleanupClerkTestUser(user.clerkUserId)
    console.log('   ✓ Clerk cleanup complete')
  } catch (error) {
    console.error('   ⚠️ Cleanup failed:', error)
  }
}

// ============================================================================
// Test Steps
// ============================================================================

async function testProfileCreation(user: E2EUser): Promise<TestResult & { dbUserId?: string }> {
  const start = Date.now()

  try {
    // The /api/profile endpoint creates the user in our DB
    // This happens automatically on first authenticated request
    const profile = await apiRequest<{ userId: string; id: string }>('/api/profile')

    // Store the DB user ID for cleanup
    user.dbUserId = profile.id

    return {
      step: 'Profile Creation',
      passed: !!profile.userId,
      duration: Date.now() - start,
      details: profile,
      dbUserId: profile.id,
    }
  } catch (error) {
    return {
      step: 'Profile Creation',
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testOnboarding(): Promise<TestResult> {
  const start = Date.now()

  try {
    // Step 1: Name + Business
    await apiRequest('/api/onboarding/step-1', {
      method: 'PATCH',
      body: { fullName: 'E2E Test User', businessName: 'E2E Test Inc' },
    })

    // Step 2: Brand description
    await apiRequest('/api/onboarding/step-2', {
      method: 'PATCH',
      body: { brandDescription: 'Testing with real Clerk auth' },
    })

    // Step 3: Plan selection
    await apiRequest('/api/onboarding/save-plan', {
      method: 'POST',
      body: { planId: 'fame_flex' },
    })

    // Verify
    const status = await apiRequest<{ onboardingStep: string }>('/api/onboarding/status')

    return {
      step: 'Onboarding',
      passed: status.onboardingStep === 'plan_selected',
      duration: Date.now() - start,
      details: status,
    }
  } catch (error) {
    return {
      step: 'Onboarding',
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function activatePlan(user: E2EUser): Promise<void> {
  if (!user.dbUserId) return

  console.log(`\n💳 Activating plan for E2E user`)

  await db
    .update(userSubscriptions)
    .set({
      currentPlan: 'fame_flex',
      subscriptionStatus: 'active',
      trialStatus: 'converted',
    })
    .where(eq(userSubscriptions.userId, user.dbUserId))

  await db
    .update(users)
    .set({ onboardingStep: 'completed' })
    .where(eq(users.id, user.dbUserId))

  console.log(`   ✓ Plan activated: fame_flex`)
}

async function testCampaignCreation(): Promise<TestResult & { campaignId?: string }> {
  const start = Date.now()

  try {
    const campaign = await apiRequest<{ id: string; name: string }>('/api/campaigns', {
      method: 'POST',
      body: {
        name: `E2E Test Campaign ${Date.now()}`,
        searchType: 'keyword',
      },
    })

    return {
      step: 'Campaign Creation',
      passed: !!campaign.id,
      duration: Date.now() - start,
      details: campaign,
      campaignId: campaign.id,
    }
  } catch (error) {
    return {
      step: 'Campaign Creation',
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testListCreation(): Promise<TestResult & { listId?: string }> {
  const start = Date.now()

  try {
    const response = await apiRequest<{ list: { id: string; name: string } }>('/api/lists', {
      method: 'POST',
      body: {
        name: `E2E Test List ${Date.now()}`,
        type: 'campaign',
        description: 'Created by E2E Clerk test',
      },
    })

    return {
      step: 'List Creation',
      passed: !!response.list?.id,
      duration: Date.now() - start,
      details: response.list,
      listId: response.list?.id,
    }
  } catch (error) {
    return {
      step: 'List Creation',
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗')
  console.log('║           E2E SANDBOX TEST (REAL CLERK AUTH)                           ║')
  console.log('║           No auth bypass - Real JWT tokens                             ║')
  console.log('╠════════════════════════════════════════════════════════════════════════╣')
  console.log(`║ Test ID:   ${TEST_ID.padEnd(60)}║`)
  console.log(`║ Local URL: ${BASE_URL.padEnd(60)}║`)
  if (NGROK_URL) {
    console.log(`║ Ngrok URL: ${NGROK_URL.padEnd(60)}║`)
  }
  console.log('╚════════════════════════════════════════════════════════════════════════╝')

  let e2eUser: E2EUser | null = null
  const results: TestResult[] = []
  const startTime = Date.now()

  try {
    // Setup: Create real Clerk user
    e2eUser = await setupE2EUser()

    // Test 1: Profile creation (triggers webhook flow)
    console.log('\n📋 Test 1: Profile Creation')
    const profileResult = await testProfileCreation(e2eUser)
    results.push(profileResult)
    if (profileResult.dbUserId) {
      e2eUser.dbUserId = profileResult.dbUserId
    }
    console.log(`   ${profileResult.passed ? '✅' : '❌'} ${profileResult.step} (${profileResult.duration}ms)`)

    // Test 2: Onboarding
    console.log('\n📋 Test 2: Onboarding Flow')
    const onboardingResult = await testOnboarding()
    results.push(onboardingResult)
    console.log(`   ${onboardingResult.passed ? '✅' : '❌'} ${onboardingResult.step} (${onboardingResult.duration}ms)`)

    // Activate plan
    await activatePlan(e2eUser)

    // Test 3: Campaign Creation
    console.log('\n📋 Test 3: Campaign Creation')
    const campaignResult = await testCampaignCreation()
    results.push(campaignResult)
    console.log(`   ${campaignResult.passed ? '✅' : '❌'} ${campaignResult.step} (${campaignResult.duration}ms)`)

    // Test 4: List Creation
    console.log('\n📋 Test 4: List Creation')
    const listResult = await testListCreation()
    results.push(listResult)
    console.log(`   ${listResult.passed ? '✅' : '❌'} ${listResult.step} (${listResult.duration}ms)`)

    // Report
    const totalDuration = Date.now() - startTime
    const passed = results.filter(r => r.passed).length
    const total = results.length
    const allPassed = passed === total

    console.log('\n╔════════════════════════════════════════════════════════════════════════╗')
    console.log('║                        TEST RESULTS                                    ║')
    console.log('╠════════════════════════════════════════════════════════════════════════╣')

    for (const result of results) {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED'
      const line = `║ ${result.step.padEnd(30)} ${status.padEnd(15)} ${(result.duration + 'ms').padStart(8)} ║`
      console.log(line.padEnd(76) + '║')
      if (result.error) {
        console.log(`║   Error: ${result.error.substring(0, 60).padEnd(62)}║`)
      }
    }

    console.log('╠════════════════════════════════════════════════════════════════════════╣')
    console.log(`║ Auth:     🔐 REAL CLERK JWT TOKENS                                     ║`)
    console.log(`║ Duration: ${String(totalDuration).padEnd(6)}ms                                              ║`)
    console.log(`║ Results:  ${passed}/${total} tests passed                                          ║`)
    console.log(`║ Overall:  ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}                                   ║`)
    console.log('╚════════════════════════════════════════════════════════════════════════╝')

    return allPassed
  } finally {
    // Always cleanup
    if (e2eUser) {
      await cleanupE2EUser(e2eUser)
    }
  }
}

// Run
main()
  .then(passed => {
    process.exit(passed ? 0 : 1)
  })
  .catch(error => {
    console.error('\n💥 E2E test crashed:', error)
    stopTokenRefresh()
    process.exit(1)
  })
