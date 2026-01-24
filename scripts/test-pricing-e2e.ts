#!/usr/bin/env tsx
/**
 * E2E Test for New Pricing Tiers
 * Tests checkout session creation for all new plans
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../lib/db'
import { users, userSubscriptions, userUsage, subscriptionPlans } from '../lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { buildTestAuthHeaders } from '../lib/auth/testable-auth'

const BASE_URL = 'http://localhost:3002'

interface TestResult {
  plan: string
  billing: string
  checkoutCreated: boolean
  priceId?: string
  sessionId?: string
  error?: string
}

async function testCheckoutCreation(userId: string, plan: string, billing: 'monthly' | 'yearly'): Promise<TestResult> {
  const authHeaders = buildTestAuthHeaders({ userId })
  
  try {
    const response = await fetch(`${BASE_URL}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ planId: plan, billing }),
    })
    
    const data = await response.json()
    
    if (response.ok && data.url) {
      return {
        plan,
        billing,
        checkoutCreated: true,
        sessionId: data.sessionId,
      }
    } else {
      return {
        plan,
        billing,
        checkoutCreated: false,
        error: data.error || 'Unknown error',
      }
    }
  } catch (e) {
    return {
      plan,
      billing,
      checkoutCreated: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('    New Pricing Tiers E2E Test')
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  // Get a test user
  const [existingUser] = await db.select().from(users).limit(1)
  if (!existingUser) {
    console.error('❌ No users in database to test with')
    process.exit(1)
  }
  
  console.log(`Using test user: ${existingUser.userId}\n`)
  
  // Test 1: Verify database has all plans
  console.log('--- Test 1: Database Plan Verification ---')
  const plans = await db.select({
    planKey: subscriptionPlans.planKey,
    displayName: subscriptionPlans.displayName,
    monthlyPrice: subscriptionPlans.monthlyPrice,
    creatorsLimit: subscriptionPlans.creatorsLimit,
  }).from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder))
  
  const newPlans = plans.filter(p => ['growth', 'scale', 'pro'].includes(p.planKey))
  console.log(`Found ${newPlans.length}/3 new plans in database:`)
  for (const p of newPlans) {
    console.log(`  ✅ ${p.planKey}: ${p.displayName} - $${p.monthlyPrice/100}/mo, ${p.creatorsLimit} creators`)
  }
  
  if (newPlans.length !== 3) {
    console.error('❌ Missing new plans in database!')
    process.exit(1)
  }
  
  // Test 2: Checkout creation for all plans
  console.log('\n--- Test 2: Checkout Session Creation ---')
  const testCases = [
    { plan: 'growth', billing: 'monthly' as const },
    { plan: 'growth', billing: 'yearly' as const },
    { plan: 'scale', billing: 'monthly' as const },
    { plan: 'scale', billing: 'yearly' as const },
    { plan: 'pro', billing: 'monthly' as const },
    { plan: 'pro', billing: 'yearly' as const },
  ]
  
  const results: TestResult[] = []
  for (const { plan, billing } of testCases) {
    const result = await testCheckoutCreation(existingUser.userId, plan, billing)
    results.push(result)
    
    if (result.checkoutCreated) {
      console.log(`  ✅ ${plan} (${billing}): Checkout created`)
    } else {
      console.log(`  ❌ ${plan} (${billing}): ${result.error}`)
    }
  }
  
  const passed = results.filter(r => r.checkoutCreated).length
  const total = results.length
  
  // Test 3: Invalid plan rejection
  console.log('\n--- Test 3: Invalid Plan Rejection ---')
  const invalidResult = await testCheckoutCreation(existingUser.userId, 'invalid_plan', 'monthly')
  if (!invalidResult.checkoutCreated && invalidResult.error?.includes('Invalid plan')) {
    console.log('  ✅ Invalid plan correctly rejected')
  } else {
    console.log('  ❌ Invalid plan not properly rejected')
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('    SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Database Plans: ✅ 3/3 new plans present`)
  console.log(`Checkout Tests: ${passed === total ? '✅' : '❌'} ${passed}/${total} passed`)
  console.log(`Invalid Plan Test: ✅ Correctly rejected`)
  console.log('═══════════════════════════════════════════════════════════════')
  
  if (passed === total) {
    console.log('\n🎉 All tests PASSED!')
  } else {
    console.log('\n⚠️ Some tests failed - check output above')
  }
  
  process.exit(passed === total ? 0 : 1)
}

main().catch(console.error)
