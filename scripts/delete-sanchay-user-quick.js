#!/usr/bin/env node

/**
 * 🔥 QUICK USER DELETE - Get rid of Sanchay's test data fast!
 */

const postgres = require('postgres');
require('dotenv').config({ path: '.env.development' });

const TARGET_USER_ID = 'user_2zRnraoVNDAegfHnci1xUMWybwz';

async function deleteEverything() {
  console.log('🔥 DELETING ALL DATA FOR:', TARGET_USER_ID);
  
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🗑️ Step 1: Delete from old user_profiles table (if exists)...');
    try {
      await sql`DELETE FROM user_profiles WHERE user_id = ${TARGET_USER_ID}`;
      console.log('✅ Deleted from user_profiles');
    } catch (e) {
      console.log('ℹ️ user_profiles table not found (expected)');
    }
    
    console.log('🗑️ Step 2: Delete campaigns and scraping data...');
    await sql`DELETE FROM scraping_results WHERE job_id IN (
      SELECT id FROM scraping_jobs WHERE user_id = ${TARGET_USER_ID}
    )`;
    await sql`DELETE FROM scraping_jobs WHERE user_id = ${TARGET_USER_ID}`;
    await sql`DELETE FROM campaigns WHERE user_id = ${TARGET_USER_ID}`;
    console.log('✅ Deleted campaigns and scraping data');
    
    console.log('🗑️ Step 3: Find user in normalized tables...');
    const users = await sql`SELECT * FROM users WHERE user_id = ${TARGET_USER_ID}`;
    
    if (users.length > 0) {
      const user = users[0];
      console.log('✅ Found user:', user.full_name, user.email);
      
      console.log('🗑️ Step 4: Delete from all normalized tables...');
      await sql`DELETE FROM user_subscriptions WHERE user_id = ${user.id}`;
      await sql`DELETE FROM user_billing WHERE user_id = ${user.id}`;
      await sql`DELETE FROM user_usage WHERE user_id = ${user.id}`;
      await sql`DELETE FROM user_system_data WHERE user_id = ${user.id}`;
      await sql`DELETE FROM users WHERE id = ${user.id}`;
      
      console.log('✅ Deleted from all normalized tables');
    } else {
      console.log('ℹ️ User not found in normalized tables');
    }
    
    console.log('🗑️ Step 5: Clean up background jobs and events...');
    await sql`DELETE FROM background_jobs WHERE payload->>'userId' = ${TARGET_USER_ID}`;
    await sql`DELETE FROM events WHERE aggregate_id = ${TARGET_USER_ID}`;
    console.log('✅ Cleaned up background data');
    
    console.log('\n🎉 COMPLETE! User data totally wiped!');
    console.log('🚀 Ready for fresh signup test!');
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
  } finally {
    await sql.end();
  }
}

deleteEverything();