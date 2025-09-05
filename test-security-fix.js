const { PlanValidator } = require('./lib/services/plan-validator.ts');
require('dotenv').config({ path: '.env.local' });

async function testSecurityFix() {
  const userId = 'user_2zRnraoVNDAegfHnci1xUMWybwz';
  
  console.log('🔒 Testing security fix for user:', userId);
  console.log('Expected: Should block campaign creation for fame_flex plan without completed onboarding\n');
  
  try {
    const result = await PlanValidator.validateCampaignCreation(userId);
    
    console.log('📊 Validation Result:');
    console.log('  ✅ Allowed:', result.allowed);
    console.log('  📝 Reason:', result.reason);
    console.log('  🔒 Security:', result.securityFlag || false);
    console.log('  🎯 Current Usage:', result.currentUsage);
    console.log('  📈 Limit:', result.limit);
    console.log('  🚨 Upgrade Required:', result.upgradeRequired);
    
    if (!result.allowed && result.reason.includes('onboarding')) {
      console.log('\n✅ SECURITY FIX WORKING: Exploitation attempt blocked!');
    } else if (result.allowed) {
      console.log('\n❌ SECURITY ISSUE: User can still create campaigns without completing onboarding!');
    } else {
      console.log('\n⚠️  BLOCKED FOR OTHER REASON:', result.reason);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSecurityFix();