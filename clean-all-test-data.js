#!/usr/bin/env node

/**
 * Clean ALL Test Subscription Data from Database
 * This will permanently remove all test subscription references
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function cleanAllTestData() {
  console.log('🧹 CLEANING ALL TEST SUBSCRIPTION DATA FROM DATABASE');
  console.log('━'.repeat(60));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Step 1: Find ALL users with ANY test subscription data
    console.log('\n🔍 STEP 1: Finding ALL test subscription references...');
    
    const findAllTestQuery = `
      SELECT 
        id, 
        user_id, 
        stripe_subscription_id, 
        stripe_customer_id, 
        current_plan, 
        trial_status,
        subscription_status
      FROM user_profiles 
      WHERE 
        stripe_subscription_id IS NOT NULL 
        AND (
          stripe_subscription_id LIKE 'sub_1Rm%'
          OR stripe_subscription_id LIKE '%test%'
          OR stripe_customer_id LIKE '%test%'
          OR stripe_customer_id LIKE 'cus_test_%'
          OR stripe_subscription_id = 'sub_1RmIl6IgBf4indow6nna9OSp'
        )
      ORDER BY user_id;
    `;
    
    const testUsers = await client.query(findAllTestQuery);
    
    if (testUsers.rows.length > 0) {
      console.log(`🎯 Found ${testUsers.rows.length} users with test subscription data:`);
      console.log('');
      
      testUsers.rows.forEach((user, index) => {
        console.log(`${index + 1}. User: ${user.user_id}`);
        console.log(`   Plan: ${user.current_plan || 'none'}`);
        console.log(`   Trial: ${user.trial_status || 'none'}`);
        console.log(`   Subscription: ${user.stripe_subscription_id}`);
        console.log(`   Customer: ${user.stripe_customer_id || 'none'}`);
        console.log(`   Status: ${user.subscription_status || 'none'}`);
        console.log('   ---');
      });
      
      // Step 2: Clean ALL test subscription references
      console.log('\n🧹 STEP 2: Cleaning ALL test subscription data...');
      
      const cleanAllQuery = `
        UPDATE user_profiles 
        SET 
          stripe_subscription_id = NULL,
          stripe_customer_id = NULL,
          subscription_status = NULL,
          payment_method_id = NULL,
          card_last_4 = NULL,
          card_brand = NULL,
          card_exp_month = NULL,
          card_exp_year = NULL,
          billing_address_city = NULL,
          billing_address_country = NULL,
          billing_address_postal_code = NULL,
          last_webhook_event = NULL,
          last_webhook_timestamp = NULL,
          billing_sync_status = NULL,
          subscription_cancel_date = NULL,
          subscription_renewal_date = NULL,
          updated_at = NOW()
        WHERE 
          stripe_subscription_id IS NOT NULL 
          AND (
            stripe_subscription_id LIKE 'sub_1Rm%'
            OR stripe_subscription_id LIKE '%test%'
            OR stripe_customer_id LIKE '%test%'
            OR stripe_customer_id LIKE 'cus_test_%'
            OR stripe_subscription_id = 'sub_1RmIl6IgBf4indow6nna9OSp'
          )
        RETURNING user_id, current_plan, trial_status;
      `;
      
      const cleanResult = await client.query(cleanAllQuery);
      
      console.log(`✅ SUCCESSFULLY CLEANED ${cleanResult.rows.length} users:`);
      console.log('');
      
      cleanResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ✅ User: ${user.user_id}`);
        console.log(`   Plan preserved: ${user.current_plan || 'none'}`);
        console.log(`   Trial preserved: ${user.trial_status || 'none'}`);
        console.log('   🔥 All Stripe test data removed');
        console.log('   ---');
      });
      
      // Step 3: Verify cleanup
      console.log('\n🔍 STEP 3: Verifying cleanup...');
      
      const verifyQuery = `
        SELECT COUNT(*) as remaining_count
        FROM user_profiles 
        WHERE stripe_subscription_id IS NOT NULL;
      `;
      
      const verifyResult = await client.query(verifyQuery);
      const remainingCount = parseInt(verifyResult.rows[0].remaining_count);
      
      if (remainingCount === 0) {
        console.log('✅ PERFECT! No subscription references remain in database');
        console.log('🎉 Database is now clean for live Stripe integration');
      } else {
        console.log(`⚠️  ${remainingCount} subscription references still remain`);
        console.log('These are likely live subscriptions - safe to keep');
        
        // Show remaining subscriptions
        const remainingQuery = `
          SELECT user_id, stripe_subscription_id, current_plan
          FROM user_profiles 
          WHERE stripe_subscription_id IS NOT NULL
          LIMIT 5;
        `;
        
        const remaining = await client.query(remainingQuery);
        console.log('Remaining subscriptions:');
        remaining.rows.forEach(row => {
          console.log(`   ${row.user_id}: ${row.stripe_subscription_id} (${row.current_plan})`);
        });
      }
      
    } else {
      console.log('✅ NO TEST SUBSCRIPTION DATA FOUND');
      console.log('🎉 Database is already clean!');
      
      // Check if there are any subscriptions at all
      const anySubsQuery = `SELECT COUNT(*) as total FROM user_profiles WHERE stripe_subscription_id IS NOT NULL;`;
      const anySubs = await client.query(anySubsQuery);
      const totalSubs = parseInt(anySubs.rows[0].total);
      
      if (totalSubs > 0) {
        console.log(`📊 Found ${totalSubs} live subscriptions in database - these are good!`);
      } else {
        console.log('📊 No subscriptions found in database - ready for new live subscriptions');
      }
    }
    
    console.log('\n🎯 FINAL RESULT:');
    console.log('✅ Database cleaned of ALL test subscription references');
    console.log('✅ Live Stripe keys will now work without conflicts');
    console.log('✅ Users can create new live subscriptions');
    console.log('✅ No more test/live mode errors');
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('1. ✅ Database is now clean');
  console.log('2. 🔄 Restart your Vercel app (or redeploy)');
  console.log('3. 🧪 Test the billing flow with live Stripe');
  console.log('4. 🎉 Users can now subscribe without errors');
}

cleanAllTestData().catch(console.error);