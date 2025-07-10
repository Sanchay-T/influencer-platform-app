import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTrialStatus } from '@/lib/trial/trial-service';

export async function GET() {
  try {
    console.log('🔐 [PROFILE-API-GET] Getting authenticated user from Clerk');
    const { userId } = await auth();

    if (!userId) {
      console.error('❌ [PROFILE-API-GET] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [PROFILE-API-GET] User authenticated', { userId });

    // Buscar el perfil del usuario
    console.log('🔍 [PROFILE-API-GET] Fetching user profile');
    const userProfile = await db.query.userProfiles.findFirst({
      where: (userProfiles, { eq }) => eq(userProfiles.userId, userId),
    });

    if (!userProfile) {
      console.log('ℹ️ [PROFILE-API-GET] No profile found for user');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get trial status data
    console.log('🎯 [PROFILE-API-GET] Fetching trial status');
    const trialData = await getTrialStatus(userId);

    // Prepare response with trial data
    const responseData = {
      // Basic profile info
      id: userProfile.id,
      userId: userProfile.userId,
      name: userProfile.name,
      companyName: userProfile.companyName,
      industry: userProfile.industry,
      email: userProfile.email,
      
      // Onboarding info
      signupTimestamp: userProfile.signupTimestamp,
      onboardingStep: userProfile.onboardingStep,
      fullName: userProfile.fullName,
      businessName: userProfile.businessName,
      brandDescription: userProfile.brandDescription,
      emailScheduleStatus: userProfile.emailScheduleStatus,
      
      // Trial system data
      trialData: trialData ? {
        status: trialData.trialStatus,
        startDate: trialData.trialStartDate?.toISOString(),
        endDate: trialData.trialEndDate?.toISOString(),
        daysRemaining: trialData.daysRemaining,
        hoursRemaining: trialData.hoursRemaining,
        minutesRemaining: trialData.minutesRemaining,
        progressPercentage: trialData.progressPercentage,
        timeUntilExpiry: trialData.timeUntilExpiry,
        isExpired: trialData.isExpired,
        stripeCustomerId: trialData.stripeCustomerId,
        stripeSubscriptionId: trialData.stripeSubscriptionId,
        subscriptionStatus: trialData.subscriptionStatus
      } : null,
      
      // Timestamps
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt
    };

    console.log('✅ [PROFILE-API-GET] Profile fetched successfully', { 
      profileId: userProfile.id,
      hasTrialData: !!trialData,
      trialStatus: trialData?.trialStatus || 'none',
      daysRemaining: trialData?.daysRemaining || 0
    });
    
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('💥 [PROFILE-API-GET] Error fetching profile:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('🔐 [PROFILE-API] Getting authenticated user from Clerk');
    const { userId } = await auth();

    if (!userId) {
      console.error('❌ [PROFILE-API] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [PROFILE-API] User authenticated', { userId });

    const { name, companyName, industry } = await request.json();
    console.log('📥 [PROFILE-API] Profile data received', { name, companyName, industry });

    // Verificar si ya existe un perfil
    console.log('🔍 [PROFILE-API] Checking for existing profile');
    const existingUser = await db.query.userProfiles.findFirst({
      where: (userProfiles, { eq }) => eq(userProfiles.userId, userId),
    });

    if (existingUser) {
      console.log('⚠️ [PROFILE-API] Profile already exists for user');
      return NextResponse.json({ 
        error: 'Ya existe un perfil para este usuario' 
      }, { status: 400 });
    }

    // Crear el perfil
    console.log('🔄 [PROFILE-API] Creating new profile');
    const [profile] = await db.insert(userProfiles).values({
      userId,
      name,
      companyName,
      industry,
    }).returning();

    console.log('✅ [PROFILE-API] Profile created successfully', { profileId: profile.id });
    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('💥 [PROFILE-API] Error creating profile:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 