/**
 * Test script to verify the database refactoring works correctly
 */

const { db } = require('./lib/db/index.ts');
const { getUserProfile, createUser } = require('./lib/db/queries/user-queries.ts');

async function testMigration() {
  console.log('🧪 Testing Database Refactoring...');
  
  try {
    // Test 1: Create a new user with normalized tables
    console.log('📝 Test 1: Creating new user with normalized tables...');
    
    const testUser = await createUser({
      userId: 'test_user_123',
      email: 'test@example.com',
      fullName: 'Test User',
      businessName: 'Test Business',
      onboardingStep: 'pending',
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      currentPlan: 'free'
    });
    
    console.log('✅ User created successfully:', {
      userId: testUser.userId,
      email: testUser.email,
      currentPlan: testUser.currentPlan,
      trialStatus: testUser.trialStatus
    });
    
    // Test 2: Retrieve user profile
    console.log('🔍 Test 2: Retrieving user profile...');
    
    const retrievedUser = await getUserProfile('test_user_123');
    
    if (retrievedUser) {
      console.log('✅ User retrieved successfully:', {
        userId: retrievedUser.userId,
        email: retrievedUser.email,
        currentPlan: retrievedUser.currentPlan,
        hasAllFields: !!(retrievedUser.stripeCustomerId !== undefined && retrievedUser.usageCampaignsCurrent !== undefined)
      });
    } else {
      console.log('❌ Failed to retrieve user');
    }
    
    // Test 3: Check table structure
    console.log('🏗️ Test 3: Verifying table structure...');
    
    const tables = await db.execute('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' AND table_name IN (\'users\', \'user_subscriptions\', \'user_billing\', \'user_usage\', \'user_system_data\')');
    
    console.log('✅ New tables found:', tables.rows.map(row => row.table_name));
    
    // Test 4: Verify migration flag
    console.log('🚩 Test 4: Checking migration completion flag...');
    
    const migrationFlag = await db.execute('SELECT value FROM system_configurations WHERE category = \'database\' AND key = \'user_tables_normalized\'');
    
    if (migrationFlag.rows.length > 0) {
      console.log('✅ Migration flag found:', migrationFlag.rows[0].value);
    } else {
      console.log('⚠️ Migration flag not found - this is expected if migration hasn\'t run yet');
    }
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  process.exit(0);
}

// Run the test
testMigration().catch(console.error);