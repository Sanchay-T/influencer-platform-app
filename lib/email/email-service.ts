import { Resend } from 'resend';
import { qstash } from '@/lib/queue/qstash';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Email service configuration
export const EMAIL_CONFIG = {
  fromAddress: process.env.EMAIL_FROM_ADDRESS || 'hello@gemz.io',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  delays: {
    welcome: '10m',        // 10 minutes after signup
    abandonment: '2h',     // 2 hours if no trial started
    trial_day2: '2d',       // 2 days after trial starts
    trial_day5: '5d',       // 5 days after trial starts
    subscription_welcome: '30s', // Quick confirmation after subscription activation
  }
};

export interface EmailTemplateProps {
  username?: string;
  fullName?: string;
  businessName?: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
  billingUrl?: string;
  plan?: string;
  planName?: string;
  planFeatures?: string[];
}

export interface EmailScheduleParams {
  userId: string;
  emailType: 'welcome' | 'abandonment' | 'trial_day2' | 'trial_day5' | 'subscription_welcome';
  userEmail: string;
  templateProps: EmailTemplateProps;
  delay?: string;
}

/**
 * Send an email immediately using Resend
 */
export async function sendEmail(
  to: string,
  subject: string,
  reactComponent: React.ReactElement,
  from?: string
) {
  try {
    console.log('📧 [EMAIL-SERVICE] Sending email:', { to, subject, from: from || EMAIL_CONFIG.fromAddress });

    const result = await resend.emails.send({
      from: from || EMAIL_CONFIG.fromAddress,
      to: [to],
      subject,
      react: reactComponent,
    });

    console.log('✅ [EMAIL-SERVICE] Email sent successfully:', result.id);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('❌ [EMAIL-SERVICE] Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Schedule an email to be sent later using QStash
 */
export async function scheduleEmail(params: EmailScheduleParams) {
  try {
    const { userId, emailType, userEmail, templateProps, delay } = params;
    const emailDelay = delay || EMAIL_CONFIG.delays[emailType];
    
    console.log('📅 [EMAIL-SCHEDULER] Scheduling email:', {
      userId,
      emailType,
      userEmail,
      delay: emailDelay
    });

    // QStash callback URL for email processing
    const callbackUrl = `${EMAIL_CONFIG.siteUrl}/api/email/send-scheduled`;
    
    const messageData = {
      userId,
      emailType,
      userEmail,
      templateProps,
      scheduledAt: new Date().toISOString()
    };

    // Schedule with QStash
    const result = await qstash.publishJSON({
      url: callbackUrl,
      body: messageData,
      delay: emailDelay,
    });

    console.log('✅ [EMAIL-SCHEDULER] Email scheduled successfully:', {
      messageId: result.messageId,
      emailType,
      delay: emailDelay
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ [EMAIL-SCHEDULER] Failed to schedule email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update email schedule status in user profile
 */
export async function updateEmailScheduleStatus(
  userId: string,
  emailType: string,
  status: 'scheduled' | 'sent' | 'failed',
  messageId?: string
) {
  try {
    const { getUserProfile, updateUserProfile } = await import('@/lib/db/queries/user-queries');

    // Get current email schedule status
    const user = await getUserProfile(userId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const currentStatus = user.emailScheduleStatus as Record<string, any> || {};
    
    // Update the specific email type status
    const updatedStatus = {
      ...currentStatus,
      [emailType]: {
        status,
        messageId,
        timestamp: new Date().toISOString()
      }
    };

    // Update in database
    await updateUserProfile(userId, {
      emailScheduleStatus: updatedStatus,
    });

    console.log('✅ [EMAIL-STATUS] Updated email schedule status:', {
      userId,
      emailType,
      status,
      messageId
    });

    return { success: true };
  } catch (error) {
    console.error('❌ [EMAIL-STATUS] Failed to update email schedule status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get user email from Clerk
 */
export async function getUserEmailFromClerk(userId: string): Promise<string | null> {
  try {
    console.log('🔍 [CLERK-EMAIL] Starting Clerk email retrieval for userId:', userId);
    
    // Import Clerk server functions with the modern pattern
    const { clerkClient } = await import('@clerk/nextjs/server');
    
    if (!clerkClient) {
      console.error('❌ [CLERK-EMAIL] clerkClient is undefined');
      return null;
    }

    // Modern Clerk pattern: clerkClient is now an async function that must be called
    console.log('🔄 [CLERK-EMAIL] Initializing Clerk client...');
    const client = await clerkClient();
    
    if (!client || !client.users) {
      console.error('❌ [CLERK-EMAIL] Clerk client initialization failed or users API unavailable');
      return null;
    }

    console.log('✅ [CLERK-EMAIL] Clerk client initialized successfully');
    const user = await client.users.getUser(userId);
    
    if (!user) {
      console.error('❌ [CLERK-EMAIL] User not found:', userId);
      return null;
    }
    
    const primaryEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);
    
    if (!primaryEmail) {
      console.error('❌ [CLERK-EMAIL] No primary email found for user:', userId);
      console.log('🔍 [CLERK-EMAIL] Available emails:', user.emailAddresses?.map(e => ({ id: e.id, email: e.emailAddress })));
      return null;
    }

    console.log('✅ [CLERK-EMAIL] Retrieved user email:', primaryEmail.emailAddress);
    return primaryEmail.emailAddress;
  } catch (error) {
    console.error('❌ [CLERK-EMAIL] Failed to get user email from Clerk:', error);
    return null;
  }
}

/**
 * Check if email should be sent (avoid duplicates)
 */
export async function shouldSendEmail(userId: string, emailType: string): Promise<boolean> {
  try {
    const { getUserProfile } = await import('@/lib/db/queries/user-queries');

    const user = await getUserProfile(userId);

    if (!user) {
      return false;
    }

    const emailStatus = user.emailScheduleStatus as Record<string, any> || {};
    const emailInfo = emailStatus[emailType];

    // Don't send if already sent or scheduled
    if (emailInfo && (emailInfo.status === 'sent' || emailInfo.status === 'scheduled')) {
      console.log(`⏭️ [EMAIL-CHECK] Email ${emailType} already ${emailInfo.status} for user ${userId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ [EMAIL-CHECK] Error checking email status:', error);
    return false;
  }
}
