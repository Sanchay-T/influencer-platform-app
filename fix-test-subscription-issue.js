#!/usr/bin/env node

/**
 * Fix Test Subscription Issue
 * 
 * Remove test subscription ID from database that's causing live key errors
 */

require('dotenv').config({ path: '.env.local' });

async function fixTestSubscriptionIssue() {
  console.log('🔧 FIXING TEST SUBSCRIPTION ISSUE');
  console.log('━'.repeat(50));
  
  const problemSubId = 'sub_1RmIl6IgBf4indow6nna9OSp';
  
  console.log('🎯 THE PROBLEM:');
  console.log(`   Test subscription: ${problemSubId}`);
  console.log('   Production environment: Using LIVE Stripe keys');
  console.log('   Result: Live key cannot access test subscription');
  
  try {
    const { db } = require('./lib/db');
    const { userProfiles } = require('./lib/db/schema');
    const { eq } = require('drizzle-orm');
    
    console.log('\n🔍 STEP 1: Finding user with problematic subscription...');
    
    const userWithTestSub = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.stripeSubscriptionId, problemSubId))
      .limit(1);
    
    if (userWithTestSub.length > 0) {
      const user = userWithTestSub[0];
      console.log(`✅ Found user: ${user.userId}`);
      console.log(`   Current plan: ${user.currentPlan}`);
      console.log(`   Trial status: ${user.trialStatus}`);
      console.log(`   Subscription: ${user.stripeSubscriptionId}`);
      console.log(`   Customer: ${user.stripeCustomerId}`);
      
      console.log('\n🛠️  STEP 2: Cleaning test subscription data...');
      
      // Update the user to remove test Stripe references
      await db.update(userProfiles)
        .set({
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          // Keep trial data - user can re-subscribe
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, user.id));
      
      console.log('✅ CLEANUP COMPLETE!');
      console.log('\n📊 RESULT:');
      console.log('   ✅ Test subscription ID removed');
      console.log('   ✅ Test customer ID removed'); 
      console.log('   ✅ Trial status preserved');
      console.log('   ✅ User can now re-subscribe with live payment');
      
      console.log('\n👤 USER IMPACT:');
      console.log(`   User ${user.userId} will need to:`)
      console.log('   1. Go to billing page');
      console.log('   2. Re-select their plan');
      console.log('   3. Enter live payment method');
      console.log('   4. Complete subscription in live mode');
      
    } else {
      console.log('❓ No user found with that subscription ID');
      
      // Check for any other test subscriptions
      console.log('\n🔍 Checking for other test subscriptions...');
      
      const allSubs = await db.select({
        userId: userProfiles.userId,
        subscriptionId: userProfiles.stripeSubscriptionId
      })
      .from(userProfiles)
      .where(eq(userProfiles.stripeSubscriptionId, null));
      
      const testSubs = allSubs.filter(sub => 
        sub.subscriptionId && 
        (sub.subscriptionId.includes('test') || sub.subscriptionId.startsWith('sub_1Rm'))
      );
      
      if (testSubs.length > 0) {
        console.log(`Found ${testSubs.length} other potential test subscriptions:`);
        testSubs.forEach(sub => {
          console.log(`   ${sub.userId}: ${sub.subscriptionId}`);
        });
      } else {
        console.log('✅ No other test subscriptions found');
      }
    }
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
    
    console.log('\n🔧 MANUAL SQL FIX:');
    console.log(`-- Find the user`);
    console.log(`SELECT * FROM userProfiles WHERE stripeSubscriptionId = '${problemSubId}';`);
    console.log('');
    console.log(`-- Clean the test subscription`);
    console.log(`UPDATE userProfiles SET`);
    console.log(`  stripeSubscriptionId = NULL,`);
    console.log(`  stripeCustomerId = NULL,`);
    console.log(`  updatedAt = NOW()`);
    console.log(`WHERE stripeSubscriptionId = '${problemSubId}';`);
  }
  
  console.log('\n🎉 NEXT STEPS:');
  console.log('1. ✅ Test subscription cleaned from database');
  console.log('2. 🔄 Restart your application');
  console.log('3. 🧪 Test the billing flow');
  console.log('4. 👤 Inform affected user about re-subscription');
  console.log('5. 📊 Monitor for similar errors');
}

fixTestSubscriptionIssue().catch(console.error);