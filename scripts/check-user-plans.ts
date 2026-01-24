#!/usr/bin/env tsx
/**
 * Check users with new pricing plans
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../lib/db'
import { users, userSubscriptions, userUsage } from '../lib/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'

async function main() {
  console.log('Checking Users with New Plans...\n')
  
  // Find users with new plans
  const usersWithNewPlans = await db
    .select({
      email: users.email,
      currentPlan: userSubscriptions.currentPlan,
      subscriptionStatus: userSubscriptions.subscriptionStatus,
      trialEndDate: userSubscriptions.trialEndDate,
      planCreatorsLimit: userUsage.planCreatorsLimit,
      planCampaignsLimit: userUsage.planCampaignsLimit,
    })
    .from(users)
    .innerJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
    .leftJoin(userUsage, eq(users.id, userUsage.userId))
    .where(inArray(userSubscriptions.currentPlan, ['growth', 'scale', 'pro']))
  
  if (usersWithNewPlans.length === 0) {
    console.log('No users found with new pricing plans (growth/scale/pro).')
    console.log('This is expected if no test checkouts have been completed yet.')
    process.exit(0)
  }
  
  console.log(`Found ${usersWithNewPlans.length} users with new plans:\n`)
  
  for (const user of usersWithNewPlans) {
    console.log(`Email: ${user.email}`)
    console.log(`  Plan: ${user.currentPlan}`)
    console.log(`  Status: ${user.subscriptionStatus}`)
    console.log(`  Trial Ends: ${user.trialEndDate ? new Date(user.trialEndDate).toISOString() : 'N/A'}`)
    console.log(`  Plan Limits: ${user.planCreatorsLimit?.toLocaleString()} creators, ${user.planCampaignsLimit} campaigns`)
    console.log()
  }
  
  process.exit(0)
}

main().catch(console.error)
