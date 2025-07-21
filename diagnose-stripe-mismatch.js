#!/usr/bin/env node

/**
 * Diagnose Stripe Test/Live Mode Mismatch
 * 
 * This script helps identify what's causing the test/live mode conflict
 */

require('dotenv').config({ path: '.env.local' });

async function diagnoseStripeMismatch() {
  console.log('🔍 STRIPE TEST/LIVE MODE MISMATCH DIAGNOSIS');
  console.log('━'.repeat(60));
  
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  
  console.log('🔑 CURRENT CONFIGURATION:');
  console.log(`   Secret Key: ${secretKey.substring(0, 20)}...`);
  console.log(`   Mode: ${secretKey.startsWith('sk_test_') ? '🧪 TEST' : '🔴 LIVE'}`);
  console.log(`   Publishable: ${publishableKey.substring(0, 20)}...`);
  
  // Analyze the problematic subscription
  const problemSubId = 'sub_1RmIl6IgBf4indow6nna9OSp';
  console.log('\n🎫 PROBLEMATIC SUBSCRIPTION:');
  console.log(`   ID: ${problemSubId}`);
  console.log('   💡 This subscription was created in TEST mode');
  console.log('   ❌ Error: Trying to access with LIVE keys');
  
  console.log('\n🔍 POSSIBLE CAUSES:');
  console.log('1. 📊 Database has test subscription IDs but live Stripe keys');
  console.log('2. 🔄 User created subscription in test, now system is live');
  console.log('3. 🌍 Environment variables mixed between test/live');
  console.log('4. 👤 User account has both test and live subscriptions');
  
  // Check if we can connect to Stripe
  try {
    const stripe = require('stripe')(secretKey);
    
    console.log('\n🔗 STRIPE CONNECTION TEST:');
    const customers = await stripe.customers.list({ limit: 1 });
    console.log(`   ✅ Connected to Stripe ${secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE'} mode`);
    
    // Try to find the subscription
    try {
      await stripe.subscriptions.retrieve(problemSubId);
      console.log(`   ✅ Subscription ${problemSubId} found in current mode`);
    } catch (subError) {
      if (subError.code === 'resource_missing') {
        console.log(`   ❌ Subscription ${problemSubId} NOT found in current mode`);
        console.log('   💡 Confirms: subscription is in the OTHER mode');
      }
    }
    
  } catch (error) {
    console.log('\n❌ STRIPE CONNECTION FAILED:', error.message);
  }
  
  console.log('\n🛠️  RECOMMENDED SOLUTIONS:');
  console.log('');
  console.log('🎯 OPTION 1: Clean Database (RECOMMENDED for production)');
  console.log('   • Remove all test subscription references from database');
  console.log('   • Force users to recreate subscriptions in live mode');
  console.log('   • Clean slate for production launch');
  console.log('');
  console.log('🎯 OPTION 2: Environment-Specific Handling');
  console.log('   • Keep test keys for development environment');
  console.log('   • Use live keys only for production');
  console.log('   • Add environment detection in code');
  console.log('');
  console.log('🎯 OPTION 3: Data Migration');
  console.log('   • Create equivalent live subscriptions for test users');
  console.log('   • Update database with new live subscription IDs');
  console.log('   • Preserve user trial states');
}

// Check database for test subscription references
function checkDatabaseReferences() {
  console.log('\n📊 DATABASE CLEANUP NEEDED:');
  console.log('━'.repeat(60));
  console.log('Look for these test subscription patterns in your database:');
  console.log('   • sub_1Rm... (test subscription IDs)');
  console.log('   • cus_... created in test mode');
  console.log('   • price_1Rl... (test price IDs)');
  console.log('');
  console.log('🔍 SQL to find test subscriptions:');
  console.log('   SELECT * FROM userProfiles WHERE stripeSubscriptionId LIKE \'sub_1Rm%\';');
  console.log('   SELECT * FROM userProfiles WHERE stripeCustomerId LIKE \'cus_%\';');
  console.log('');
  console.log('🧹 Cleanup options:');
  console.log('   UPDATE userProfiles SET stripeSubscriptionId = NULL WHERE stripeSubscriptionId LIKE \'sub_1Rm%\';');
  console.log('   UPDATE userProfiles SET stripeCustomerId = NULL WHERE stripeCustomerId LIKE \'cus_%\';');
}

diagnoseStripeMismatch().then(() => {
  checkDatabaseReferences();
}).catch(console.error);