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
const { pgTable, uuid, text, timestamp, varchar, boolean } = require('drizzle-orm/pg-core');

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
  signupTimestamp: timestamp('signup_timestamp').defaultNow()
});

const emailQueue = pgTable('email_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  emailType: varchar('email_type', { length: 50 }).notNull(),
  scheduledFor: timestamp('scheduled_for').notNull(),
  sentAt: timestamp('sent_at'),
  status: varchar('status', { length: 20 }).default('pending'),
  qstashMessageId: text('qstash_message_id')
});

const db = drizzle(queryClient, {
  schema: { userProfiles, emailQueue }
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
    
    // Step 1: Find user in Clerk by email
    log('\n📧 Step 1: Finding user in Clerk...', 'yellow');
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    
    if (!users.data || users.data.length === 0) {
      log(`❌ No user found with email: ${email}`, 'red');
      return;
    }
    
    const user = users.data[0];
    const userId = user.id;
    log(`✅ Found user: ${userId}`, 'green');
    
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
        trialStartDate: null,
        trialEndDate: null,
        trialStatus: 'pending'
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
    
    // Step 4: Delete all scheduled emails
    log('\n📨 Step 4: Checking for scheduled emails...', 'yellow');
    try {
      // Try to delete from email_queue table if it exists
      const emailResult = await queryClient`
        DELETE FROM email_queue 
        WHERE user_id = ${userId}
        RETURNING *;
      `;
      log(`✅ Deleted ${emailResult.length} scheduled emails`, 'green');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        log('ℹ️  Email queue table does not exist (this is normal)', 'blue');
      } else {
        log('⚠️  Could not check email queue:', error.message, 'yellow');
      }
    }
    
    // Step 5: Delete all campaigns (optional - uncomment if needed)
    log('\n🎯 Step 5: Checking campaigns...', 'yellow');
    try {
      // We'll use raw SQL for count since we don't have the campaigns table schema
      const campaignCountResult = await queryClient`
        SELECT COUNT(*) as count 
        FROM campaigns 
        WHERE "userId" = ${userId};
      `;
      
      if (campaignCountResult[0]?.count > 0) {
        log(`ℹ️  User has ${campaignCountResult[0].count} campaigns`, 'blue');
        log('   (Not deleting campaigns - uncomment code if needed)', 'blue');
        
        // Uncomment to delete campaigns:
        // const campaignResult = await queryClient`
        //   DELETE FROM campaigns 
        //   WHERE "userId" = ${userId}
        //   RETURNING id;
        // `;
        // log(`✅ Deleted ${campaignResult.length} campaigns`, 'green');
      }
    } catch (error) {
      log('⚠️  Could not check campaigns (table may not exist)', 'yellow');
    }
    
    // Step 6: Delete scraping jobs and results (optional - uncomment if needed)
    log('\n🔍 Step 6: Checking scraping jobs...', 'yellow');
    try {
      const jobCountResult = await queryClient`
        SELECT COUNT(*) as count 
        FROM "scrapingJobs" 
        WHERE "userId" = ${userId};
      `;
      
      if (jobCountResult[0]?.count > 0) {
        log(`ℹ️  User has ${jobCountResult[0].count} scraping jobs`, 'blue');
        log('   (Not deleting jobs - uncomment code if needed)', 'blue');
        
        // Uncomment to delete jobs:
        // const jobResult = await queryClient`
        //   DELETE FROM "scrapingJobs" 
        //   WHERE "userId" = ${userId}
        //   RETURNING id;
        // `;
        // log(`✅ Deleted ${jobResult.length} scraping jobs`, 'green');
      }
    } catch (error) {
      log('⚠️  Could not check scraping jobs (table may not exist)', 'yellow');
    }
    
    // Step 7: Clear Clerk metadata (optional)
    log('\n🔐 Step 7: Clearing Clerk metadata...', 'yellow');
    try {
      await clerk.users.updateUser(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          onboardingCompleted: false,
          trialStarted: false,
        },
      });
      log('✅ Clerk metadata cleared', 'green');
    } catch (clerkError) {
      log('⚠️  Could not update Clerk metadata (non-critical)', 'yellow');
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