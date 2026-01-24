#!/usr/bin/env tsx
/**
 * Verify plan limits are correctly configured
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../lib/db'
import { subscriptionPlans } from '../lib/db/schema'
import { asc } from 'drizzle-orm'

async function main() {
  console.log('Verifying Plan Limits...\n')
  
  // Expected limits for new plans
  const expected = {
    growth: { creators: 6000, campaigns: -1 },
    scale: { creators: 30000, campaigns: -1 },
    pro: { creators: 75000, campaigns: -1 },
  }
  
  const plans = await db.select({
    planKey: subscriptionPlans.planKey,
    displayName: subscriptionPlans.displayName,
    creatorsLimit: subscriptionPlans.creatorsLimit,
    campaignsLimit: subscriptionPlans.campaignsLimit,
    monthlyPrice: subscriptionPlans.monthlyPrice,
  }).from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder))
  
  console.log('Current Plan Limits in Database:\n')
  console.log('| Plan         | Price     | Creators   | Campaigns  | Status |')
  console.log('|--------------|-----------|------------|------------|--------|')
  
  let allCorrect = true
  
  for (const plan of plans) {
    const isNew = plan.planKey in expected
    const exp = expected[plan.planKey as keyof typeof expected]
    
    let status = ''
    if (isNew) {
      const creatorsOk = plan.creatorsLimit === exp.creators
      const campaignsOk = plan.campaignsLimit === exp.campaigns
      
      if (creatorsOk && campaignsOk) {
        status = '✅'
      } else {
        status = '❌'
        allCorrect = false
        if (!creatorsOk) console.log(`   Expected creators: ${exp.creators}, got: ${plan.creatorsLimit}`)
        if (!campaignsOk) console.log(`   Expected campaigns: ${exp.campaigns}, got: ${plan.campaignsLimit}`)
      }
    }
    
    const priceStr = '$' + (plan.monthlyPrice / 100).toFixed(0)
    const creatorsStr = plan.creatorsLimit === -1 ? 'Unlimited' : plan.creatorsLimit?.toLocaleString()
    const campaignsStr = plan.campaignsLimit === -1 ? 'Unlimited' : plan.campaignsLimit?.toString()
    
    console.log(`| ${plan.planKey.padEnd(12)} | ${priceStr.padStart(9)} | ${creatorsStr?.padStart(10)} | ${campaignsStr?.padStart(10)} | ${status.padStart(6)} |`)
  }
  
  console.log()
  console.log(allCorrect ? '✅ All new plan limits are correct!' : '❌ Some limits are incorrect')
  process.exit(allCorrect ? 0 : 1)
}

main().catch(console.error)
