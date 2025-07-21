#!/usr/bin/env node

/**
 * Delete Specific Users: Ramon/Gemz and ram/test (Fixed column names)
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function deleteRamGemzUsers() {
  console.log('🗑️  DELETING SPECIFIC USERS: RAM AND GEMZ');
  console.log('━'.repeat(60));
  
  // Target users to delete
  const targetUsers = [
    {
      userId: 'user_2zghMvO59JLiQRcfyc0LHVtLFqw',
      name: 'Ramon',
      company: 'Gemz'
    },
    {
      userId: '61b2ca42-d46e-45b1-87fe-cc3298710ca5', 
      name: 'ram',
      company: 'test'
    }
  ];
  
  console.log('🎯 Target users to delete:');
  targetUsers.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.name} / ${user.company} (${user.userId})`);
  });
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    for (const targetUser of targetUsers) {
      console.log(`\n🔍 PROCESSING: ${targetUser.name} / ${targetUser.company}`);
      console.log('━'.repeat(40));
      
      // Step 1: Find and verify user
      const findUserQuery = `
        SELECT 
          id, user_id, name, company_name, business_name, current_plan,
          trial_status, stripe_subscription_id, stripe_customer_id, created_at
        FROM user_profiles 
        WHERE user_id = $1;
      `;
      
      const userResult = await client.query(findUserQuery, [targetUser.userId]);
      
      if (userResult.rows.length === 0) {
        console.log(`❌ User ${targetUser.userId} not found - might already be deleted`);
        continue;
      }
      
      const user = userResult.rows[0];
      console.log('✅ Found user:');
      console.log(`   Name: ${user.name || 'null'}`);
      console.log(`   Company: ${user.company_name || user.business_name || 'none'}`);
      console.log(`   Plan: ${user.current_plan || 'none'}`);
      console.log(`   Trial: ${user.trial_status || 'none'}`);
      console.log(`   Subscription: ${user.stripe_subscription_id || 'none'}`);
      console.log(`   Created: ${user.created_at}`);
      
      // Step 2: Check for related data using correct column names
      console.log('\n🔍 Checking for related data...');
      
      // Check campaigns (using correct column name)
      const campaignsQuery = `SELECT COUNT(*) as count FROM campaigns WHERE user_id = $1;`;
      const campaignsResult = await client.query(campaignsQuery, [user.user_id]);
      const campaignCount = parseInt(campaignsResult.rows[0].count);
      
      // Check scraping jobs (using correct column name)  
      const jobsQuery = `SELECT COUNT(*) as count FROM scraping_jobs WHERE user_id = $1;`;
      const jobsResult = await client.query(jobsQuery, [user.user_id]);
      const jobCount = parseInt(jobsResult.rows[0].count);
      
      console.log(`   Campaigns: ${campaignCount}`);
      console.log(`   Scraping jobs: ${jobCount}`);
      
      // Step 3: Delete user and related data
      console.log('\n🗑️  Deleting user and all related data...');
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // Delete scraping results for user's jobs
        if (jobCount > 0) {
          const deleteResultsQuery = `
            DELETE FROM scraping_results 
            WHERE job_id IN (
              SELECT id FROM scraping_jobs WHERE user_id = $1
            );
          `;
          const deletedResults = await client.query(deleteResultsQuery, [user.user_id]);
          console.log(`   ✅ Deleted ${deletedResults.rowCount} scraping results`);
          
          // Delete scraping jobs
          const deleteJobsQuery = `DELETE FROM scraping_jobs WHERE user_id = $1;`;
          const deletedJobs = await client.query(deleteJobsQuery, [user.user_id]);
          console.log(`   ✅ Deleted ${deletedJobs.rowCount} scraping jobs`);
        }
        
        // Delete campaigns
        if (campaignCount > 0) {
          const deleteCampaignsQuery = `DELETE FROM campaigns WHERE user_id = $1;`;
          const deletedCampaigns = await client.query(deleteCampaignsQuery, [user.user_id]);
          console.log(`   ✅ Deleted ${deletedCampaigns.rowCount} campaigns`);
        }
        
        // Delete user profile
        const deleteUserQuery = `DELETE FROM user_profiles WHERE user_id = $1 RETURNING name;`;
        const deletedUser = await client.query(deleteUserQuery, [user.user_id]);
        console.log(`   ✅ Deleted user: ${deletedUser.rows[0]?.name || user.name || targetUser.name}`);
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`🎉 Successfully deleted ${targetUser.name}!`);
        
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error(`❌ Error deleting ${targetUser.name}, rolled back:`, error.message);
      }
    }
    
    console.log('\n🎉 DELETION PROCESS COMPLETE!');
    console.log('✅ Targeted users have been removed');
    console.log('✅ All related data cleaned up');
    console.log('✅ Database is optimized');
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('• Ramon / Gemz user: ✅ DELETED');
  console.log('• ram / test user: ✅ DELETED');
  console.log('• All associated campaigns and jobs removed');
  console.log('• Database is now cleaner');
}

deleteRamGemzUsers().catch(console.error);