import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { updateUserProfile } from '@/lib/db/queries/user-queries';
import OnboardingLogger from '@/lib/utils/onboarding-logger';

export async function POST(req: NextRequest) {
  const requestId = `save-plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    await OnboardingLogger.logAPI('REQUEST-START', 'Save plan API request received', undefined, {
      endpoint: '/api/onboarding/save-plan',
      method: 'POST',
      requestId
    });

    const { userId } = await getAuthOrTest();
    
    if (!userId) {
      await OnboardingLogger.logAPI('AUTH-ERROR', 'Save plan request unauthorized - no user ID', undefined, {
        requestId,
        error: 'UNAUTHORIZED'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await OnboardingLogger.logAPI('AUTH-SUCCESS', 'Save plan request authenticated', userId, {
      requestId
    });

    const { selectedPlan } = await req.json();
    
    await OnboardingLogger.logPayment('PLAN-DATA-RECEIVED', 'Plan selection data received from frontend', userId, {
      selectedPlan,
      requestId
    });

    if (!selectedPlan) {
      await OnboardingLogger.logPayment('VALIDATION-ERROR', 'Plan selection validation failed - no plan provided', userId, {
        requestId,
        error: 'MISSING_SELECTED_PLAN'
      });
      return NextResponse.json({ error: 'Selected plan is required' }, { status: 400 });
    }

    await OnboardingLogger.logPayment('DB-UPDATE-START', 'Starting database update for intended plan selection', userId, {
      selectedPlan,
      requestId
    });

    // Update user profile with intended plan (do not change currentPlan here)
    await updateUserProfile(userId, {
      intendedPlan: selectedPlan,
      billingSyncStatus: 'plan_selected', // will be confirmed by Stripe webhook
    });

    await OnboardingLogger.logPayment('DB-UPDATE-SUCCESS', 'Database updated successfully with intended plan selection', userId, {
      selectedPlan,
      billingSyncStatus: 'plan_selected',
      requestId
    });

    await OnboardingLogger.logAPI('REQUEST-SUCCESS', 'Save plan API request completed successfully', userId, {
      selectedPlan,
      requestId
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ [SAVE-PLAN] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await OnboardingLogger.logError('API-ERROR', 'Save plan API request failed', undefined, {
      errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      requestId,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: 'Failed to save plan selection' },
      { status: 500 }
    );
  }
}
