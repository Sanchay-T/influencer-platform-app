import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, createUser } from '@/lib/db/queries/user-queries';
import { getTrialStatus } from '@/lib/trial/trial-service';

export async function GET() {
  try {
    const startedAt = Date.now();
    const reqId = `prof_get_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    structuredConsole.log(`🟢 [PROFILE-API-GET:${reqId}] START ${ts}`);
    structuredConsole.log('🔐 [PROFILE-API-GET] Getting authenticated user from Clerk');
    const { userId } = await getAuthOrTest();

    if (!userId) {
      structuredConsole.error('❌ [PROFILE-API-GET] Unauthorized - No valid user session');
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return res;
    }
    structuredConsole.log('✅ [PROFILE-API-GET] User authenticated', { userId });

    // Buscar el perfil del usuario
    structuredConsole.log('🔍 [PROFILE-API-GET] Fetching user profile');
    const profileStart = Date.now();
    const userProfile = await getUserProfile(userId);
    structuredConsole.log(`⏱️ [PROFILE-API-GET:${reqId}] DB profile query: ${Date.now() - profileStart}ms`);

    if (!userProfile) {
      structuredConsole.log('ℹ️ [PROFILE-API-GET] No profile found for user');
      const res = NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return res;
    }

    // Get trial status data
    structuredConsole.log('🎯 [PROFILE-API-GET] Fetching trial status');
    const trialStart = Date.now();
    const trialData = await getTrialStatus(userId);
    structuredConsole.log(`⏱️ [PROFILE-API-GET:${reqId}] Trial service duration: ${Date.now() - trialStart}ms`);

    // Prepare response with trial data
    const responseData = {
      // Basic profile info
      id: userProfile.id,
      userId: userProfile.userId,
      name: userProfile.fullName, // Use fullName instead of name for normalized data
      companyName: userProfile.businessName, // Use businessName instead of companyName
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

    const duration = Date.now() - startedAt;
    structuredConsole.log('✅ [PROFILE-API-GET] Profile fetched successfully', { 
      profileId: userProfile.id,
      hasTrialData: !!trialData,
      trialStatus: trialData?.trialStatus || 'none',
      daysRemaining: trialData?.daysRemaining || 0,
      duration
    });
    const res = NextResponse.json(responseData);
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-started-at', ts);
    res.headers.set('x-duration-ms', String(duration));
    structuredConsole.log(`🟣 [PROFILE-API-GET:${reqId}] END duration=${duration}ms`);
    return res;
  } catch (error: any) {
    const reqId = `prof_get_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    structuredConsole.error(`💥 [PROFILE-API-GET:${reqId}] Error fetching profile:`, error);
    const res = NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-duration-ms', '0');
    return res;
  }
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
    const reqId = `prof_post_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    structuredConsole.log(`🟢 [PROFILE-API:${reqId}] START ${ts}`);
    structuredConsole.log('🔐 [PROFILE-API] Getting authenticated user from Clerk');
    const { userId } = await getAuthOrTest();

    if (!userId) {
      structuredConsole.error('❌ [PROFILE-API] Unauthorized - No valid user session');
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return res;
    }
    structuredConsole.log('✅ [PROFILE-API] User authenticated', { userId });

    const { name, companyName, industry } = await request.json();
    structuredConsole.log('📥 [PROFILE-API] Profile data received', { name, companyName, industry });

    // Verificar si ya existe un perfil
    structuredConsole.log('🔍 [PROFILE-API] Checking for existing profile');
    const checkStart = Date.now();
    const existingUser = await getUserProfile(userId);
    structuredConsole.log(`⏱️ [PROFILE-API:${reqId}] DB existence check: ${Date.now() - checkStart}ms`);

    if (existingUser) {
      structuredConsole.log('⚠️ [PROFILE-API] Profile already exists for user');
      const res = NextResponse.json({ 
        error: 'Ya existe un perfil para este usuario' 
      }, { status: 400 });
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return res;
    }

    // Crear el perfil
    structuredConsole.log('🔄 [PROFILE-API] Creating new profile');
    const insertStart = Date.now();
    const profile = await createUser({
      userId,
      fullName: name, // Map name to fullName for normalized schema
      businessName: companyName, // Map companyName to businessName 
      industry,
    });
    structuredConsole.log(`⏱️ [PROFILE-API:${reqId}] DB insert: ${Date.now() - insertStart}ms`);

    const duration = Date.now() - startedAt;
    structuredConsole.log('✅ [PROFILE-API] Profile created successfully', { profileId: profile.id, duration });
    const res = NextResponse.json(profile);
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-started-at', ts);
    res.headers.set('x-duration-ms', String(duration));
    structuredConsole.log(`🟣 [PROFILE-API:${reqId}] END duration=${duration}ms`);
    return res;
  } catch (error: any) {
    const reqId = `prof_post_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    structuredConsole.error(`💥 [PROFILE-API:${reqId}] Error creating profile:`, error);
    const res = NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-duration-ms', '0');
    return res;
  }
} 
