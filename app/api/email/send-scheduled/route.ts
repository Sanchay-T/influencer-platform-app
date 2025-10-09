import { NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { sendEmail, updateEmailScheduleStatus, EMAIL_CONFIG } from '@/lib/email/email-service';
import { backgroundJobLogger, jobLog } from '@/lib/logging/background-job-logger';
import { logger } from '@/lib/logging';
import { LogCategory } from '@/lib/logging/types';

// Import email templates (will be created next)
import WelcomeEmail from '@/components/email-templates/welcome-email';
import TrialAbandonmentEmail from '@/components/email-templates/trial-abandonment-email';
import TrialDay2Email from '@/components/email-templates/trial-day2-email';
import TrialDay5Email from '@/components/email-templates/trial-day5-email';
import SubscriptionWelcomeEmail from '@/components/email-templates/subscription-welcome-email';

// Initialize QStash receiver
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(request: Request) {
  try {
    // Start email job tracking
    const jobId = jobLog.start({
      jobType: 'scheduled-email',
      metadata: { operation: 'send-scheduled-email' }
    });

    logger.info('Processing scheduled email request', { jobId }, LogCategory.EMAIL);

    // Get request body
    const body = await request.text();
    const messageData = JSON.parse(body);
    const { userId, emailType, userEmail, templateProps, scheduledAt, source, adminUserId } = messageData;

    // Skip signature verification for admin-triggered emails (development convenience)
    if (source !== 'admin-testing') {
      try {
        const isValid = await receiver.verify({
          signature: request.headers.get('Upstash-Signature')!,
          body,
          url: `${EMAIL_CONFIG.siteUrl}/api/email/send-scheduled`
        });

        if (!isValid) {
          logger.error('Invalid QStash signature for scheduled email', undefined, { jobId }, LogCategory.EMAIL);
          jobLog.fail(jobId, new Error('Invalid QStash signature'), undefined, false);
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } catch (signatureError) {
        logger.warn('QStash signature verification failed for admin test', signatureError as Error, { jobId }, LogCategory.EMAIL);
      }
    }

    logger.info('Processing scheduled email', {
      jobId,
      userId,
      emailType,
      userEmail: userEmail.replace(/(.{2}).*@/, '$1***@'), // Partially redact
      scheduledAt,
      source: source || 'system',
      adminTriggered: !!adminUserId
    }, LogCategory.EMAIL);

    // Get the appropriate email template and subject
    let emailComponent: React.ReactElement;
    let subject: string;

    // Add admin testing prefix if triggered by admin
    const subjectPrefix = source === 'admin-testing' ? '[ADMIN TEST] ' : '';

    switch (emailType) {
      case 'welcome':
        emailComponent = WelcomeEmail(templateProps);
        subject = subjectPrefix + `Welcome to ${templateProps.businessName || 'our platform'}! 🎉`;
        break;
      
      case 'abandonment':
        emailComponent = TrialAbandonmentEmail(templateProps);
        subject = subjectPrefix + 'Complete your setup and start your free trial';
        break;
      
      case 'trial_day2':
        emailComponent = TrialDay2Email(templateProps);
        subject = subjectPrefix + 'How\'s your trial going? Tips to get the most out of it 💡';
        break;
      
      case 'trial_day5':
        emailComponent = TrialDay5Email(templateProps);
        subject = subjectPrefix + 'Your trial ends in 2 days - here\'s what you\'ve accomplished! 🏆';
        break;

      case 'subscription_welcome':
        emailComponent = SubscriptionWelcomeEmail({
          fullName: templateProps.fullName,
          businessName: templateProps.businessName,
          planName: templateProps.planName || templateProps.plan || 'Gemz',
          planFeatures: templateProps.planFeatures,
          dashboardUrl: templateProps.dashboardUrl,
          billingUrl: templateProps.billingUrl,
        });
        subject = subjectPrefix + `You're now live on the ${templateProps.planName || templateProps.plan || 'Gemz'} plan! 🎉`;
        break;

      case 'trial_expiry':
        emailComponent = TrialDay5Email(templateProps); // Reuse day5 template for now
        subject = subjectPrefix + 'Your trial expires tomorrow - Don\'t lose your progress! 🔔';
        break;
      
      default:
        console.error('❌ [SCHEDULED-EMAIL] Unknown email type:', emailType);
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 });
    }

    // Send the email
    const result = await sendEmail(userEmail, subject, emailComponent);

    if (result.success) {
      // Update email status as sent (skip for admin tests)
      if (source !== 'admin-testing') {
        await updateEmailScheduleStatus(userId, emailType, 'sent', result.id);
      }
      
      jobLog.email(jobId, 'send', userEmail, emailType, true);
      jobLog.complete(jobId, { emailId: result.id, action: 'email-sent' });
      
      logger.info('Scheduled email sent successfully', {
        jobId,
        userId,
        emailType,
        emailId: result.id,
        adminTest: source === 'admin-testing',
        recipient: userEmail.replace(/(.{2}).*@/, '$1***@')
      }, LogCategory.EMAIL);

      return NextResponse.json({ 
        success: true, 
        emailId: result.id,
        emailType,
        subject,
        recipient: userEmail,
        sentAt: new Date().toISOString(),
        source: source || 'system'
      });
    } else {
      // Update email status as failed (skip for admin tests)
      if (source !== 'admin-testing') {
        await updateEmailScheduleStatus(userId, emailType, 'failed');
      }
      
      jobLog.email(jobId, 'fail', userEmail, emailType, false);
      jobLog.fail(jobId, new Error(result.error || 'Email sending failed'));
      
      logger.error('Scheduled email sending failed', 
        new Error(result.error || 'Email sending failed'), 
        {
          jobId,
          emailType,
          recipient: userEmail.replace(/(.{2}).*@/, '$1***@')
        }, 
        LogCategory.EMAIL
      );
      
      return NextResponse.json({ 
        error: result.error,
        emailType,
        recipient: userEmail
      }, { status: 500 });
    }

  } catch (error: any) {
    logger.error('Error processing scheduled email', 
      error instanceof Error ? error : new Error(String(error)), 
      { operation: 'scheduled-email-processing' }, 
      LogCategory.EMAIL
    );
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
