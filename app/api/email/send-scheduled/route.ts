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
import { verifyQstashRequestSignature } from '@/lib/queue/qstash-signature';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const onlyStrings = value.filter((item): item is string => typeof item === 'string');
	return onlyStrings.length === value.length ? onlyStrings : undefined;
}

export async function POST(request: Request) {
	try {
		const rawBody = await request.text();

		const verification = await verifyQstashRequestSignature({
			req: request,
			rawBody,
			pathname: '/api/email/send-scheduled',
		});
		if (!verification.ok) {
			logger.warn(
				'Scheduled email QStash signature rejected',
				{ error: verification.error, callbackUrl: verification.callbackUrl },
				LogCategory.EMAIL
			);
			return NextResponse.json({ error: verification.error }, { status: verification.status });
		}

		let messageData: unknown;
		try {
			messageData = JSON.parse(rawBody);
		} catch {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
		}

		// Start email job tracking (only after request is trusted)
			const jobId = jobLog.start({
				jobType: 'scheduled-email',
				metadata: { operation: 'send-scheduled-email' },
			});

			logger.info('Processing scheduled email request', { jobId }, LogCategory.EMAIL);

			if (!isRecord(messageData)) {
				return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
			}

			const userId = readString(messageData.userId);
			const emailType = readString(messageData.emailType);
			const userEmail = readString(messageData.userEmail);
			const scheduledAt = readString(messageData.scheduledAt);
			const source = readString(messageData.source) ?? 'system';
			const adminUserId = readString(messageData.adminUserId);
			const templatePropsRaw = messageData.templateProps;

			if (!userId || !emailType || !userEmail) {
				return NextResponse.json(
					{
						error: 'Invalid payload: userId, emailType, and userEmail are required',
					},
					{ status: 400 }
				);
			}

			if (!isRecord(templatePropsRaw)) {
				return NextResponse.json({ error: 'Invalid payload: templateProps is required' }, { status: 400 });
			}
			const templateProps = templatePropsRaw;
			const dashboardUrl = readString(templateProps.dashboardUrl);
			if (!dashboardUrl) {
				return NextResponse.json(
					{ error: 'Invalid payload: templateProps.dashboardUrl is required' },
					{ status: 400 }
				);
			}

			logger.info(
				'Processing scheduled email',
				{
					jobId,
					userId,
					emailType,
					userEmail: userEmail.replace(/(.{2}).*@/, '$1***@'), // Partially redact
					scheduledAt,
					source,
					adminTriggered: !!adminUserId,
				},
				LogCategory.EMAIL
			);

		// Check if email was cancelled before sending (skip for admin tests)
		if (source !== 'admin-testing') {
			const { getUserProfile } = await import('@/lib/db/queries/user-queries');
				const userProfile = await getUserProfile(userId);

			if (userProfile?.emailScheduleStatus) {
				const emailStatusRaw = userProfile.emailScheduleStatus;
				const perEmailStatus = isRecord(emailStatusRaw) ? emailStatusRaw[emailType] : null;
				const thisEmailStatus = isRecord(perEmailStatus) ? readString(perEmailStatus.status) : undefined;

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
					emailComponent = WelcomeEmail({
						username: readString(templateProps.username),
						fullName: readString(templateProps.fullName),
						businessName: readString(templateProps.businessName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}Welcome to Gemz! 🎉`;
					break;

				case 'abandonment':
					emailComponent = TrialAbandonmentEmail({
						username: readString(templateProps.username),
						fullName: readString(templateProps.fullName),
						businessName: readString(templateProps.businessName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}Complete your setup and start your free trial`;
					break;

				case 'trial_day2':
					emailComponent = TrialDay2Email({
						username: readString(templateProps.username),
						fullName: readString(templateProps.fullName),
						businessName: readString(templateProps.businessName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}How's your trial going? Tips to get the most out of it 💡`;
					break;

				case 'trial_day5':
					emailComponent = TrialDay5Email({
						username: readString(templateProps.username),
						fullName: readString(templateProps.fullName),
						businessName: readString(templateProps.businessName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}Your trial ends in 2 days - here's what you've accomplished! 🏆`;
					break;

				case 'subscription_welcome':
					{
						const planName =
							readString(templateProps.planName) ??
							readString(templateProps.plan) ??
							'Gemz';
						const planFeatures = readStringArray(templateProps.planFeatures);

					emailComponent = SubscriptionWelcomeEmail({
						fullName: readString(templateProps.fullName),
						businessName: readString(templateProps.businessName),
						planName,
						planFeatures,
						dashboardUrl,
						billingUrl: readString(templateProps.billingUrl),
					});
					subject =
						subjectPrefix +
						`You're now live on the ${planName} plan! 🎉`;
					break;
				}

				case 'trial_expiry':
					emailComponent = TrialDay5Email({
						username: readString(templateProps.username),
						fullName: readString(templateProps.fullName),
						businessName: readString(templateProps.businessName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					}); // Reuse day5 template for now
					subject = `${subjectPrefix}Your trial expires tomorrow - Don't lose your progress! 🔔`;
					break;

				// Onboarding drip sequence (for users who sign up but don't start trial)
				case 'onboarding_1_welcome':
					emailComponent = OnboardingWelcomeEmail({
						fullName: readString(templateProps.fullName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}Welcome to Gemz — here's what you're unlocking`;
					break;

				case 'onboarding_2_keyword':
					emailComponent = OnboardingKeywordEmail({
						fullName: readString(templateProps.fullName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}How to find creators by what they actually talk about`;
					break;

				case 'onboarding_3_similar':
					emailComponent = OnboardingSimilarCreatorEmail({
						fullName: readString(templateProps.fullName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}Found one good creator? Here's how to find 50 more`;
					break;

				case 'onboarding_4_database':
					emailComponent = OnboardingNotDatabaseEmail({
						fullName: readString(templateProps.fullName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}Why influencer databases are lying to you`;
					break;

				case 'onboarding_5_cost':
					emailComponent = OnboardingCostComparisonEmail({
						fullName: readString(templateProps.fullName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
					});
					subject = `${subjectPrefix}You don't need a $500/mo influencer tool`;
					break;

				case 'onboarding_6_final':
					emailComponent = OnboardingFinalPushEmail({
						fullName: readString(templateProps.fullName),
						dashboardUrl,
						unsubscribeUrl: readString(templateProps.unsubscribeUrl),
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
