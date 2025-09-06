const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function fixFameFlexLimits() {
  const userId = 'user_2zRnraoVNDAegfHnci1xUMWybwz';
  
  console.log('🔧 [FIX-LIMITS] Fixing fame_flex plan limits for user:', userId);
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  const sql = postgres(dbUrl);
  
  try {
    // First check current state
    console.log('📊 [FIX-LIMITS] Current state:');
    const currentState = await sql`
      SELECT 
        user_id,
        current_plan,
        usage_campaigns_current,
        plan_campaigns_limit,
        plan_creators_limit,
        (SELECT COUNT(*) FROM campaigns WHERE user_id = ${userId}) as actual_campaigns
      FROM user_profiles 
      WHERE user_id = ${userId}
    `;
    
    if (currentState.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const state = currentState[0];
    console.log(`   Plan: ${state.current_plan}`);
    console.log(`   Campaign Limit: ${state.plan_campaigns_limit} (should be -1 for fame_flex)`);
    console.log(`   Creator Limit: ${state.plan_creators_limit} (should be -1 for fame_flex)`);
    console.log(`   Usage: ${state.usage_campaigns_current} campaigns`);
    console.log(`   Actual: ${state.actual_campaigns} campaigns`);
    
    // Get fame_flex plan limits from subscription_plans table
    const fameFlexPlan = await sql`
      SELECT campaigns_limit, creators_limit, features 
      FROM subscription_plans 
      WHERE plan_key = 'fame_flex'
    `;
    
    if (fameFlexPlan.length === 0) {
      console.log('❌ fame_flex plan not found in subscription_plans table');
      return;
    }
    
    const correctLimits = fameFlexPlan[0];
    console.log(`\n🎯 [FIX-LIMITS] Correct fame_flex limits:`);
    console.log(`   Campaigns: ${correctLimits.campaigns_limit} (unlimited)`);
    console.log(`   Creators: ${correctLimits.creators_limit} (unlimited)`);
    
    // Update user with correct limits
    console.log(`\n🔄 [FIX-LIMITS] Updating user profile with correct limits...`);
    
    const updated = await sql`
      UPDATE user_profiles 
      SET 
        plan_campaigns_limit = ${correctLimits.campaigns_limit},
        plan_creators_limit = ${correctLimits.creators_limit},
        plan_features = ${correctLimits.features},
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING user_id, current_plan, plan_campaigns_limit, plan_creators_limit
    `;
    
    if (updated.length > 0) {
      const result = updated[0];
      console.log(`✅ [FIX-LIMITS] Successfully updated user limits:`);
      console.log(`   Plan: ${result.current_plan}`);
      console.log(`   Campaign Limit: ${result.plan_campaigns_limit} (unlimited)`);
      console.log(`   Creator Limit: ${result.plan_creators_limit} (unlimited)`);
      
      console.log(`\n🎉 [FIX-LIMITS] Fix complete! User should now see "0/∞ campaigns"`);
      console.log(`📝 [FIX-LIMITS] Next steps:`);
      console.log(`   1. Clear browser localStorage`);
      console.log(`   2. Refresh the application`);
      console.log(`   3. Counter should show "0/∞ campaigns" (unlimited)`);
    } else {
      console.log('❌ [FIX-LIMITS] Failed to update user profile');
    }
    
  } catch (error) {
    console.error('❌ [FIX-LIMITS] Error:', error.message);
  } finally {
    await sql.end();
  }
}

fixFameFlexLimits();