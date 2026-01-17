import { Resend } from 'resend';
import { clerkBackendClient } from '@/lib/auth/backend-auth';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { qstash } from '@/lib/queue/qstash';
import { apiTracker } from '@/lib/sentry/feature-tracking';
import { getRecordProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';

const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
	throw new Error(
		'RESEND_API_KEY must be set before sending emails. Add it to your environment configuration.'
	);
}

// Initialize Resend
const resend = new Resend(resendApiKey);

const resolvedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!resolvedSiteUrl) {
	throw new Error(
		'NEXT_PUBLIC_SITE_URL must be configured for email scheduling so QStash can reach the application.'
	);
}

export type EmailType =
	| 'welcome'
	| 'abandonment'
	| 'trial_day2'
	| 'trial_day5'
	| 'subscription_welcome';

export type EmailDelay = `${bigint}s` | `${bigint}m` | `${bigint}h` | `${bigint}d`;

const isEmailDelay = (value: string): value is EmailDelay => /^\d+[smhd]$/.test(value);

// Email service configuration
export const EMAIL_CONFIG = {
	fromAddress: process.env.EMAIL_FROM_ADDRESS || 'hello@gemz.io',
	siteUrl: resolvedSiteUrl,
	delays: {
		welcome: '10m', // 10 minutes after signup
		abandonment: '2h', // 2 hours if no trial started
		trial_day2: '2d', // 2 days after trial starts
		trial_day5: '5d', // 5 days after trial starts
		subscription_welcome: '30s', // Quick confirmation after subscription activation
	} satisfies Record<EmailType, EmailDelay>,
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
	emailType: EmailType;
	userEmail: string;
	templateProps: EmailTemplateProps;
	delay?: string;
}

export type EmailScheduleStatus =
	| 'scheduled'
	| 'sent'
	| 'failed'
	| 'cancelled'
	| 'cancelled_subscription';

/**
 * Send an email immediately using Resend
 */
