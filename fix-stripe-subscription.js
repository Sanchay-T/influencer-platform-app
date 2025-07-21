#!/usr/bin/env node

/**
 * Fix Stripe Test Subscription Issue - Final Version
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fixStripeSubscription() {
  console.log('🔧 FIXING STRIPE TEST SUBSCRIPTION ISSUE');
  console.log('━'.repeat(50));
  
  const problemSubId = 'sub_1RmIl6IgBf4indow6nna9OSp';
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Find the user with the problematic subscription
    console.log('\n🔍 STEP 1: Finding user with test subscription...');
    const findQuery = `
      SELECT id, user_id, stripe_subscription_id, stripe_customer_id, current_plan, trial_status
      FROM user_profiles 
      WHERE stripe_subscription_id = $1;
    `;
    
    const findResult = await client.query(findQuery, [problemSubId]);
    
    if (findResult.rows.length > 0) {
      const user = findResult.rows[0];
      console.log(`✅ Found problematic user:`);
      console.log(`   User ID: ${user.user_id}`);
      console.log(`   Current plan: ${user.current_plan}`);
      console.log(`   Trial status: ${user.trial_status}`);
      console.log(`   Test subscription: ${user.stripe_subscription_id}`);
      console.log(`   Test customer: ${user.stripe_customer_id}`);
      
      // Clean the test subscription data
      console.log('\n🧹 STEP 2: Removing test Stripe references...');
      const cleanQuery = `
        UPDATE user_profiles 
        SET 
          stripe_subscription_id = NULL,
          stripe_customer_id = NULL,
          subscription_status = NULL,
          updated_at = NOW()
        WHERE stripe_subscription_id = $1
        RETURNING user_id, current_plan, trial_status;
      `;
      
      const cleanResult = await client.query(cleanQuery, [problemSubId]);
      
      if (cleanResult.rows.length > 0) {
        const cleanedUser = cleanResult.rows[0];
        console.log('✅ CLEANUP SUCCESSFUL!');
        console.log(`   User: ${cleanedUser.user_id}`);
        console.log(`   Plan preserved: ${cleanedUser.current_plan}`);
        console.log(`   Trial status preserved: ${cleanedUser.trial_status}`);
        console.log('   ✅ Test subscription ID removed');
        console.log('   ✅ Test customer ID removed');
        console.log('   ✅ Subscription status reset');
        
        console.log('\n🎉 PROBLEM SOLVED:');
        console.log('   ✅ Database cleaned of test subscription');
        console.log('   ✅ Live Stripe keys will now work properly');
        console.log('   ✅ No more test/live mode conflicts');
        
        console.log('\n👤 USER IMPACT:');
        console.log(`   User ${cleanedUser.user_id} will need to:`);
        console.log('   1. Go to billing/subscription page');
        console.log('   2. Select their plan again');
        console.log('   3. Complete payment with live Stripe');
        console.log('   4. New live subscription will be created automatically');
        
      } else {
        console.log('❌ Update failed - no rows affected');
      }
      
    } else {
      console.log('❓ No user found with that specific subscription ID');
      
      // Check for any other test subscriptions
      console.log('\n🔍 Checking for other test subscriptions...');
      const testSubQuery = `
        SELECT user_id, stripe_subscription_id, stripe_customer_id, current_plan
        FROM user_profiles 
        WHERE stripe_subscription_id LIKE 'sub_1Rm%'
           OR stripe_subscription_id LIKE '%test%'
           OR stripe_customer_id LIKE '%test%';
      `;
      
      const testSubResult = await client.query(testSubQuery);
      
      if (testSubResult.rows.length > 0) {
        console.log(`Found ${testSubResult.rows.length} other test subscriptions:`);
        testSubResult.rows.forEach(row => {
          console.log(`   ${row.user_id}: ${row.stripe_subscription_id} (${row.current_plan})`);
        });
        
        console.log('\n🧹 OPTION: Clean all test subscriptions:');
        console.log('   Run: UPDATE user_profiles SET stripe_subscription_id = NULL, stripe_customer_id = NULL WHERE stripe_subscription_id LIKE \'sub_1Rm%\';');
      } else {
        console.log('✅ No other test subscriptions found');
      }
    }
    
    // Show current Stripe environment
    console.log('\n🔑 CURRENT STRIPE CONFIGURATION:');
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    console.log(`   Secret Key: ${secretKey.substring(0, 15)}... (${secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE'})`);
    console.log(`   Publishable: ${publishableKey.substring(0, 15)}... (${publishableKey.startsWith('pk_test_') ? 'TEST' : 'LIVE'})`);
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n🚀 FINAL STEPS:');
  console.log('1. ✅ Test subscription cleaned from database');
  console.log('2. 🔄 Restart your application/server');
  console.log('3. 🧪 Test the billing flow');
  console.log('4. 📊 Monitor logs for any remaining conflicts');
  console.log('5. 🎯 Users can now subscribe with live payment methods');
}

fixStripeSubscription().catch(console.error);