#!/usr/bin/env node

/**
 * 🔥 COMPLETE TEST USER RESET - JUGAAD EDITION
 * 
 * This script completely wipes ALL data for the test user and resets everything
 * to allow fresh signup testing with the new normalized database structure.
 * 
 * TARGET USER: user_2zRnraoVNDAegfHnci1xUMWybwz (Sanchay's test account)
 * 
 * ⚠️ WARNING: This is DESTRUCTIVE and will delete ALL user data!
 */

const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const TARGET_USER_ID = 'user_2zRnraoVNDAegfHnci1xUMWybwz';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function completeUserReset() {
  log('\n🔥🔥🔥 COMPLETE USER RESET - JUGAAD EDITION 🔥🔥🔥', 'red');
  log('='.repeat(60), 'red');
  log(`🎯 Target User: ${TARGET_USER_ID}`, 'yellow');
  log('⚠️  This will DELETE ALL DATA for this user!', 'red');
  log('📋 Resetting for fresh onboarding test with normalized DB', 'cyan');
  
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    log('\n🔍 Step 1: Finding user in database...', 'blue');
    
    // Check if user exists in old table (user_profiles)
    let oldUser = null;
    try {
      const oldUsers = await sql`
        SELECT * FROM user_profiles WHERE user_id = ${TARGET_USER_ID}
      `;
      oldUser = oldUsers[0];
      if (oldUser) {
        log('✅ Found user in OLD user_profiles table', 'green');
        log(`   Name: ${oldUser.full_name}`, 'cyan');
        log(`   Email: ${oldUser.email}`, 'cyan');
        log(`   Plan: ${oldUser.current_plan}`, 'cyan');
        log(`   Trial: ${oldUser.trial_status}`, 'cyan');
      }
    } catch (e) {
      log('ℹ️  Old user_profiles table not found (expected with normalized DB)', 'yellow');
    }
    
    // Check if user exists in new normalized tables
    const newUsers = await sql`
      SELECT * FROM users WHERE user_id = ${TARGET_USER_ID}
    `;
    const newUser = newUsers[0];
    if (newUser) {
      log('✅ Found user in NEW normalized users table', 'green');
      log(`   Name: ${newUser.full_name}`, 'cyan');
      log(`   Email: ${newUser.email}`, 'cyan');
      log(`   Onboarding: ${newUser.onboarding_step}`, 'cyan');
    } else {
      log('❌ User not found in normalized tables', 'red');
    }

    log('\n🗑️  Step 2: Deleting ALL user data...', 'blue');
    
    // Delete from old structure (if exists)
    if (oldUser) {
      log('🔥 Deleting from user_profiles (old table)...', 'yellow');
      await sql`DELETE FROM user_profiles WHERE user_id = ${TARGET_USER_ID}`;
      log('✅ Deleted from user_profiles', 'green');
    }
    
    // Delete campaigns and related data
    log('🔥 Deleting campaigns and scraping data...', 'yellow');
    await sql`DELETE FROM scraping_results WHERE job_id IN (
      SELECT id FROM scraping_jobs WHERE user_id = ${TARGET_USER_ID}
    )`;
    await sql`DELETE FROM scraping_jobs WHERE user_id = ${TARGET_USER_ID}`;
    await sql`DELETE FROM campaigns WHERE user_id = ${TARGET_USER_ID}`;
    log('✅ Deleted campaigns and scraping data', 'green');
    
    // Delete from new normalized structure (if exists)
    if (newUser) {
      log('🔥 Deleting from normalized tables...', 'yellow');
      
      // Delete child records first (foreign key constraints)
      await sql`DELETE FROM user_subscriptions WHERE user_id = ${newUser.id}`;
      await sql`DELETE FROM user_billing WHERE user_id = ${newUser.id}`;
      await sql`DELETE FROM user_usage WHERE user_id = ${newUser.id}`;
      await sql`DELETE FROM user_system_data WHERE user_id = ${newUser.id}`;
      
      // Delete parent record last
      await sql`DELETE FROM users WHERE id = ${newUser.id}`;
      
      log('✅ Deleted from all normalized tables', 'green');
    }
    
    // Delete any background jobs
    log('🔥 Cleaning up background jobs...', 'yellow');
    await sql`DELETE FROM background_jobs WHERE payload->>'userId' = ${TARGET_USER_ID}`;
    await sql`DELETE FROM events WHERE aggregate_id = ${TARGET_USER_ID}`;
    log('✅ Cleaned up background jobs and events', 'green');

    log('\n🎉 Step 3: Reset complete!', 'blue');
    log('✅ All user data has been completely wiped', 'green');
    log('✅ Ready for fresh signup test', 'green');
    log('✅ New normalized database structure will be used', 'green');
    
    log('\n📋 NEXT STEPS FOR TESTING:', 'magenta');
    log('1. 🌐 Go to your app and sign up fresh', 'cyan');
    log('2. 📝 Complete onboarding (name, business, description)', 'cyan');
    log('3. 💳 Select a plan and go through payment flow', 'cyan');
    log('4. 🔍 Verify billing status updates correctly', 'cyan');
    log('5. 🎯 Test that all features work with new DB structure', 'cyan');
    
    log('\n🔧 WHAT SHOULD WORK NOW:', 'magenta');
    log('✅ Fresh signup will use normalized tables', 'green');
    log('✅ Onboarding flow will save data correctly', 'green');
    log('✅ Stripe webhooks should update billing properly', 'green');
    log('✅ Trial system should work with new structure', 'green');
    
  } catch (error) {
    log('❌ ERROR during reset:', 'red');
    console.error(error);
  } finally {
    await sql.end();
  }
}

// Run the reset
completeUserReset().then(() => {
  log('\n🎉 JUGAAD COMPLETE! Ready for fresh testing! 🎉', 'green');
  process.exit(0);
}).catch(error => {
  log('💥 JUGAAD FAILED!', 'red');
  console.error(error);
  process.exit(1);
});