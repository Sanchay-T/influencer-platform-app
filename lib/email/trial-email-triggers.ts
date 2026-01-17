import { structuredConsole } from '@/lib/logging/console-proxy';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { billingTracker } from '@/lib/sentry/feature-tracking';
import {
	getUserEmailFromClerk,
	scheduleEmail,
	shouldSendEmail,
	updateEmailScheduleStatus,
} from './email-service';

/**
 * Schedule trial-related emails when user starts their trial
 */
export async function scheduleTrialEmails(
	userId: string,
	userInfo: { fullName: string; businessName: string }
) {
	const startTime = Date.now();
	const requestId = `trial_emails_${Date.now()}_${Math.random().toString(36).substring(7)}`;

	// Set Sentry context for trial email scheduling
	SentryLogger.setContext('trial_emails', {
		userId,
		requestId,
		userInfo,
	});

	// Add breadcrumb for trial email scheduling
	SentryLogger.addBreadcrumb({
		category: 'email',
		message: 'Scheduling trial email sequence',
		level: 'info',
		data: { userId, requestId },
	});

	structuredConsole.log('📧📧📧 [TRIAL-EMAILS] ===============================');
	structuredConsole.log('📧📧📧 [TRIAL-EMAILS] SCHEDULING TRIAL EMAIL SEQUENCE');
	structuredConsole.log('📧📧📧 [TRIAL-EMAILS] ===============================');
	structuredConsole.log('🆔 [TRIAL-EMAILS] Request ID:', requestId);
	structuredConsole.log('⏰ [TRIAL-EMAILS] Timestamp:', new Date().toISOString());
	structuredConsole.log('📧 [TRIAL-EMAILS] Target user:', userId);
	structuredConsole.log('📧 [TRIAL-EMAILS] User info:', userInfo);

	try {
		structuredConsole.log('🔍 [TRIAL-EMAILS] Getting user email from Clerk...');
		const userEmail = await getUserEmailFromClerk(userId);

		if (!userEmail) {
			structuredConsole.error('❌❌❌ [TRIAL-EMAILS] NO EMAIL FOUND FOR USER:', userId);
			return { success: false, error: 'User email not found' };
		}

		structuredConsole.log('✅ [TRIAL-EMAILS] User email retrieved:', userEmail);
		structuredConsole.log(
			'⏱️ [TRIAL-EMAILS] Email lookup completed in:',
			Date.now() - startTime,
			'ms'
		);

		const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/campaigns`;
		const templateProps = {
			fullName: userInfo.fullName,
			businessName: userInfo.businessName,
			dashboardUrl,
		};

		structuredConsole.log('📧 [TRIAL-EMAILS] Template props prepared:', templateProps);
		structuredConsole.log('📧 [TRIAL-EMAILS] Dashboard URL:', dashboardUrl);

		const results = [];

		// Schedule Trial Day 2 email (2 days after trial starts)
		structuredConsole.log('🔍 [TRIAL-EMAILS] Checking if trial day 2 email should be sent...');
		if (await shouldSendEmail(userId, 'trial_day2')) {
			structuredConsole.log('📧📧📧 [TRIAL-EMAILS] SCHEDULING TRIAL DAY 2 EMAIL');
			structuredConsole.log('📧 [TRIAL-EMAILS] Email will be sent 2 days after trial start');

			const day2StartTime = Date.now();

			const day2Result = await scheduleEmail({
				userId,
				emailType: 'trial_day2',
				userEmail,
				templateProps,
				delay: '2d', // 2 days
			});

			if (day2Result.success) {
				await updateEmailScheduleStatus(userId, 'trial_day2', 'scheduled', day2Result.messageId);
				results.push({
					emailType: 'trial_day2',
					success: true,
					messageId: day2Result.messageId,
					delay: '2d',
				});
				structuredConsole.log('✅✅✅ [TRIAL-EMAILS] TRIAL DAY 2 EMAIL SCHEDULED SUCCESSFULLY');
				structuredConsole.log('📧 [TRIAL-EMAILS] Day 2 details:', {
					messageId: day2Result.messageId,
					setupTime: Date.now() - day2StartTime + 'ms',
				});
			} else {
				results.push({ emailType: 'trial_day2', success: false, error: day2Result.error });
				structuredConsole.error('❌❌❌ [TRIAL-EMAILS] FAILED TO SCHEDULE TRIAL DAY 2 EMAIL');
				structuredConsole.error('📧 [TRIAL-EMAILS] Day 2 error:', day2Result.error);
			}
		} else {
			structuredConsole.log(
				'⚠️ [TRIAL-EMAILS] Trial day 2 email skipped (shouldSendEmail returned false)'
			);
		}

		// Schedule Trial Day 5 email (5 days after trial starts)
		structuredConsole.log('🔍 [TRIAL-EMAILS] Checking if trial day 5 email should be sent...');
		if (await shouldSendEmail(userId, 'trial_day5')) {
			structuredConsole.log('📧📧📧 [TRIAL-EMAILS] SCHEDULING TRIAL DAY 5 EMAIL');
			structuredConsole.log('📧 [TRIAL-EMAILS] Email will be sent 5 days after trial start');

			const day5StartTime = Date.now();

			const day5Result = await scheduleEmail({
				userId,
				emailType: 'trial_day5',
				userEmail,
				templateProps,
				delay: '5d', // 5 days
			});

			if (day5Result.success) {
				await updateEmailScheduleStatus(userId, 'trial_day5', 'scheduled', day5Result.messageId);
				results.push({
					emailType: 'trial_day5',
					success: true,
					messageId: day5Result.messageId,
					delay: '5d',
				});
				structuredConsole.log('✅✅✅ [TRIAL-EMAILS] TRIAL DAY 5 EMAIL SCHEDULED SUCCESSFULLY');
				structuredConsole.log('📧 [TRIAL-EMAILS] Day 5 details:', {
					messageId: day5Result.messageId,
					setupTime: Date.now() - day5StartTime + 'ms',
				});
			} else {
				results.push({ emailType: 'trial_day5', success: false, error: day5Result.error });
				structuredConsole.error('❌❌❌ [TRIAL-EMAILS] FAILED TO SCHEDULE TRIAL DAY 5 EMAIL');
				structuredConsole.error('📧 [TRIAL-EMAILS] Day 5 error:', day5Result.error);
			}
		} else {
			structuredConsole.log(
				'⚠️ [TRIAL-EMAILS] Trial day 5 email skipped (shouldSendEmail returned false)'
			);
		}

		const totalTime = Date.now() - startTime;

		structuredConsole.log('🎉🎉🎉 [TRIAL-EMAILS] ===============================');
		structuredConsole.log('🎉🎉🎉 [TRIAL-EMAILS] TRIAL EMAIL SEQUENCE COMPLETED');
		structuredConsole.log('🎉🎉🎉 [TRIAL-EMAILS] ===============================');
		structuredConsole.log('⏱️ [TRIAL-EMAILS] Total execution time:', totalTime, 'ms');
		structuredConsole.log('📊 [TRIAL-EMAILS] Summary:', {
			emailsScheduled: results.filter((r) => r.success).length,
			emailsFailed: results.filter((r) => !r.success).length,
			totalEmails: results.length,
			userEmail,
			userId,
			requestId,
		});
		structuredConsole.log('📧 [TRIAL-EMAILS] Detailed results:', results);

		// Track trial email sequence started in Sentry
		SentryLogger.addBreadcrumb({
			category: 'email',
			message: 'Trial email sequence scheduled successfully',
			level: 'info',
			data: {
				userId,
				emailsScheduled: results.filter((r) => r.success).length,
				requestId,
			},
		});

		return { success: true, results };
	} catch (error) {
		structuredConsole.error('❌ [TRIAL-EMAILS] Error scheduling trial emails:', error);

		// Capture error in Sentry
		SentryLogger.captureException(error, {
			tags: { feature: 'email', operation: 'schedule_trial_emails' },
			extra: { userId, requestId },
		});

		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Cancel scheduled abandonment email when user starts trial
 */
export async function cancelAbandonmentEmail(userId: string) {
	try {
		structuredConsole.log('🚫 [TRIAL-EMAILS] Canceling abandonment email for user:', userId);

		// Mark abandonment email as cancelled (we can't actually cancel QStash messages,
		// but we can track that the user completed the trial)
		await updateEmailScheduleStatus(userId, 'abandonment', 'cancelled');

		structuredConsole.log('✅ [TRIAL-EMAILS] Abandonment email marked as cancelled');
		return { success: true };
	} catch (error) {
		structuredConsole.error('❌ [TRIAL-EMAILS] Error canceling abandonment email:', error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Cancel all scheduled trial emails when user subscribes to a paid plan
 */
export async function cancelTrialEmailsOnSubscription(userId: string) {
	try {
		structuredConsole.log('🚫🚫🚫 [TRIAL-EMAILS] ===============================');
		structuredConsole.log('🚫🚫🚫 [TRIAL-EMAILS] CANCELING TRIAL EMAILS ON SUBSCRIPTION');
		structuredConsole.log('🚫🚫🚫 [TRIAL-EMAILS] ===============================');
		structuredConsole.log('🚫 [TRIAL-EMAILS] Target user:', userId);
		structuredConsole.log('📧 [TRIAL-EMAILS] Reason: User subscribed to paid plan');

		const results = [];

		// Cancel trial day 2 email
		try {
			await updateEmailScheduleStatus(userId, 'trial_day2', 'cancelled_subscription');
			results.push({ emailType: 'trial_day2', cancelled: true });
			structuredConsole.log('✅ [TRIAL-EMAILS] Trial Day 2 email marked as cancelled');
		} catch (error) {
			structuredConsole.error('❌ [TRIAL-EMAILS] Error canceling trial day 2 email:', error);
			results.push({
				emailType: 'trial_day2',
				cancelled: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}

		// Cancel trial day 5 email
		try {
			await updateEmailScheduleStatus(userId, 'trial_day5', 'cancelled_subscription');
			results.push({ emailType: 'trial_day5', cancelled: true });
			structuredConsole.log('✅ [TRIAL-EMAILS] Trial Day 5 email marked as cancelled');
		} catch (error) {
			structuredConsole.error('❌ [TRIAL-EMAILS] Error canceling trial day 5 email:', error);
			results.push({
				emailType: 'trial_day5',
				cancelled: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}

		// Cancel any remaining abandonment emails
		try {
			await updateEmailScheduleStatus(userId, 'abandonment', 'cancelled_subscription');
			results.push({ emailType: 'abandonment', cancelled: true });
			structuredConsole.log('✅ [TRIAL-EMAILS] Abandonment email marked as cancelled');
		} catch (error) {
			structuredConsole.error('❌ [TRIAL-EMAILS] Error canceling abandonment email:', error);
			results.push({
				emailType: 'abandonment',
				cancelled: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}

		const successCount = results.filter((r) => r.cancelled).length;
		const failureCount = results.filter((r) => !r.cancelled).length;

		structuredConsole.log('🎉 [TRIAL-EMAILS] Trial email cancellation completed:', {
			userId,
			emailsCancelled: successCount,
			emailsFailed: failureCount,
			totalEmails: results.length,
		});

		return {
			success: true,
			results,
			emailsCancelled: successCount,
			emailsFailed: failureCount,
		};
	} catch (error) {
		structuredConsole.error(
			'❌ [TRIAL-EMAILS] Error canceling trial emails on subscription:',
			error
		);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Schedule subscription welcome email when user subscribes
 */
export async function scheduleSubscriptionWelcomeEmail(
	userId: string,
	subscriptionInfo: {
		plan: string;
		fullName: string;
		businessName: string;
	}
) {
	try {
		structuredConsole.log('📧📧📧 [SUBSCRIPTION-EMAILS] ===============================');
		structuredConsole.log('📧📧📧 [SUBSCRIPTION-EMAILS] SCHEDULING SUBSCRIPTION WELCOME EMAIL');
		structuredConsole.log('📧📧📧 [SUBSCRIPTION-EMAILS] ===============================');
		structuredConsole.log('📧 [SUBSCRIPTION-EMAILS] Target user:', userId);
		structuredConsole.log('📧 [SUBSCRIPTION-EMAILS] Subscription info:', subscriptionInfo);

		const userEmail = await getUserEmailFromClerk(userId);

		if (!userEmail) {
			structuredConsole.error('❌ [SUBSCRIPTION-EMAILS] No email found for user:', userId);
			return { success: false, error: 'User email not found' };
		}

		const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/campaigns`;
		const billingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/billing`;

		const planDisplayName = getPlanDisplayName(subscriptionInfo.plan);

		const templateProps = {
			fullName: subscriptionInfo.fullName,
			businessName: subscriptionInfo.businessName,
			plan: subscriptionInfo.plan,
			planName: planDisplayName,
			dashboardUrl,
			billingUrl,
			planFeatures: getPlanFeatures(subscriptionInfo.plan),
		};

		// Schedule immediate welcome email
		const emailResult = await scheduleEmail({
			userId,
			emailType: 'subscription_welcome',
			userEmail,
			templateProps,
			delay: '30s', // Send almost immediately
		});

		if (emailResult.success) {
			await updateEmailScheduleStatus(
				userId,
				'subscription_welcome',
				'scheduled',
				emailResult.messageId
			);
			structuredConsole.log('✅✅✅ [SUBSCRIPTION-EMAILS] SUBSCRIPTION WELCOME EMAIL SCHEDULED');
			structuredConsole.log('📧 [SUBSCRIPTION-EMAILS] Welcome email details:', {
				messageId: emailResult.messageId,
				userEmail,
				plan: subscriptionInfo.plan,
			});

			return {
				success: true,
				messageId: emailResult.messageId,
				userEmail,
				plan: subscriptionInfo.plan,
			};
		} else {
			structuredConsole.error(
				'❌ [SUBSCRIPTION-EMAILS] Failed to schedule welcome email:',
				emailResult.error
			);
			return { success: false, error: emailResult.error };
		}
	} catch (error) {
		structuredConsole.error(
			'❌ [SUBSCRIPTION-EMAILS] Error scheduling subscription welcome email:',
			error
		);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

function getPlanDisplayName(plan: string): string {
	const planNames: Record<string, string> = {
		glow_up: 'Glow Up',
		viral_surge: 'Viral Surge',
		fame_flex: 'Fame Flex',
		premium: 'Premium',
		enterprise: 'Enterprise',
		basic: 'Basic',
	};

	return planNames[plan] || plan.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get plan features for email template
 */
function getPlanFeatures(plan: string): string[] {
	const planFeatures: Record<string, string[]> = {
		glow_up: [
			'Run up to 3 active campaigns simultaneously',
			'Discover up to 1,000 creators each month',
			'Unlimited influencer search with CSV export',
			'Essential performance analytics for every campaign',
		],
		viral_surge: [
			'Unlock 10 concurrent campaigns to scale quickly',
			'Review up to 10,000 new creators every month',
			'Advanced analytics with engagement + audience insights',
			'Priority support with faster response times',
		],
		fame_flex: [
			'Unlimited campaigns and creator discovery',
			'Enterprise-grade analytics and reporting',
			'API access plus custom integrations workflow',
			'White-glove onboarding with dedicated success partner',
		],
		premium: [
			'Unlimited influencer searches across TikTok, Instagram, and YouTube',
			'Advanced bio and email extraction',
			'CSV export functionality',
			'Real-time search progress tracking',
			'Priority customer support',
		],
		enterprise: [
			'All Premium features',
			'API access for custom integrations',
			'Dedicated account manager',
			'Custom reporting and analytics',
			'White-label options',
			'Priority feature requests',
		],
		basic: [
			'Limited influencer searches',
			'Basic bio extraction',
			'CSV export functionality',
			'Standard customer support',
		],
	};

	return planFeatures[plan] || planFeatures.basic;
}
