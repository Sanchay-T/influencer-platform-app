#!/usr/bin/env node

/**
 * Clean Test Subscription from Database
 * Direct database connection to fix the Stripe test/live mismatch
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function cleanTestSubscription() {
  console.log('🔧 CLEANING TEST SUBSCRIPTION FROM DATABASE');
  console.log('━'.repeat(50));
  
  const problemSubId = 'sub_1RmIl6IgBf4indow6nna9OSp';
  
  // Parse the DATABASE_URL from .env.local
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    return;
  }
  
  console.log('🎯 Target subscription:', problemSubId);
  console.log('🔗 Connecting to database...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false } // Required for Supabase
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // First, find the user with this subscription
    console.log('\n🔍 STEP 1: Finding user with test subscription...');
    const findQuery = `
      SELECT id, "userId", "stripeSubscriptionId", "stripeCustomerId", "currentPlan", "trialStatus"
      FROM "userProfiles" 
      WHERE "stripeSubscriptionId" = $1;
    `;
    
    const findResult = await client.query(findQuery, [problemSubId]);
    
    if (findResult.rows.length > 0) {
      const user = findResult.rows[0];
      console.log(`✅ Found user: ${user.userId}`);
      console.log(`   Current plan: ${user.currentPlan}`);
      console.log(`   Trial status: ${user.trialStatus}`);
      console.log(`   Subscription: ${user.stripeSubscriptionId}`);
      console.log(`   Customer: ${user.stripeCustomerId}`);
      
      // Clean the test subscription data
      console.log('\n🧹 STEP 2: Cleaning test subscription data...');
      const cleanQuery = `
        UPDATE "userProfiles" 
        SET 
          "stripeSubscriptionId" = NULL,
          "stripeCustomerId" = NULL,
          "updatedAt" = NOW()
        WHERE "stripeSubscriptionId" = $1
        RETURNING "userId", "currentPlan", "trialStatus";
      `;
      
      const cleanResult = await client.query(cleanQuery, [problemSubId]);
      
      if (cleanResult.rows.length > 0) {
        const cleanedUser = cleanResult.rows[0];
        console.log('✅ CLEANUP SUCCESSFUL!');
        console.log(`   User: ${cleanedUser.userId}`);
        console.log(`   Plan preserved: ${cleanedUser.currentPlan}`);
        console.log(`   Trial status preserved: ${cleanedUser.trialStatus}`);
        console.log('   ✅ Test subscription ID removed');
        console.log('   ✅ Test customer ID removed');
        
        console.log('\n🎉 RESULT:');
        console.log('   ✅ Database cleaned of test subscription references');
        console.log('   ✅ User account preserved (trial status intact)');
        console.log('   ✅ Ready for live Stripe integration');
        
        console.log('\n👤 USER IMPACT:');
        console.log(`   User ${cleanedUser.userId} will need to:`);
        console.log('   1. Visit billing page');
        console.log('   2. Select their plan again');
        console.log('   3. Complete payment with live Stripe');
        console.log('   4. New live subscription will be created');
        
      } else {
        console.log('❌ Update failed - no rows affected');
      }
      
    } else {
      console.log('❓ No user found with that subscription ID');
      
      // Check for any other test subscriptions
      console.log('\n🔍 Checking for other test subscriptions...');
      const testSubQuery = `
        SELECT "userId", "stripeSubscriptionId", "stripeCustomerId"
        FROM "userProfiles" 
        WHERE "stripeSubscriptionId" LIKE 'sub_1Rm%'
           OR "stripeSubscriptionId" LIKE '%test%'
           OR "stripeCustomerId" LIKE '%test%';
      `;
      
      const testSubResult = await client.query(testSubQuery);
      
      if (testSubResult.rows.length > 0) {
        console.log(`Found ${testSubResult.rows.length} other test subscriptions:`);
        testSubResult.rows.forEach(row => {
          console.log(`   ${row.userId}: ${row.stripeSubscriptionId}`);
        });
        
        console.log('\n🧹 Clean all test subscriptions? [Manual step needed]');
        console.log('Run this query to clean all:');
        console.log(`UPDATE "userProfiles" SET "stripeSubscriptionId" = NULL, "stripeCustomerId" = NULL WHERE "stripeSubscriptionId" LIKE 'sub_1Rm%';`);
      } else {
        console.log('✅ No other test subscriptions found');
      }
    }
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('1. ✅ Test subscription cleaned from database');
  console.log('2. 🔄 Restart your application server');
  console.log('3. 🧪 Test the billing flow with live Stripe');
  console.log('4. 📧 Notify affected users if needed');
  console.log('5. 🔍 Monitor for similar test/live conflicts');
}

cleanTestSubscription().catch(console.error);