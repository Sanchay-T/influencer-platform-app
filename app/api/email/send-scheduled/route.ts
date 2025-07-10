import { NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { sendEmail, updateEmailScheduleStatus, EMAIL_CONFIG } from '@/lib/email/email-service';

// Import email templates (will be created next)
import WelcomeEmail from '@/components/email-templates/welcome-email';
import TrialAbandonmentEmail from '@/components/email-templates/trial-abandonment-email';
import TrialDay2Email from '@/components/email-templates/trial-day2-email';
import TrialDay5Email from '@/components/email-templates/trial-day5-email';

// Initialize QStash receiver
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(request: Request) {
  try {
    console.log('📧 [SCHEDULED-EMAIL] Processing scheduled email request');

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
          console.error('❌ [SCHEDULED-EMAIL] Invalid QStash signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } catch (signatureError) {
        console.warn('⚠️ [SCHEDULED-EMAIL] Signature verification failed, but proceeding for admin test');
      }
    }

    console.log('📧 [SCHEDULED-EMAIL] Processing email:', {
      userId,
      emailType,
      userEmail,
      scheduledAt,
      source: source || 'system',
      adminTriggered: !!adminUserId
    });

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
      
      console.log('✅ [SCHEDULED-EMAIL] Email sent successfully:', {
        userId,
        emailType,
        emailId: result.id,
        adminTest: source === 'admin-testing'
      });

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
      
      console.error('❌ [SCHEDULED-EMAIL] Email sending failed:', result.error);
      return NextResponse.json({ 
        error: result.error,
        emailType,
        recipient: userEmail
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ [SCHEDULED-EMAIL] Error processing scheduled email:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}