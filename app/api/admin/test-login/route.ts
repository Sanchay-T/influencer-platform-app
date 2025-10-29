import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { isAdminUser } from '@/lib/auth/admin-utils';

/**
 * Simulates login for test users by setting environment variables
 * This allows testing the onboarding flow without Clerk authentication
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, password } = await req.json();
    
    if (!userId || !password) {
      return NextResponse.json({ 
        error: 'userId and password are required' 
      }, { status: 400 });
    }

    structuredConsole.log('🔐 [TEST-LOGIN] Attempting test login for userId:', userId);

    // Verify the test user exists in database
    const testUser = await getUserProfile(userId);

    if (!testUser) {
      structuredConsole.error('❌ [TEST-LOGIN] Test user not found:', userId);
      return NextResponse.json({ 
        error: 'Test user not found' 
      }, { status: 404 });
    }

    if (!userId.startsWith('test_user_')) {
      structuredConsole.error('❌ [TEST-LOGIN] Invalid test user ID format:', userId);
      return NextResponse.json({ 
        error: 'Invalid test user ID format' 
      }, { status: 400 });
    }

    structuredConsole.log('✅ [TEST-LOGIN] Test user verified:', {
      userId: testUser.userId,
      onboardingStep: testUser.onboardingStep,
      fullName: testUser.fullName,
      businessName: testUser.businessName
    });

    // For test authentication, we'll use the existing TEST_AUTH system
    // The frontend should check if TEST_AUTH is enabled and use the TEST_USER_ID
    
    const authInstructions = {
      success: true,
      message: 'Test login verified',
      testUser: {
        userId: testUser.userId,
        onboardingStep: testUser.onboardingStep,
        fullName: testUser.fullName,
        businessName: testUser.businessName,
        trialStatus: testUser.trialStatus
      },
      instructions: [
        '1. Set ENABLE_TEST_AUTH=true in your .env.local',
        `2. Set TEST_USER_ID=${userId} in your .env.local`,
        '3. Restart your development server',
        '4. Navigate to /onboarding to start the test flow',
        '5. Watch console logs for detailed onboarding tracking'
      ],
      nextSteps: {
        onboardingUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
        currentStep: testUser.onboardingStep,
        recommendedAction: testUser.onboardingStep === 'pending' 
          ? 'Start with Step 1 (Basic Info)'
          : `Continue from ${testUser.onboardingStep}`
      }
    };

    structuredConsole.log('🎯 [TEST-LOGIN] Test login setup completed');
    structuredConsole.log('📋 [TEST-LOGIN] Instructions provided for test authentication');

    return NextResponse.json(authInstructions);

  } catch (error: any) {
    structuredConsole.error('❌ [TEST-LOGIN] Error in test login:', error);
    return NextResponse.json({
      error: 'Failed to setup test login',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get current test authentication status
 */
export async function GET(req: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentTestUserId = process.env.TEST_USER_ID;
    const testAuthEnabled = process.env.ENABLE_TEST_AUTH === 'true';

    structuredConsole.log('📊 [TEST-LOGIN-STATUS] Current test auth status:', {
      enabled: testAuthEnabled,
      currentTestUserId
    });

    let testUserProfile = null;
    if (currentTestUserId && testAuthEnabled) {
      testUserProfile = await getUserProfile(currentTestUserId);
    }

    return NextResponse.json({
      testAuth: {
        enabled: testAuthEnabled,
        currentUserId: currentTestUserId,
        userProfile: testUserProfile ? {
          userId: testUserProfile.userId,
          onboardingStep: testUserProfile.onboardingStep,
          fullName: testUserProfile.fullName,
          businessName: testUserProfile.businessName,
          trialStatus: testUserProfile.trialStatus
        } : null
      },
      instructions: testAuthEnabled 
        ? `Test auth is active for user: ${currentTestUserId}`
        : 'Test auth is disabled. Use POST to setup test login.'
    });

  } catch (error: any) {
    structuredConsole.error('❌ [TEST-LOGIN-STATUS] Error checking status:', error);
    return NextResponse.json({
      error: 'Failed to check test login status'
    }, { status: 500 });
  }
}