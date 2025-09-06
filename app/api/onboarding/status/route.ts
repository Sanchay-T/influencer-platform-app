import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const startedAt = Date.now();
    const reqId = `ob_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    console.log(`🟢 [ONBOARDING-STATUS:${reqId}] START ${ts}`);
    console.log('🔍 [ONBOARDING-STATUS] Checking onboarding status');
    const { userId } = await auth();

    if (!userId) {
      console.error('❌ [ONBOARDING-STATUS] Unauthorized - No valid user session');
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return res;
    }

    console.log('✅ [ONBOARDING-STATUS] User authenticated:', userId);

    // Check if user profile exists
    const profileStart = Date.now();
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });
    console.log(`⏱️ [ONBOARDING-STATUS:${reqId}] DB profile query: ${Date.now() - profileStart}ms`);

    if (!userProfile) {
      console.log('🆕 [ONBOARDING-STATUS] User profile not found, new user detected');
      const res = NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return res;
    }

    console.log('📊 [ONBOARDING-STATUS] User profile found:', {
      userId: userProfile.userId,
      onboardingStep: userProfile.onboardingStep,
      fullName: userProfile.fullName,
      businessName: userProfile.businessName
    });

    const payload = {
      userId: userProfile.userId,
      onboardingStep: userProfile.onboardingStep,
      fullName: userProfile.fullName,
      businessName: userProfile.businessName,
      brandDescription: userProfile.brandDescription,
      signupTimestamp: userProfile.signupTimestamp
    };
    const duration = Date.now() - startedAt;
    const res = NextResponse.json(payload);
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-started-at', ts);
    res.headers.set('x-duration-ms', String(duration));
    console.log(`🟣 [ONBOARDING-STATUS:${reqId}] END duration=${duration}ms`);
    return res;

  } catch (error: any) {
    const reqId = `ob_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.error(`💥 [ONBOARDING-STATUS:${reqId}] Error checking onboarding status:`, error);
    const res = NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-duration-ms', '0');
    return res;
  }
}
