import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, updateUserProfile, createUser } from '@/lib/db/queries/user-queries';
import { scheduleEmail, getUserEmailFromClerk, updateEmailScheduleStatus, shouldSendEmail } from '@/lib/email/email-service';

export async function PATCH(request: Request) {
  try {
    const startTime = Date.now();
    const requestId = `step1_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log('🚀🚀🚀 [ONBOARDING-STEP1] ===============================');
    console.log('🚀🚀🚀 [ONBOARDING-STEP1] STARTING STEP 1 - BASIC INFO CAPTURE');
    console.log('🚀🚀🚀 [ONBOARDING-STEP1] ===============================');
    console.log('🆔 [ONBOARDING-STEP1] Request ID:', requestId);
    console.log('⏰ [ONBOARDING-STEP1] Timestamp:', new Date().toISOString());
    console.log('🔐 [ONBOARDING-STEP1] Getting authenticated user from Clerk');
    const { userId } = await getAuthOrTest();

    if (!userId) {
      console.error('❌ [ONBOARDING-STEP1] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fullName, businessName } = await request.json();
    console.log('📥 [ONBOARDING-STEP1] Data received:', {
      fullName: fullName || 'NOT_PROVIDED',
      fullNameLength: fullName?.length || 0,
      businessName: businessName || 'NOT_PROVIDED',
      businessNameLength: businessName?.length || 0,
      userId,
      requestId
    });

    if (!fullName?.trim() || !businessName?.trim()) {
      return NextResponse.json({ 
        error: 'Full name and business name are required' 
      }, { status: 400 });
    }

    // Resolve email from Clerk before proceeding
    console.log('📧 [ONBOARDING-STEP1] Resolving primary email from Clerk');
    const clerkEmail = await getUserEmailFromClerk(userId);

    // Check if user profile exists
    const existingProfile = await getUserProfile(userId);
    let normalizedEmail: string | null = clerkEmail?.trim().toLowerCase() || null;

    if (!normalizedEmail && existingProfile?.email) {
      normalizedEmail = existingProfile.email.trim().toLowerCase();
      console.warn('⚠️ [ONBOARDING-STEP1] Clerk email missing; falling back to stored profile email.', {
        userId,
        fallbackEmail: normalizedEmail,
      });
    }

    if (!normalizedEmail) {
      // In non-production environments, allow onboarding to continue even if Clerk didn't return an email.
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) {
        normalizedEmail = `dev-user-${userId}@example.dev`;
        console.warn('⚠️ [ONBOARDING-STEP1] No Clerk email found; using fallback for non-production environment.', {
          userId,
          fallbackEmail: normalizedEmail,
          clerkEmails: clerkEmail,
          env: process.env.NODE_ENV,
        });
      } else {
        console.error('❌ [ONBOARDING-STEP1] No email available from Clerk or profile. Blocking onboarding progress.');
        return NextResponse.json(
          {
            error: 'Email required to continue onboarding. Add an email address to your account and try again.',
          },
          { status: 409 }
        );
      }
    }

    console.log('✅ [ONBOARDING-STEP1] Email confirmed for onboarding:', normalizedEmail);

    if (existingProfile) {
      // Update existing profile
      console.log('🔄🔄🔄 [ONBOARDING-STEP1] UPDATING EXISTING PROFILE');
      console.log('📊 [ONBOARDING-STEP1] Existing profile data:', {
        currentOnboardingStep: existingProfile.onboardingStep,
        currentFullName: existingProfile.fullName,
        currentBusinessName: existingProfile.businessName,
        profileCreatedAt: existingProfile.signupTimestamp,
        hasTrialData: !!(existingProfile.trialStartDate && existingProfile.trialEndDate)
      });
      
      // Get user email from Clerk for database storage
      await updateUserProfile(userId, {
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        email: normalizedEmail,
        onboardingStep: 'info_captured',
      });

      console.log('✅✅✅ [ONBOARDING-STEP1] PROFILE UPDATED SUCCESSFULLY');
      console.log('💾 [ONBOARDING-STEP1] Update completed in:', Date.now() - startTime, 'ms');

      // Schedule welcome email for existing users too (if not already sent)
      
      if (await shouldSendEmail(userId, 'welcome')) {
        console.log('📧📧📧 [ONBOARDING-STEP1] SCHEDULING WELCOME EMAIL FOR EXISTING USER');
        console.log('📧 [ONBOARDING-STEP1] Email details:', {
          targetEmail: normalizedEmail,
          emailType: 'welcome',
          fullName: fullName.trim(),
          businessName: businessName.trim(),
          dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/step-2`
        });
        
        const emailResult = await scheduleEmail({
          userId,
          emailType: 'welcome',
          userEmail: normalizedEmail,
          templateProps: {
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/step-2`
          }
        });

        if (emailResult.success) {
          await updateEmailScheduleStatus(userId, 'welcome', 'scheduled', emailResult.messageId);
          console.log('✅✅✅ [ONBOARDING-STEP1] WELCOME EMAIL SCHEDULED FOR EXISTING USER');
          console.log('📧 [ONBOARDING-STEP1] Welcome email details:', {
            messageId: emailResult.messageId,
            scheduledFor: 'In 10 minutes',
            qstashId: 'N/A'
          });
        } else {
          console.error('❌ [ONBOARDING-STEP1] Welcome email scheduling failed:', emailResult.error);
        }
      }

      // Schedule abandonment email for existing users too (if not already sent)
      if (await shouldSendEmail(userId, 'abandonment')) {
        console.log('📧📧📧 [ONBOARDING-STEP1] SCHEDULING ABANDONMENT EMAIL FOR EXISTING USER');
        console.log('📧 [ONBOARDING-STEP1] Abandonment email details:', {
          targetEmail: normalizedEmail,
          emailType: 'abandonment',
          scheduledFor: '2 hours after signup',
          fullName: fullName.trim(),
          businessName: businessName.trim()
        });
        
        const abandonmentResult = await scheduleEmail({
          userId,
          emailType: 'abandonment',
          userEmail: normalizedEmail,
          templateProps: {
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/step-2`
          }
        });

        if (abandonmentResult.success) {
          await updateEmailScheduleStatus(userId, 'abandonment', 'scheduled', abandonmentResult.messageId);
          console.log('✅✅✅ [ONBOARDING-STEP1] ABANDONMENT EMAIL SCHEDULED FOR EXISTING USER');
          console.log('📧 [ONBOARDING-STEP1] Abandonment email details:', {
            messageId: abandonmentResult.messageId,
            scheduledFor: 'In 2 hours',
            qstashId: 'N/A'
          });
        } else {
          console.error('❌ [ONBOARDING-STEP1] Abandonment email scheduling failed:', abandonmentResult.error);
        }
      }
    } else {
      // Create new profile
      console.log('🆕🆕🆕 [ONBOARDING-STEP1] CREATING NEW PROFILE');
      console.log('🆕 [ONBOARDING-STEP1] This is a first-time user signup');
      
      // Get user email from Clerk for database storage
      await createUser({
        userId,
        email: normalizedEmail,
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        onboardingStep: 'info_captured',
      });

      console.log('✅✅✅ [ONBOARDING-STEP1] PROFILE CREATED SUCCESSFULLY');
      console.log('💾 [ONBOARDING-STEP1] Profile creation completed in:', Date.now() - startTime, 'ms');

      // Schedule welcome email (10 minutes after signup)
      
      if (await shouldSendEmail(userId, 'welcome')) {
        console.log('📧📧📧 [ONBOARDING-STEP1] SCHEDULING WELCOME EMAIL');
        console.log('📧 [ONBOARDING-STEP1] Email details:', {
          targetEmail: normalizedEmail,
          emailType: 'welcome',
          fullName: fullName.trim(),
          businessName: businessName.trim(),
          dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/step-2`
        });
        
        const emailResult = await scheduleEmail({
          userId,
          emailType: 'welcome',
          userEmail: normalizedEmail,
          templateProps: {
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/step-2`
          }
        });

        if (emailResult.success) {
          await updateEmailScheduleStatus(userId, 'welcome', 'scheduled', emailResult.messageId);
          console.log('✅✅✅ [ONBOARDING-STEP1] WELCOME EMAIL SCHEDULED SUCCESSFULLY');
          console.log('📧 [ONBOARDING-STEP1] Welcome email details:', {
            messageId: emailResult.messageId,
            scheduledFor: 'In 10 minutes',
            qstashId: 'N/A'
          });
        } else {
          console.error('❌ [ONBOARDING-STEP1] Welcome email scheduling failed:', emailResult.error);
        }
      }

      // Schedule abandonment email (2 hours after signup)
      if (await shouldSendEmail(userId, 'abandonment')) {
        console.log('📧📧📧 [ONBOARDING-STEP1] SCHEDULING ABANDONMENT EMAIL');
        console.log('📧 [ONBOARDING-STEP1] Abandonment email details:', {
          targetEmail: normalizedEmail,
          emailType: 'abandonment',
          scheduledFor: '2 hours after signup',
          fullName: fullName.trim(),
          businessName: businessName.trim()
        });
        
        const abandonmentResult = await scheduleEmail({
          userId,
          emailType: 'abandonment',
          userEmail: normalizedEmail,
          templateProps: {
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/step-2`
          }
        });

        if (abandonmentResult.success) {
          await updateEmailScheduleStatus(userId, 'abandonment', 'scheduled', abandonmentResult.messageId);
          console.log('✅✅✅ [ONBOARDING-STEP1] ABANDONMENT EMAIL SCHEDULED SUCCESSFULLY');
          console.log('📧 [ONBOARDING-STEP1] Abandonment email details:', {
            messageId: abandonmentResult.messageId,
            scheduledFor: 'In 2 hours',
            qstashId: 'N/A'
          });
        } else {
          console.error('❌ [ONBOARDING-STEP1] Abandonment email scheduling failed:', abandonmentResult.error);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    
    console.log('🎉🎉🎉 [ONBOARDING-STEP1] ===============================');
    console.log('🎉🎉🎉 [ONBOARDING-STEP1] STEP 1 COMPLETED SUCCESSFULLY');
    console.log('🎉🎉🎉 [ONBOARDING-STEP1] ===============================');
    console.log('⏱️ [ONBOARDING-STEP1] Total execution time:', totalTime, 'ms');
    console.log('📊 [ONBOARDING-STEP1] Summary:', {
      action: existingProfile ? 'PROFILE_UPDATED' : 'PROFILE_CREATED',
      fullName: fullName.trim(),
      businessName: businessName.trim(),
      userId,
      requestId,
      executionTime: totalTime
    });
    console.log('➡️ [ONBOARDING-STEP1] Next step: User should proceed to Step 2 (Brand Description)');
    
    return NextResponse.json({ 
      success: true,
      message: 'Step 1 completed successfully',
      data: {
        requestId,
        executionTime: totalTime,
        nextStep: '/onboarding/step-2'
      }
    });

  } catch (error: any) {
    console.error('💥 [ONBOARDING-STEP1] Error saving step 1 data:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
