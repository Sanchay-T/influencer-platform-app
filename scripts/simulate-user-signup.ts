import { createUser } from '../lib/db/queries/user-queries';

const TEST_USER_ID = 'b9b65707-10e9-4d2b-85eb-130f513d7c59';

async function simulateUserSignup() {
  console.log('👤 [SIMULATE-SIGNUP] ====================================');
  console.log('👤 [SIMULATE-SIGNUP] SIMULATING NORMAL USER SIGNUP FLOW');
  console.log('👤 [SIMULATE-SIGNUP] ====================================');
  console.log(`👤 [SIMULATE-SIGNUP] Creating user: ${TEST_USER_ID}`);
  
  try {
    // Simulate what Clerk webhook does when user signs up
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    const newUser = await createUser({
      userId: TEST_USER_ID,
      email: 'test@example.com',
      fullName: 'Test User',
      onboardingStep: 'pending', // Will trigger onboarding modal
      
      // Trial system - Start 7-day trial immediately (like webhook does)
      trialStartDate: now,
      trialEndDate: trialEndDate,
      
      // Subscription defaults
      currentPlan: 'free', // Start with free, upgrade during onboarding
    });

    console.log('✅ [SIMULATE-SIGNUP] User created successfully!');
    console.log('📊 [SIMULATE-SIGNUP] User details:');
    console.log(`   👤 Full Name: ${newUser.fullName}`);
    console.log(`   📧 Email: ${newUser.email}`);
    console.log(`   🆔 Clerk ID: ${newUser.userId}`);
    console.log(`   📋 Onboarding Step: ${newUser.onboardingStep}`);
    console.log(`   🔄 Trial Status: ${newUser.trialStatus}`);
    console.log(`   📅 Trial Expires: ${newUser.trialEndDate?.toLocaleDateString()}`);
    console.log(`   💰 Current Plan: ${newUser.currentPlan}`);
    
    console.log('');
    console.log('🎯 [SIMULATE-SIGNUP] Next steps in normal user journey:');
    console.log('   1. ✅ User created in database (DONE)');
    console.log('   2. 🔄 User sees onboarding modal');
    console.log('   3. 💳 User makes payment');
    console.log('   4. 🎉 Payment success page processes upgrade');
    console.log('');
    console.log('🧪 [SIMULATE-SIGNUP] Ready to test payment flow!');

  } catch (error) {
    console.error('❌ [SIMULATE-SIGNUP] Failed to create user:', error);
  }
}

// Run the simulation
simulateUserSignup();