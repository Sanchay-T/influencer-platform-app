import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🔍 [ONBOARDING-STATUS] Checking onboarding status');
    const { userId } = await auth();

    if (!userId) {
      console.error('❌ [ONBOARDING-STATUS] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [ONBOARDING-STATUS] User authenticated:', userId);

    // Check if user profile exists
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!userProfile) {
      console.log('🆕 [ONBOARDING-STATUS] User profile not found, new user detected');
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    console.log('📊 [ONBOARDING-STATUS] User profile found:', {
      userId: userProfile.userId,
      onboardingStep: userProfile.onboardingStep,
      fullName: userProfile.fullName,
      businessName: userProfile.businessName
    });

    return NextResponse.json({
      userId: userProfile.userId,
      onboardingStep: userProfile.onboardingStep,
      fullName: userProfile.fullName,
      businessName: userProfile.businessName,
      brandDescription: userProfile.brandDescription,
      signupTimestamp: userProfile.signupTimestamp
    });

  } catch (error: any) {
    console.error('💥 [ONBOARDING-STATUS] Error checking onboarding status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}