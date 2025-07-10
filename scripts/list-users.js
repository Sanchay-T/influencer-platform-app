const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function listUsers() {
  console.log('\n🔍 LISTING ALL USERS IN DATABASE\n');
  console.log('='.repeat(60));

  const sql = postgres(process.env.DATABASE_URL);

  try {
    // Get all users
    const users = await sql`
      SELECT 
        user_id,
        full_name,
        business_name,
        email,
        onboarding_step,
        trial_status,
        trial_start_date,
        trial_end_date,
        created_at
      FROM user_profiles 
      ORDER BY created_at DESC
    `;

    if (users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`✅ Found ${users.length} users:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.user_id}`);
      console.log(`   📧 Email: ${user.email || 'Not set'}`);
      console.log(`   👤 Name: ${user.full_name || 'Not set'}`);
      console.log(`   🏢 Business: ${user.business_name || 'Not set'}`);
      console.log(`   📋 Onboarding: ${user.onboarding_step}`);
      console.log(`   🎯 Trial: ${user.trial_status}`);
      
      if (user.trial_start_date && user.trial_end_date) {
        const now = new Date();
        const endDate = new Date(user.trial_end_date);
        const timeDiff = endDate.getTime() - now.getTime();
        
        if (timeDiff > 0) {
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          console.log(`   ⏰ Time left: ${days}d ${hours}h`);
        } else {
          console.log(`   ⏰ Trial expired`);
        }
      }
      
      console.log(`   📅 Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    // Search suggestions
    console.log('='.repeat(60));
    console.log('🔍 SEARCH SUGGESTIONS:');
    console.log('='.repeat(60));
    
    const emailsToTry = users
      .filter(u => u.email)
      .map(u => u.email)
      .slice(0, 3);
      
    const namesToTry = users
      .filter(u => u.full_name)
      .map(u => u.full_name.split(' ')[0]) // First name only
      .slice(0, 3);

    if (emailsToTry.length > 0) {
      console.log('\n📧 Try searching by email:');
      emailsToTry.forEach(email => console.log(`   - ${email}`));
    }
    
    if (namesToTry.length > 0) {
      console.log('\n👤 Try searching by first name:');
      namesToTry.forEach(name => console.log(`   - ${name}`));
    }

    const userIdsToTry = users
      .map(u => u.user_id.substring(0, 8))
      .slice(0, 3);
      
    if (userIdsToTry.length > 0) {
      console.log('\n🆔 Try searching by user ID prefix:');
      userIdsToTry.forEach(id => console.log(`   - ${id}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

listUsers();