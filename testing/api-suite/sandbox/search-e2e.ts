#!/usr/bin/env tsx
/**
 * E2E Search Tests with REAL Clerk Auth
 *
 * Tests all three search types using the V2 status endpoint:
 * 1. TikTok keyword search (POST /api/v2/dispatch → poll /api/v2/status)
 * 2. YouTube keyword search (POST /api/v2/dispatch → poll /api/v2/status)
 * 3. Instagram similar search (POST /api/scraping/similar-discovery → poll GET)
 *
 * Usage:
 *   npx tsx testing/api-suite/sandbox/search-e2e.ts
 *   SESSION_BASE_URL=https://usegemz.ngrok.app npx tsx testing/api-suite/sandbox/search-e2e.ts
 *
 * Options:
 *   --platform=tiktok|youtube|instagram  Run only one platform test
 *   --target=25                          Target creator count (default: 25)
 *   --skip-cleanup                       Don't cleanup test user after
 */

import crypto from 'crypto'
import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../../../lib/db'
import {
  campaigns,
  creatorListItems,
  creatorLists,
  jobCreators,
  scrapingJobs,
  scrapingResults,
  userBilling,
  users,
  userSubscriptions,
  userUsage,
} from '../../../lib/db/schema'
import {
  buildClerkAuthHeaders,
  cleanupClerkTestUser,
  refreshSessionToken,
  setupClerkTestUser,
} from '../lib/clerk-auth'

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.SESSION_BASE_URL || 'http://localhost:3001'
const TEST_ID = `search-e2e-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

const args = process.argv.slice(2)
const PLATFORM_FILTER = args.find((a) => a.startsWith('--platform='))?.split('=')[1]
const TARGET = parseInt(args.find((a) => a.startsWith('--target='))?.split('=')[1] || '25')
const SKIP_CLEANUP = args.includes('--skip-cleanup')

// Status polling config
const POLL_INTERVAL_MS = 3000
const MAX_POLL_TIME_MS = 5 * 60 * 1000 // 5 minutes max per test

interface E2EUser {
  clerkUserId: string
  sessionId: string
  sessionToken: string
  email: string
  dbUserId?: string
}

interface SearchTestResult {
  platform: string
  searchType: string
  passed: boolean
  duration: number
  creatorsFound: number
  finalStatus: string
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
  options: { method?: string; body?: Record<string, unknown>; label?: string } = {}
): Promise<T> {
  const { method = options.body ? 'POST' : 'GET', body, label = path } = options

  const headers: Record<string, string> = {
    ...buildClerkAuthHeaders(currentToken),
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${path}`, {
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
// V2 Status Polling
// ============================================================================

interface V2StatusResponse {
  status: 'dispatching' | 'searching' | 'enriching' | 'completed' | 'partial' | 'error'
  message: string
  progress: {
    keywordsDispatched: number
    keywordsCompleted: number
    creatorsFound: number
    creatorsEnriched: number
    percentComplete: number
  }
  processedResults: number
  totalCreators: number
  targetResults: number
  platform: string
  keywords: string[]
  error?: string
  results: Array<{ id: string; creators: unknown[] }>
}

async function pollV2Status(
  jobId: string,
  options: { maxWaitMs?: number; intervalMs?: number } = {}
): Promise<{ status: V2StatusResponse; durationMs: number }> {
  const { maxWaitMs = MAX_POLL_TIME_MS, intervalMs = POLL_INTERVAL_MS } = options
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const status = await apiRequest<V2StatusResponse>(`/api/v2/status?jobId=${jobId}`)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(
      `   ⏳ [${elapsed}s] ${status.status} - ${status.progress.creatorsFound} creators (${status.progress.percentComplete.toFixed(0)}%)`
    )

    // Terminal states
    if (status.status === 'completed' || status.status === 'partial') {
      return { status, durationMs: Date.now() - startTime }
    }

    if (status.status === 'error') {
      throw new Error(`Job failed: ${status.error || 'Unknown error'}`)
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timeout: Job did not complete within ${maxWaitMs / 1000}s`)
}

// ============================================================================
// Similar Search Status Polling (uses different endpoint)
// ============================================================================

interface SimilarStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'error' | 'timeout'
  processedResults: number
  targetResults: number
  targetUsername: string
  error?: string | null
  results: Array<{ id: string; creators: unknown[] }>
  progress: number
  platform: string
  totalCreators: number
}

async function pollSimilarStatus(
  jobId: string,
  options: { maxWaitMs?: number; intervalMs?: number } = {}
): Promise<{ status: SimilarStatusResponse; durationMs: number }> {
  const { maxWaitMs = MAX_POLL_TIME_MS, intervalMs = POLL_INTERVAL_MS } = options
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const status = await apiRequest<SimilarStatusResponse>(
      `/api/scraping/similar-discovery?jobId=${jobId}`
    )

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(
      `   ⏳ [${elapsed}s] ${status.status} - ${status.processedResults}/${status.targetResults} creators (${status.progress}%)`
    )

    // Terminal states
    if (status.status === 'completed') {
      return { status, durationMs: Date.now() - startTime }
    }

    if (status.status === 'error' || status.status === 'timeout') {
      throw new Error(`Job failed: ${status.error || status.status}`)
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timeout: Job did not complete within ${maxWaitMs / 1000}s`)
}

// ============================================================================
// Setup & Teardown
// ============================================================================

async function setupE2EUser(): Promise<E2EUser> {
  console.log(`\n🔐 Setting up REAL Clerk user...`)

  const clerkUser = await setupClerkTestUser(TEST_ID)

  currentToken = clerkUser.sessionToken
  startTokenRefresh(clerkUser.sessionId)

  console.log(`   ✓ Clerk user: ${clerkUser.user.id}`)
  console.log(`   ✓ Session: ${clerkUser.sessionId}`)

  // Create user in our database
  console.log(`\n📦 Creating user in database...`)

  const [dbUser] = await db
    .insert(users)
    .values({
      userId: clerkUser.user.id,
      email: clerkUser.user.email,
      fullName: 'E2E Search Test',
      businessName: 'E2E Testing Inc',
      onboardingStep: 'completed',
    })
    .returning()

  if (!dbUser) {
    throw new Error('Failed to create database user')
  }

  // Create required related records with active plan
  await db
    .insert(userSubscriptions)
    .values({
      userId: dbUser.id,
      currentPlan: 'fame_flex',
      subscriptionStatus: 'active',
    })
    .onConflictDoNothing()

  await db
    .insert(userBilling)
    .values({
      userId: dbUser.id,
      stripeCustomerId: null,
    })
    .onConflictDoNothing()

  await db
    .insert(userUsage)
    .values({
      userId: dbUser.id,
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0,
      usageResetDate: new Date(),
    })
    .onConflictDoNothing()

  console.log(`   ✓ Database user created: ${dbUser.id}`)
  console.log(`   ✓ Plan activated: fame_flex`)

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
    if (user.dbUserId) {
      // Delete lists and list items
      const lists = await db.query.creatorLists.findMany({
        where: eq(creatorLists.ownerId, user.dbUserId),
        columns: { id: true },
      })
      for (const list of lists) {
        await db.delete(creatorListItems).where(eq(creatorListItems.listId, list.id))
      }
      await db.delete(creatorLists).where(eq(creatorLists.ownerId, user.dbUserId))

      // Delete jobs, job_creators, and results
      const jobs = await db.query.scrapingJobs.findMany({
        where: eq(scrapingJobs.userId, user.clerkUserId),
        columns: { id: true },
      })
      for (const job of jobs) {
        await db.delete(jobCreators).where(eq(jobCreators.jobId, job.id))
        await db.delete(scrapingResults).where(eq(scrapingResults.jobId, job.id))
      }
      await db.delete(scrapingJobs).where(eq(scrapingJobs.userId, user.clerkUserId))
      await db.delete(campaigns).where(eq(campaigns.userId, user.clerkUserId))

      // Delete user records
      await db.delete(userUsage).where(eq(userUsage.userId, user.dbUserId))
      await db.delete(userBilling).where(eq(userBilling.userId, user.dbUserId))
      await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, user.dbUserId))
      await db.delete(users).where(eq(users.id, user.dbUserId))

      console.log('   ✓ Database cleanup complete')
    }

    await cleanupClerkTestUser(user.clerkUserId)
    console.log('   ✓ Clerk cleanup complete')
  } catch (error) {
    console.error('   ⚠️ Cleanup failed:', error)
  }
}

