import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';

export async function PATCH(request: Request) {
  try {
    const startTime = Date.now();
    const requestId = `step2_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    structuredConsole.log('🚀🚀🚀 [ONBOARDING-STEP2] ===============================');
    structuredConsole.log('🚀🚀🚀 [ONBOARDING-STEP2] STARTING STEP 2 - BRAND DESCRIPTION');
    structuredConsole.log('🚀🚀🚀 [ONBOARDING-STEP2] ===============================');
    structuredConsole.log('🆔 [ONBOARDING-STEP2] Request ID:', requestId);
    structuredConsole.log('⏰ [ONBOARDING-STEP2] Timestamp:', new Date().toISOString());
    structuredConsole.log('🔐 [ONBOARDING-STEP2] Getting authenticated user from Clerk');
    const { userId } = await getAuthOrTest();

    if (!userId) {
      structuredConsole.error('❌ [ONBOARDING-STEP2] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { brandDescription } = await request.json();
    structuredConsole.log('📥 [ONBOARDING-STEP2] Data received:', {
      brandDescription: brandDescription || 'NOT_PROVIDED',
      brandDescriptionLength: brandDescription?.length || 0,
      userId,
      requestId
    });
    
    structuredConsole.log('📝 [ONBOARDING-STEP2] Brand description preview:', 
      brandDescription ? brandDescription.substring(0, 100) + '...' : 'No description provided');

    if (!brandDescription?.trim()) {
      return NextResponse.json({ 
        error: 'Brand description is required' 
      }, { status: 400 });
    }

    // Check if user profile exists
    structuredConsole.log('🔍 [ONBOARDING-STEP2] Looking up existing user profile...');
    const existingProfile = await getUserProfile(userId);
    
    structuredConsole.log('📊 [ONBOARDING-STEP2] Profile lookup result:', {
      profileExists: !!existingProfile,
      currentStep: existingProfile?.onboardingStep || 'NOT_FOUND',
      hasBasicInfo: !!(existingProfile?.fullName && existingProfile?.businessName),
      hasExistingDescription: !!existingProfile?.brandDescription
    });

    if (!existingProfile) {
      structuredConsole.error('❌ [ONBOARDING-STEP2] User profile not found');
      return NextResponse.json({ 
        error: 'User profile not found. Please complete step 1 first.' 
      }, { status: 404 });
    }

    // Update profile with brand description
    structuredConsole.log('🔄🔄🔄 [ONBOARDING-STEP2] UPDATING PROFILE WITH BRAND DESCRIPTION');
    structuredConsole.log('📝 [ONBOARDING-STEP2] Previous description:', existingProfile.brandDescription || 'None');
    structuredConsole.log('📝 [ONBOARDING-STEP2] New description length:', brandDescription.trim().length);
    
    await updateUserProfile(userId, {
      brandDescription: brandDescription.trim(),
      onboardingStep: 'intent_captured',
    });

    structuredConsole.log('✅✅✅ [ONBOARDING-STEP2] PROFILE UPDATED SUCCESSFULLY');
    structuredConsole.log('💾 [ONBOARDING-STEP2] Update completed in:', Date.now() - startTime, 'ms');
    structuredConsole.log('📊 [ONBOARDING-STEP2] Profile now ready for completion');

    const totalTime = Date.now() - startTime;
    
    structuredConsole.log('🎉🎉🎉 [ONBOARDING-STEP2] ===============================');
    structuredConsole.log('🎉🎉🎉 [ONBOARDING-STEP2] STEP 2 COMPLETED SUCCESSFULLY');
    structuredConsole.log('🎉🎉🎉 [ONBOARDING-STEP2] ===============================');
    structuredConsole.log('⏱️ [ONBOARDING-STEP2] Total execution time:', totalTime, 'ms');
    structuredConsole.log('📊 [ONBOARDING-STEP2] Summary:', {
      action: 'BRAND_DESCRIPTION_CAPTURED',
      descriptionLength: brandDescription.trim().length,
      userId,
      requestId,
      executionTime: totalTime
    });
    structuredConsole.log('➡️ [ONBOARDING-STEP2] Next step: User should complete onboarding to start trial');
    
    return NextResponse.json({ 
      success: true,
      message: 'Step 2 completed successfully',
      data: {
        requestId,
        executionTime: totalTime,
        nextStep: '/onboarding/complete'
      }
    });

  } catch (error: any) {
    structuredConsole.error('💥 [ONBOARDING-STEP2] Error saving step 2 data:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}