import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      console.log('🚫 [DEBUG-WHOAMI] No authenticated user');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');
    console.log('🆔🆔🆔 [DEBUG-WHOAMI] CURRENT USER IDENTIFICATION');
    console.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');
    console.log('🔑 [DEBUG-WHOAMI] Clerk User ID:', userId);
    console.log('⏰ [DEBUG-WHOAMI] Timestamp:', new Date().toISOString());

    // Get user profile
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (userProfile) {
      console.log('👤 [DEBUG-WHOAMI] User Profile Found:');
      console.log('📧 [DEBUG-WHOAMI] Email:', userProfile.email || 'NOT_SET');
      console.log('👤 [DEBUG-WHOAMI] Full Name:', userProfile.fullName || 'NOT_SET');
      console.log('🏢 [DEBUG-WHOAMI] Business Name:', userProfile.businessName || 'NOT_SET');
      console.log('📋 [DEBUG-WHOAMI] Onboarding Step:', userProfile.onboardingStep);
      console.log('🔄 [DEBUG-WHOAMI] Trial Status:', userProfile.trialStatus);
      console.log('💳 [DEBUG-WHOAMI] Current Plan:', userProfile.currentPlan);
      console.log('📅 [DEBUG-WHOAMI] Created At:', userProfile.createdAt);
      console.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');
    } else {
      console.log('❌ [DEBUG-WHOAMI] No user profile found in database');
      console.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');
    }

    return NextResponse.json({
      userId,
      userProfile: userProfile ? {
        email: userProfile.email,
        fullName: userProfile.fullName,
        businessName: userProfile.businessName,
        onboardingStep: userProfile.onboardingStep,
        trialStatus: userProfile.trialStatus,
        currentPlan: userProfile.currentPlan,
        createdAt: userProfile.createdAt
      } : null,
      message: 'Check server console for detailed logs'
    });

  } catch (error) {
    console.error('💥 [DEBUG-WHOAMI] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}