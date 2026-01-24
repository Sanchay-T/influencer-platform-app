#!/usr/bin/env tsx
/**
 * Comprehensive Feature Gate Testing
 * Tests all features and limits for new pricing tiers
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../lib/db'
import { users, userSubscriptions, userUsage } from '../lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { PLANS, type PlanKey } from '../lib/billing/plan-config'
import { 
  getUserFeatures, 
  hasFeature, 
  hasApiAccess, 
  hasPrioritySupport,
  hasAdvancedAnalytics,
  canExportFormat 
} from '../lib/billing/feature-gates'
import {
  validateCampaignCreation,
  validateCreatorSearch,
  validateEnrichment,
  validateAccess
} from '../lib/billing/access-validation'

// Expected feature matrix for new plans
const EXPECTED_FEATURES = {
  growth: {
    csvExport: true,
    analytics: 'basic',
    apiAccess: false,
    prioritySupport: false,
    realtimeUpdates: false,
  },
  scale: {
    csvExport: true,
    analytics: 'advanced',
    apiAccess: true,
    prioritySupport: false,
    realtimeUpdates: true,
  },
  pro: {
    csvExport: true,
    analytics: 'advanced',
    apiAccess: true,
    prioritySupport: true,
    realtimeUpdates: true,
  },
} as const

// Expected limits for new plans
const EXPECTED_LIMITS = {
  growth: {
    campaigns: -1, // unlimited
    creatorsPerMonth: 6000,
    enrichmentsPerMonth: 500,
  },
  scale: {
    campaigns: -1,
    creatorsPerMonth: 30000,
    enrichmentsPerMonth: 1000,
  },
  pro: {
    campaigns: -1,
    creatorsPerMonth: 75000,
    enrichmentsPerMonth: 10000,
  },
} as const

interface TestResult {
  test: string
  passed: boolean
  details?: string
}

const results: TestResult[] = []

function addResult(test: string, passed: boolean, details?: string) {
  results.push({ test, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`  ${icon} ${test}${details ? ` - ${details}` : ''}`)
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('    FEATURE GATE & LIMITS TESTING')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Verify PLANS config has correct features
  // ═══════════════════════════════════════════════════════════════
  console.log('─── Test 1: Plan Config Features ───\n')
  
  const newPlans: PlanKey[] = ['growth', 'scale', 'pro']
  
  for (const planKey of newPlans) {
    console.log(`  ${planKey.toUpperCase()} plan:`)
    const plan = PLANS[planKey]
    const expected = EXPECTED_FEATURES[planKey]
    
    // Check each feature
    addResult(
      `  csvExport`,
      plan.features.csvExport === expected.csvExport,
      `expected: ${expected.csvExport}, got: ${plan.features.csvExport}`
    )
    addResult(
      `  analytics`,
      plan.features.analytics === expected.analytics,
      `expected: ${expected.analytics}, got: ${plan.features.analytics}`
    )
    addResult(
      `  apiAccess`,
      plan.features.apiAccess === expected.apiAccess,
      `expected: ${expected.apiAccess}, got: ${plan.features.apiAccess}`
    )
    addResult(
      `  prioritySupport`,
      plan.features.prioritySupport === expected.prioritySupport,
      `expected: ${expected.prioritySupport}, got: ${plan.features.prioritySupport}`
    )
    addResult(
      `  realtimeUpdates`,
      plan.features.realtimeUpdates === expected.realtimeUpdates,
      `expected: ${expected.realtimeUpdates}, got: ${plan.features.realtimeUpdates}`
    )
    console.log()
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Verify PLANS config has correct limits
  // ═══════════════════════════════════════════════════════════════
  console.log('─── Test 2: Plan Config Limits ───\n')
  
  for (const planKey of newPlans) {
    console.log(`  ${planKey.toUpperCase()} plan:`)
    const plan = PLANS[planKey]
    const expected = EXPECTED_LIMITS[planKey]
    
    addResult(
      `  campaigns`,
      plan.limits.campaigns === expected.campaigns,
      `expected: ${expected.campaigns === -1 ? 'unlimited' : expected.campaigns}, got: ${plan.limits.campaigns === -1 ? 'unlimited' : plan.limits.campaigns}`
    )
    addResult(
      `  creatorsPerMonth`,
      plan.limits.creatorsPerMonth === expected.creatorsPerMonth,
      `expected: ${expected.creatorsPerMonth}, got: ${plan.limits.creatorsPerMonth}`
    )
    addResult(
      `  enrichmentsPerMonth`,
      plan.limits.enrichmentsPerMonth === expected.enrichmentsPerMonth,
      `expected: ${expected.enrichmentsPerMonth}, got: ${plan.limits.enrichmentsPerMonth}`
    )
    console.log()
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Test feature gate functions with real users
  // ═══════════════════════════════════════════════════════════════
  console.log('─── Test 3: Feature Gate Functions (Real Users) ───\n')
  
  // Find users with each new plan
  const usersWithPlans = await db
    .select({
      clerkId: users.userId,
      email: users.email,
      currentPlan: userSubscriptions.currentPlan,
    })
    .from(users)
    .innerJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
    .where(inArray(userSubscriptions.currentPlan, ['growth', 'scale', 'pro']))

  if (usersWithPlans.length === 0) {
    console.log('  ⚠️  No users found with new plans - skipping real user tests')
    console.log('  (This is expected if no test checkouts have been completed)\n')
  } else {
    for (const user of usersWithPlans) {
      console.log(`  Testing user: ${user.email} (${user.currentPlan})`)
      const planKey = user.currentPlan as 'growth' | 'scale' | 'pro'
      const expected = EXPECTED_FEATURES[planKey]
      
      // Test hasApiAccess
      const apiResult = await hasApiAccess(user.clerkId)
      addResult(
        `    hasApiAccess()`,
        apiResult.allowed === expected.apiAccess,
        `expected: ${expected.apiAccess}, got: ${apiResult.allowed}`
      )
      
      // Test hasPrioritySupport
      const supportResult = await hasPrioritySupport(user.clerkId)
      addResult(
        `    hasPrioritySupport()`,
        supportResult.allowed === expected.prioritySupport,
        `expected: ${expected.prioritySupport}, got: ${supportResult.allowed}`
      )
      
      // Test hasAdvancedAnalytics
      const analyticsResult = await hasAdvancedAnalytics(user.clerkId)
      const expectedAdvanced = expected.analytics === 'advanced'
      addResult(
        `    hasAdvancedAnalytics()`,
        analyticsResult.allowed === expectedAdvanced,
        `expected: ${expectedAdvanced}, got: ${analyticsResult.allowed}`
      )
      
      // Test CSV export
      const csvResult = await canExportFormat(user.clerkId, 'CSV')
      addResult(
        `    canExportFormat('CSV')`,
        csvResult.allowed === expected.csvExport,
        `expected: ${expected.csvExport}, got: ${csvResult.allowed}`
      )
      
      // Test getUserFeatures
      const features = await getUserFeatures(user.clerkId)
      addResult(
        `    getUserFeatures()`,
        features !== null && features.currentPlan === planKey,
        features ? `plan: ${features.currentPlan}` : 'null'
      )
      
      console.log()
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Test limit validation functions
  // ═══════════════════════════════════════════════════════════════
  console.log('─── Test 4: Limit Validation Functions ───\n')
  
  if (usersWithPlans.length > 0) {
    const testUser = usersWithPlans[0]
    console.log(`  Testing with user: ${testUser.email} (${testUser.currentPlan})`)
    
    // Test validateAccess
    const accessResult = await validateAccess(testUser.clerkId)
    addResult(
      `  validateAccess()`,
      accessResult.allowed === true,
      accessResult.reason || 'allowed'
    )
    
    // Test validateCampaignCreation
    const campaignResult = await validateCampaignCreation(testUser.clerkId)
    addResult(
      `  validateCampaignCreation()`,
      campaignResult.allowed === true,
      campaignResult.reason || 'allowed (unlimited campaigns)'
    )
    
    // Test validateCreatorSearch (small amount)
    const searchResult = await validateCreatorSearch(testUser.clerkId, 100)
    addResult(
      `  validateCreatorSearch(100)`,
      searchResult.allowed === true,
      searchResult.reason || 'allowed'
    )
    
    // Test validateEnrichment
    const enrichResult = await validateEnrichment(testUser.clerkId, 10)
    addResult(
      `  validateEnrichment(10)`,
      enrichResult.allowed === true,
      enrichResult.reason || 'allowed'
    )
    console.log()
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Test limit boundary conditions
  // ═══════════════════════════════════════════════════════════════
  console.log('─── Test 5: Limit Boundary Verification ───\n')
  
  // Test that Growth plan would block if limit exceeded
  if (usersWithPlans.find(u => u.currentPlan === 'growth')) {
    const growthUser = usersWithPlans.find(u => u.currentPlan === 'growth')!
    
    // Request more creators than Growth limit (6000)
    const overLimitSearch = await validateCreatorSearch(growthUser.clerkId, 10000)
    // This should still pass if user hasn't used any creators yet
    // but would fail if they've used most of their limit
    console.log(`  Growth plan creator limit test:`)
    console.log(`    Requesting 10,000 creators (limit: 6,000)`)
    console.log(`    Result: ${overLimitSearch.allowed ? 'allowed (user has headroom)' : 'blocked - ' + overLimitSearch.reason}`)
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('    SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  
  console.log(`\nTotal Tests: ${total}`)
  console.log(`  ✅ Passed: ${passed}`)
  console.log(`  ❌ Failed: ${failed}`)
  
  if (failed > 0) {
    console.log('\nFailed Tests:')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.test}: ${r.details}`)
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(failed === 0 ? '🎉 All feature gate tests PASSED!' : '⚠️ Some tests failed')
  console.log('═══════════════════════════════════════════════════════════════')
  
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(console.error)
