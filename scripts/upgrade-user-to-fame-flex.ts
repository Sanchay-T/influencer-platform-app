import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { subscriptionPlans } from '../lib/db/schema';
import { getUserProfile, updateUserProfile } from '../lib/db/queries/user-queries';
import { eq } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const postgresClient = postgres(connectionString);
const db = drizzle(postgresClient);

// Use development test user ID from environment, or provided argument
const TARGET_USER_ID = process.argv[2] || process.env.TEST_USER_ID || 'b9b65707-10e9-4d2b-85eb-130f513d7c59';

async function upgradeUserToFameFlex() {
  console.log('🚀 [UPGRADE-TO-FAME-FLEX] Starting user upgrade to Fame Flex plan');
  console.log(`🎯 [UPGRADE-TO-FAME-FLEX] Target user: ${TARGET_USER_ID}`);
  console.log('');

  try {
    // Step 1: Get Fame Flex plan details from database
    console.log('📋 [UPGRADE-TO-FAME-FLEX] Fetching Fame Flex plan details from database...');
    const fameFlexPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.planKey, 'fame_flex')
    });

    if (!fameFlexPlan) {
      console.error('❌ [UPGRADE-TO-FAME-FLEX] Fame Flex plan not found in database!');
      console.error('❌ [UPGRADE-TO-FAME-FLEX] Run: npm run db:seed:plans first');
      process.exit(1);
    }

    console.log(`✅ [UPGRADE-TO-FAME-FLEX] Found Fame Flex plan:`, {
      name: fameFlexPlan.displayName,
      price: `$${fameFlexPlan.monthlyPrice / 100}/month`,
      campaignsLimit: fameFlexPlan.campaignsLimit === -1 ? 'Unlimited' : fameFlexPlan.campaignsLimit,
      creatorsLimit: fameFlexPlan.creatorsLimit === -1 ? 'Unlimited' : fameFlexPlan.creatorsLimit.toLocaleString()
    });

    // Step 2: Get current user state using normalized tables
    console.log('📊 [UPGRADE-TO-FAME-FLEX] Getting current user state...');
    const currentState = await getUserProfile(TARGET_USER_ID);

    if (!currentState) {
      console.error('❌ [UPGRADE-TO-FAME-FLEX] User not found in database');
      console.error('❌ [UPGRADE-TO-FAME-FLEX] Please ensure user exists first');
      process.exit(1);
    }

    console.log(`📈 [UPGRADE-TO-FAME-FLEX] Current user state:`, {
      plan: currentState.currentPlan,
      trialStatus: currentState.trialStatus,
      subscriptionStatus: currentState.subscriptionStatus,
      onboarding: currentState.onboardingStep,
      campaignsUsed: currentState.usageCampaignsCurrent,
      creatorsUsed: currentState.usageCreatorsCurrentMonth
    });

    // Step 3: Perform the upgrade using normalized tables update
    console.log('🔄 [UPGRADE-TO-FAME-FLEX] Upgrading user to Fame Flex plan...');
    
    const now = new Date();
    const renewalDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await updateUserProfile(TARGET_USER_ID, {
      // Subscription updates
      currentPlan: 'fame_flex',
      intendedPlan: 'fame_flex', // Set intended plan to match current
      subscriptionStatus: 'active',
      trialStatus: 'converted', // Mark trial as converted
      trialConversionDate: now, // Record conversion date
      subscriptionRenewalDate: renewalDate,
      billingSyncStatus: 'synced', // Mark as synced
      
      // Usage updates - set to Fame Flex limits (unlimited = -1)
      planCampaignsLimit: fameFlexPlan.campaignsLimit, // -1 for unlimited
      planCreatorsLimit: fameFlexPlan.creatorsLimit,   // -1 for unlimited
      planFeatures: fameFlexPlan.features, // JSON features from database
      
      // Reset usage counters for new plan
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0,
      usageResetDate: now,
      
      // System updates
      lastWebhookEvent: 'manual_upgrade_to_fame_flex',
      lastWebhookTimestamp: now
    });

    console.log('✅ [UPGRADE-TO-FAME-FLEX] Successfully upgraded user to Fame Flex plan!');
    console.log('');

    // Step 4: Verify the upgrade using normalized tables
    console.log('🔍 [UPGRADE-TO-FAME-FLEX] Verifying upgrade...');
    const upgradedState = await getUserProfile(TARGET_USER_ID);

    if (upgradedState?.currentPlan === 'fame_flex') {
      console.log('🎉 [UPGRADE-TO-FAME-FLEX] Upgrade verification successful!');
      console.log('');
      console.log('📊 [UPGRADE-TO-FAME-FLEX] New user state:');
      console.log(`   Plan: ${upgradedState.currentPlan} (${fameFlexPlan.displayName})`);
      console.log(`   Subscription Status: ${upgradedState.subscriptionStatus}`);
      console.log(`   Trial Status: ${upgradedState.trialStatus}`);
      console.log(`   Campaigns Limit: ${upgradedState.planCampaignsLimit === -1 ? 'Unlimited' : upgradedState.planCampaignsLimit}`);
      console.log(`   Creators Limit: ${upgradedState.planCreatorsLimit === -1 ? 'Unlimited' : upgradedState.planCreatorsLimit?.toLocaleString()}`);
      console.log(`   Usage Reset: ${upgradedState.usageResetDate?.toLocaleDateString()}`);
      console.log(`   Renewal Date: ${upgradedState.subscriptionRenewalDate?.toLocaleDateString()}`);
      console.log(`   Conversion Date: ${upgradedState.trialConversionDate?.toLocaleDateString()}`);
      console.log('');

      // Step 5: Display Fame Flex features
      console.log('🌟 [UPGRADE-TO-FAME-FLEX] Fame Flex plan features activated:');
      const features = upgradedState.planFeatures;
      if (features.platforms) {
        console.log(`   • Platforms: ${features.platforms.join(', ')}`);
      }
      if (features.exportFormats) {
        console.log(`   • Export Formats: ${features.exportFormats.join(', ')}`);
      }
      if (features.apiAccess) {
        console.log(`   • API Access: Enabled`);
      }
      if (features.customIntegrations) {
        console.log(`   • Custom Integrations: Enabled`);
      }
      if (features.dedicatedSupport) {
        console.log(`   • Dedicated Support: Enabled`);
      }
      console.log('');

      console.log('📝 [UPGRADE-TO-FAME-FLEX] Next steps:');
      console.log('   1. User now has UNLIMITED campaigns and creators');
      console.log('   2. All Fame Flex features are active');
      console.log('   3. API access and custom integrations enabled');
      console.log('   4. Dedicated support level activated');
      console.log('   5. Usage counters have been reset');
      console.log('   6. Clear browser localStorage if needed:');
      console.log('      - gemz_entitlements_v1');
      console.log('      - gemz_trial_status_v1');
      console.log('   7. User should see Fame Flex features in the UI');

    } else {
      console.error('❌ [UPGRADE-TO-FAME-FLEX] Upgrade verification failed!');
      console.error(`❌ [UPGRADE-TO-FAME-FLEX] Expected: fame_flex, Got: ${upgradedState?.currentPlan}`);
    }

  } catch (error) {
    console.error('❌ [UPGRADE-TO-FAME-FLEX] Upgrade failed:', error);
    console.error('');
    console.error('💡 [UPGRADE-TO-FAME-FLEX] Troubleshooting:');
    console.error('   • Check database connection');
    console.error('   • Ensure user exists in normalized tables');
    console.error('   • Verify subscription_plans table has Fame Flex plan');
    console.error('   • Check if database migration is complete');
  } finally {
    await postgresClient.end();
  }
}

// Script usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🚀 Upgrade User to Fame Flex Plan');
  console.log('');
  console.log('Usage:');
  console.log('  npm run upgrade-to-fame-flex');
  console.log('  npx tsx scripts/upgrade-user-to-fame-flex.ts');
  console.log('  npx tsx scripts/upgrade-user-to-fame-flex.ts [user-id]');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DATABASE_URL - PostgreSQL connection string (required)');
  console.log('  TEST_USER_ID - Default user ID to upgrade (optional)');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/upgrade-user-to-fame-flex.ts user_123456');
  console.log('  TEST_USER_ID="user_123456" npx tsx scripts/upgrade-user-to-fame-flex.ts');
  console.log('');
  process.exit(0);
}

// Run the upgrade
upgradeUserToFameFlex();