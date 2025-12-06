import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, userSubscriptions, userBilling, userUsage, userSystemData } from '../lib/db/schema';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const postgresClient = postgres(connectionString);
const db = drizzle(postgresClient);

const TEST_USER_ID = 'b9b65707-10e9-4d2b-85eb-130f513d7c59';

async function createTestUser() {
  console.log('🧪 [CREATE-TEST-USER] Creating test user in normalized tables...');
  console.log('👤 [CREATE-TEST-USER] User ID:', TEST_USER_ID);
  
  try {
    // Step 1: Create core user record
    console.log('1️⃣ [CREATE-TEST-USER] Inserting into users table...');
    const [newUser] = await db.insert(users).values({
      userId: TEST_USER_ID,
      email: 'test@example.com',
      fullName: 'Test User',
      businessName: 'Test Business',
      brandDescription: 'Testing onboarding flow',
      industry: 'Technology',
      onboardingStep: 'pending',
      isAdmin: false
    }).returning();
    
    console.log('✅ [CREATE-TEST-USER] User created:', newUser.id);

    // Step 2: Create subscription record with active trial
    console.log('2️⃣ [CREATE-TEST-USER] Inserting into user_subscriptions table...');
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const [newSubscription] = await db.insert(userSubscriptions).values({
      userId: newUser.id,
      currentPlan: 'free',
      intendedPlan: null,
      subscriptionStatus: 'trialing',
      trialStatus: 'active',
      trialStartDate: now,
      trialEndDate: trialEndDate,
      billingSyncStatus: 'pending'
    }).returning();
    
    console.log('✅ [CREATE-TEST-USER] Subscription created:', newSubscription.id);

    // Step 3: Create billing record (empty for now)
    console.log('3️⃣ [CREATE-TEST-USER] Inserting into user_billing table...');
    const [newBilling] = await db.insert(userBilling).values({
      userId: newUser.id,
      stripeCustomerId: null,
      stripeSubscriptionId: null
    }).returning();
    
    console.log('✅ [CREATE-TEST-USER] Billing created:', newBilling.id);

    // Step 4: Create usage record
    console.log('4️⃣ [CREATE-TEST-USER] Inserting into user_usage table...');
    const [newUsage] = await db.insert(userUsage).values({
      userId: newUser.id,
      planCampaignsLimit: 0,
      planCreatorsLimit: 0,
      planFeatures: {},
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0,
      enrichmentsCurrentMonth: 0,
      usageResetDate: now
    }).returning();
    
    console.log('✅ [CREATE-TEST-USER] Usage created:', newUsage.id);

    // Step 5: Create system data record
    console.log('5️⃣ [CREATE-TEST-USER] Inserting into user_system_data table...');
    const [newSystemData] = await db.insert(userSystemData).values({
      userId: newUser.id,
      signupTimestamp: now,
      emailScheduleStatus: {},
      lastWebhookEvent: null,
      lastWebhookTimestamp: null
    }).returning();
    
    console.log('✅ [CREATE-TEST-USER] System data created:', newSystemData.id);

    console.log('\n🎉 [CREATE-TEST-USER] Test user created successfully in all normalized tables!');
    console.log('📊 [CREATE-TEST-USER] Summary:');
    console.log(`   👤 User: ${newUser.fullName} (${newUser.email})`);
    console.log(`   🆔 Clerk ID: ${newUser.userId}`);
    console.log(`   📋 Onboarding: ${newUser.onboardingStep}`);
    console.log(`   🔄 Trial Status: ${newSubscription.trialStatus}`);
    console.log(`   📅 Trial Expires: ${trialEndDate.toLocaleDateString()}`);
    console.log(`   💰 Plan: ${newSubscription.currentPlan}`);
    console.log(`   📈 Campaign Limit: ${newUsage.planCampaignsLimit}`);
    console.log(`   👥 Creator Limit: ${newUsage.planCreatorsLimit}`);

  } catch (error) {
    console.error('❌ [CREATE-TEST-USER] Failed to create test user:', error);
  } finally {
    await postgresClient.end();
  }
}

// Run the creation
createTestUser();
