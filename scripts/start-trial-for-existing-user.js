const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function startTrialForExistingUser() {
  console.log('\n🎯 STARTING TRIAL FOR EXISTING USER\n');
  console.log('='.repeat(50));

  const sql = postgres(process.env.DATABASE_URL);

  try {
    const userId = 'user_2zb4wFmyH7n6rV7ByOGNhexQVfi'; // Your user ID from logs
    
    // 1. Check current user status
    console.log('🔍 Step 1: Checking current user status...');
    const user = await sql`
      SELECT 
        user_id,
        full_name,
        business_name,
        onboarding_step,
        trial_start_date,
        trial_end_date,
        trial_status,
        stripe_customer_id,
        email_schedule_status
      FROM user_profiles 
      WHERE user_id = ${userId}
    `;

    if (user.length === 0) {
      console.error('❌ User not found!');
      return;
    }

    const userProfile = user[0];
    console.log('✅ User found:', {
      fullName: userProfile.full_name,
      businessName: userProfile.business_name,
      onboardingStep: userProfile.onboarding_step,
      hasTrialData: !!(userProfile.trial_start_date && userProfile.trial_end_date)
    });

    // 2. Generate mock Stripe data
    console.log('\n💳 Step 2: Creating mock Stripe data...');
    const customerId = `cus_mock_${Date.now()}_existing_user`;
    const subscriptionId = `sub_mock_${Date.now()}_existing_user`;
    console.log('✅ Mock Stripe data created:', { customerId, subscriptionId });

    // 3. Start trial (7 days from now)
    console.log('\n🎯 Step 3: Starting 7-day trial...');
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await sql`
      UPDATE user_profiles 
      SET 
        trial_start_date = ${now},
        trial_end_date = ${trialEndDate},
        trial_status = 'active',
        subscription_status = 'trialing',
        stripe_customer_id = ${customerId},
        stripe_subscription_id = ${subscriptionId},
        updated_at = ${now}
      WHERE user_id = ${userId}
    `;

    console.log('✅ Trial started successfully!');
    console.log('📅 Trial dates:', {
      startDate: now.toISOString(),
      endDate: trialEndDate.toISOString(),
      daysFromNow: 7
    });

    // 4. Calculate countdown to verify
    console.log('\n⏰ Step 4: Verifying countdown calculation...');
    const timeDiff = trialEndDate.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    console.log('✅ Countdown verification:', {
      daysRemaining: days,
      hoursRemaining: hours,
      minutesRemaining: minutes,
      timeUntilExpiry: `${days}d ${hours}h ${minutes}m`
    });

    // 5. Verify database update
    console.log('\n📊 Step 5: Verifying database update...');
    const updatedUser = await sql`
      SELECT 
        trial_start_date,
        trial_end_date,
        trial_status,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status
      FROM user_profiles 
      WHERE user_id = ${userId}
    `;

    console.table(updatedUser);

    // 6. Instructions for user
    console.log('\n' + '='.repeat(50));
    console.log('🎉 TRIAL STARTED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('📋 What to do next:');
    console.log('1. Refresh your profile page: http://localhost:3000/profile');
    console.log('2. You should now see the trial countdown');
    console.log('3. The countdown will update every 60 seconds');
    console.log('4. Check the debug section for raw data');
    console.log('5. Trial emails are NOT scheduled (since you already completed onboarding)');
    console.log('\n💡 Note: The trial system will now work for all future users automatically!');

  } catch (error) {
    console.error('❌ Error starting trial:', error);
  } finally {
    await sql.end();
  }
}

startTrialForExistingUser();