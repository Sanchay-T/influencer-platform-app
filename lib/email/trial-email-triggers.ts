import { scheduleEmail, getUserEmailFromClerk, updateEmailScheduleStatus, shouldSendEmail } from './email-service';

/**
 * Schedule trial-related emails when user starts their trial
 */
export async function scheduleTrialEmails(userId: string, userInfo: { fullName: string; businessName: string }) {
  const startTime = Date.now();
  const requestId = `trial_emails_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log('📧📧📧 [TRIAL-EMAILS] ===============================');
  console.log('📧📧📧 [TRIAL-EMAILS] SCHEDULING TRIAL EMAIL SEQUENCE');
  console.log('📧📧📧 [TRIAL-EMAILS] ===============================');
  console.log('🆔 [TRIAL-EMAILS] Request ID:', requestId);
  console.log('⏰ [TRIAL-EMAILS] Timestamp:', new Date().toISOString());
  console.log('📧 [TRIAL-EMAILS] Target user:', userId);
  console.log('📧 [TRIAL-EMAILS] User info:', userInfo);

  try {
    console.log('🔍 [TRIAL-EMAILS] Getting user email from Clerk...');
    const userEmail = await getUserEmailFromClerk(userId);
    
    if (!userEmail) {
      console.error('❌❌❌ [TRIAL-EMAILS] NO EMAIL FOUND FOR USER:', userId);
      return { success: false, error: 'User email not found' };
    }
    
    console.log('✅ [TRIAL-EMAILS] User email retrieved:', userEmail);
    console.log('⏱️ [TRIAL-EMAILS] Email lookup completed in:', Date.now() - startTime, 'ms');

    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/campaigns`;
    const templateProps = {
      fullName: userInfo.fullName,
      businessName: userInfo.businessName,
      dashboardUrl
    };
    
    console.log('📧 [TRIAL-EMAILS] Template props prepared:', templateProps);
    console.log('📧 [TRIAL-EMAILS] Dashboard URL:', dashboardUrl);

    const results = [];

    // Schedule Trial Day 2 email (2 days after trial starts)
    console.log('🔍 [TRIAL-EMAILS] Checking if trial day 2 email should be sent...');
    if (await shouldSendEmail(userId, 'trial_day2')) {
      console.log('📧📧📧 [TRIAL-EMAILS] SCHEDULING TRIAL DAY 2 EMAIL');
      console.log('📧 [TRIAL-EMAILS] Email will be sent 2 days after trial start');
      
      const day2StartTime = Date.now();
      
      const day2Result = await scheduleEmail({
        userId,
        emailType: 'trial_day2',
        userEmail,
        templateProps,
        delay: '2d' // 2 days
      });

      if (day2Result.success) {
        await updateEmailScheduleStatus(userId, 'trial_day2', 'scheduled', day2Result.messageId);
        results.push({ 
          emailType: 'trial_day2', 
          success: true, 
          messageId: day2Result.messageId,
          deliveryTime: day2Result.deliveryTime,
          delay: '2d'
        });
        console.log('✅✅✅ [TRIAL-EMAILS] TRIAL DAY 2 EMAIL SCHEDULED SUCCESSFULLY');
        console.log('📧 [TRIAL-EMAILS] Day 2 details:', {
          messageId: day2Result.messageId,
          scheduledFor: day2Result.deliveryTime,
          qstashId: day2Result.qstashId || 'N/A',
          setupTime: Date.now() - day2StartTime + 'ms'
        });
      } else {
        results.push({ emailType: 'trial_day2', success: false, error: day2Result.error });
        console.error('❌❌❌ [TRIAL-EMAILS] FAILED TO SCHEDULE TRIAL DAY 2 EMAIL');
        console.error('📧 [TRIAL-EMAILS] Day 2 error:', day2Result.error);
      }
    } else {
      console.log('⚠️ [TRIAL-EMAILS] Trial day 2 email skipped (shouldSendEmail returned false)');
    }

    // Schedule Trial Day 5 email (5 days after trial starts)
    console.log('🔍 [TRIAL-EMAILS] Checking if trial day 5 email should be sent...');
    if (await shouldSendEmail(userId, 'trial_day5')) {
      console.log('📧📧📧 [TRIAL-EMAILS] SCHEDULING TRIAL DAY 5 EMAIL');
      console.log('📧 [TRIAL-EMAILS] Email will be sent 5 days after trial start');
      
      const day5StartTime = Date.now();
      
      const day5Result = await scheduleEmail({
        userId,
        emailType: 'trial_day5',
        userEmail,
        templateProps,
        delay: '5d' // 5 days
      });

      if (day5Result.success) {
        await updateEmailScheduleStatus(userId, 'trial_day5', 'scheduled', day5Result.messageId);
        results.push({ 
          emailType: 'trial_day5', 
          success: true, 
          messageId: day5Result.messageId,
          deliveryTime: day5Result.deliveryTime,
          delay: '5d'
        });
        console.log('✅✅✅ [TRIAL-EMAILS] TRIAL DAY 5 EMAIL SCHEDULED SUCCESSFULLY');
        console.log('📧 [TRIAL-EMAILS] Day 5 details:', {
          messageId: day5Result.messageId,
          scheduledFor: day5Result.deliveryTime,
          qstashId: day5Result.qstashId || 'N/A',
          setupTime: Date.now() - day5StartTime + 'ms'
        });
      } else {
        results.push({ emailType: 'trial_day5', success: false, error: day5Result.error });
        console.error('❌❌❌ [TRIAL-EMAILS] FAILED TO SCHEDULE TRIAL DAY 5 EMAIL');
        console.error('📧 [TRIAL-EMAILS] Day 5 error:', day5Result.error);
      }
    } else {
      console.log('⚠️ [TRIAL-EMAILS] Trial day 5 email skipped (shouldSendEmail returned false)');
    }

    const totalTime = Date.now() - startTime;
    
    console.log('🎉🎉🎉 [TRIAL-EMAILS] ===============================');
    console.log('🎉🎉🎉 [TRIAL-EMAILS] TRIAL EMAIL SEQUENCE COMPLETED');
    console.log('🎉🎉🎉 [TRIAL-EMAILS] ===============================');
    console.log('⏱️ [TRIAL-EMAILS] Total execution time:', totalTime, 'ms');
    console.log('📊 [TRIAL-EMAILS] Summary:', {
      emailsScheduled: results.filter(r => r.success).length,
      emailsFailed: results.filter(r => !r.success).length,
      totalEmails: results.length,
      userEmail,
      userId,
      requestId
    });
    console.log('📧 [TRIAL-EMAILS] Detailed results:', results);
    
    return { success: true, results };

  } catch (error) {
    console.error('❌ [TRIAL-EMAILS] Error scheduling trial emails:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Cancel scheduled abandonment email when user starts trial
 */
export async function cancelAbandonmentEmail(userId: string) {
  try {
    console.log('🚫 [TRIAL-EMAILS] Canceling abandonment email for user:', userId);
    
    // Mark abandonment email as cancelled (we can't actually cancel QStash messages, 
    // but we can track that the user completed the trial)
    await updateEmailScheduleStatus(userId, 'abandonment', 'cancelled');
    
    console.log('✅ [TRIAL-EMAILS] Abandonment email marked as cancelled');
    return { success: true };
  } catch (error) {
    console.error('❌ [TRIAL-EMAILS] Error canceling abandonment email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Cancel all scheduled trial emails when user subscribes to a paid plan
 */
export async function cancelTrialEmailsOnSubscription(userId: string) {
  try {
    console.log('🚫🚫🚫 [TRIAL-EMAILS] ===============================');
    console.log('🚫🚫🚫 [TRIAL-EMAILS] CANCELING TRIAL EMAILS ON SUBSCRIPTION');
    console.log('🚫🚫🚫 [TRIAL-EMAILS] ===============================');
    console.log('🚫 [TRIAL-EMAILS] Target user:', userId);
    console.log('📧 [TRIAL-EMAILS] Reason: User subscribed to paid plan');
    
    const results = [];
    
    // Cancel trial day 2 email
    try {
      await updateEmailScheduleStatus(userId, 'trial_day2', 'cancelled_subscription');
      results.push({ emailType: 'trial_day2', cancelled: true });
      console.log('✅ [TRIAL-EMAILS] Trial Day 2 email marked as cancelled');
    } catch (error) {
      console.error('❌ [TRIAL-EMAILS] Error canceling trial day 2 email:', error);
      results.push({ emailType: 'trial_day2', cancelled: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // Cancel trial day 5 email
    try {
      await updateEmailScheduleStatus(userId, 'trial_day5', 'cancelled_subscription');
      results.push({ emailType: 'trial_day5', cancelled: true });
      console.log('✅ [TRIAL-EMAILS] Trial Day 5 email marked as cancelled');
    } catch (error) {
      console.error('❌ [TRIAL-EMAILS] Error canceling trial day 5 email:', error);
      results.push({ emailType: 'trial_day5', cancelled: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // Cancel any remaining abandonment emails
    try {
      await updateEmailScheduleStatus(userId, 'abandonment', 'cancelled_subscription');
      results.push({ emailType: 'abandonment', cancelled: true });
      console.log('✅ [TRIAL-EMAILS] Abandonment email marked as cancelled');
    } catch (error) {
      console.error('❌ [TRIAL-EMAILS] Error canceling abandonment email:', error);
      results.push({ emailType: 'abandonment', cancelled: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    const successCount = results.filter(r => r.cancelled).length;
    const failureCount = results.filter(r => !r.cancelled).length;
    
    console.log('🎉 [TRIAL-EMAILS] Trial email cancellation completed:', {
      userId,
      emailsCancelled: successCount,
      emailsFailed: failureCount,
      totalEmails: results.length
    });
    
    return { 
      success: true, 
      results,
      emailsCancelled: successCount,
      emailsFailed: failureCount
    };
    
  } catch (error) {
    console.error('❌ [TRIAL-EMAILS] Error canceling trial emails on subscription:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Schedule subscription welcome email when user subscribes
 */
export async function scheduleSubscriptionWelcomeEmail(userId: string, subscriptionInfo: { 
  plan: string; 
  fullName: string; 
  businessName: string; 
}) {
  try {
    console.log('📧📧📧 [SUBSCRIPTION-EMAILS] ===============================');
    console.log('📧📧📧 [SUBSCRIPTION-EMAILS] SCHEDULING SUBSCRIPTION WELCOME EMAIL');
    console.log('📧📧📧 [SUBSCRIPTION-EMAILS] ===============================');
    console.log('📧 [SUBSCRIPTION-EMAILS] Target user:', userId);
    console.log('📧 [SUBSCRIPTION-EMAILS] Subscription info:', subscriptionInfo);
    
    const userEmail = await getUserEmailFromClerk(userId);
    
    if (!userEmail) {
      console.error('❌ [SUBSCRIPTION-EMAILS] No email found for user:', userId);
      return { success: false, error: 'User email not found' };
    }
    
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/campaigns`;
    const billingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/billing`;
    
    const templateProps = {
      fullName: subscriptionInfo.fullName,
      businessName: subscriptionInfo.businessName,
      plan: subscriptionInfo.plan,
      dashboardUrl,
      billingUrl,
      planFeatures: getPlanFeatures(subscriptionInfo.plan)
    };
    
    // Schedule immediate welcome email
    const emailResult = await scheduleEmail({
      userId,
      emailType: 'subscription_welcome',
      userEmail,
      templateProps,
      delay: '30s' // Send almost immediately
    });
    
    if (emailResult.success) {
      await updateEmailScheduleStatus(userId, 'subscription_welcome', 'scheduled', emailResult.messageId);
      console.log('✅✅✅ [SUBSCRIPTION-EMAILS] SUBSCRIPTION WELCOME EMAIL SCHEDULED');
      console.log('📧 [SUBSCRIPTION-EMAILS] Welcome email details:', {
        messageId: emailResult.messageId,
        userEmail,
        plan: subscriptionInfo.plan
      });
      
      return { 
        success: true, 
        messageId: emailResult.messageId,
        userEmail,
        plan: subscriptionInfo.plan
      };
    } else {
      console.error('❌ [SUBSCRIPTION-EMAILS] Failed to schedule welcome email:', emailResult.error);
      return { success: false, error: emailResult.error };
    }
    
  } catch (error) {
    console.error('❌ [SUBSCRIPTION-EMAILS] Error scheduling subscription welcome email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get plan features for email template
 */
function getPlanFeatures(plan: string): string[] {
  const planFeatures: Record<string, string[]> = {
    premium: [
      'Unlimited influencer searches across TikTok, Instagram, and YouTube',
      'Advanced bio and email extraction',
      'CSV export functionality',
      'Real-time search progress tracking',
      'Priority customer support'
    ],
    enterprise: [
      'All Premium features',
      'API access for custom integrations',
      'Dedicated account manager',
      'Custom reporting and analytics',
      'White-label options',
      'Priority feature requests'
    ],
    basic: [
      'Limited influencer searches',
      'Basic bio extraction',
      'CSV export functionality',
      'Standard customer support'
    ]
  };
  
  return planFeatures[plan] || planFeatures.basic;
}