const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function completeOnboardingAndActivatePlan() {
  const targetUserId = process.argv[2] || 'user_32HJoFFCdAuvypqbWh9E1stJWpx';
  const planKey = process.argv[3] || 'fame_flex';
  
  console.log('🔧 [ONBOARDING-SETUP] Setting up user:', targetUserId);
  console.log('🎯 [ONBOARDING-SETUP] Target plan:', planKey);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  const sql = postgres(dbUrl);
  
  try {
    // Step 1: Verify user exists
    const userCheck = await sql`
      SELECT user_id, email, full_name, onboarding_step, current_plan
      FROM user_profiles 
      WHERE user_id = ${targetUserId}
    `;
    
    if (userCheck.length === 0) {
      console.log('❌ User not found:', targetUserId);
      return;
    }
    
    const user = userCheck[0];
    console.log(`\n👤 [ONBOARDING-SETUP] Current user state:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.full_name}`);
    console.log(`   Onboarding: ${user.onboarding_step}`);
    console.log(`   Plan: ${user.current_plan}`);
    
    // Step 2: Get plan details
    const planDetails = await sql`
      SELECT plan_key, campaigns_limit, creators_limit, features
      FROM subscription_plans 
      WHERE plan_key = ${planKey}
    `;
    
    if (planDetails.length === 0) {
      console.log('❌ Plan not found:', planKey);
      return;
    }
    
    const plan = planDetails[0];
    console.log(`\n🎯 [ONBOARDING-SETUP] Target plan details:`);
    console.log(`   Plan: ${plan.plan_key}`);
    console.log(`   Campaign Limit: ${plan.campaigns_limit} ${plan.campaigns_limit === -1 ? '(unlimited)' : ''}`);
    console.log(`   Creator Limit: ${plan.creators_limit} ${plan.creators_limit === -1 ? '(unlimited)' : ''}`);
    
    // Step 3: Complete onboarding and activate plan
    console.log(`\n🔄 [ONBOARDING-SETUP] Completing onboarding and activating plan...`);
    
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    await sql`
      UPDATE user_profiles
      SET
        -- Complete onboarding with sample data
        full_name = COALESCE(full_name, 'Test User'),
        business_name = 'Test Business',
        industry = 'Technology',
        brand_description = 'Testing fame_flex plan features',
        onboarding_step = 'completed',
        
        -- Activate fame_flex plan
        current_plan = ${plan.plan_key},
        plan_campaigns_limit = ${plan.campaigns_limit},
        plan_creators_limit = ${plan.creators_limit},
        plan_features = ${plan.features},
        
        -- Set up trial subscription (simulating Stripe)
        trial_start_date = ${now},
        trial_end_date = ${trialEndDate},
        trial_status = 'active',
        subscription_status = 'trialing',
        
        -- Create mock Stripe IDs
        stripe_customer_id = 'cus_test_' || substring(${targetUserId}, 6, 10),
        stripe_subscription_id = 'sub_test_' || substring(${targetUserId}, 6, 10),
        
        -- Reset usage
        usage_campaigns_current = 0,
        usage_creators_current_month = 0,
        usage_reset_date = ${now},
        
        -- Update timestamps
        updated_at = ${now}
      WHERE user_id = ${targetUserId}
    `;
    
    // Step 4: Verify the setup
    console.log(`\n✅ [ONBOARDING-SETUP] Setup complete! Verifying...`);
    
    const verifyResult = await sql`
      SELECT 
        user_id,
        email,
        full_name,
        business_name,
        onboarding_step,
        current_plan,
        plan_campaigns_limit,
        plan_creators_limit,
        trial_status,
        subscription_status,
        stripe_customer_id,
        stripe_subscription_id,
        trial_end_date
      FROM user_profiles 
      WHERE user_id = ${targetUserId}
    `;
    
    const result = verifyResult[0];
    console.log(`\n🎉 [ONBOARDING-SETUP] Final user state:`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Name: ${result.full_name}`);
    console.log(`   Business: ${result.business_name}`);
    console.log(`   Onboarding: ${result.onboarding_step} ✅`);
    console.log(`   Plan: ${result.current_plan} ✅`);
    console.log(`   Campaign Limit: ${result.plan_campaigns_limit} ${result.plan_campaigns_limit === -1 ? '(unlimited)' : ''}`);
    console.log(`   Creator Limit: ${result.plan_creators_limit} ${result.plan_creators_limit === -1 ? '(unlimited)' : ''}`);
    console.log(`   Trial Status: ${result.trial_status}`);
    console.log(`   Subscription: ${result.subscription_status}`);
    console.log(`   Trial Expires: ${result.trial_end_date?.toLocaleDateString()}`);
    console.log(`   Stripe Customer: ${result.stripe_customer_id}`);
    console.log(`   Stripe Subscription: ${result.stripe_subscription_id}`);
    
    console.log(`\n📝 [ONBOARDING-SETUP] Next steps:`);
    console.log(`   1. User can now log in and see completed onboarding`);
    console.log(`   2. User has access to fame_flex features (unlimited campaigns/creators)`);
    console.log(`   3. User is on a 7-day trial that expires on ${result.trial_end_date?.toLocaleDateString()}`);
    console.log(`   4. Campaign counter should show "0/∞ campaigns"`);
    console.log(`   5. User can create unlimited campaigns and searches`);
    
  } catch (error) {
    console.error('❌ [ONBOARDING-SETUP] Setup failed:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

completeOnboardingAndActivatePlan();