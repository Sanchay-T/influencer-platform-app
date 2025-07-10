const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function copyTrialToCurrentUser() {
  console.log('\n🔄 COPYING TRIAL DATA TO CURRENT USER\n');
  console.log('='.repeat(50));

  const sql = postgres(process.env.DATABASE_URL);

  try {
    const sourceUserId = 'user_2zb4wFmyH7n6rV7ByOGNhexQVfi'; // User with active trial
    const targetUserId = 'user_2zRnraoVNDAegfHnci1xUMWybwz'; // Current logged-in user

    console.log('📋 Step 1: Getting trial data from source user...');
    const [sourceUser] = await sql`
      SELECT 
        trial_start_date,
        trial_end_date,
        trial_status,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        email_schedule_status
      FROM user_profiles 
      WHERE user_id = ${sourceUserId}
    `;

    if (!sourceUser) {
      console.error('❌ Source user not found!');
      return;
    }

    console.log('✅ Source trial data found:', {
      trialStatus: sourceUser.trial_status,
      stripeCustomerId: sourceUser.stripe_customer_id,
      trialStartDate: sourceUser.trial_start_date,
      trialEndDate: sourceUser.trial_end_date
    });

    console.log('\n🎯 Step 2: Copying trial data to current user...');
    await sql`
      UPDATE user_profiles 
      SET 
        trial_start_date = ${sourceUser.trial_start_date},
        trial_end_date = ${sourceUser.trial_end_date},
        trial_status = ${sourceUser.trial_status},
        stripe_customer_id = ${sourceUser.stripe_customer_id},
        stripe_subscription_id = ${sourceUser.stripe_subscription_id},
        subscription_status = ${sourceUser.subscription_status},
        email_schedule_status = ${sourceUser.email_schedule_status || '{}'}
      WHERE user_id = ${targetUserId}
    `;

    console.log('✅ Trial data copied successfully!');

    console.log('\n🧹 Step 3: Cleaning up old trial data...');
    await sql`
      UPDATE user_profiles 
      SET 
        trial_start_date = NULL,
        trial_end_date = NULL,
        trial_status = 'pending',
        stripe_customer_id = NULL,
        stripe_subscription_id = NULL,
        subscription_status = 'none',
        email_schedule_status = '{}'
      WHERE user_id = ${sourceUserId}
    `;

    console.log('✅ Old trial data cleaned up!');

    console.log('\n📊 Step 4: Verifying the copy...');
    const [updatedUser] = await sql`
      SELECT 
        user_id,
        full_name,
        trial_status,
        trial_start_date,
        trial_end_date,
        stripe_customer_id
      FROM user_profiles 
      WHERE user_id = ${targetUserId}
    `;

    console.log('✅ Verification successful:', {
      userId: updatedUser.user_id,
      fullName: updatedUser.full_name,
      trialStatus: updatedUser.trial_status,
      stripeCustomerId: updatedUser.stripe_customer_id
    });

    // Calculate time remaining
    if (updatedUser.trial_start_date && updatedUser.trial_end_date) {
      const now = new Date();
      const endDate = new Date(updatedUser.trial_end_date);
      const timeDiff = endDate.getTime() - now.getTime();
      
      if (timeDiff > 0) {
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        console.log(`⏰ Time remaining: ${days}d ${hours}h`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 TRIAL DATA SUCCESSFULLY COPIED!');
    console.log('='.repeat(50));
    console.log('\n✨ Now refresh your profile page to see the active trial!');
    console.log('🔗 http://localhost:3000/profile');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

copyTrialToCurrentUser();