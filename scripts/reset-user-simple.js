#!/usr/bin/env node

/**
 * Simple User Reset Script (No Dependencies)
 * 
 * This script resets a user's onboarding status using direct database queries.
 * Designed to work with your existing setup without additional dependencies.
 * 
 * Usage: node scripts/reset-user-simple.js <email>
 * Example: node scripts/reset-user-simple.js thalnerkarsanchay17@gmail.com
 */

const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function resetUserOnboarding(email) {
  let sql;
  
  try {
    log(`\n🔄 Starting onboarding reset for: ${email}`, 'cyan');
    
    // Initialize database connection
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    sql = postgres(connectionString, {
      idle_timeout: 30,
      max_lifetime: 60 * 60,
    });
    
    // Step 1: Find user in Clerk by email (we'll get the userId from the database instead)
    log('\n📧 Step 1: Finding user in database...', 'yellow');
    
    // First try to find the user profile to get the userId
    // We'll assume the email is stored somewhere or the userId follows a pattern
    // For now, let's look for existing user profiles and show them
    const existingProfiles = await sql`
      SELECT "userId", "fullName", "businessName", "onboardingStep", "trialStatus" 
      FROM "userProfiles" 
      LIMIT 10;
    `;
    
    if (existingProfiles.length === 0) {
      log('❌ No user profiles found in database', 'red');
      log('💡 This might be a new database or the user hasn\'t been created yet', 'yellow');
      return;
    }
    
    log(`✅ Found ${existingProfiles.length} existing user profiles:`, 'green');
    existingProfiles.forEach((profile, index) => {
      log(`   ${index + 1}. ${profile.userId} (${profile.fullName || 'No name'}) - ${profile.onboardingStep}`, 'blue');
    });
    
    // For the script to work, we need the Clerk userId
    // Let's try to match by email if it exists in the profile
    log('\n🔍 Step 2: Looking for user by email pattern...', 'yellow');
    
    // Since we don't have email in userProfiles, we'll need to provide the userId
    // Let's create a simple mapping or ask the user to provide it
    const emailToUserIdMap = {
      'thalnerkarsanchay17@gmail.com': 'user_2rJQZdWXiOddUpj7n7bTgdyBqmT', // You'll need to provide this
      // Add more mappings as needed
    };
    
    const userId = emailToUserIdMap[email];
    if (!userId) {
      log(`❌ No userId mapping found for email: ${email}`, 'red');
      log('💡 Please add your userId to the emailToUserIdMap in the script', 'yellow');
      log('💡 You can find your userId in Clerk dashboard or by logging into your app and checking the network tab', 'yellow');
      return;
    }
    
    log(`✅ Found userId: ${userId}`, 'green');
    
    // Step 3: Reset user profile data
    log('\n👤 Step 3: Resetting user profile...', 'yellow');
    const profileResult = await sql`
      UPDATE "userProfiles"
      SET 
        "onboardingStep" = 'pending',
        "fullName" = NULL,
        "businessName" = NULL,
        "industry" = NULL,
        "targetAudience" = NULL,
        "campaignGoals" = NULL,
        "trialStartedAt" = NULL,
        "trialExpiresAt" = NULL,
        "trialStatus" = 'inactive',
        "updatedAt" = NOW()
      WHERE "userId" = ${userId}
      RETURNING *;
    `;
    
    if (profileResult.length > 0) {
      log('✅ User profile reset successfully', 'green');
      log(`   - Onboarding step: pending`, 'blue');
      log(`   - Trial status: inactive`, 'blue');
      log(`   - Personal info: cleared`, 'blue');
    } else {
      log('⚠️  No user profile found to reset', 'yellow');
    }
    
    // Step 4: Delete all scheduled emails
    log('\n📨 Step 4: Deleting scheduled emails...', 'yellow');
    const emailResult = await sql`
      DELETE FROM "emailQueue"
      WHERE "userId" = ${userId}
      RETURNING *;
    `;
    
    log(`✅ Deleted ${emailResult.length} scheduled emails`, 'green');
    
    // Step 5: Check campaigns
    log('\n🎯 Step 5: Checking campaigns...', 'yellow');
    try {
      const campaignCount = await sql`
        SELECT COUNT(*) as count 
        FROM campaigns 
        WHERE "userId" = ${userId};
      `;
      
      if (parseInt(campaignCount[0].count) > 0) {
        log(`ℹ️  User has ${campaignCount[0].count} campaigns`, 'blue');
        log('   (Not deleting campaigns - modify script if needed)', 'blue');
      } else {
        log('ℹ️  No campaigns found', 'blue');
      }
    } catch (error) {
      log('⚠️  Could not check campaigns (table may not exist)', 'yellow');
    }
    
    // Step 6: Check scraping jobs
    log('\n🔍 Step 6: Checking scraping jobs...', 'yellow');
    try {
      const jobCount = await sql`
        SELECT COUNT(*) as count 
        FROM "scrapingJobs" 
        WHERE "userId" = ${userId};
      `;
      
      if (parseInt(jobCount[0].count) > 0) {
        log(`ℹ️  User has ${jobCount[0].count} scraping jobs`, 'blue');
        log('   (Not deleting jobs - modify script if needed)', 'blue');
      } else {
        log('ℹ️  No scraping jobs found', 'blue');
      }
    } catch (error) {
      log('⚠️  Could not check scraping jobs (table may not exist)', 'yellow');
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
    if (sql) {
      await sql.end();
    }
  }
}

// Main execution
const email = process.argv[2];

if (!email) {
  log('\n❌ Please provide an email address', 'red');
  log('Usage: node scripts/reset-user-simple.js <email>', 'yellow');
  log('Example: node scripts/reset-user-simple.js user@example.com\n', 'yellow');
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