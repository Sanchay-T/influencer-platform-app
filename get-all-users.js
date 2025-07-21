#!/usr/bin/env node

/**
 * Get ALL Users from Database
 * Complete list of all users with all their data
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function getAllUsers() {
  console.log('👥 GETTING ALL USERS FROM DATABASE');
  console.log('━'.repeat(60));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Get ALL users with ALL columns
    console.log('\n📊 FETCHING ALL USERS...');
    const getAllQuery = `
      SELECT 
        id,
        user_id,
        name,
        company_name,
        industry,
        email,
        full_name,
        business_name,
        brand_description,
        trial_status,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        current_plan,
        created_at,
        updated_at,
        signup_timestamp,
        onboarding_step
      FROM user_profiles 
      ORDER BY created_at DESC;
    `;
    
    const result = await client.query(getAllQuery);
    
    console.log(`\n🎯 FOUND ${result.rows.length} TOTAL USERS:`);
    console.log('━'.repeat(80));
    
    if (result.rows.length === 0) {
      console.log('❌ NO USERS FOUND IN DATABASE');
      console.log('🤔 This might indicate a connection issue or empty database');
      return;
    }
    
    // Display all users with detailed info
    result.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. USER DETAILS:`);
      console.log(`   📧 Email: ${user.email || 'NO EMAIL'}`);
      console.log(`   🆔 User ID: ${user.user_id}`);
      console.log(`   🆔 DB ID: ${user.id}`);
      console.log(`   👤 Name: ${user.name || user.full_name || 'NO NAME'}`);
      console.log(`   🏢 Company: ${user.company_name || user.business_name || 'NO COMPANY'}`);
      console.log(`   📅 Created: ${user.created_at}`);
      console.log(`   📅 Signup: ${user.signup_timestamp || 'N/A'}`);
      console.log(`   🎯 Plan: ${user.current_plan || 'NO PLAN'}`);
      console.log(`   🧪 Trial: ${user.trial_status || 'NO TRIAL'}`);
      console.log(`   💳 Subscription: ${user.stripe_subscription_id || 'NO SUBSCRIPTION'}`);
      console.log(`   👤 Customer: ${user.stripe_customer_id || 'NO CUSTOMER'}`);
      console.log(`   📝 Status: ${user.subscription_status || 'NO STATUS'}`);
      console.log(`   🚀 Onboarding: ${user.onboarding_step || 'NO STEP'}`);
      console.log(`   🏭 Industry: ${user.industry || 'NO INDUSTRY'}`);
      console.log('   ' + '─'.repeat(60));
    });
    
    // Search specifically for the target email
    console.log('\n🔍 SEARCHING FOR TARGET EMAIL: trysorzproject@gmail.com');
    const targetUser = result.rows.find(user => 
      user.email === 'trysorzproject@gmail.com' ||
      (user.email && user.email.toLowerCase().includes('trysorzproject')) ||
      (user.email && user.email.toLowerCase().includes('sorz'))
    );
    
    if (targetUser) {
      console.log('🎯 FOUND TARGET USER:');
      console.log(`   📧 Email: ${targetUser.email}`);
      console.log(`   🆔 User ID: ${targetUser.user_id}`);
      console.log(`   🆔 DB ID: ${targetUser.id}`);
      console.log(`   👤 Name: ${targetUser.name || targetUser.full_name}`);
      console.log(`   📅 Created: ${targetUser.created_at}`);
    } else {
      console.log('❌ TARGET EMAIL NOT FOUND IN RESULTS');
    }
    
    // Email analysis
    console.log('\n📧 EMAIL ANALYSIS:');
    const emailCounts = {
      withEmail: result.rows.filter(user => user.email).length,
      withoutEmail: result.rows.filter(user => !user.email).length,
      gmail: result.rows.filter(user => user.email && user.email.includes('@gmail.com')).length,
      unique: new Set(result.rows.map(user => user.email).filter(Boolean)).size
    };
    
    console.log(`   Users with email: ${emailCounts.withEmail}`);
    console.log(`   Users without email: ${emailCounts.withoutEmail}`);
    console.log(`   Gmail accounts: ${emailCounts.gmail}`);
    console.log(`   Unique emails: ${emailCounts.unique}`);
    
    // Show all unique emails
    console.log('\n📧 ALL UNIQUE EMAILS:');
    const uniqueEmails = [...new Set(result.rows.map(user => user.email).filter(Boolean))];
    uniqueEmails.forEach((email, index) => {
      console.log(`   ${index + 1}. ${email}`);
    });
    
    // Show users without emails (these might be Clerk users not fully synced)
    const usersWithoutEmail = result.rows.filter(user => !user.email);
    if (usersWithoutEmail.length > 0) {
      console.log('\n❓ USERS WITHOUT EMAIL (Might be incomplete Clerk sync):');
      usersWithoutEmail.forEach((user, index) => {
        console.log(`   ${index + 1}. User ID: ${user.user_id} | Name: ${user.name || user.full_name || 'NO NAME'} | Created: ${user.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n🎯 SEARCH COMPLETE');
  console.log('If target user not found, they might be:');
  console.log('• In Clerk but not synced to database yet');
  console.log('• Using a different email address');
  console.log('• Not fully registered/onboarded');
}

getAllUsers().catch(console.error);