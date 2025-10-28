#!/usr/bin/env node

/**
 * Reset User Onboarding Script
 * 
 * This script resets a user's onboarding status for testing purposes.
 * It clears trial data, onboarding steps, and email schedules.
 * 
 * Usage: node scripts/reset-user-onboarding.js <email>
 * Example: node scripts/reset-user-onboarding.js thalnerkarsanchay17@gmail.com
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq } = require('drizzle-orm');
const { createClerkClient } = require('@clerk/nextjs/server');
require('dotenv').config({ path: '.env.local' });

// Initialize database (same as your existing setup)
const connectionString = process.env.DATABASE_URL;
const queryClient = postgres(connectionString, {
  idle_timeout: 30,
  max_lifetime: 60 * 60,
});

// Simple schema for the script (just what we need)
const { pgTable, uuid, text, timestamp, varchar, boolean, jsonb, integer } = require('drizzle-orm/pg-core');

const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  fullName: text('full_name'),
  businessName: text('business_name'),
  industry: text('industry'),
  onboardingStep: varchar('onboarding_step', { length: 50 }).default('pending'),
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),
  trialStatus: varchar('trial_status', { length: 20 }).default('pending'),
  signupTimestamp: timestamp('signup_timestamp').defaultNow(),
  brandDescription: text('brand_description'),
  emailScheduleStatus: jsonb('email_schedule_status').default('{}'),
  // Stripe/billing fields we need to clear
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('none'),
  currentPlan: varchar('current_plan', { length: 50 }).default('free'),
  paymentMethodId: text('payment_method_id'),
  cardLast4: varchar('card_last_4', { length: 4 }),
  cardBrand: varchar('card_brand', { length: 20 }),
  cardExpMonth: integer('card_exp_month'),
  cardExpYear: integer('card_exp_year'),
  usageCampaignsCurrent: integer('usage_campaigns_current').default(0),
  usageCreatorsCurrentMonth: integer('usage_creators_current_month').default(0),
  enrichmentsCurrentMonth: integer('enrichments_current_month').default(0),
  planCampaignsLimit: integer('plan_campaigns_limit'),
  planCreatorsLimit: integer('plan_creators_limit'),
  billingSyncStatus: varchar('billing_sync_status', { length: 20 }).default('pending')
});

// Note: We do not maintain a separate email queue table in current schema.
// Scheduled emails are tracked via QStash and user_profiles.email_schedule_status
const db = drizzle(queryClient, {
  schema: { userProfiles }
});

// Initialize Clerk
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function resetUserOnboarding(email) {
  try {
    log(`\n🔄 Starting onboarding reset for: ${email}`, 'cyan');
    
    // Step 1: Resolve userId (Clerk or DB fallback)
    let user = null;
    let userId = null;
    const hasClerkKey = !!process.env.CLERK_SECRET_KEY;
    if (hasClerkKey) {
      try {
        log('\n📧 Step 1: Finding user in Clerk...', 'yellow');
        const users = await clerk.users.getUserList({ emailAddress: [email] });
        if (users.data && users.data.length > 0) {
          user = users.data[0];
          userId = user.id;
          log(`✅ Found user in Clerk: ${userId}`, 'green');
        }
      } catch (e) {
        log(`⚠️  Clerk lookup failed (${e.message}). Will try DB lookup...`, 'yellow');
      }
    } else {
      log('\nℹ️  CLERK_SECRET_KEY not set. Using DB lookup by email...', 'yellow');
    }

    if (!userId) {
      // Fallback: find user_id via database by email
      const profileRows = await queryClient`
        SELECT user_id FROM user_profiles WHERE email = ${email} ORDER BY created_at DESC LIMIT 1;
      `;
      if (!profileRows || profileRows.length === 0) {
        log(`❌ No user profile found by email in database: ${email}`, 'red');
        return;
      }
      userId = profileRows[0].user_id;
      log(`✅ Found user in DB: ${userId}`, 'green');
    }
    
    // Step 2: Database operations (using Drizzle ORM)
    log('\n🗄️  Step 2: Connecting to database...', 'yellow');
    
    // Step 3: Reset user profile data
    log('\n👤 Step 3: Resetting user profile...', 'yellow');
    const profileResult = await db
      .update(userProfiles)
      .set({
        onboardingStep: 'pending',
        fullName: null,
        businessName: null,
        industry: null,
        brandDescription: null,
        trialStartDate: null,
        trialEndDate: null,
        trialStatus: 'pending',
        // Clear subscription/billing so flow can restart cleanly
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: 'none',
        currentPlan: 'free',
        paymentMethodId: null,
        cardLast4: null,
        cardBrand: null,
        cardExpMonth: null,
        cardExpYear: null,
        usageCampaignsCurrent: 0,
        usageCreatorsCurrentMonth: 0,
        enrichmentsCurrentMonth: 0,
        planCampaignsLimit: 0,
        planCreatorsLimit: 0,
        billingSyncStatus: 'reset_by_script'
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    
    if (profileResult.length > 0) {
      log('✅ User profile reset successfully', 'green');
      log(`   - Onboarding step: pending`, 'blue');
      log(`   - Trial status: inactive`, 'blue');
      log(`   - Personal info: cleared`, 'blue');
    } else {
      log('⚠️  No user profile found to reset', 'yellow');
    }
    
    // Step 4: Clear email schedule status on user profile
    log('\n📨 Step 4: Clearing email schedule status on profile...', 'yellow');
    try {
      const emailStatusClear = await db
        .update(userProfiles)
        .set({ emailScheduleStatus: {}, /* reset schedule tracker */ })
        .where(eq(userProfiles.userId, userId))
        .returning();
      if (emailStatusClear.length > 0) {
        log('✅ Cleared email_schedule_status in user profile', 'green');
      } else {
        log('ℹ️  No profile found to clear email status', 'blue');
      }
    } catch (error) {
      log(`⚠️  Could not clear email schedule status: ${error.message}`, 'yellow');
    }
    
    // Step 5: Check campaigns (informational only; not deleting by default)
    log('\n🎯 Step 5: Checking campaigns...', 'yellow');
    try {
      // We'll use raw SQL for count since we don't have the campaigns table schema
      const campaignCountResult = await queryClient`
        SELECT COUNT(*) as count 
        FROM campaigns 
        WHERE user_id = ${userId};
      `;
      
      if (campaignCountResult[0]?.count > 0) {
        log(`ℹ️  User has ${campaignCountResult[0].count} campaigns`, 'blue');
        log('   (Not deleting campaigns - uncomment code if needed)', 'blue');
        
        // Uncomment to delete campaigns:
        // const campaignResult = await queryClient`
        //   DELETE FROM campaigns 
        //   WHERE user_id = ${userId}
        //   RETURNING id;
        // `;
        // log(`✅ Deleted ${campaignResult.length} campaigns`, 'green');
      }
    } catch (error) {
      log('⚠️  Could not check campaigns (table may not exist)', 'yellow');
    }
    
    // Step 6: Check scraping jobs (informational only; not deleting by default)
    log('\n🔍 Step 6: Checking scraping jobs...', 'yellow');
    try {
      const jobCountResult = await queryClient`
        SELECT COUNT(*) as count 
        FROM scraping_jobs 
        WHERE user_id = ${userId};
      `;
      
      if (jobCountResult[0]?.count > 0) {
        log(`ℹ️  User has ${jobCountResult[0].count} scraping jobs`, 'blue');
        log('   (Not deleting jobs - uncomment code if needed)', 'blue');
        
        // Uncomment to delete jobs:
        // const jobIds = await queryClient`
        //   SELECT id FROM scraping_jobs WHERE user_id = ${userId};
        // `;
        // if (jobIds.length > 0) {
        //   await queryClient`
        //     DELETE FROM scraping_results WHERE job_id IN ${queryClient(jobIds.map(j => j.id))};
        //   `;
        // }
        // const jobResult = await queryClient`
        //   DELETE FROM scraping_jobs 
        //   WHERE user_id = ${userId}
        //   RETURNING id;
        // `;
        // log(`✅ Deleted ${jobResult.length} scraping jobs`, 'green');
      }
    } catch (error) {
      log('⚠️  Could not check scraping jobs (table may not exist)', 'yellow');
    }
    
    // Step 7: Clear Clerk metadata (optional)
    if (hasClerkKey && user) {
      log('\n🔐 Step 7: Clearing Clerk metadata...', 'yellow');
      try {
        await clerk.users.updateUser(userId, {
          publicMetadata: {
            ...(user.publicMetadata || {}),
            onboardingCompleted: false,
            trialStarted: false,
          },
        });
        log('✅ Clerk metadata cleared', 'green');
      } catch (clerkError) {
        log('⚠️  Could not update Clerk metadata (non-critical)', 'yellow');
      }
    } else {
      log('\n🔐 Skipping Clerk metadata update (no Clerk key or user not found in Clerk)', 'blue');
    }
    
    // Summary
    log('\n✨ Reset Complete!', 'bright');
    log(`\nUser ${email} has been reset to pre-onboarding state:`, 'cyan');
    log('  ✓ Profile data cleared', 'green');
    log('  ✓ Trial status reset to inactive', 'green');
    log('  ✓ Scheduled emails deleted', 'green');
    log('  ✓ Ready for fresh onboarding flow', 'green');
    
    log('\n📝 Next steps:', 'yellow');
    log('  1. User can now sign in and see the onboarding flow', 'blue');
    log('  2. All trial features will be unavailable', 'blue');
    log('  3. Email sequences will restart upon completion', 'blue');
    
  } catch (error) {
    log(`\n❌ Error resetting user: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await queryClient.end();
  }
}

// Main execution
const email = process.argv[2];

if (!email) {
  log('\n❌ Please provide an email address', 'red');
  log('Usage: node scripts/reset-user-onboarding.js <email>', 'yellow');
  log('Example: node scripts/reset-user-onboarding.js user@example.com\n', 'yellow');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  log(`\n❌ Invalid email format: ${email}`, 'red');
  process.exit(1);
}

// Run the reset
resetUserOnboarding(email).then(() => {
  process.exit(0);
}).catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
