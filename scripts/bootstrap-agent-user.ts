#!/usr/bin/env npx tsx
// Ensure a normalized DB user exists and upgrade to fame_flex with onboarding completed.
// Uses existing DB helpers. No API or route changes.
//
// Usage:
//   npx tsx scripts/bootstrap-agent-user.ts --user-id <clerkUserId> --email you@example.com
// Options:
//   --plan fame_flex (default)
//   --stripe-sub sub_test_dev (default)

import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import { getUserProfile, createUser, updateUserProfile } from '@/lib/db/queries/user-queries'
import { db } from '@/lib/db'
import { subscriptionPlans } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function parseArgs(argv: string[]) {
  const args: any = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--user-id': args.userId = next; i++; break
      case '--email': args.email = next; i++; break
      case '--plan': args.plan = next; i++; break
      case '--stripe-sub': args.stripeSub = next; i++; break
      case '--help': args.help = true; break
      default: break
    }
  }
  return args
}

function printHelp() {
  console.log(`\nBootstrap agent user to paid plan (no route changes)\n\nUsage:\n  npx tsx scripts/bootstrap-agent-user.ts --user-id <clerkUserId> --email you@example.com [--plan fame_flex] [--stripe-sub sub_test_dev]\n`)
}

async function main() {
  // Load .env.worktree then .env.development, if not already loaded
  try { require('dotenv').config({ path: path.resolve(process.cwd(), '.env.worktree') }) } catch {}
  try { require('dotenv').config({ path: path.resolve(process.cwd(), '.env.development') }) } catch {}

  const args = parseArgs(process.argv)
  if (args.help) return printHelp()

  const userId: string = args.userId || process.env.TEST_USER_ID
  const email: string | undefined = args.email
  const planKey: string = args.plan || 'fame_flex'
  const stripeSub: string = args.stripeSub || 'sub_test_dev'
  if (!userId) throw new Error('--user-id or TEST_USER_ID is required')

  // Ensure user exists
  let profile = await getUserProfile(userId)
  if (!profile) {
    if (!email) throw new Error('User does not exist in DB; provide --email to create profile')
    await createUser({ userId, email, onboardingStep: 'completed', currentPlan: 'free' })
    profile = await getUserProfile(userId)
  }

  // Load plan limits from subscription_plans
  let campaignsLimit = -1
  let creatorsLimit = -1
  let features: any = {}
  try {
    const row = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.planKey, planKey) })
    if (row) {
      campaignsLimit = row.campaignsLimit ?? campaignsLimit
      creatorsLimit = row.creatorsLimit ?? creatorsLimit
      features = row.features ?? {}
    }
  } catch {}

  // Upgrade to paid plan and mark onboarding completed/active subscription
  await updateUserProfile(userId, {
    onboardingStep: 'completed',
    currentPlan: planKey,
    intendedPlan: planKey,
    subscriptionStatus: 'active',
    trialStatus: profile?.trialStatus === 'active' ? 'converted' : profile?.trialStatus || 'converted',
    stripeSubscriptionId: stripeSub,
    planCampaignsLimit: campaignsLimit,
    planCreatorsLimit: creatorsLimit,
    planFeatures: features,
    usageCampaignsCurrent: 0,
    usageCreatorsCurrentMonth: 0,
    billingSyncStatus: 'admin_upgraded',
  })

  const updated = await getUserProfile(userId)
  console.log(JSON.stringify({ success: true, user: updated }, null, 2))
}

main().catch((err) => {
  console.error('bootstrap-agent-user failed:', err)
  process.exit(1)
})

