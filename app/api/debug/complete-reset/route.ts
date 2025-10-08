import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/backend-auth';
import { db } from '@/lib/db';
import { getUserProfile, createUser } from '@/lib/db/queries/user-queries';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('🔄🔄🔄 [COMPLETE-RESET] ===================================');
    console.log('🔄🔄🔄 [COMPLETE-RESET] STARTING COMPLETE USER RESET');
    console.log('🔄🔄🔄 [COMPLETE-RESET] ===================================');
    console.log('🔑 [COMPLETE-RESET] User ID:', userId);

    // Step 1: Delete existing user from normalized tables
    // Find the user first
    const existingUser = await getUserProfile(userId);
    if (existingUser) {
      await db.delete(users).where(eq(users.userId, userId));
      console.log('🗑️ [COMPLETE-RESET] Deleted existing user profile');
    }

    // Step 2: Create fresh profile with pending onboarding
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    const freshProfile = {
      userId: userId,
      email: null, // Will be populated by backfill or onboarding
      fullName: null,
      businessName: null,
      signupTimestamp: now,
      onboardingStep: 'pending', // ✅ Force onboarding to restart
      
      // Fresh trial
      trialStartDate: now,
      trialEndDate: trialEndDate,
      trialStatus: 'active',
      
      // Reset to free plan
      currentPlan: 'free',
      subscriptionStatus: 'none',
      
      // Reset limits
      planCampaignsLimit: 0,
      planCreatorsLimit: 0,
      planFeatures: {},
      
      // Reset usage
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0,
      usageResetDate: now,
      
      // Reset billing
      billingSyncStatus: 'pending',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      
      // Admin
      isAdmin: false,
      
      // Timestamps
      createdAt: now,
      updatedAt: now
    };

    // Step 2: Create fresh user profile using normalized schema
    await createUser({
      userId: userId,
      onboardingStep: 'pending',
      trialStartDate: now,
      trialEndDate: trialEndDate,
      currentPlan: 'free'
    });
    console.log('✅ [COMPLETE-RESET] Created fresh user profile with pending onboarding');

    console.log('🔄🔄🔄 [COMPLETE-RESET] ===================================');
    console.log('🔄🔄🔄 [COMPLETE-RESET] RESET COMPLETE - NEXT STEPS:');
    console.log('🔄🔄🔄 [COMPLETE-RESET] 1. Clear browser cache/localStorage');
    console.log('🔄🔄🔄 [COMPLETE-RESET] 2. Refresh the page');
    console.log('🔄🔄🔄 [COMPLETE-RESET] 3. Onboarding should appear');
    console.log('🔄🔄🔄 [COMPLETE-RESET] ===================================');

    return NextResponse.json({
      success: true,
      message: 'User reset complete',
      nextSteps: [
        'Clear browser cache and localStorage',
        'Refresh the page or navigate to /onboarding',
        'Onboarding modal should appear'
      ],
      profile: {
        userId,
        onboardingStep: 'pending',
        trialStatus: 'active',
        currentPlan: 'free'
      }
    });

  } catch (error) {
    console.error('💥 [COMPLETE-RESET] Error:', error);
    return NextResponse.json({ 
      error: 'Reset failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to reset user profile',
    instructions: 'Send POST request to this endpoint to completely reset your user profile'
  });
}