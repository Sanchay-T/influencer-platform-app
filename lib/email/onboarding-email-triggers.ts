import { structuredConsole } from '@/lib/logging/console-proxy';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import {
	EMAIL_CONFIG,
	type EmailTemplateProps,
	type EmailType,
	getUserEmailFromClerk,
	scheduleEmail,
	shouldSendEmail,
	updateEmailScheduleStatus,
} from './email-service';

/**
 * Onboarding email sequence for users who sign up but don't start their trial.
 * Schedules all 6 emails in the drip sequence.
 */

const ONBOARDING_EMAIL_TYPES: EmailType[] = [
	'onboarding_1_welcome',
	'onboarding_2_keyword',
	'onboarding_3_similar',
	'onboarding_4_database',
	'onboarding_5_cost',
	'onboarding_6_final',
];

const ONBOARDING_SUBJECTS: Record<string, string> = {
	onboarding_1_welcome: "Welcome to Gemz — here's what you're unlocking",
	onboarding_2_keyword: 'How to find creators by what they actually talk about',
	onboarding_3_similar: "Found one good creator? Here's how to find 50 more",
	onboarding_4_database: 'Why influencer databases are lying to you',
	onboarding_5_cost: "You don't need a $500/mo influencer tool",
	onboarding_6_final: "Last thing — then I'll stop emailing",
};

interface ScheduleOnboardingResult {
	success: boolean;
	scheduled: string[];
	skipped: string[];
	failed: string[];
	error?: string;
}

/**
 * Schedule all onboarding emails for a user who just signed up.
 * Should be called after user registration, before they start their trial.
 */
export async function scheduleOnboardingEmails(
	userId: string,
	fullName?: string
): Promise<ScheduleOnboardingResult> {
	structuredConsole.log('📧 [ONBOARDING-EMAILS] Scheduling onboarding sequence for user:', userId);

	const scheduled: string[] = [];
	const skipped: string[] = [];
	const failed: string[] = [];

	try {
		// Get user email from Clerk
		const userEmail = await getUserEmailFromClerk(userId);
		if (!userEmail) {
			structuredConsole.error('❌ [ONBOARDING-EMAILS] Could not retrieve email for user:', userId);
			return {
				success: false,
				scheduled: [],
				skipped: [],
				failed: ONBOARDING_EMAIL_TYPES as string[],
				error: 'Could not retrieve user email',
			};
		}

		// Build template props with UTM tracking
		// Note: dashboardUrl goes to /dashboard which shows the onboarding modal
		// for users who haven't completed onboarding yet
		const templateProps: EmailTemplateProps = {
			fullName,
			dashboardUrl: `${EMAIL_CONFIG.siteUrl}/dashboard?utm_source=email&utm_campaign=onboarding`,
			// unsubscribeUrl intentionally omitted - no unsubscribe page exists yet
			// Templates handle missing value gracefully by showing "— The Gemz Team"
		};

		// Schedule each email in the sequence
		for (const emailType of ONBOARDING_EMAIL_TYPES) {
			// Check if email should be sent (avoid duplicates)
			const shouldSend = await shouldSendEmail(userId, emailType);
			if (!shouldSend) {
				skipped.push(emailType);
				continue;
			}

			const result = await scheduleEmail({
				userId,
				emailType,
				userEmail,
				templateProps,
			});

			if (result.success) {
				scheduled.push(emailType);
				await updateEmailScheduleStatus(userId, emailType, 'scheduled', result.messageId);
			} else {
				failed.push(emailType);
				structuredConsole.error(
					`❌ [ONBOARDING-EMAILS] Failed to schedule ${emailType}:`,
					result.error
				);
			}
		}

		const success = failed.length === 0;
		structuredConsole.log('✅ [ONBOARDING-EMAILS] Scheduling complete:', {
			userId,
			scheduled,
			skipped,
			failed,
		});

		return { success, scheduled, skipped, failed };
	} catch (error) {
		structuredConsole.error('❌ [ONBOARDING-EMAILS] Error scheduling emails:', error);
		SentryLogger.captureException(error, {
			tags: { feature: 'email', operation: 'schedule_onboarding' },
			extra: { userId },
			level: 'error',
		});

		return {
			success: false,
			scheduled,
			skipped,
			failed: ONBOARDING_EMAIL_TYPES.filter(
				(t) => !(scheduled.includes(t) || skipped.includes(t))
			) as string[],
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Cancel all pending onboarding emails for a user.
 * Should be called when a user starts their trial (enters credit card).
 */
export async function cancelOnboardingEmails(userId: string): Promise<{
	success: boolean;
	cancelled: string[];
	error?: string;
}> {
	structuredConsole.log('🛑 [ONBOARDING-EMAILS] Cancelling onboarding sequence for user:', userId);

	const cancelled: string[] = [];

	try {
		for (const emailType of ONBOARDING_EMAIL_TYPES) {
			await updateEmailScheduleStatus(userId, emailType, 'cancelled_subscription');
			cancelled.push(emailType);
		}

		structuredConsole.log('✅ [ONBOARDING-EMAILS] Cancelled onboarding emails:', {
			userId,
			cancelled,
		});

		return { success: true, cancelled };
	} catch (error) {
		structuredConsole.error('❌ [ONBOARDING-EMAILS] Error cancelling emails:', error);
		SentryLogger.captureException(error, {
			tags: { feature: 'email', operation: 'cancel_onboarding' },
			extra: { userId },
			level: 'warning',
		});

		return {
			success: false,
			cancelled,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Get the subject line for an onboarding email type.
 */
export function getOnboardingEmailSubject(emailType: EmailType): string {
	return ONBOARDING_SUBJECTS[emailType] || 'Welcome to Gemz';
}

/**
 * Check if an email type is part of the onboarding sequence.
 */
export function isOnboardingEmail(emailType: string): emailType is EmailType {
	return ONBOARDING_EMAIL_TYPES.includes(emailType as EmailType);
}
