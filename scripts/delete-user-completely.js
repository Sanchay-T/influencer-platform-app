const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function deleteUserCompletely() {
  const targetEmail = process.argv[2];
  const targetUserId = process.argv[3];
  
  if (!targetEmail && !targetUserId) {
    console.error('Usage: node scripts/delete-user-completely.js <email_or_user_id>');
    console.error('Example: node scripts/delete-user-completely.js sanchay.thalnerkar15976@sakec.ac.in');
    console.error('Example: node scripts/delete-user-completely.js user_123abc');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  const sql = postgres(dbUrl);
  
  try {
    console.log('🔍 [USER-DELETE] Searching for user...');
    
    // Find user by email or user_id
    let userQuery;
    let searchTerm = targetEmail || targetUserId;
    
    if (searchTerm.includes('@')) {
      userQuery = await sql`
        SELECT user_id, email, full_name, created_at
        FROM user_profiles 
        WHERE email = ${searchTerm}
      `;
    } else {
      userQuery = await sql`
        SELECT user_id, email, full_name, created_at
        FROM user_profiles 
        WHERE user_id = ${searchTerm}
      `;
    }
    
    if (userQuery.length === 0) {
      console.log('❌ User not found with identifier:', searchTerm);
      
      // Show recent users for reference
      const recentUsers = await sql`
        SELECT user_id, email, full_name, created_at
        FROM user_profiles 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      
      console.log('\n📋 Recent users for reference:');
      recentUsers.forEach(user => {
        console.log(`   ${user.email} (${user.user_id}) - ${user.created_at}`);
      });
      
      return;
    }
    
    const user = userQuery[0];
    console.log(`\n👤 [USER-DELETE] Found user:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Name: ${user.full_name}`);
    console.log(`   Created: ${user.created_at}`);
    
    // Count associated data
    const [campaignCount] = await sql`
      SELECT COUNT(*) as count FROM campaigns WHERE user_id = ${user.user_id}
    `;
    
    const [jobCount] = await sql`
      SELECT COUNT(*) as count FROM scraping_jobs WHERE user_id = ${user.user_id}
    `;
    
    console.log(`\n📊 [USER-DELETE] Associated data:`);
    console.log(`   Campaigns: ${campaignCount.count}`);
    console.log(`   Scraping Jobs: ${jobCount.count}`);
    
    // Confirm deletion
    console.log(`\n⚠️ [USER-DELETE] This will PERMANENTLY delete:`);
    console.log(`   ✗ User profile: ${user.email}`);
    console.log(`   ✗ ${campaignCount.count} campaigns`);
    console.log(`   ✗ ${jobCount.count} scraping jobs`);
    console.log(`   ✗ All associated scraping results`);
    console.log(`   ✗ All billing and subscription data`);
    
    // For safety, require exact confirmation
    console.log(`\n🛑 [USER-DELETE] TO CONFIRM, run with --confirm flag:`);
    console.log(`   node scripts/delete-user-completely.js "${searchTerm}" --confirm`);
    
    if (!process.argv.includes('--confirm')) {
      console.log('❌ Deletion cancelled - missing --confirm flag');
      return;
    }
    
    console.log(`\n🗑️ [USER-DELETE] Starting deletion process...`);
    
    // Step 1: Delete scraping results
    if (parseInt(jobCount.count) > 0) {
      console.log('🗑️ [USER-DELETE] Deleting scraping results...');
      await sql`
        DELETE FROM scraping_results 
        WHERE job_id IN (
          SELECT id FROM scraping_jobs WHERE user_id = ${user.user_id}
        )
      `;
      console.log('   ✅ Scraping results deleted');
    }
    
    // Step 2: Delete scraping jobs
    if (parseInt(jobCount.count) > 0) {
      console.log('🗑️ [USER-DELETE] Deleting scraping jobs...');
      await sql`
        DELETE FROM scraping_jobs WHERE user_id = ${user.user_id}
      `;
      console.log(`   ✅ ${jobCount.count} scraping jobs deleted`);
    }
    
    // Step 3: Delete campaigns
    if (parseInt(campaignCount.count) > 0) {
      console.log('🗑️ [USER-DELETE] Deleting campaigns...');
      await sql`
        DELETE FROM campaigns WHERE user_id = ${user.user_id}
      `;
      console.log(`   ✅ ${campaignCount.count} campaigns deleted`);
    }
    
    // Step 4: Delete user profile
    console.log('🗑️ [USER-DELETE] Deleting user profile...');
    await sql`
      DELETE FROM user_profiles WHERE user_id = ${user.user_id}
    `;
    console.log('   ✅ User profile deleted');
    
    console.log(`\n🎉 [USER-DELETE] Complete deletion successful!`);
    console.log(`📧 User ${user.email} has been completely removed from the database.`);
    
    console.log(`\n📝 [USER-DELETE] Note: This only deletes database records.`);
    console.log(`   To fully remove the user, you may also need to:`);
    console.log(`   1. Delete from Clerk dashboard (if applicable)`);
    console.log(`   2. Cancel any active Stripe subscriptions`);
    console.log(`   3. Clear any cached data or logs`);
    
  } catch (error) {
    console.error('❌ [USER-DELETE] Deletion failed:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

deleteUserCompletely();