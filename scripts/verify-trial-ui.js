const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function verifyTrialUI() {
  console.log('\n🔍 VERIFYING TRIAL UI DATA\n');
  console.log('='.repeat(50));

  const sql = postgres(process.env.DATABASE_URL);

  try {
    const userId = 'user_2zb4wFmyH7n6rV7ByOGNhexQVfi';
    
    // 1. Check trial data
    console.log('🎯 Step 1: Checking trial data in database...');
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
        stripe_subscription_id,
        subscription_status,
        email_schedule_status
      FROM user_profiles 
      WHERE user_id = ${userId}
    `;

    if (user.length === 0) {
      console.error('❌ User not found!');
      return;
    }

    const userProfile = user[0];
    console.log('\n✅ User Profile Data:');
    console.table([{
      'Full Name': userProfile.full_name,
      'Business': userProfile.business_name,
      'Onboarding': userProfile.onboarding_step,
      'Trial Status': userProfile.trial_status,
      'Subscription': userProfile.subscription_status
    }]);

    // 2. Calculate countdown
    let timeDiff = 0;
    let days = 0;
    let progressPercentage = 0;
    
    if (userProfile.trial_start_date && userProfile.trial_end_date) {
      console.log('\n⏰ Step 2: Trial Countdown Calculation:');
      const now = new Date();
      const endDate = new Date(userProfile.trial_end_date);
      timeDiff = endDate.getTime() - now.getTime();
      
      if (timeDiff > 0) {
        days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        progressPercentage = Math.round(((7 - days) / 7) * 100);

        console.log('✅ Trial Active:');
        console.log(`   Time Remaining: ${days}d ${hours}h ${minutes}m`);
        console.log(`   Progress: ${progressPercentage}% complete`);
        console.log(`   Start Date: ${new Date(userProfile.trial_start_date).toLocaleString()}`);
        console.log(`   End Date: ${new Date(userProfile.trial_end_date).toLocaleString()}`);
      } else {
        console.log('⚠️ Trial Expired!');
      }
    } else {
      console.log('❌ No trial data found!');
    }

    // 3. Mock Stripe Data
    console.log('\n💳 Step 3: Mock Stripe Information:');
    console.log('   Customer ID:', userProfile.stripe_customer_id || 'Not set');
    console.log('   Subscription ID:', userProfile.stripe_subscription_id || 'Not set');

    // 4. Email Schedule Status
    console.log('\n📧 Step 4: Email Schedule Status:');
    if (userProfile.email_schedule_status && Object.keys(userProfile.email_schedule_status).length > 0) {
      console.log(JSON.stringify(userProfile.email_schedule_status, null, 2));
    } else {
      console.log('   No email schedule data');
    }

    // 5. What you should see on profile page
    console.log('\n' + '='.repeat(50));
    console.log('📋 WHAT YOU SHOULD SEE ON PROFILE PAGE:');
    console.log('='.repeat(50));
    console.log('\n1. Trial Status Card:');
    console.log('   - Live countdown timer');
    console.log('   - Progress bar showing ~' + progressPercentage + '% complete');
    console.log('   - Start/End dates');
    console.log('   - Mock Stripe IDs');
    console.log('   - Action buttons (Cancel/Upgrade)');
    console.log('\n2. Email Schedule Card:');
    console.log('   - Email statuses (if any scheduled)');
    console.log('\n3. Personal Information:');
    console.log('   - Name, Email, Company, Industry');
    console.log('\n4. Debug Section (dev only):');
    console.log('   - Raw trial data JSON');
    console.log('   - Email schedule JSON');
    
    console.log('\n✨ Visit http://localhost:3000/profile to see everything!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

verifyTrialUI();