// ============================================================================
// Search Tests
// ============================================================================

async function createCampaign(name: string): Promise<string> {
  const campaign = await apiRequest<{ id: string }>('/api/campaigns', {
    method: 'POST',
    body: {
      name,
      searchType: 'keyword',
    },
  })
  return campaign.id
}

async function testTikTokKeywordSearch(campaignId: string): Promise<SearchTestResult> {
  const startTime = Date.now()

  console.log('\n📱 Testing TikTok Keyword Search...')
  console.log(`   Target: ${TARGET} creators`)
  console.log(`   Keywords: fitness influencer`)

  try {
    // Dispatch search
    const dispatch = await apiRequest<{ jobId: string; workersDispatched: number }>(
      '/api/v2/dispatch',
      {
        method: 'POST',
        body: {
          platform: 'tiktok',
          keywords: ['fitness influencer'],
          targetResults: TARGET <= 100 ? 100 : TARGET,
          campaignId,
          enableExpansion: false, // Skip AI expansion for faster tests
        },
      }
    )

    console.log(`   ✓ Dispatched: jobId=${dispatch.jobId}, workers=${dispatch.workersDispatched}`)

    // Poll for completion
    const { status, durationMs } = await pollV2Status(dispatch.jobId)

    return {
      platform: 'TikTok',
      searchType: 'keyword',
      passed: status.status === 'completed' || status.status === 'partial',
      duration: durationMs,
      creatorsFound: status.totalCreators,
      finalStatus: status.status,
    }
  } catch (error) {
    return {
      platform: 'TikTok',
      searchType: 'keyword',
      passed: false,
      duration: Date.now() - startTime,
      creatorsFound: 0,
      finalStatus: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testYouTubeKeywordSearch(campaignId: string): Promise<SearchTestResult> {
  const startTime = Date.now()

  console.log('\n📺 Testing YouTube Keyword Search...')
  console.log(`   Target: ${TARGET} creators`)
  console.log(`   Keywords: tech reviewer`)

  try {
    // Dispatch search
    const dispatch = await apiRequest<{ jobId: string; workersDispatched: number }>(
      '/api/v2/dispatch',
      {
        method: 'POST',
        body: {
          platform: 'youtube',
          keywords: ['tech reviewer'],
          targetResults: TARGET <= 100 ? 100 : TARGET,
          campaignId,
          enableExpansion: false,
        },
      }
    )

    console.log(`   ✓ Dispatched: jobId=${dispatch.jobId}, workers=${dispatch.workersDispatched}`)

    // Poll for completion
    const { status, durationMs } = await pollV2Status(dispatch.jobId)

    return {
      platform: 'YouTube',
      searchType: 'keyword',
      passed: status.status === 'completed' || status.status === 'partial',
      duration: durationMs,
      creatorsFound: status.totalCreators,
      finalStatus: status.status,
    }
  } catch (error) {
    return {
      platform: 'YouTube',
      searchType: 'keyword',
      passed: false,
      duration: Date.now() - startTime,
      creatorsFound: 0,
      finalStatus: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testInstagramSimilarSearch(campaignId: string): Promise<SearchTestResult> {
  const startTime = Date.now()

  console.log('\n📸 Testing Instagram Similar Search...')
  console.log(`   Target: ${TARGET} creators`)
  console.log(`   Seed: @therock`)

  try {
    // Start similar search
    const startResponse = await apiRequest<{ jobId: string; status: string }>(
      '/api/scraping/similar-discovery',
      {
        method: 'POST',
        body: {
          platform: 'instagram',
          username: 'therock',
          targetResults: TARGET <= 100 ? 100 : TARGET,
          campaignId,
        },
      }
    )

    console.log(`   ✓ Started: jobId=${startResponse.jobId}`)

    // Poll for completion
    const { status, durationMs } = await pollSimilarStatus(startResponse.jobId)

    return {
      platform: 'Instagram',
      searchType: 'similar',
      passed: status.status === 'completed',
      duration: durationMs,
      creatorsFound: status.processedResults,
      finalStatus: status.status,
    }
  } catch (error) {
    return {
      platform: 'Instagram',
      searchType: 'similar',
      passed: false,
      duration: Date.now() - startTime,
      creatorsFound: 0,
      finalStatus: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗')
  console.log('║           E2E SEARCH TESTS (REAL CLERK AUTH)                           ║')
  console.log('║           V2 Status Polling • All Platforms                            ║')
  console.log('╠════════════════════════════════════════════════════════════════════════╣')
  console.log(`║ Test ID:   ${TEST_ID.padEnd(60)}║`)
  console.log(`║ Base URL:  ${BASE_URL.padEnd(60)}║`)
  console.log(`║ Target:    ${String(TARGET).padEnd(60)}║`)
  if (PLATFORM_FILTER) {
    console.log(`║ Platform:  ${PLATFORM_FILTER.padEnd(60)}║`)
  }
  console.log('╚════════════════════════════════════════════════════════════════════════╝')

  let e2eUser: E2EUser | null = null
  const results: SearchTestResult[] = []
  const startTime = Date.now()

  try {
    // Setup
    e2eUser = await setupE2EUser()

    // Create a campaign for all tests
    console.log('\n📋 Creating test campaign...')
    const campaignId = await createCampaign(`E2E Search Test ${Date.now()}`)
    console.log(`   ✓ Campaign created: ${campaignId}`)

    // Run tests based on filter
    const testsToRun = PLATFORM_FILTER
      ? [PLATFORM_FILTER]
      : ['tiktok', 'youtube', 'instagram']

    for (const platform of testsToRun) {
      switch (platform) {
        case 'tiktok':
          results.push(await testTikTokKeywordSearch(campaignId))
          break
        case 'youtube':
          results.push(await testYouTubeKeywordSearch(campaignId))
          break
        case 'instagram':
          results.push(await testInstagramSimilarSearch(campaignId))
          break
      }
    }

    // Report
    const totalDuration = Date.now() - startTime
    const passed = results.filter((r) => r.passed).length
    const total = results.length
    const allPassed = passed === total

    console.log('\n╔════════════════════════════════════════════════════════════════════════╗')
    console.log('║                        SEARCH TEST RESULTS                            ║')
    console.log('╠════════════════════════════════════════════════════════════════════════╣')

    for (const result of results) {
      const status = result.passed ? '✅' : '❌'
      const durationStr = (result.duration / 1000).toFixed(1) + 's'
      const line = `║ ${status} ${result.platform} ${result.searchType}: ${result.creatorsFound} creators (${result.finalStatus}) ${durationStr}`
      console.log(line.padEnd(75) + '║')
      if (result.error) {
        console.log(`║    Error: ${result.error.substring(0, 60).padEnd(62)}║`)
      }
    }

    console.log('╠════════════════════════════════════════════════════════════════════════╣')
    console.log(`║ Auth:     🔐 REAL CLERK JWT TOKENS                                     ║`)
    console.log(`║ Duration: ${String((totalDuration / 1000).toFixed(1))}s total                                              ║`)
    console.log(`║ Results:  ${passed}/${total} tests passed                                          ║`)
    console.log(`║ Overall:  ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}                                   ║`)
    console.log('╚════════════════════════════════════════════════════════════════════════╝')

    return allPassed
  } finally {
    if (e2eUser && !SKIP_CLEANUP) {
      await cleanupE2EUser(e2eUser)
    } else if (SKIP_CLEANUP) {
      console.log('\n⚠️  Skipping cleanup (--skip-cleanup flag)')
      console.log(`   Clerk user: ${e2eUser?.clerkUserId}`)
      console.log(`   DB user: ${e2eUser?.dbUserId}`)
    }
  }
}

// Run
main()
  .then((passed) => {
    process.exit(passed ? 0 : 1)
  })
  .catch((error) => {
    console.error('\n💥 E2E search test crashed:', error)
    stopTokenRefresh()
    process.exit(1)
  })
