import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { startTrial } from '@/lib/trial/trial-service';
import { MockStripeService } from '@/lib/stripe/mock-stripe';
import { scheduleTrialEmails } from '@/lib/email/trial-email-triggers';
import { getUserEmailFromClerk } from '@/lib/email/email-service';
import OnboardingLogger from '@/lib/utils/onboarding-logger';

export async function PATCH(request: Request) {
  try {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await OnboardingLogger.logAPI('REQUEST-START', 'Onboarding completion request received', undefined, {
      endpoint: '/api/onboarding/complete',
      method: 'PATCH',
      requestId
    });
    
    console.log('🚀🚀🚀 [ONBOARDING-COMPLETE] ===============================');
    console.log('🚀🚀🚀 [ONBOARDING-COMPLETE] STARTING COMPLETE ONBOARDING FLOW');
    console.log('🚀🚀🚀 [ONBOARDING-COMPLETE] ===============================');
    console.log('🆔 [ONBOARDING-COMPLETE] Request ID:', requestId);
    console.log('⏰ [ONBOARDING-COMPLETE] Timestamp:', new Date().toISOString());
    console.log('🔐 [ONBOARDING-COMPLETE] Getting authenticated user from Clerk');
    
    const { userId } = await getAuthOrTest();

    if (!userId) {
      console.error('❌ [ONBOARDING-COMPLETE] Unauthorized - No valid user session');
      await OnboardingLogger.logAPI('AUTH-ERROR', 'Onboarding completion unauthorized - no user ID', undefined, { requestId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [ONBOARDING-COMPLETE] User authenticated:', userId);
    console.log('🔍 [ONBOARDING-COMPLETE] Auth check completed in:', Date.now() - startTime, 'ms');

    // Get request data
    const { completed } = await request.json();
    console.log('📥 [ONBOARDING-COMPLETE] Request data:', { completed, userId });

    // Get current user profile
    console.log('🔍 [ONBOARDING-COMPLETE] Fetching user profile');
    const userProfile = await getUserProfile(userId);

    if (!userProfile) {
      console.error('❌ [ONBOARDING-COMPLETE] User profile not found');
      await OnboardingLogger.logError('PROFILE-NOT-FOUND', 'Onboarding completion failed: profile missing', userId, { requestId });
      return NextResponse.json({ 
        error: 'User profile not found. Please complete step 1 first.' 
      }, { status: 404 });
    }

    console.log('✅ [ONBOARDING-COMPLETE] User profile found:', {
      fullName: userProfile.fullName,
      businessName: userProfile.businessName,
      onboardingStep: userProfile.onboardingStep,
      profileCreatedAt: userProfile.signupTimestamp,
      hasTrialData: !!(userProfile.trialStartDate && userProfile.trialEndDate),
      currentTrialStatus: userProfile.trialStatus
    });
    console.log('⏱️ [ONBOARDING-COMPLETE] Profile fetch completed in:', Date.now() - startTime, 'ms');

    // Resolve usable email. Prefer database profile, then Clerk lookup.
    let userEmail = userProfile.email || null;
    if (userEmail) {
      console.log('📧 [ONBOARDING-COMPLETE] Using email from profile:', userEmail);
    } else {
      console.log('📧 [ONBOARDING-COMPLETE] No email on profile, querying Clerk');
      userEmail = await getUserEmailFromClerk(userId);
      if (userEmail) {
        console.log('✅ [ONBOARDING-COMPLETE] User email retrieved from Clerk:', userEmail);
      } else {
        console.warn('⚠️ [ONBOARDING-COMPLETE] Could not resolve user email; onboarding will continue without scheduling outbound emails.');
      }
    }

    // ⚠️ SKIP STRIPE SETUP: User already has Stripe customer + subscription from checkout
    // This endpoint is called AFTER payment success, so Stripe resources already exist
    console.log('💳 [ONBOARDING-COMPLETE] Skipping Stripe setup - already completed during checkout');
    console.log('✅ [ONBOARDING-COMPLETE] User already has:', {
      stripeCustomerId: userProfile.stripeCustomerId,
      stripeSubscriptionId: userProfile.stripeSubscriptionId,
      subscriptionStatus: userProfile.subscriptionStatus,
      currentPlan: userProfile.currentPlan,
      note: 'These were created during the checkout flow, no need to recreate'
    });

    // Step 2: Start trial system (background job will set plan asynchronously)
    console.log('🎯🎯🎯 [ONBOARDING-COMPLETE] ===============================');
    console.log('🎯🎯🎯 [ONBOARDING-COMPLETE] STARTING PRODUCTION TRIAL SYSTEM');
    console.log('🎯🎯🎯 [ONBOARDING-COMPLETE] ===============================');
    console.log('📝 [ONBOARDING-COMPLETE] Note: Background job will set plan asynchronously');
    
    console.log('🎯 [ONBOARDING-COMPLETE] Input data:', {
      userId,
      customerId: userProfile.stripeCustomerId,
      subscriptionId: userProfile.stripeSubscriptionId,
      note: 'Using Stripe data from checkout, not creating new resources'
    });
    const trialStartTime = Date.now();
    const trialData = await startTrial(userId, {
      customerId: userProfile.stripeCustomerId || '',
      subscriptionId: userProfile.stripeSubscriptionId || ''
    });
    console.log('⏱️ [ONBOARDING-COMPLETE] Trial setup completed in:', Date.now() - trialStartTime, 'ms');

    console.log('✅ [ONBOARDING-COMPLETE] Trial started successfully:', {
      trialStatus: trialData.trialStatus,
      trialStartDate: trialData.trialStartDate?.toISOString(),
      trialEndDate: trialData.trialEndDate?.toISOString(),
      daysRemaining: trialData.daysRemaining,
      progressPercentage: trialData.progressPercentage
    });

    // Step 3: Mark onboarding as completed
    console.log('📝 [ONBOARDING-COMPLETE] Marking onboarding as completed');
    await updateUserProfile(userId, {
      onboardingStep: 'completed'
    });

    console.log('✅ [ONBOARDING-COMPLETE] Onboarding marked as completed');

    // Step 4: Schedule trial emails (day 2, day 5, expiry)
    console.log('📧📧📧 [ONBOARDING-COMPLETE] ===============================');
    console.log('📧📧📧 [ONBOARDING-COMPLETE] SCHEDULING TRIAL EMAIL SEQUENCE');
    console.log('📧📧📧 [ONBOARDING-COMPLETE] ===============================');
    
    const userInfo = {
      fullName: userProfile.fullName || 'User',
      businessName: userProfile.businessName || 'Your Business'
    };
    
    console.log('📧 [ONBOARDING-COMPLETE] Email user info:', userInfo);
    console.log('📧 [ONBOARDING-COMPLETE] Target email:', userEmail);
    console.log('📧 [ONBOARDING-COMPLETE] Trial dates for scheduling:', {
      trialStartDate: trialData.trialStartDate?.toISOString(),
      trialEndDate: trialData.trialEndDate?.toISOString()
    });
    
    const emailStartTime = Date.now();
    let emailResult: Awaited<ReturnType<typeof scheduleTrialEmails>> | null = null;
    if (userEmail) {
      emailResult = await scheduleTrialEmails(userId, userInfo);
      console.log('⏱️ [ONBOARDING-COMPLETE] Email scheduling completed in:', Date.now() - emailStartTime, 'ms');
      
      if (emailResult.success) {
        console.log('✅✅✅ [ONBOARDING-COMPLETE] TRIAL EMAILS SCHEDULED SUCCESSFULLY');
        console.log('📧 [ONBOARDING-COMPLETE] Email results breakdown:');
        emailResult.results?.forEach((result, index) => {
          console.log(`📧 [ONBOARDING-COMPLETE] Email ${index + 1}:`, {
            type: result.emailType,
            messageId: result.messageId,
            scheduled: result.success,
            deliveryTime: result.deliveryTime,
            error: result.error || 'None'
          });
        });
      } else {
        console.error('❌❌❌ [ONBOARDING-COMPLETE] FAILED TO SCHEDULE TRIAL EMAILS');
        console.error('📧 [ONBOARDING-COMPLETE] Email error details:', emailResult.error);
      }
    } else {
      console.log('📧 [ONBOARDING-COMPLETE] Email scheduling skipped because no email was available.');
    }

    // Step 5: Return complete response with trial data
    const responseData = {
      success: true,
      message: 'Onboarding completed and trial started successfully',
      onboarding: {
        step: 'completed',
        completedAt: new Date().toISOString()
      },
      trial: {
        status: trialData.trialStatus,
        startDate: trialData.trialStartDate?.toISOString(),
        endDate: trialData.trialEndDate?.toISOString(),
        daysRemaining: trialData.daysRemaining,
        hoursRemaining: trialData.hoursRemaining,
        minutesRemaining: trialData.minutesRemaining,
        progressPercentage: trialData.progressPercentage,
        timeUntilExpiry: trialData.timeUntilExpiry
      },
      stripe: {
        customerId: userProfile.stripeCustomerId || 'not-set',
        subscriptionId: userProfile.stripeSubscriptionId || 'not-set',
        note: 'Stripe resources created during checkout, not onboarding'
      },
      emails: userEmail
        ? {
            scheduled: emailResult?.success ?? false,
            results: emailResult?.results || []
          }
        : {
            scheduled: false,
            skipped: true,
            reason: 'email_unavailable'
          }
    };

    const totalTime = Date.now() - startTime;
    
    console.log('🎉🎉🎉 [ONBOARDING-COMPLETE] ===============================');
    console.log('🎉🎉🎉 [ONBOARDING-COMPLETE] COMPLETE FLOW FINISHED SUCCESSFULLY');
    console.log('🎉🎉🎉 [ONBOARDING-COMPLETE] ===============================');
    console.log('⏱️ [ONBOARDING-COMPLETE] Total execution time:', totalTime, 'ms');
    console.log('📊 [ONBOARDING-COMPLETE] Final response data:', {
      trialStatus: responseData.trial.status,
      daysRemaining: responseData.trial.daysRemaining,
      emailsScheduled: responseData.emails.scheduled,
      stripeCustomerId: responseData.stripe.customerId,
      requestId,
      executionTime: totalTime
    });
    console.log('🎯 [ONBOARDING-COMPLETE] User can now access campaigns and start trial');
    console.log('📧 [ONBOARDING-COMPLETE] User will receive trial emails on schedule');
    console.log('🚀 [ONBOARDING-COMPLETE] Onboarding flow completed successfully for:', userEmail);

    await OnboardingLogger.logStep4('COMPLETION-SUCCESS', 'Onboarding completed and trial started', userId, {
      requestId,
      trialStatus: responseData.trial.status,
      stripeCustomerId: responseData.stripe.customerId,
      stripeSubscriptionId: responseData.stripe.subscriptionId
    });

    await OnboardingLogger.logAPI('REQUEST-SUCCESS', 'Onboarding completion request processed', userId, {
      requestId,
      durationMs: totalTime
    });

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('💥 [ONBOARDING-COMPLETE] Error in complete onboarding flow:', error);
    await OnboardingLogger.logError('API-ERROR', 'Onboarding completion request failed', undefined, {
      errorMessage: error?.message || 'Unknown error'
    });
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    console.log('🔍 [ONBOARDING-COMPLETE-GET] Checking onboarding completion status');
    
    const { userId } = await getAuthOrTest();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with trial data
    const userProfile = await getUserProfile(userId);

    if (!userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 });
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
    };

    console.log('📊 [ONBOARDING-COMPLETE-GET] Status retrieved:', responseData);
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('❌ [ONBOARDING-COMPLETE-GET] Error checking status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
