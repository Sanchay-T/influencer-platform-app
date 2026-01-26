#!/usr/bin/env tsx
/**
 * Verify Stripe Price IDs match database
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../lib/db'
import { subscriptionPlans } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  console.log('Verifying Price IDs...\n')
  
  // Expected price IDs from the plan
  const expected = {
    growth: {
      monthly: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_GROWTH_YEARLY_PRICE_ID,
    },
    scale: {
      monthly: process.env.STRIPE_SCALE_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_SCALE_YEARLY_PRICE_ID,
    },
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
  }
  
  const plans = ['growth', 'scale', 'pro'] as const
  let allMatch = true
  
  for (const planKey of plans) {
    const [dbPlan] = await db.select({
      monthlyPriceId: subscriptionPlans.stripeMonthlyPriceId,
      yearlyPriceId: subscriptionPlans.stripeYearlyPriceId,
    }).from(subscriptionPlans).where(eq(subscriptionPlans.planKey, planKey))
    
    if (!dbPlan) {
      console.log(`❌ ${planKey}: Not found in database`)
      allMatch = false
      continue
    }
    
    const monthlyMatch = dbPlan.monthlyPriceId === expected[planKey].monthly
    const yearlyMatch = dbPlan.yearlyPriceId === expected[planKey].yearly
    
    if (monthlyMatch && yearlyMatch) {
      console.log(`✅ ${planKey}: Price IDs match`)
      console.log(`   Monthly: ${dbPlan.monthlyPriceId?.substring(0, 30)}...`)
      console.log(`   Yearly:  ${dbPlan.yearlyPriceId?.substring(0, 30)}...`)
    } else {
      console.log(`❌ ${planKey}: Price ID mismatch!`)
      if (!monthlyMatch) {
        console.log(`   Monthly: DB=${dbPlan.monthlyPriceId}, ENV=${expected[planKey].monthly}`)
      }
      if (!yearlyMatch) {
        console.log(`   Yearly: DB=${dbPlan.yearlyPriceId}, ENV=${expected[planKey].yearly}`)
      }
      allMatch = false
    }
    console.log()
  }
  
  console.log(allMatch ? '✅ All price IDs verified!' : '❌ Some price IDs do not match')
  process.exit(allMatch ? 0 : 1)
}

main().catch(console.error)
