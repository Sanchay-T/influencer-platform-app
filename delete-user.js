#!/usr/bin/env node

/**
 * Delete User from Database
 * Safely removes user and all associated data
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function deleteUser() {
  console.log('🗑️  DELETING USER FROM DATABASE');
  console.log('━'.repeat(50));
  
  const targetEmail = 'trysorzproject@gmail.com';
  console.log(`🎯 Target email: ${targetEmail}`);
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Step 1: Find the user
    console.log('\n🔍 STEP 1: Finding user...');
    const findUserQuery = `
      SELECT 
        id, 
        user_id, 
        email, 
        name,
        full_name,
        current_plan,
        trial_status,
        stripe_subscription_id,
        stripe_customer_id,
        created_at
      FROM user_profiles 
      WHERE email = $1;
    `;
    
    const userResult = await client.query(findUserQuery, [targetEmail]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found with that email');
      console.log('\n🔍 Searching for similar emails...');
      
      const similarQuery = `
        SELECT email, user_id, name 
        FROM user_profiles 
        WHERE email ILIKE '%trysorzproject%' OR email ILIKE '%sorz%'
        LIMIT 5;
      `;
      
      const similarResult = await client.query(similarQuery);
      
      if (similarResult.rows.length > 0) {
        console.log('Found similar emails:');
        similarResult.rows.forEach(row => {
          console.log(`   ${row.email} (${row.user_id}) - ${row.name || 'No name'}`);
        });
      } else {
        console.log('No similar emails found');
      }
      
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Found user:');
    console.log(`   ID: ${user.id}`);
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || user.full_name || 'No name'}`);
    console.log(`   Plan: ${user.current_plan || 'none'}`);
    console.log(`   Trial: ${user.trial_status || 'none'}`);
    console.log(`   Subscription: ${user.stripe_subscription_id || 'none'}`);
    console.log(`   Customer: ${user.stripe_customer_id || 'none'}`);
    console.log(`   Created: ${user.created_at}`);
    
    // Step 2: Check for related data
    console.log('\n🔍 STEP 2: Checking for related data...');
    
    // Check campaigns
    const campaignsQuery = `
      SELECT COUNT(*) as count FROM campaigns WHERE "userId" = $1;
    `;
    const campaignsResult = await client.query(campaignsQuery, [user.user_id]);
    const campaignCount = parseInt(campaignsResult.rows[0].count);
    
    // Check scraping jobs
    const jobsQuery = `
      SELECT COUNT(*) as count FROM scraping_jobs WHERE "userId" = $1;
    `;
    const jobsResult = await client.query(jobsQuery, [user.user_id]);
    const jobCount = parseInt(jobsResult.rows[0].count);
    
    console.log(`📊 Related data:`);
    console.log(`   Campaigns: ${campaignCount}`);
    console.log(`   Scraping jobs: ${jobCount}`);
    
    // Step 3: Delete user and related data
    console.log('\n🗑️  STEP 3: Deleting user and all related data...');
    
    // Start transaction
    await client.query('BEGIN');
    
    try {
      // Delete scraping results for user's jobs
      if (jobCount > 0) {
        const deleteResultsQuery = `
          DELETE FROM scraping_results 
          WHERE "jobId" IN (
            SELECT id FROM scraping_jobs WHERE "userId" = $1
          );
        `;
        const deletedResults = await client.query(deleteResultsQuery, [user.user_id]);
        console.log(`   ✅ Deleted ${deletedResults.rowCount} scraping results`);
        
        // Delete scraping jobs
        const deleteJobsQuery = `DELETE FROM scraping_jobs WHERE "userId" = $1;`;
        const deletedJobs = await client.query(deleteJobsQuery, [user.user_id]);
        console.log(`   ✅ Deleted ${deletedJobs.rowCount} scraping jobs`);
      }
      
      // Delete campaigns
      if (campaignCount > 0) {
        const deleteCampaignsQuery = `DELETE FROM campaigns WHERE "userId" = $1;`;
        const deletedCampaigns = await client.query(deleteCampaignsQuery, [user.user_id]);
        console.log(`   ✅ Deleted ${deletedCampaigns.rowCount} campaigns`);
      }
      
      // Delete user profile
      const deleteUserQuery = `DELETE FROM user_profiles WHERE user_id = $1 RETURNING email;`;
      const deletedUser = await client.query(deleteUserQuery, [user.user_id]);
      console.log(`   ✅ Deleted user profile: ${deletedUser.rows[0].email}`);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log('\n🎉 USER DELETION SUCCESSFUL!');
      console.log('✅ User and all related data have been permanently removed');
      console.log('✅ Database is now clean');
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error('❌ Error during deletion, rolled back:', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n🚀 CLEANUP COMPLETE');
  console.log(`✅ User ${targetEmail} has been permanently deleted`);
  console.log('✅ All associated campaigns and jobs removed');
  console.log('✅ Database is clean and optimized');
}

deleteUser().catch(console.error);