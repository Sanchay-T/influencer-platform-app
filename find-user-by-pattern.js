#!/usr/bin/env node

/**
 * Find User by Name Pattern
 * Since emails aren't synced, search by name/company patterns
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function findUserByPattern() {
  console.log('🔍 FINDING USER BY NAME/COMPANY PATTERNS');
  console.log('━'.repeat(60));
  console.log('🎯 Looking for patterns that might match "trysorzproject@gmail.com"');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Search patterns that might relate to "trysorzproject"
    const searchPatterns = [
      'trysorz',
      'sorz', 
      'project',
      'sorzproject',
      'trysorzproject'
    ];
    
    console.log('\n🔍 SEARCHING BY NAME/COMPANY PATTERNS:');
    
    for (const pattern of searchPatterns) {
      console.log(`\n📝 Searching for "${pattern}"...`);
      
      const patternQuery = `
        SELECT 
          id, user_id, name, full_name, company_name, business_name, 
          brand_description, current_plan, trial_status, created_at
        FROM user_profiles 
        WHERE 
          LOWER(name) LIKE LOWER('%${pattern}%')
          OR LOWER(full_name) LIKE LOWER('%${pattern}%')
          OR LOWER(company_name) LIKE LOWER('%${pattern}%')
          OR LOWER(business_name) LIKE LOWER('%${pattern}%')
          OR LOWER(brand_description) LIKE LOWER('%${pattern}%')
        ORDER BY created_at DESC;
      `;
      
      const result = await client.query(patternQuery);
      
      if (result.rows.length > 0) {
        console.log(`✅ Found ${result.rows.length} matches for "${pattern}":`);
        result.rows.forEach((user, index) => {
          console.log(`   ${index + 1}. User ID: ${user.user_id}`);
          console.log(`      Name: ${user.name || user.full_name || 'NO NAME'}`);
          console.log(`      Company: ${user.company_name || user.business_name || 'NO COMPANY'}`);
          console.log(`      Plan: ${user.current_plan || 'none'}`);
          console.log(`      Created: ${user.created_at}`);
          console.log(`      Brand: ${user.brand_description || 'none'}`);
          console.log('      ---');
        });
      } else {
        console.log(`❌ No matches for "${pattern}"`);
      }
    }
    
    // Search recent users (maybe they signed up recently)
    console.log('\n📅 RECENT USERS (Last 7 days):');
    const recentQuery = `
      SELECT 
        id, user_id, name, full_name, company_name, business_name, 
        current_plan, trial_status, created_at
      FROM user_profiles 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC;
    `;
    
    const recentResult = await client.query(recentQuery);
    
    if (recentResult.rows.length > 0) {
      console.log(`✅ Found ${recentResult.rows.length} recent users:`);
      recentResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. User ID: ${user.user_id}`);
        console.log(`      Name: ${user.name || user.full_name || 'NO NAME'}`);
        console.log(`      Company: ${user.company_name || user.business_name || 'NO COMPANY'}`);
        console.log(`      Plan: ${user.current_plan || 'none'}`);
        console.log(`      Created: ${user.created_at}`);
        console.log('      ---');
      });
    } else {
      console.log('❌ No recent users found');
    }
    
    // Check Clerk user IDs that look like test accounts
    console.log('\n🧪 CHECKING FOR TEST-LIKE USER IDs:');
    const testQuery = `
      SELECT 
        id, user_id, name, full_name, company_name, business_name, 
        current_plan, trial_status, created_at
      FROM user_profiles 
      WHERE 
        LOWER(name) LIKE '%test%' 
        OR LOWER(name) LIKE '%demo%'
        OR LOWER(name) LIKE '%trial%'
        OR LOWER(company_name) LIKE '%test%'
        OR LOWER(company_name) LIKE '%demo%'
      ORDER BY created_at DESC;
    `;
    
    const testResult = await client.query(testQuery);
    
    if (testResult.rows.length > 0) {
      console.log(`✅ Found ${testResult.rows.length} test-like users:`);
      testResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. User ID: ${user.user_id}`);
        console.log(`      Name: ${user.name || user.full_name || 'NO NAME'}`);
        console.log(`      Company: ${user.company_name || user.business_name || 'NO COMPANY'}`);
        console.log(`      Plan: ${user.current_plan || 'none'}`);
        console.log(`      Created: ${user.created_at}`);
        console.log('      ---');
      });
    } else {
      console.log('❌ No test-like users found');
    }
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. If you recognize any user above, let me know their User ID');
  console.log('2. I can delete them using their User ID instead of email');
  console.log('3. Consider fixing the email sync issue in your Clerk integration');
  console.log('\n💡 IMPORTANT: Your Clerk emails are not syncing to database!');
  console.log('   This is why we can\'t find users by email address.');
}

findUserByPattern().catch(console.error);