const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function deleteDuplicateUsers() {
  console.log('\n🗑️ DELETING DUPLICATE USERS\n');
  console.log('='.repeat(50));

  const sql = postgres(process.env.DATABASE_URL);

  try {
    // Keep: user_2zRnraoVNDAegfHnci1xUMWybwz (current user with trial)
    // Delete: user_2zbQWT7Szc35WARetKWMA4BypHe and user_2zb4wFmyH7n6rV7ByOGNhexQVfi

    const usersToDelete = [
      'user_2zbQWT7Szc35WARetKWMA4BypHe',
      'user_2zb4wFmyH7n6rV7ByOGNhexQVfi'
    ];

    console.log('📋 Step 1: Checking what will be deleted...');
    for (const userId of usersToDelete) {
      const [user] = await sql`
        SELECT user_id, full_name, business_name, trial_status, onboarding_step 
        FROM user_profiles 
        WHERE user_id = ${userId}
      `;
      
      if (user) {
        console.log(`🎯 Will delete: ${user.user_id}`);
        console.log(`   Name: ${user.full_name || 'None'}`);
        console.log(`   Business: ${user.business_name || 'None'}`);
        console.log(`   Trial: ${user.trial_status}`);
        console.log(`   Onboarding: ${user.onboarding_step}`);
      }
    }

    console.log('\n🗑️ Step 2: Deleting duplicate users...');
    
    for (const userId of usersToDelete) {
      const result = await sql`
        DELETE FROM user_profiles 
        WHERE user_id = ${userId}
      `;
      console.log(`✅ Deleted user: ${userId} (${result.count} row affected)`);
    }

    console.log('\n📊 Step 3: Verifying remaining users...');
    const remainingUsers = await sql`
      SELECT user_id, full_name, trial_status, onboarding_step 
      FROM user_profiles 
      WHERE user_id LIKE 'user_%' 
      ORDER BY created_at DESC
    `;

    console.log(`✅ Found ${remainingUsers.length} remaining Clerk users:`);
    remainingUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.user_id}`);
      console.log(`   Name: ${user.full_name || 'None'}`);
      console.log(`   Trial: ${user.trial_status}`);
      console.log(`   Onboarding: ${user.onboarding_step}`);
      console.log('');
    });

    console.log('='.repeat(50));
    console.log('🎉 DUPLICATE USERS DELETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('\n✨ You now have a clean account setup!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

deleteDuplicateUsers();