export async function sendEmail(
	to: string,
	subject: string,
	reactComponent: React.ReactElement,
	from?: string
) {
	// Track email send with Sentry
	return apiTracker.trackExternalCall('resend', 'send', async () => {
		try {
			structuredConsole.log('📧 [EMAIL-SERVICE] Sending email:', {
				to,
				subject,
				from: from || EMAIL_CONFIG.fromAddress,
			});

			const result = await resend.emails.send({
				from: from || EMAIL_CONFIG.fromAddress,
				to: [to],
				subject,
				react: reactComponent,
			});

			const resultRecord = toRecord(result);
			const directId = resultRecord ? getStringProperty(resultRecord, 'id') : null;
			const dataRecord = resultRecord ? getRecordProperty(resultRecord, 'data') : null;
			const dataId = dataRecord ? getStringProperty(dataRecord, 'id') : null;
			const resolvedId = directId ?? dataId ?? 'unknown';

			// Add breadcrumb for successful email
			SentryLogger.addBreadcrumb({
				category: 'email',
				message: `Email sent: ${subject}`,
				level: 'info',
				data: { to, emailId: resolvedId },
			});

			structuredConsole.log('✅ [EMAIL-SERVICE] Email sent successfully:', resolvedId);
			return { success: true, id: resolvedId };
		} catch (error) {
			structuredConsole.error('❌ [EMAIL-SERVICE] Failed to send email:', error);

			// Capture email error in Sentry
			SentryLogger.captureException(error, {
				tags: { feature: 'email', operation: 'send' },
				extra: { to, subject },
				level: 'warning',
			});

			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});
}

/**
 * Schedule an email to be sent later using QStash
 */
export async function scheduleEmail(params: EmailScheduleParams) {
	const { userId, emailType, userEmail, templateProps, delay } = params;
	const defaultDelay = EMAIL_CONFIG.delays[emailType];
	const emailDelay = delay && isEmailDelay(delay) ? delay : defaultDelay;

	// Add breadcrumb for email scheduling
	SentryLogger.addBreadcrumb({
		category: 'email',
		message: `Scheduling ${emailType} email`,
		level: 'info',
		data: { userId, emailType, scheduledDelay: emailDelay },
	});

	try {
		structuredConsole.log('📅 [EMAIL-SCHEDULER] Scheduling email:', {
			userId,
			emailType,
			userEmail,
			delay: emailDelay,
		});

		// QStash callback URL for email processing
		const callbackUrl = `${EMAIL_CONFIG.siteUrl}/api/email/send-scheduled`;

		const messageData = {
			userId,
			emailType,
			userEmail,
			templateProps,
			scheduledAt: new Date().toISOString(),
		};

		// Schedule with QStash - track external call
		const result = await apiTracker.trackExternalCall('qstash', 'publish_email', async () => {
			return qstash.publishJSON({
				url: callbackUrl,
				body: messageData,
				delay: emailDelay,
			});
		});

		const resultRecord = toRecord(result);
		const messageId = resultRecord ? getStringProperty(resultRecord, 'messageId') : null;
		const dataRecord = resultRecord ? getRecordProperty(resultRecord, 'data') : null;
		const dataMessageId = dataRecord ? getStringProperty(dataRecord, 'messageId') : null;
		const resolvedMessageId = messageId ?? dataMessageId ?? 'unknown';

		// Add breadcrumb for successful scheduling
		SentryLogger.addBreadcrumb({
			category: 'email',
			message: `Email scheduled: ${emailType}`,
			level: 'info',
			data: { userId, emailType, messageId: resolvedMessageId },
		});

		structuredConsole.log('✅ [EMAIL-SCHEDULER] Email scheduled successfully:', {
			messageId: resolvedMessageId,
			emailType,
			delay: emailDelay,
		});

		return { success: true, messageId: resolvedMessageId };
	} catch (error) {
		structuredConsole.error('❌ [EMAIL-SCHEDULER] Failed to schedule email:', error);

		// Capture email scheduling error in Sentry
		SentryLogger.captureException(error, {
			tags: { feature: 'email', operation: 'schedule' },
			extra: { userId, emailType, delay: emailDelay },
			level: 'warning',
		});

		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Update email schedule status in user profile
 */
export async function updateEmailScheduleStatus(
	userId: string,
	emailType: string,
	status: EmailScheduleStatus,
	messageId?: string
) {
	try {
		const { getUserProfile, updateUserProfile } = await import('@/lib/db/queries/user-queries');

		// Get current email schedule status
		const user = await getUserProfile(userId);

		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		const currentStatus = toRecord(user.emailScheduleStatus) ?? {};

		// Update the specific email type status
		const updatedStatus = {
			...currentStatus,
			[emailType]: {
				status,
				messageId,
				timestamp: new Date().toISOString(),
			},
		};

		// Update in database
		await updateUserProfile(userId, {
			emailScheduleStatus: updatedStatus,
		});

		structuredConsole.log('✅ [EMAIL-STATUS] Updated email schedule status:', {
			userId,
			emailType,
			status,
			messageId,
		});

		return { success: true };
	} catch (error) {
		structuredConsole.error('❌ [EMAIL-STATUS] Failed to update email schedule status:', error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Get user email from Clerk
 */
export async function getUserEmailFromClerk(userId: string): Promise<string | null> {
	try {
		structuredConsole.log('🔍 [CLERK-EMAIL] Starting Clerk email retrieval for userId:', userId);
		const clerk = await clerkBackendClient();

		// Track Clerk API call with Sentry
		const user = await apiTracker.trackExternalCall('clerk', 'get_user', async () => {
			return clerk.users.getUser(userId);
		});

		if (!user) {
			structuredConsole.error('❌ [CLERK-EMAIL] User not found:', userId);
			return null;
		}

		const primaryEmail = user.emailAddresses.find(
			(email) => email.id === user.primaryEmailAddressId
		);

		// Fallback: pick the first verified address, or the first address if none are verified.
		const fallbackEmail =
			user.emailAddresses.find((email) => email.verification?.status === 'verified') ||
			user.emailAddresses[0];

		const resolvedEmail = primaryEmail?.emailAddress || fallbackEmail?.emailAddress || null;

		if (!resolvedEmail) {
			structuredConsole.error('❌ [CLERK-EMAIL] No email found for user:', userId);
			structuredConsole.log(
				'🔍 [CLERK-EMAIL] Available emails:',
				user.emailAddresses?.map((e) => ({
					id: e.id,
					email: e.emailAddress,
					verified: e.verification?.status,
				}))
			);
			return null;
		}

		if (!primaryEmail) {
			structuredConsole.warn(
				'⚠️ [CLERK-EMAIL] No primary email set; using fallback email:',
				resolvedEmail
			);
		}

		structuredConsole.log('✅ [CLERK-EMAIL] Retrieved user email:', resolvedEmail);
		return resolvedEmail;
	} catch (error) {
		structuredConsole.error('❌ [CLERK-EMAIL] Failed to get user email from Clerk:', error);

		// Capture Clerk API error in Sentry
		SentryLogger.captureException(error, {
			tags: { feature: 'email', operation: 'clerk_get_user' },
			extra: { userId },
			level: 'warning',
		});

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

		const emailStatus = toRecord(user.emailScheduleStatus) ?? {};
		const emailInfo = emailStatus[emailType];
		const emailInfoRecord = toRecord(emailInfo);
		const statusValue = emailInfoRecord ? getStringProperty(emailInfoRecord, 'status') : null;

		// Don't send if already sent or scheduled
		if (
			statusValue === 'sent' ||
			statusValue === 'scheduled' ||
			statusValue === 'cancelled' ||
			statusValue === 'cancelled_subscription'
		) {
			structuredConsole.log(
				`⏭️ [EMAIL-CHECK] Email ${emailType} already ${statusValue} for user ${userId}`
			);
			return false;
		}

		return true;
	} catch (error) {
		structuredConsole.error('❌ [EMAIL-CHECK] Error checking email status:', error);
		return false;
	}
}
