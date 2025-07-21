#!/usr/bin/env node

/**
 * Search for Users in Database
 * Find users by email patterns
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function searchUsers() {
  console.log('🔍 SEARCHING FOR USERS IN DATABASE');
  console.log('━'.repeat(50));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Search 1: Exact email
    console.log('\n1️⃣  SEARCHING FOR EXACT EMAIL: trysorzproject@gmail.com');
    const exactQuery = `
      SELECT user_id, email, name, full_name, created_at 
      FROM user_profiles 
      WHERE email = 'trysorzproject@gmail.com';
    `;
    const exactResult = await client.query(exactQuery);
    
    if (exactResult.rows.length > 0) {
      console.log('✅ Found exact match:');
      exactResult.rows.forEach(row => {
        console.log(`   ${row.email} (${row.user_id}) - ${row.name || row.full_name || 'No name'}`);
      });
    } else {
      console.log('❌ No exact match found');
    }
    
    // Search 2: Similar emails with "sorz"
    console.log('\n2️⃣  SEARCHING FOR EMAILS CONTAINING "sorz":');
    const sorzQuery = `
      SELECT user_id, email, name, full_name, created_at 
      FROM user_profiles 
      WHERE email ILIKE '%sorz%'
      ORDER BY created_at DESC;
    `;
    const sorzResult = await client.query(sorzQuery);
    
    if (sorzResult.rows.length > 0) {
      console.log(`✅ Found ${sorzResult.rows.length} emails with "sorz":`);
      sorzResult.rows.forEach(row => {
        console.log(`   ${row.email} (${row.user_id}) - ${row.name || row.full_name || 'No name'}`);
      });
    } else {
      console.log('❌ No emails containing "sorz" found');
    }
    
    // Search 3: Similar emails with "trysorz"
    console.log('\n3️⃣  SEARCHING FOR EMAILS CONTAINING "trysorz":');
    const trysorzQuery = `
      SELECT user_id, email, name, full_name, created_at 
      FROM user_profiles 
      WHERE email ILIKE '%trysorz%'
      ORDER BY created_at DESC;
    `;
    const trysorzResult = await client.query(trysorzQuery);
    
    if (trysorzResult.rows.length > 0) {
      console.log(`✅ Found ${trysorzResult.rows.length} emails with "trysorz":`);
      trysorzResult.rows.forEach(row => {
        console.log(`   ${row.email} (${row.user_id}) - ${row.name || row.full_name || 'No name'}`);
      });
    } else {
      console.log('❌ No emails containing "trysorz" found');
    }
    
    // Search 4: All gmail accounts (to see if there's a typo)
    console.log('\n4️⃣  SEARCHING FOR RECENT GMAIL ACCOUNTS:');
    const gmailQuery = `
      SELECT user_id, email, name, full_name, created_at 
      FROM user_profiles 
      WHERE email ILIKE '%@gmail.com'
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    const gmailResult = await client.query(gmailQuery);
    
    if (gmailResult.rows.length > 0) {
      console.log(`✅ Found ${gmailResult.rows.length} recent Gmail accounts:`);
      gmailResult.rows.forEach(row => {
        console.log(`   ${row.email} (${row.user_id}) - ${row.name || row.full_name || 'No name'} - ${row.created_at.toISOString().split('T')[0]}`);
      });
    } else {
      console.log('❌ No Gmail accounts found');
    }
    
    // Search 5: Count total users
    console.log('\n5️⃣  TOTAL USER COUNT:');
    const countQuery = `SELECT COUNT(*) as total FROM user_profiles;`;
    const countResult = await client.query(countQuery);
    console.log(`📊 Total users in database: ${countResult.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n💡 SUGGESTIONS:');
  console.log('• Check if the email has a typo');
  console.log('• User might have used a different email to sign up');
  console.log('• User might have already been deleted');
  console.log('• User might exist in Clerk but not in your database yet');
}

searchUsers().catch(console.error);