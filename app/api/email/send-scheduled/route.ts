import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
// Email templates
import OnboardingWelcomeEmail from '@/components/email-templates/onboarding-1-welcome';
import OnboardingKeywordEmail from '@/components/email-templates/onboarding-2-keyword-search';
import OnboardingSimilarCreatorEmail from '@/components/email-templates/onboarding-3-similar-creator';
import OnboardingNotDatabaseEmail from '@/components/email-templates/onboarding-4-not-database';
import OnboardingCostComparisonEmail from '@/components/email-templates/onboarding-5-cost-comparison';
import OnboardingFinalPushEmail from '@/components/email-templates/onboarding-6-final-push';
import SubscriptionWelcomeEmail from '@/components/email-templates/subscription-welcome-email';
import TrialAbandonmentEmail from '@/components/email-templates/trial-abandonment-email';
import TrialDay2Email from '@/components/email-templates/trial-day2-email';
import TrialDay5Email from '@/components/email-templates/trial-day5-email';
import WelcomeEmail from '@/components/email-templates/welcome-email';
import { EMAIL_CONFIG, sendEmail, updateEmailScheduleStatus } from '@/lib/email/email-service';
import { logger } from '@/lib/logging';
import { jobLog } from '@/lib/logging/background-job-logger';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { LogCategory } from '@/lib/logging/types';
import { toError } from '@/lib/utils/type-guards';

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
			metadata: { operation: 'send-scheduled-email' },
		});

		logger.info('Processing scheduled email request', { jobId }, LogCategory.EMAIL);

		// Get request body
		const body = await request.text();
		const messageData = JSON.parse(body);
		const { userId, emailType, userEmail, templateProps, scheduledAt, source, adminUserId } =
			messageData;

		// Skip signature verification for admin-triggered emails (development convenience)
		if (source !== 'admin-testing') {
			try {
				const isValid = await receiver.verify({
					signature: request.headers.get('Upstash-Signature')!,
					body,
					url: `${EMAIL_CONFIG.siteUrl}/api/email/send-scheduled`,
				});

				if (!isValid) {
					logger.error(
						'Invalid QStash signature for scheduled email',
						undefined,
						{ jobId },
						LogCategory.EMAIL
					);
					jobLog.fail(jobId, new Error('Invalid QStash signature'), undefined, false);
					return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
				}
			} catch (signatureError) {
				logger.warn(
					'QStash signature verification failed for admin test',
					{ jobId, error: toError(signatureError) },
					LogCategory.EMAIL
				);
			}
		}

		logger.info(
			'Processing scheduled email',
			{
				jobId,
				userId,
				emailType,
				userEmail: userEmail.replace(/(.{2}).*@/, '$1***@'), // Partially redact
				scheduledAt,
				source: source || 'system',
				adminTriggered: !!adminUserId,
			},
			LogCategory.EMAIL
		);

		// Check if email was cancelled before sending (skip for admin tests)
		if (source !== 'admin-testing') {
			const { getUserProfile } = await import('@/lib/db/queries/user-queries');
			const userProfile = await getUserProfile(userId);

			if (userProfile?.emailScheduleStatus) {
				const emailStatus = userProfile.emailScheduleStatus as Record<string, { status?: string }>;
				const thisEmailStatus = emailStatus[emailType]?.status;

				if (thisEmailStatus === 'cancelled' || thisEmailStatus === 'cancelled_subscription') {
					logger.info(
						'Skipping cancelled email',
						{
							jobId,
							userId,
							emailType,
							status: thisEmailStatus,
						},
						LogCategory.EMAIL
					);
					return NextResponse.json({
						skipped: true,
						reason: `Email was ${thisEmailStatus}`,
						emailType,
					});
				}
			}
		}

		// Get the appropriate email template and subject
		let emailComponent: React.ReactElement;
		let subject: string;

		// Add admin testing prefix if triggered by admin
		const subjectPrefix = source === 'admin-testing' ? '[ADMIN TEST] ' : '';

		switch (emailType) {
			case 'welcome':
				emailComponent = WelcomeEmail(templateProps);
				subject = `${subjectPrefix}Welcome to Gemz! 🎉`;
				break;

			case 'abandonment':
				emailComponent = TrialAbandonmentEmail(templateProps);
				subject = `${subjectPrefix}Complete your setup and start your free trial`;
				break;

			case 'trial_day2':
				emailComponent = TrialDay2Email(templateProps);
				subject = `${subjectPrefix}How's your trial going? Tips to get the most out of it 💡`;
				break;

			case 'trial_day5':
				emailComponent = TrialDay5Email(templateProps);
				subject = `${subjectPrefix}Your trial ends in 2 days - here's what you've accomplished! 🏆`;
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
				subject =
					subjectPrefix +
					`You're now live on the ${templateProps.planName || templateProps.plan || 'Gemz'} plan! 🎉`;
				break;

			case 'trial_expiry':
				emailComponent = TrialDay5Email(templateProps); // Reuse day5 template for now
				subject = `${subjectPrefix}Your trial expires tomorrow - Don't lose your progress! 🔔`;
				break;

			// Onboarding drip sequence (for users who sign up but don't start trial)
			case 'onboarding_1_welcome':
				emailComponent = OnboardingWelcomeEmail({
					fullName: templateProps.fullName,
					dashboardUrl: templateProps.dashboardUrl,
					unsubscribeUrl: templateProps.unsubscribeUrl,
				});
				subject = `${subjectPrefix}Welcome to Gemz — here's what you're unlocking`;
				break;

			case 'onboarding_2_keyword':
				emailComponent = OnboardingKeywordEmail({
					fullName: templateProps.fullName,
					dashboardUrl: templateProps.dashboardUrl,
					unsubscribeUrl: templateProps.unsubscribeUrl,
				});
				subject = `${subjectPrefix}How to find creators by what they actually talk about`;
				break;

			case 'onboarding_3_similar':
				emailComponent = OnboardingSimilarCreatorEmail({
					fullName: templateProps.fullName,
					dashboardUrl: templateProps.dashboardUrl,
					unsubscribeUrl: templateProps.unsubscribeUrl,
				});
				subject = `${subjectPrefix}Found one good creator? Here's how to find 50 more`;
				break;

			case 'onboarding_4_database':
				emailComponent = OnboardingNotDatabaseEmail({
					fullName: templateProps.fullName,
					dashboardUrl: templateProps.dashboardUrl,
					unsubscribeUrl: templateProps.unsubscribeUrl,
				});
				subject = `${subjectPrefix}Why influencer databases are lying to you`;
				break;

			case 'onboarding_5_cost':
				emailComponent = OnboardingCostComparisonEmail({
					fullName: templateProps.fullName,
					dashboardUrl: templateProps.dashboardUrl,
					unsubscribeUrl: templateProps.unsubscribeUrl,
				});
				subject = `${subjectPrefix}You don't need a $500/mo influencer tool`;
				break;

			case 'onboarding_6_final':
				emailComponent = OnboardingFinalPushEmail({
					fullName: templateProps.fullName,
					dashboardUrl: templateProps.dashboardUrl,
					unsubscribeUrl: templateProps.unsubscribeUrl,
				});
				subject = `${subjectPrefix}Last thing — then I'll stop emailing`;
				break;

			default:
				structuredConsole.error('❌ [SCHEDULED-EMAIL] Unknown email type:', emailType);
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
			jobLog.complete(jobId, undefined, {
				metadata: {
					emailId: result.id,
					action: 'email-sent',
				},
			});

			logger.info(
				'Scheduled email sent successfully',
				{
					jobId,
					userId,
					emailType,
					emailId: result.id,
					adminTest: source === 'admin-testing',
					recipient: userEmail.replace(/(.{2}).*@/, '$1***@'),
				},
				LogCategory.EMAIL
			);

			return NextResponse.json({
				success: true,
				emailId: result.id,
				emailType,
				subject,
				recipient: userEmail,
				sentAt: new Date().toISOString(),
				source: source || 'system',
			});
		} else {
			// Update email status as failed (skip for admin tests)
			if (source !== 'admin-testing') {
				await updateEmailScheduleStatus(userId, emailType, 'failed');
			}

			jobLog.email(jobId, 'fail', userEmail, emailType, false);
			jobLog.fail(jobId, new Error(result.error || 'Email sending failed'));

			logger.error(
				'Scheduled email sending failed',
				new Error(result.error || 'Email sending failed'),
				{
					jobId,
					emailType,
					recipient: userEmail.replace(/(.{2}).*@/, '$1***@'),
				},
				LogCategory.EMAIL
			);

			return NextResponse.json(
				{
					error: result.error,
					emailType,
					recipient: userEmail,
				},
				{ status: 500 }
			);
		}
	} catch (error: unknown) {
		logger.error(
			'Error processing scheduled email',
			error instanceof Error ? error : new Error(String(error)),
			{ operation: 'scheduled-email-processing' },
			LogCategory.EMAIL
		);

		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
