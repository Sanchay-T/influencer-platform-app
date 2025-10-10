import '@/lib/config/load-env';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createUser } from '@/lib/db/queries/user-queries';
import { isAdminUser } from '@/lib/auth/admin-utils';

/**
 * Creates a test user directly in the database for testing the onboarding flow
 * This bypasses Clerk and creates a user profile that can be used for testing
 */
export async function POST(req: Request) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ error: 'Test user creation disabled during build' }, { status: 503 });
    }
    // Check admin authorization
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('🧪 [TEST-USER-CREATE] Starting test user creation process');
    console.log('📧 [TEST-USER-CREATE] Email provided:', email);

    // Generate a test user ID (you can use this to "login" as the test user)
    const testUserId = `test_user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const testPassword = `test_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log('🆔 [TEST-USER-CREATE] Generated test credentials:', {
      userId: testUserId,
      password: testPassword,
      email: email
    });

    // Create test user profile in database
    await createUser({
      userId: testUserId,
      email: email,
      fullName: null,
      businessName: null,
      brandDescription: null,
      onboardingStep: 'pending'
    });

    console.log('✅ [TEST-USER-CREATE] Test user profile created in database');

    // Return the test credentials
    const testCredentials = {
      userId: testUserId,
      password: testPassword,
      email: email,
      loginUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/test-login`,
      onboardingUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
      instructions: [
        '1. Use the returned userId and password to simulate login',
        '2. Or create a new regular account with the provided email',
        '3. Navigate to /onboarding to start the flow',
        '4. Watch server logs for detailed onboarding tracking'
      ]
    };

    console.log('🎯 [TEST-USER-CREATE] Test user creation completed');
    console.log('📋 [TEST-USER-CREATE] Test credentials:', testCredentials);

    return NextResponse.json({
      success: true,
      message: 'Test user created successfully',
      credentials: testCredentials,
      note: 'Use these credentials to test the onboarding flow with detailed logging'
    });

  } catch (error: any) {
    console.error('❌ [TEST-USER-CREATE] Error creating test user:', error);
    return NextResponse.json({
      error: 'Failed to create test user',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get all test users (for cleanup/management)
 */
export async function GET(req: Request) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ testUsers: [] });
    }
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all test users (users with userId starting with "test_user_")
    // Note: This would need a custom query for the normalized schema
    // For now, return empty array as this is just for testing
    const testUsers: any[] = [];

    console.log(`📊 [TEST-USER-LIST] Found ${testUsers.length} test users`);

    return NextResponse.json({
      testUsers: testUsers.map(user => ({
        userId: user.userId,
        onboardingStep: user.onboardingStep,
        trialStatus: user.trialStatus,
        createdAt: user.signupTimestamp,
        fullName: user.fullName,
        businessName: user.businessName
      }))
    });

  } catch (error: any) {
    console.error('❌ [TEST-USER-LIST] Error listing test users:', error);
    return NextResponse.json({
      error: 'Failed to list test users'
    }, { status: 500 });
  }
}
