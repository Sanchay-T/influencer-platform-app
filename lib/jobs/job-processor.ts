import { Client } from '@upstash/qstash';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { backgroundJobs } from '@/lib/db/schema';
import {
	AGGREGATE_TYPES,
	EVENT_TYPES,
	EventService,
	SOURCE_SYSTEMS,
} from '@/lib/events/event-service';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { apiTracker } from '@/lib/sentry/feature-tracking';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

const qstash = new Client({
	token: process.env.QSTASH_TOKEN!,
});

const resolveQstashMessageId = (response: unknown): string | null => {
	if (Array.isArray(response)) {
		const first = response[0];
		const record = toRecord(first);
		return record ? getStringProperty(record, 'messageId') : null;
	}
	const record = toRecord(response);
	return record ? getStringProperty(record, 'messageId') : null;
};

export interface JobPayload {
	[key: string]: unknown;
}

export interface JobResult {
	success: boolean;
	data?: unknown;
	error?: string;
	retryable?: boolean;
}

/**
 * Background Job Processor - Industry Standard Implementation
 *
 * Features:
 * - Idempotent job processing
 * - Automatic retry logic
 * - Event sourcing integration
 * - QStash integration for Vercel
 * - Proper error handling and logging
 */
export class JobProcessor {
	/**
	 * Queue a background job via QStash
	 */
	static async queueJob({
		jobType,
		payload,
		delay = 0,
		maxRetries = 3,
		priority = 100,
	}: {
		jobType: string;
		payload: JobPayload;
		delay?: number;
		maxRetries?: number;
		priority?: number;
	}): Promise<string> {
		structuredConsole.log('📤 [JOB-PROCESSOR] Queueing job:', { jobType, delay, priority });

		// Set Sentry context for job queueing
		SentryLogger.setContext('job_queue', {
			jobType,
			delay,
			priority,
			maxRetries,
		});

		// Add breadcrumb for job queue start
		SentryLogger.addBreadcrumb({
			category: 'job',
			message: `Queueing background job: ${jobType}`,
			level: 'info',
			data: { jobType, delay, priority },
		});

		try {
			// Create job record in database first
			const job = await EventService.createBackgroundJob({
				jobType,
				payload,
				priority,
				maxRetries,
				scheduledFor: delay > 0 ? new Date(Date.now() + delay) : undefined,
			});
			if (!job.id) {
				throw new Error('Background job ID missing after creation');
			}
			const jobId = job.id;

			// Add breadcrumb for job created in database
			SentryLogger.addBreadcrumb({
				category: 'job',
				message: `Job record created in database`,
				level: 'info',
				data: { jobId, jobType },
			});

			const delaySeconds = delay > 0 ? Math.ceil(delay / 1000) : undefined;

			// Queue job via QStash - track external call
			const qstashResponse = await apiTracker.trackExternalCall(
				'qstash',
				'publish_job',
				async () => {
					return qstash.publishJSON({
						url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/jobs/process`,
						body: {
							jobId,
							jobType,
							payload,
							attempt: 1,
							maxRetries,
						},
						delay: delaySeconds,
						retries: maxRetries,
					});
				}
			);

			const qstashMessageId = resolveQstashMessageId(qstashResponse);

			if (qstashMessageId) {
				// Update job with QStash message ID
				await db
					.update(backgroundJobs)
					.set({ qstashMessageId })
					.where(eq(backgroundJobs.id, jobId));
			} else {
				structuredConsole.warn('⚠️ [JOB-PROCESSOR] Missing QStash message ID:', {
					jobId,
					jobType,
				});
			}

			// Add breadcrumb for successful job queue
			SentryLogger.addBreadcrumb({
				category: 'job',
				message: `Job queued successfully via QStash`,
				level: 'info',
				data: { jobId, jobType, qstashMessageId: qstashMessageId ?? 'unknown' },
			});

			structuredConsole.log('✅ [JOB-PROCESSOR] Job queued successfully:', {
				jobId,
				qstashMessageId: qstashMessageId ?? 'unknown',
				jobType,
			});

			return jobId;
		} catch (error) {
			structuredConsole.error('❌ [JOB-PROCESSOR] Error queueing job:', error);

			// Capture QStash publish failure in Sentry
			SentryLogger.captureException(error, {
				tags: { feature: 'job', operation: 'queue', jobType },
				extra: { jobType, delay, priority, maxRetries },
			});

			throw error;
		}
	}

	/**
	 * Process a background job (called by QStash webhook)
	 */
	static async processJob(jobId: string, attempt: number = 1): Promise<JobResult> {
		structuredConsole.log('🔄 [JOB-PROCESSOR] Processing job:', { jobId, attempt });

		// Set Sentry context for this background job
		SentryLogger.setContext('background_job', {
			jobId,
			attempt,
		});

		// Add breadcrumb for job processing start
		SentryLogger.addBreadcrumb({
			category: 'background_job',
			message: `Processing job ${jobId} (attempt ${attempt})`,
			level: 'info',
			data: { jobId, attempt },
		});

		try {
			// Get job from database
			const job = await db.query.backgroundJobs.findFirst({
				where: eq(backgroundJobs.id, jobId),
			});

			if (!job) {
				structuredConsole.error('❌ [JOB-PROCESSOR] Job not found:', jobId);
				return { success: false, error: 'Job not found', retryable: false };
			}

			// Check if job already completed (idempotency)
			if (job.status === 'completed') {
				structuredConsole.log('✅ [JOB-PROCESSOR] Job already completed (idempotent):', jobId);
				return { success: true, data: job.result };
			}

			// Mark job as processing
			await db
				.update(backgroundJobs)
				.set({
					status: 'processing',
					startedAt: new Date(),
					retryCount: attempt - 1,
				})
				.where(eq(backgroundJobs.id, jobId));

			// Process based on job type
			let result: JobResult;

			switch (job.jobType) {
				case 'complete_onboarding':
					result = await JobProcessor.processCompleteOnboarding(job.payload);
					break;

				case 'send_trial_email':
					result = await JobProcessor.processSendTrialEmail(job.payload);
					break;

				case 'expire_trial':
					result = await JobProcessor.processExpireTrial(job.payload);
					break;

				default:
					result = {
						success: false,
						error: `Unknown job type: ${job.jobType}`,
						retryable: false,
					};
			}

			// Update job status based on result
			if (result.success) {
				await db
					.update(backgroundJobs)
					.set({
						status: 'completed',
						completedAt: new Date(),
						result: result.data || {},
					})
					.where(eq(backgroundJobs.id, jobId));

				structuredConsole.log('✅ [JOB-PROCESSOR] Job completed successfully:', jobId);
			} else {
				await db
					.update(backgroundJobs)
					.set({
						status: 'failed',
						failedAt: new Date(),
						error: result.error,
					})
					.where(eq(backgroundJobs.id, jobId));

				structuredConsole.error('❌ [JOB-PROCESSOR] Job failed:', { jobId, error: result.error });
			}

			return result;
		} catch (error) {
			structuredConsole.error('❌ [JOB-PROCESSOR] Error processing job:', error);

			// Capture error in Sentry
			SentryLogger.captureException(error, {
				tags: {
					feature: 'background_job',
				},
				extra: {
					jobId,
					attempt,
				},
			});

			// Mark job as failed
			await db
				.update(backgroundJobs)
				.set({
					status: 'failed',
					failedAt: new Date(),
					error: error instanceof Error ? error.message : 'Unknown error',
				})
				.where(eq(backgroundJobs.id, jobId));

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				retryable: true,
			};
		}
	}

	/**
	 * Complete Onboarding Job Processor
	 * @why trialStatus is now derived from subscriptionStatus + trialEndDate, not stored
	 */
	private static async processCompleteOnboarding(payload: unknown): Promise<JobResult> {
		structuredConsole.log('🎯 [JOB-PROCESSOR] Processing complete onboarding:', payload);

		try {
			const payloadRecord = toRecord(payload);
			const userId = payloadRecord ? getStringProperty(payloadRecord, 'userId') : null;
			const stripeSubscriptionId = payloadRecord
				? getStringProperty(payloadRecord, 'stripeSubscriptionId')
				: null;
			const stripeCustomerId = payloadRecord
				? getStringProperty(payloadRecord, 'stripeCustomerId')
				: null;
			const planId = payloadRecord ? getStringProperty(payloadRecord, 'planId') : null;
			const resolvedPlanId = planId ?? 'growth';

			if (!userId) {
				return { success: false, error: 'Missing userId in payload', retryable: false };
			}

			// Get user profile
			const userProfile = await getUserProfile(userId);

			if (!userProfile) {
				return { success: false, error: 'User profile not found', retryable: false };
			}

			// Check if already completed (idempotency) - use subscriptionStatus instead of trialStatus
			if (
				userProfile.onboardingStep === 'completed' &&
				userProfile.subscriptionStatus === 'trialing'
			) {
				structuredConsole.log('✅ [JOB-PROCESSOR] Onboarding already completed (idempotent)');
				return { success: true, data: { message: 'Already completed' } };
			}

			// Calculate trial dates - preserve existing trial dates if they exist
			let trialStartDate: Date;
			let trialEndDate: Date;

			if (userProfile.trialStartDate && userProfile.trialEndDate) {
				// Preserve existing trial dates to avoid resetting progress
				trialStartDate = userProfile.trialStartDate;
				trialEndDate = userProfile.trialEndDate;
				structuredConsole.log('📅 [JOB-PROCESSOR] Preserving existing trial dates:', {
					trialStartDate: trialStartDate.toISOString(),
					trialEndDate: trialEndDate.toISOString(),
					daysRemaining: Math.ceil((trialEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
				});
			} else {
				// Create new trial dates if none exist
				trialStartDate = new Date();
				trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
				structuredConsole.log('📅 [JOB-PROCESSOR] Creating new trial dates:', {
					trialStartDate: trialStartDate.toISOString(),
					trialEndDate: trialEndDate.toISOString(),
				});
			}

			// Create event for audit trail
			const correlationId = EventService.generateCorrelationId();
			await EventService.createEvent({
				aggregateId: userId,
				aggregateType: AGGREGATE_TYPES.ONBOARDING,
				eventType: EVENT_TYPES.ONBOARDING_COMPLETED,
				eventData: {
					userId,
					stripeSubscriptionId: stripeSubscriptionId ?? undefined,
					stripeCustomerId: stripeCustomerId ?? undefined,
					planId: resolvedPlanId,
					trialStartDate: trialStartDate.toISOString(),
					trialEndDate: trialEndDate.toISOString(),
					processedBy: 'background_job',
				},
				sourceSystem: SOURCE_SYSTEMS.QSTASH_JOB,
				correlationId,
				idempotencyKey: EventService.generateIdempotencyKey('onboarding', userId, 'completed'),
			});

			// Update user profile atomically
			// @why trialStatus is now derived from subscriptionStatus + trialEndDate
			type UpdateUserProfileInput = Parameters<typeof updateUserProfile>[1];
			const updateData: UpdateUserProfileInput = {
				onboardingStep: 'completed',
				trialStartDate,
				trialEndDate,
				subscriptionStatus: 'trialing',
				billingSyncStatus: 'job_onboarding_completed',
			};

			if (stripeCustomerId) {
				updateData.stripeCustomerId = stripeCustomerId;
			}
			if (stripeSubscriptionId) {
				updateData.stripeSubscriptionId = stripeSubscriptionId;
			}
			if (resolvedPlanId) {
				updateData.currentPlan = resolvedPlanId;
			}

			await updateUserProfile(userId, updateData);

			structuredConsole.log('✅ [JOB-PROCESSOR] Onboarding completed successfully:', {
				userId,
				planId: resolvedPlanId,
				trialStartDate: trialStartDate.toISOString(),
				trialEndDate: trialEndDate.toISOString(),
			});

			return {
				success: true,
				data: {
					userId,
					onboardingStep: 'completed',
					subscriptionStatus: 'trialing',
					trialStartDate: trialStartDate.toISOString(),
					trialEndDate: trialEndDate.toISOString(),
				},
			};
		} catch (error) {
			structuredConsole.error('❌ [JOB-PROCESSOR] Error completing onboarding:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				retryable: true,
			};
		}
	}

	/**
	 * Send Trial Email Job Processor
	 */
	private static async processSendTrialEmail(payload: unknown): Promise<JobResult> {
		structuredConsole.log('📧 [JOB-PROCESSOR] Processing send trial email:', payload);

		// TODO: Implement email sending logic
		// This would integrate with your existing email service

		return { success: true, data: { emailSent: true } };
	}

	/**
	 * Expire Trial Job Processor
	 */
	private static async processExpireTrial(payload: unknown): Promise<JobResult> {
		structuredConsole.log('⏰ [JOB-PROCESSOR] Processing expire trial:', payload);

		// TODO: Implement trial expiration logic

		return { success: true, data: { trialExpired: true } };
	}

	/**
	 * Get job status
	 */
	static async getJobStatus(jobId: string) {
		return await db.query.backgroundJobs.findFirst({
			where: eq(backgroundJobs.id, jobId),
		});
	}

	/**
	 * Retry failed job
	 */
	static async retryJob(jobId: string): Promise<string> {
		const job = await db.query.backgroundJobs.findFirst({
			where: eq(backgroundJobs.id, jobId),
		});

		if (!job) {
			throw new Error('Job not found');
		}

		if (job.retryCount >= job.maxRetries) {
			throw new Error('Maximum retries exceeded');
		}

		// Queue new attempt
		return await JobProcessor.queueJob({
			jobType: job.jobType,
			payload: toRecord(job.payload) ?? { value: job.payload },
			maxRetries: job.maxRetries,
		});
	}
}
