#!/usr/bin/env tsx
/**
 * Onboarding Sandbox Test
 *
 * Django-style isolated test:
 * 1. Creates a fresh test user directly in DB
 * 2. Runs the complete onboarding flow
 * 3. Verifies all steps
 * 4. Cleans up everything (deletes test user)
 *
 * No external dependencies - fully self-contained.
 *
 * Usage: npx tsx testing/api-suite/sandbox/onboarding-sandbox.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import crypto from 'crypto'

// Load env for DB connection
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../../../lib/db'
import { users, userSubscriptions, userBilling, userUsage } from '../../../lib/db/schema'
import { eq } from 'drizzle-orm'
import { buildTestAuthHeaders } from '../../../lib/auth/testable-auth'

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.SESSION_BASE_URL || 'http://localhost:3001'
const TEST_PREFIX = `sandbox-onboarding-${Date.now()}`

interface SandboxUser {
  clerkId: string
  uuid: string
  email: string
}

// ============================================================================
// Sandbox Setup & Teardown
// ============================================================================

async function createSandboxUser(): Promise<SandboxUser> {
  const clerkId = `${TEST_PREFIX}-${crypto.randomUUID().slice(0, 8)}`
  const email = `${clerkId}@sandbox.test`

  console.log(`\n🔧 Creating sandbox user: ${clerkId}`)

  // Create user
  const [newUser] = await db.insert(users).values({
    userId: clerkId,
    email,
    fullName: null, // Will be set during onboarding
    businessName: null,
    onboardingStep: 'pending', // Start fresh
  }).returning()

  if (!newUser) {
    throw new Error('Failed to create sandbox user')
  }

  // Create related tables (required for full flow)
  // @why trialStatus is now derived from subscriptionStatus + trialEndDate
  await db.insert(userSubscriptions).values({
    userId: newUser.id,
    currentPlan: null,
    subscriptionStatus: 'none',
  }).onConflictDoNothing()

  await db.insert(userBilling).values({
    userId: newUser.id,
    stripeCustomerId: null,
  }).onConflictDoNothing()

  await db.insert(userUsage).values({
    userId: newUser.id,
    usageCampaignsCurrent: 0,
    usageCreatorsCurrentMonth: 0,
    usageResetDate: new Date(),
  }).onConflictDoNothing()

  console.log(`   ✓ User created: ${newUser.id}`)

  return {
    clerkId,
    uuid: newUser.id,
    email,
  }
}

async function cleanupSandboxUser(user: SandboxUser): Promise<void> {
  console.log(`\n🧹 Cleaning up sandbox user: ${user.clerkId}`)

  try {
    // Delete in reverse order of dependencies
    await db.delete(userUsage).where(eq(userUsage.userId, user.uuid))
    await db.delete(userBilling).where(eq(userBilling.userId, user.uuid))
    await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, user.uuid))
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
  options: { method?: string; body?: Record<string, unknown>; label?: string } = {}
): Promise<T> {
  const { method = options.body ? 'POST' : 'GET', body, label = path } = options

  const headers: Record<string, string> = {
    ...getAuthHeaders(user),
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
// Test Flow
// ============================================================================

interface OnboardingTestResult {
  passed: boolean
  steps: {
    step1: { passed: boolean; result?: unknown; error?: string }
    step2: { passed: boolean; result?: unknown; error?: string }
    step3: { passed: boolean; result?: unknown; error?: string }
    verify: { passed: boolean; result?: unknown; error?: string }
  }
  duration: number
}

async function runOnboardingTest(user: SandboxUser): Promise<OnboardingTestResult> {
  const startTime = Date.now()
  const result: OnboardingTestResult = {
    passed: false,
    steps: {
      step1: { passed: false },
      step2: { passed: false },
      step3: { passed: false },
      verify: { passed: false },
    },
    duration: 0,
  }

  const testData = {
    fullName: 'Sandbox Test User',
    businessName: 'Sandbox Business Inc',
    brandDescription: 'Testing the onboarding flow in isolation',
    planId: 'viral_surge',
  }

  console.log('\n📋 Running onboarding flow...')
  console.log(`   Full Name: ${testData.fullName}`)
  console.log(`   Business: ${testData.businessName}`)
  console.log(`   Plan: ${testData.planId}`)

  // Step 1: Name + Business
  try {
    console.log('\n→ Step 1: Saving name and business')
    const step1 = await apiRequest<{ success: boolean; step: string }>(
      user,
      '/api/onboarding/step-1',
      {
        method: 'PATCH',
        body: { fullName: testData.fullName, businessName: testData.businessName },
        label: 'Step 1',
      }
    )
    console.log(`   ✓ Step 1 complete: ${step1.step}`)
    result.steps.step1 = { passed: true, result: step1 }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.log(`   ✗ Step 1 failed: ${msg}`)
    result.steps.step1 = { passed: false, error: msg }
    result.duration = Date.now() - startTime
    return result
  }

  // Step 2: Brand description
  try {
    console.log('\n→ Step 2: Saving brand description')
    const step2 = await apiRequest<{ success: boolean; step: string }>(
      user,
      '/api/onboarding/step-2',
      {
        method: 'PATCH',
        body: { brandDescription: testData.brandDescription },
        label: 'Step 2',
      }
    )
    console.log(`   ✓ Step 2 complete: ${step2.step}`)
    result.steps.step2 = { passed: true, result: step2 }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.log(`   ✗ Step 2 failed: ${msg}`)
    result.steps.step2 = { passed: false, error: msg }
    result.duration = Date.now() - startTime
    return result
  }

  // Step 3: Plan selection
  try {
    console.log('\n→ Step 3: Selecting plan')
    const step3 = await apiRequest<{ success: boolean; step: string; planId: string }>(
      user,
      '/api/onboarding/save-plan',
      {
        method: 'POST',
        body: { planId: testData.planId },
        label: 'Step 3',
      }
    )
    console.log(`   ✓ Step 3 complete: plan=${step3.planId}`)
    result.steps.step3 = { passed: true, result: step3 }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.log(`   ✗ Step 3 failed: ${msg}`)
    result.steps.step3 = { passed: false, error: msg }
    result.duration = Date.now() - startTime
    return result
  }

  // Verify final status
  try {
    console.log('\n→ Verifying final status')
    const status = await apiRequest<{
      onboardingStep: string
      fullName: string
      businessName: string
      intendedPlan: string
    }>(user, '/api/onboarding/status', { label: 'Status check' })

    const errors: string[] = []
    if (status.onboardingStep !== 'plan_selected') {
      errors.push(`Expected step 'plan_selected', got '${status.onboardingStep}'`)
    }
    if (status.fullName !== testData.fullName) {
      errors.push(`Expected fullName '${testData.fullName}', got '${status.fullName}'`)
    }
    if (status.businessName !== testData.businessName) {
      errors.push(`Expected businessName '${testData.businessName}', got '${status.businessName}'`)
    }
    if (status.intendedPlan !== testData.planId) {
      errors.push(`Expected intendedPlan '${testData.planId}', got '${status.intendedPlan}'`)
    }

    if (errors.length > 0) {
      console.log('   ⚠️ Validation warnings:')
      for (const err of errors) {
        console.log(`      - ${err}`)
      }
      result.steps.verify = { passed: false, result: status, error: errors.join('; ') }
    } else {
      console.log('   ✓ All validations passed')
      result.steps.verify = { passed: true, result: status }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.log(`   ✗ Verification failed: ${msg}`)
    result.steps.verify = { passed: false, error: msg }
  }

  result.passed = Object.values(result.steps).every(s => s.passed)
  result.duration = Date.now() - startTime
  return result
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗')
  console.log('║           ONBOARDING SANDBOX TEST                                      ║')
  console.log('║           Django-style isolated test environment                       ║')
  console.log('╠════════════════════════════════════════════════════════════════════════╣')
  console.log(`║ Base URL: ${BASE_URL.padEnd(60)}║`)
  console.log('╚════════════════════════════════════════════════════════════════════════╝')

  let sandboxUser: SandboxUser | null = null

  try {
    // Setup
    sandboxUser = await createSandboxUser()

    // Run test
    const result = await runOnboardingTest(sandboxUser)

    // Report
    console.log('\n╔════════════════════════════════════════════════════════════════════════╗')
    console.log('║                        TEST RESULTS                                    ║')
    console.log('╠════════════════════════════════════════════════════════════════════════╣')
    console.log(`║ Step 1 (Name/Business):    ${result.steps.step1.passed ? '✅ PASSED' : '❌ FAILED'}                             ║`)
    console.log(`║ Step 2 (Brand):            ${result.steps.step2.passed ? '✅ PASSED' : '❌ FAILED'}                             ║`)
    console.log(`║ Step 3 (Plan):             ${result.steps.step3.passed ? '✅ PASSED' : '❌ FAILED'}                             ║`)
    console.log(`║ Verification:              ${result.steps.verify.passed ? '✅ PASSED' : '❌ FAILED'}                             ║`)
    console.log('╠════════════════════════════════════════════════════════════════════════╣')
    console.log(`║ Duration: ${String(result.duration).padEnd(6)}ms                                              ║`)
    console.log(`║ Overall:  ${result.passed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}                                   ║`)
    console.log('╚════════════════════════════════════════════════════════════════════════╝')

    return result.passed

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
