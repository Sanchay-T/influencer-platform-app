#!/usr/bin/env tsx
/**
 * Complete Sandbox Test Suite
 *
 * Django-style isolated test covering the FULL user journey:
 * 1. User creation (directly in DB)
 * 2. Onboarding flow (all 4 steps)
 * 3. Plan activation (set to active subscriber)
 * 4. Campaign creation
 * 5. V2 Keyword Search (TikTok - quick test)
 * 6. List creation + Save creators
 * 7. Full cleanup
 *
 * NO EXTERNAL DEPENDENCIES - fully self-contained.
 * Creates its own user, tests everything, cleans up after.
 *
 * Usage: npx tsx testing/api-suite/sandbox/complete-sandbox.ts
 * Options:
 *   --skip-search    Skip the V2 search (faster test, ~5s vs ~60s)
 *   --platform=X     Platform to test (tiktok, instagram, youtube)
 *   --target=N       Number of creators to search for (default: 25)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import crypto from 'crypto'

// Load env for DB connection
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
import { buildTestAuthHeaders } from '../../../lib/auth/testable-auth'

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.SESSION_BASE_URL || 'http://localhost:3001'
const NGROK_URL = process.env.NGROK_DOMAIN ? `https://${process.env.NGROK_DOMAIN}` : null
const TEST_PREFIX = `sandbox-complete-${Date.now()}`

// Parse CLI args
const args = process.argv.slice(2)
const SKIP_SEARCH = args.includes('--skip-search')
const PLATFORM = args.find(a => a.startsWith('--platform='))?.split('=')[1] || 'tiktok'
const TARGET = parseInt(args.find(a => a.startsWith('--target='))?.split('=')[1] || '25')

interface SandboxUser {
  clerkId: string
  uuid: string
  email: string
}

interface TestResult {
  step: string
  passed: boolean
  duration: number
  details?: unknown
  error?: string
}

// ============================================================================
// Sandbox Setup & Teardown
// ============================================================================

async function createSandboxUser(): Promise<SandboxUser> {
  const clerkId = `${TEST_PREFIX}-${crypto.randomUUID().slice(0, 8)}`
  const email = `${clerkId}@sandbox.test`

  console.log(`\n🔧 Creating sandbox user: ${clerkId}`)

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      userId: clerkId,
      email,
      fullName: null,
      businessName: null,
      onboardingStep: 'pending',
    })
    .returning()

  if (!newUser) {
    throw new Error('Failed to create sandbox user')
  }

  // Create subscription - start inactive, will activate after onboarding
  await db
    .insert(userSubscriptions)
    .values({
      userId: newUser.id,
      currentPlan: null,
      subscriptionStatus: 'inactive',
      trialStatus: 'pending',
    })
    .onConflictDoNothing()

  // Create billing
  await db
    .insert(userBilling)
    .values({
      userId: newUser.id,
      stripeCustomerId: `cus_sandbox_${clerkId}`,
    })
    .onConflictDoNothing()

  // Create usage
  await db
    .insert(userUsage)
    .values({
      userId: newUser.id,
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0,
      usageResetDate: new Date(),
    })
    .onConflictDoNothing()

  console.log(`   ✓ User created: ${newUser.id}`)

  return {
    clerkId,
    uuid: newUser.id,
    email,
  }
}

async function activatePlan(user: SandboxUser): Promise<void> {
  console.log(`\n💳 Activating plan for user: ${user.clerkId}`)

  // Update subscription to active
  await db
    .update(userSubscriptions)
    .set({
      currentPlan: 'fame_flex', // Unlimited plan for testing
      subscriptionStatus: 'active',
      trialStatus: 'converted',
    })
    .where(eq(userSubscriptions.userId, user.uuid))

  // Also set onboardingStep to 'completed' - required by access validation
  await db
    .update(users)
    .set({
      onboardingStep: 'completed',
    })
    .where(eq(users.id, user.uuid))

  console.log(`   ✓ Plan activated: fame_flex (unlimited)`)
}

async function cleanupSandboxUser(user: SandboxUser): Promise<void> {
  console.log(`\n🧹 Cleaning up sandbox user: ${user.clerkId}`)

  try {
    // Delete in reverse order of dependencies

    // 1. Delete list items (creatorLists uses ownerId which is UUID, not clerkId)
    const lists = await db.query.creatorLists.findMany({
      where: eq(creatorLists.ownerId, user.uuid), // Fixed: use ownerId (UUID), not userId
      columns: { id: true },
    })
    for (const list of lists) {
      await db.delete(creatorListItems).where(eq(creatorListItems.listId, list.id))
    }

    // 2. Delete lists (use ownerId which is UUID)
    await db.delete(creatorLists).where(eq(creatorLists.ownerId, user.uuid))

    // 3. Delete scraping results and jobs (scrapingJobs uses userId which is clerkId text)
    const jobs = await db.query.scrapingJobs.findMany({
      where: eq(scrapingJobs.userId, user.clerkId),
      columns: { id: true },
    })
    for (const job of jobs) {
      await db.delete(scrapingResults).where(eq(scrapingResults.jobId, job.id))
    }
    await db.delete(scrapingJobs).where(eq(scrapingJobs.userId, user.clerkId))

    // 4. Delete campaigns (campaigns uses userId which is clerkId text)
    await db.delete(campaigns).where(eq(campaigns.userId, user.clerkId))

    // 5. Delete user-related tables (by UUID)
    await db.delete(userUsage).where(eq(userUsage.userId, user.uuid))
    await db.delete(userBilling).where(eq(userBilling.userId, user.uuid))
    await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, user.uuid))

    // 6. Delete user
    await db.delete(users).where(eq(users.id, user.uuid))

    console.log('   ✓ Cleanup complete')
  } catch (error) {
    console.error('   ⚠️ Cleanup failed:', error)
  }
}

// ============================================================================
// API Helpers
// ============================================================================

function getAuthHeaders(user: SandboxUser): Record<string, string> {
  return buildTestAuthHeaders({ userId: user.clerkId, email: user.email })
}

async function apiRequest<T>(
  user: SandboxUser,
  path: string,
  options: { method?: string; body?: Record<string, unknown>; label?: string; baseUrl?: string } = {}
): Promise<T> {
  const { method = options.body ? 'POST' : 'GET', body, label = path, baseUrl = BASE_URL } = options

  const headers: Record<string, string> = {
    ...getAuthHeaders(user),
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
// Test Steps
// ============================================================================

async function testOnboarding(user: SandboxUser): Promise<TestResult> {
  const start = Date.now()

  try {
    // Step 1: Name + Business
    await apiRequest(user, '/api/onboarding/step-1', {
      method: 'PATCH',
      body: { fullName: 'Sandbox Test User', businessName: 'Sandbox Inc' },
    })

    // Step 2: Brand description
    await apiRequest(user, '/api/onboarding/step-2', {
      method: 'PATCH',
      body: { brandDescription: 'Testing the complete flow' },
    })

    // Step 3: Plan selection
    await apiRequest(user, '/api/onboarding/save-plan', {
      method: 'POST',
      body: { planId: 'fame_flex' },
    })

    // Verify
    const status = await apiRequest<{ onboardingStep: string }>(user, '/api/onboarding/status')

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

async function testCampaignCreation(user: SandboxUser): Promise<TestResult & { campaignId?: string }> {
  const start = Date.now()

  try {
    const campaign = await apiRequest<{ id: string; name: string }>(user, '/api/campaigns', {
      method: 'POST',
      body: {
        name: `Sandbox Test Campaign ${Date.now()}`,
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

async function testV2Search(
  user: SandboxUser,
  campaignId: string
): Promise<TestResult & { creatorsFound?: number }> {
  const start = Date.now()

  // V2 search requires ngrok for QStash callbacks
  const searchUrl = NGROK_URL || BASE_URL

  try {
    console.log(`   → Dispatching V2 search (${PLATFORM}, target: ${TARGET})...`)

    // Dispatch search
    const dispatch = await apiRequest<{ jobId: string; message: string }>(user, '/api/v2/dispatch', {
      method: 'POST',
      body: {
        platform: PLATFORM,
        keywords: ['fitness'],
        targetResults: TARGET,
        campaignId,
      },
      baseUrl: searchUrl,
    })

    if (!dispatch.jobId) {
      throw new Error('No jobId returned from dispatch')
    }

    console.log(`   → Job dispatched: ${dispatch.jobId}`)
    console.log(`   → Polling for completion...`)

    // Poll for completion (max 2 minutes)
    const maxWait = 120000
    const pollInterval = 5000
    let elapsed = 0
    let lastStatus = ''
    let creatorsFound = 0

    while (elapsed < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval))
      elapsed += pollInterval

      // Query job directly from DB (more reliable than API during testing)
      const job = await db.query.scrapingJobs.findFirst({
        where: eq(scrapingJobs.id, dispatch.jobId),
      })

      if (!job) {
        throw new Error(`Job ${dispatch.jobId} not found in database`)
      }

      creatorsFound = job.creatorsFound || 0
      const progress = job.targetResults ? ((creatorsFound / job.targetResults) * 100).toFixed(0) : '0'

      if (job.status !== lastStatus) {
        console.log(
          `   → Status: ${job.status} | Found: ${creatorsFound}/${job.targetResults} (${progress}%)`
        )
        lastStatus = job.status || ''
      }

      if (job.status === 'completed') {
        return {
          step: `V2 Search (${PLATFORM})`,
          passed: creatorsFound >= TARGET * 0.8, // 80% threshold
          duration: Date.now() - start,
          details: {
            jobId: dispatch.jobId,
            platform: PLATFORM,
            target: TARGET,
            found: creatorsFound,
            accuracy: `${((creatorsFound / TARGET) * 100).toFixed(1)}%`,
          },
          creatorsFound,
        }
      }

      if (job.status === 'error') {
        throw new Error(`Search failed: ${job.errorMessage}`)
      }
    }

    throw new Error(`Search timed out after ${maxWait / 1000}s`)
  } catch (error) {
    return {
      step: `V2 Search (${PLATFORM})`,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testListCreation(user: SandboxUser): Promise<TestResult & { listId?: string }> {
  const start = Date.now()

  try {
    // API returns { list: { id, name, ... } }
    const response = await apiRequest<{ list: { id: string; name: string } }>(user, '/api/lists', {
      method: 'POST',
      body: {
        name: `Sandbox Test List ${Date.now()}`,
        type: 'campaign',
        description: 'Created by sandbox test',
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

async function testSaveCreatorToList(
  user: SandboxUser,
  listId: string,
  jobId?: string
): Promise<TestResult> {
  const start = Date.now()

  try {
    // Get a creator from the search results
    let creator: Record<string, unknown> | null = null

    if (jobId) {
      const result = await db.query.scrapingResults.findFirst({
        where: eq(scrapingResults.jobId, jobId),
      })
      if (result && Array.isArray(result.creators) && result.creators.length > 0) {
        creator = result.creators[0] as Record<string, unknown>
      }
    }

    // If no creator from search, create a mock one
    if (!creator) {
      creator = {
        platform: 'TikTok',
        creator: {
          username: 'sandbox_test_creator',
          name: 'Sandbox Creator',
          followers: 10000,
          avatarUrl: 'https://example.com/avatar.jpg',
          bio: 'Test creator for sandbox',
          emails: [],
        },
        content: {
          id: 'test_content_123',
          url: 'https://tiktok.com/@sandbox_test',
        },
      }
    }

    // Save to list
    const saved = await apiRequest<{ success: boolean }>(user, `/api/lists/${listId}/items`, {
      method: 'POST',
      body: { creator },
    })

    return {
      step: 'Save Creator to List',
      passed: saved.success !== false,
      duration: Date.now() - start,
      details: { listId, creatorUsername: (creator.creator as Record<string, unknown>)?.username },
    }
  } catch (error) {
    return {
      step: 'Save Creator to List',
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
  console.log('║           COMPLETE SANDBOX TEST SUITE                                  ║')
  console.log('║           Django-style isolated test environment                       ║')
  console.log('╠════════════════════════════════════════════════════════════════════════╣')
  console.log(`║ Local URL:  ${BASE_URL.padEnd(59)}║`)
  if (NGROK_URL) {
    console.log(`║ Ngrok URL:  ${NGROK_URL.padEnd(59)}║`)
  }
  console.log(`║ Platform:   ${PLATFORM.padEnd(59)}║`)
  console.log(`║ Target:     ${String(TARGET).padEnd(59)}║`)
  console.log(`║ Skip Search: ${String(SKIP_SEARCH).padEnd(58)}║`)
  console.log('╚════════════════════════════════════════════════════════════════════════╝')

  let sandboxUser: SandboxUser | null = null
  const results: TestResult[] = []
  const startTime = Date.now()

  try {
    // Setup
    sandboxUser = await createSandboxUser()

    // Test 1: Onboarding
    console.log('\n📋 Test 1: Onboarding Flow')
    const onboardingResult = await testOnboarding(sandboxUser)
    results.push(onboardingResult)
    console.log(`   ${onboardingResult.passed ? '✅' : '❌'} ${onboardingResult.step} (${onboardingResult.duration}ms)`)

    // Activate plan after onboarding
    await activatePlan(sandboxUser)

    // Test 2: Campaign Creation
    console.log('\n📋 Test 2: Campaign Creation')
    const campaignResult = await testCampaignCreation(sandboxUser)
    results.push(campaignResult)
    console.log(`   ${campaignResult.passed ? '✅' : '❌'} ${campaignResult.step} (${campaignResult.duration}ms)`)

    let searchJobId: string | undefined

    // Test 3: V2 Search (optional)
    if (!SKIP_SEARCH && campaignResult.campaignId) {
      console.log('\n📋 Test 3: V2 Keyword Search')
      const searchResult = await testV2Search(sandboxUser, campaignResult.campaignId)
      results.push(searchResult)
      console.log(`   ${searchResult.passed ? '✅' : '❌'} ${searchResult.step} (${searchResult.duration}ms)`)

      // Get job ID from details
      if (searchResult.details && typeof searchResult.details === 'object' && 'jobId' in searchResult.details) {
        searchJobId = searchResult.details.jobId as string
      }
    } else if (SKIP_SEARCH) {
      console.log('\n📋 Test 3: V2 Keyword Search (SKIPPED)')
      results.push({
        step: 'V2 Search (skipped)',
        passed: true,
        duration: 0,
        details: 'Skipped via --skip-search flag',
      })
    }

    // Test 4: List Creation
    console.log('\n📋 Test 4: List Creation')
    const listResult = await testListCreation(sandboxUser)
    results.push(listResult)
    console.log(`   ${listResult.passed ? '✅' : '❌'} ${listResult.step} (${listResult.duration}ms)`)

    // Test 5: Save Creator to List
    if (listResult.listId) {
      console.log('\n📋 Test 5: Save Creator to List')
      const saveResult = await testSaveCreatorToList(sandboxUser, listResult.listId, searchJobId)
      results.push(saveResult)
      console.log(`   ${saveResult.passed ? '✅' : '❌'} ${saveResult.step} (${saveResult.duration}ms)`)
    }

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
    console.log(`║ Duration: ${String(totalDuration).padEnd(6)}ms                                              ║`)
    console.log(`║ Results:  ${passed}/${total} tests passed                                          ║`)
    console.log(`║ Overall:  ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}                                   ║`)
    console.log('╚════════════════════════════════════════════════════════════════════════╝')

    return allPassed
  } finally {
    // Always cleanup - Django style
    if (sandboxUser) {
      await cleanupSandboxUser(sandboxUser)
    }
  }
}

// Run
main()
  .then(passed => {
    process.exit(passed ? 0 : 1)
  })
  .catch(error => {
    console.error('\n💥 Sandbox test crashed:', error)
    process.exit(1)
  })
