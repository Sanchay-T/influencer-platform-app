import { NextResponse } from 'next/server'
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test'
import { getUserProfile } from '@/lib/db/queries/user-queries'
import OnboardingLogger from '@/lib/utils/onboarding-logger'
import { finalizeOnboarding } from '@/lib/onboarding/finalize-onboarding'

export async function PATCH(request: Request) {
  try {
    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`
    await OnboardingLogger.logAPI('REQUEST-START', 'Onboarding completion request received', undefined, {
      endpoint: '/api/onboarding/complete',
      method: 'PATCH',
      requestId
    })

    console.log('🚀🚀🚀 [ONBOARDING-COMPLETE] ===============================')
    console.log('🚀🚀🚀 [ONBOARDING-COMPLETE] STARTING COMPLETE ONBOARDING FLOW')
    console.log('🚀🚀🚀 [ONBOARDING-COMPLETE] ===============================')
    console.log('🆔 [ONBOARDING-COMPLETE] Request ID:', requestId)
    console.log('⏰ [ONBOARDING-COMPLETE] Timestamp:', new Date().toISOString())

    const { userId } = await getAuthOrTest()

    if (!userId) {
      console.error('❌ [ONBOARDING-COMPLETE] Unauthorized - No valid user session')
      await OnboardingLogger.logAPI('AUTH-ERROR', 'Onboarding completion unauthorized - no user ID', undefined, { requestId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ [ONBOARDING-COMPLETE] User authenticated:', userId)
    console.log('🔍 [ONBOARDING-COMPLETE] Auth check completed in:', Date.now() - startTime, 'ms')

    const payload = await request.json().catch(() => ({}))
    console.log('📥 [ONBOARDING-COMPLETE] Request data:', { ...payload, userId })

    console.log('🔍 [ONBOARDING-COMPLETE] Fetching user profile')
    const userProfile = await getUserProfile(userId)

    if (!userProfile) {
      console.error('❌ [ONBOARDING-COMPLETE] User profile not found')
      await OnboardingLogger.logError('PROFILE-NOT-FOUND', 'Onboarding completion failed: profile missing', userId, { requestId })
      return NextResponse.json({
        error: 'User profile not found. Please complete step 1 first.'
      }, { status: 404 })
    }

    console.log('✅ [ONBOARDING-COMPLETE] User profile found:', {
      fullName: userProfile.fullName,
      businessName: userProfile.businessName,
      onboardingStep: userProfile.onboardingStep,
      profileCreatedAt: userProfile.signupTimestamp,
      hasTrialData: !!(userProfile.trialStartDate && userProfile.trialEndDate),
      currentTrialStatus: userProfile.trialStatus
    })

    console.log('💳 [ONBOARDING-COMPLETE] Skipping Stripe setup - already completed during checkout')
    console.log('✅ [ONBOARDING-COMPLETE] User already has:', {
      stripeCustomerId: userProfile.stripeCustomerId,
      stripeSubscriptionId: userProfile.stripeSubscriptionId,
      subscriptionStatus: userProfile.subscriptionStatus,
      currentPlan: userProfile.currentPlan,
      note: 'These were created during the checkout flow, no need to recreate'
    })

    const finalizeResult = await finalizeOnboarding(userId, {
      requestId,
      clerkEmailHint: userProfile.email,
      triggerEmails: true,
      skipIfCompleted: false
    })

    const responseData = {
      success: true,
      message: 'Onboarding completed and trial started successfully',
      onboarding: {
        step: finalizeResult.profileStep || 'completed',
        completedAt: new Date().toISOString()
      },
      trial: finalizeResult.trial
        ? {
            status: finalizeResult.trial.trialStatus,
            startDate: finalizeResult.trial.trialStartDate?.toISOString(),
            endDate: finalizeResult.trial.trialEndDate?.toISOString(),
            daysRemaining: finalizeResult.trial.daysRemaining,
            hoursRemaining: finalizeResult.trial.hoursRemaining,
            minutesRemaining: finalizeResult.trial.minutesRemaining,
            progressPercentage: finalizeResult.trial.progressPercentage,
            timeUntilExpiry: finalizeResult.trial.timeUntilExpiry
          }
        : null,
      stripe: {
        customerId: userProfile.stripeCustomerId || 'not-set',
        subscriptionId: userProfile.stripeSubscriptionId || 'not-set',
        note: 'Stripe resources created during checkout, not onboarding'
      },
      emails: finalizeResult.emails
        ? {
            scheduled: finalizeResult.emails.success ?? false,
            results: finalizeResult.emails.results || []
          }
        : {
            scheduled: false,
            skipped: true,
            reason: finalizeResult.userEmail ? 'not_triggered' : 'email_unavailable'
          }
    }

    const totalTime = Date.now() - startTime

    console.log('🎉🎉🎉 [ONBOARDING-COMPLETE] ===============================')
    console.log('🎉🎉🎉 [ONBOARDING-COMPLETE] COMPLETE FLOW FINISHED SUCCESSFULLY')
    console.log('🎉🎉🎉 [ONBOARDING-COMPLETE] ===============================')
    console.log('⏱️ [ONBOARDING-COMPLETE] Total execution time:', totalTime, 'ms')
    console.log('📊 [ONBOARDING-COMPLETE] Final response data:', {
      trialStatus: responseData.trial?.status,
      daysRemaining: responseData.trial?.daysRemaining,
      emailsScheduled: responseData.emails.scheduled,
      stripeCustomerId: responseData.stripe.customerId,
      requestId,
      executionTime: totalTime
    })

    await OnboardingLogger.logStep4('COMPLETION-SUCCESS', 'Onboarding completed and trial started', userId, {
      requestId,
      trialStatus: responseData.trial?.status,
      stripeCustomerId: responseData.stripe.customerId,
      stripeSubscriptionId: responseData.stripe.subscriptionId
    })

    await OnboardingLogger.logAPI('REQUEST-SUCCESS', 'Onboarding completion request processed', userId, {
      requestId,
      durationMs: totalTime
    })

    return NextResponse.json(responseData)

  } catch (error: any) {
    console.error('💥 [ONBOARDING-COMPLETE] Error in complete onboarding flow:', error)
    await OnboardingLogger.logError('API-ERROR', 'Onboarding completion request failed', undefined, {
      errorMessage: error?.message || 'Unknown error'
    })
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    console.log('🔍 [ONBOARDING-COMPLETE-GET] Checking onboarding completion status')

    const { userId } = await getAuthOrTest()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userProfile = await getUserProfile(userId)

    if (!userProfile) {
      return NextResponse.json({
        error: 'User profile not found'
      }, { status: 404 })
    }

    const responseData = {
      onboarding: {
        step: userProfile.onboardingStep,
        isCompleted: userProfile.onboardingStep === 'completed'
      },
      trial: {
        status: userProfile.trialStatus,
        startDate: userProfile.trialStartDate?.toISOString() || null,
        endDate: userProfile.trialEndDate?.toISOString() || null,
        hasTrialData: !!(userProfile.trialStartDate && userProfile.trialEndDate)
      },
      stripe: {
        customerId: userProfile.stripeCustomerId,
        subscriptionId: userProfile.stripeSubscriptionId,
        hasStripeData: !!(userProfile.stripeCustomerId && userProfile.stripeSubscriptionId)
      }
    }

    console.log('📊 [ONBOARDING-COMPLETE-GET] Status retrieved:', responseData)
    return NextResponse.json(responseData)

  } catch (error: any) {
    console.error('❌ [ONBOARDING-COMPLETE-GET] Error checking status:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}
