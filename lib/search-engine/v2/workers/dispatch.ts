/**
 * V2 Dispatch Worker - Fan-Out Logic
 *
 * Orchestrates the search process:
 * 1. Validates billing (user can afford this search)
 * 2. Creates job in DB
 * 3. Queues a dispatch worker to expand keywords + fan out search workers
 * 4. Returns jobId immediately
 */

import { eq } from 'drizzle-orm';
import { trackServer } from '@/lib/analytics/track';
import { getUserDataForTracking } from '@/lib/analytics/track-server-utils';
import { validateCreatorSearch, validateTrialSearchLimit } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { getDeadLetterQueueUrl, qstash } from '@/lib/queue/qstash';
import { PLATFORM_TIMEOUTS } from '../core/config';
import { createV2Job, loadJobTracker } from '../core/job-tracker';
import { expandKeywordsForTarget } from '../core/keyword-expander';
import type { Platform } from '../core/types';
import type {
	DispatchRequest,
	DispatchResponse,
	DispatchWorkerMessage,
	SearchWorkerMessage,
} from './types';

// Re-export enrichment dispatch for backward compatibility
export { dispatchEnrichmentBatches } from './enrich-dispatch';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[v2-dispatch]';

/**
 * Get the base URL for worker endpoints
 * In production, this is the actual domain
 * In dev, we use ngrok
 */
function getWorkerBaseUrl(): string {
	// Check for explicit worker URL
	if (process.env.V2_WORKER_URL) {
		return process.env.V2_WORKER_URL;
	}

	// Use ngrok in development
	if (process.env.NODE_ENV === 'development' || process.env.NGROK_DOMAIN) {
		const ngrokDomain = process.env.NGROK_DOMAIN || 'usegemz.ngrok.app';
		return `https://${ngrokDomain}`;
	}

	// Production URL
	return process.env.NEXT_PUBLIC_APP_URL || 'https://usegems.io';
}

async function updateJobKeywords(jobId: string, keywords: string[]): Promise<void> {
	await db
		.update(scrapingJobs)
		.set({
			keywords,
			usedKeywords: keywords,
			updatedAt: new Date(),
		})
		.where(eq(scrapingJobs.id, jobId));
}

async function fanoutSearchWorkers(options: {
	jobId: string;
	platform: Platform;
	keywords: string[];
	userId: string;
	targetResults: number;
}): Promise<{ successCount: number; failCount: number }> {
	const { jobId, platform, keywords, userId, targetResults } = options;
	const baseUrl = getWorkerBaseUrl();
	const searchWorkerUrl = `${baseUrl}/api/v2/worker/search`;

	logger.info(
		`${LOG_PREFIX} Dispatching ${keywords.length} search workers`,
		{
			jobId,
			workerUrl: searchWorkerUrl,
		},
		LogCategory.JOB
	);

	const dispatchPromises: Promise<unknown>[] = [];

	for (let i = 0; i < keywords.length; i++) {
		const keyword = keywords[i];

		const message: SearchWorkerMessage = {
			jobId,
			platform,
			keyword,
			batchIndex: i,
			totalKeywords: keywords.length,
			userId,
			targetResults,
		};

		const workerTimeoutSeconds = Math.ceil((PLATFORM_TIMEOUTS[platform] || 120_000) / 1000);

		const publishPromise = qstash.publishJSON({
			url: searchWorkerUrl,
			body: message,
			retries: 3,
			delay: Math.floor(i / 5) * 1,
			timeout: workerTimeoutSeconds,
			failureCallback: getDeadLetterQueueUrl(),
		});

		dispatchPromises.push(publishPromise);
	}

	const results = await Promise.allSettled(dispatchPromises);
	const successCount = results.filter((r) => r.status === 'fulfilled').length;
	const failCount = results.filter((r) => r.status === 'rejected').length;

	if (failCount > 0) {
		logger.warn(
			`${LOG_PREFIX} Some QStash publishes failed`,
			{
				jobId,
				successCount,
				failCount,
				errors: results
					.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
					.map((r) => String(r.reason))
					.slice(0, 3),
			},
			LogCategory.JOB
		);
	}

	return { successCount, failCount };
}

// ============================================================================
// Dispatch Function
// ============================================================================

export interface DispatchOptions {
	/** User ID making the request */
	userId: string;

	/** Validated dispatch request */
	request: DispatchRequest;
}

export interface DispatchResult {
	success: boolean;
	data?: DispatchResponse;
	error?: string;
	statusCode: number;
}

export interface DispatchWorkerResult {
	success: boolean;
	error?: string;
	keywordsDispatched?: number;
	failedDispatches?: number;
}

/**
 * Main dispatch function - validates, creates job, fans out to workers
 */
export async function dispatch(options: DispatchOptions): Promise<DispatchResult> {
	const { userId, request } = options;
	const { platform, keywords, targetResults, campaignId, enableExpansion = true } = request;

	// Set Sentry context for this dispatch
	SentryLogger.setContext('search_dispatch', {
		userId,
		platform,
		keywordCount: keywords.length,
		targetResults,
		campaignId,
	});

	// Add breadcrumb for dispatch start
	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Starting search dispatch for ${keywords.length} keywords`,
		level: 'info',
		data: { platform, targetResults, campaignId },
	});

	// If QStash is not configured, we can't fan-out workers (search + enrichment).
	// In that case, fail fast with a JSON error so the client doesn't crash on response.json().
	if (!process.env.QSTASH_TOKEN) {
		logger.error(
			`${LOG_PREFIX} Missing QSTASH_TOKEN in environment`,
			new Error('QSTASH_TOKEN not configured'),
			{ platform, targetResults, campaignId },
			LogCategory.JOB
		);

		return {
			success: false,
			error: 'QSTASH_TOKEN is missing in production environment',
			statusCode: 500,
		};
	}

	// Wrap entire dispatch in a Sentry span for automatic duration tracking
	return SentryLogger.startSpanAsync(
		{
			name: 'search.dispatch',
			op: 'function',
			attributes: {
				userId,
				platform,
				keywordCount: keywords.length,
				targetResults,
				campaignId,
			},
		},
		async () => {
			const startTime = Date.now();

			logger.info(
				`${LOG_PREFIX} Starting dispatch`,
				{
					userId,
					platform,
					keywordCount: keywords.length,
					targetResults,
					campaignId,
					enableExpansion,
				},
				LogCategory.JOB
			);

			// ============================================================================
			// Step 1: Validate Campaign Ownership (with Sentry span)
			// ============================================================================

			const campaign = await SentryLogger.startSpanAsync(
				{ name: 'dispatch.validate_campaign', op: 'db' },
				async () => {
					return db.query.campaigns.findFirst({
						where: eq(campaigns.id, campaignId),
					});
				}
			);

			if (!campaign) {
				return {
					success: false,
					error: 'Campaign not found',
					statusCode: 404,
				};
			}

			if (campaign.userId !== userId) {
				return {
					success: false,
					error: 'Campaign does not belong to this user',
					statusCode: 403,
				};
			}

			// Add breadcrumb for state transition
			SentryLogger.addBreadcrumb({
				category: 'dispatch',
				message: 'Campaign validation passed',
				level: 'info',
				data: { campaignId },
			});

			// ============================================================================
			// Step 2: Validate Billing / Plan Limits (with Sentry span)
			// ============================================================================

			const validation = await SentryLogger.startSpanAsync(
				{ name: 'dispatch.validate_billing', op: 'function' },
				async () => validateCreatorSearch(userId, targetResults)
			);

			if (!validation.allowed) {
				logger.warn(
					`${LOG_PREFIX} Search blocked by plan limits`,
					{
						userId,
						targetResults,
						reason: validation.reason,
					},
					LogCategory.BILLING
				);

				return {
					success: false,
					error: validation.reason || 'Search limit exceeded',
					statusCode: 403,
				};
			}

			// ============================================================================
			// Step 2.5: Validate Trial Search Limit
			// ============================================================================

			const trialValidation = await validateTrialSearchLimit(userId);
			if (!trialValidation.allowed) {
				logger.warn(
					`${LOG_PREFIX} Search blocked by trial limit`,
					{
						userId,
						reason: trialValidation.reason,
						trialSearchesUsed: trialValidation.trialSearchesUsed,
					},
					LogCategory.BILLING
				);

				return {
					success: false,
					error: trialValidation.reason || 'Trial search limit exceeded',
					statusCode: 403,
				};
			}

			// Add breadcrumb for state transition
			SentryLogger.addBreadcrumb({
				category: 'dispatch',
				message: 'Billing validation passed',
				level: 'info',
				data: { userId },
			});

			// ============================================================================
			// Step 3: Create Job in Database (with Sentry span)
			// ============================================================================

			const jobId = await SentryLogger.startSpanAsync(
				{ name: 'dispatch.create_job', op: 'db' },
				async () =>
					createV2Job({
						userId,
						campaignId,
						platform,
						keywords,
						targetResults,
					})
			);

			// Add breadcrumb for state transition
			SentryLogger.addBreadcrumb({
				category: 'dispatch',
				message: `Job created: ${jobId}`,
				level: 'info',
				data: { jobId, platform },
			});

			// ============================================================================
			// Step 3.5: Track search_started in LogSnag (fire and forget)
			// ============================================================================

			const normalizedPlatform = platform.toLowerCase().includes('instagram')
				? 'instagram'
				: platform.toLowerCase().includes('youtube')
					? 'youtube'
					: 'tiktok';

			// Get user data for tracking (don't block on this)
			// @why Uses getUserDataForTracking to get fresh data from Clerk if DB has fallback email
			getUserDataForTracking(userId)
				.then((userData) => {
					return trackServer('search_started', {
						userId,
						platform: normalizedPlatform as 'tiktok' | 'instagram' | 'youtube',
						type: 'keyword',
						targetCount: targetResults,
						email: userData.email,
						name: userData.name,
					});
				})
				.catch((err) => {
					logger.warn(
						`${LOG_PREFIX} Failed to track search_started`,
						{ error: String(err) },
						LogCategory.JOB
					);
				});

			// ============================================================================
			// Step 4: Queue Dispatch Worker (with Sentry span)
			// ============================================================================

			const baseUrl = getWorkerBaseUrl();
			const dispatchWorkerUrl = `${baseUrl}/api/v2/worker/dispatch`;

			try {
				const message: DispatchWorkerMessage = {
					jobId,
					platform,
					keywords,
					targetResults,
					userId,
					enableExpansion,
				};

				await SentryLogger.startSpanAsync(
					{ name: 'dispatch.queue_worker', op: 'queue' },
					async () =>
						qstash.publishJSON({
							url: dispatchWorkerUrl,
							body: message,
							retries: 3,
							timeout: 60,
							failureCallback: getDeadLetterQueueUrl(),
						})
				);

				// Add breadcrumb for state transition
				SentryLogger.addBreadcrumb({
					category: 'dispatch',
					message: 'Dispatch worker queued',
					level: 'info',
					data: { jobId },
				});
			} catch (qstashError) {
				// Capture QStash error in Sentry
				SentryLogger.captureException(qstashError, {
					tags: {
						feature: 'search',
						service: 'qstash',
						stage: 'dispatch',
					},
					extra: {
						jobId,
						platform,
						keywordCount: keywords.length,
						targetResults,
					},
				});

				const tracker = loadJobTracker(jobId);
				await tracker.markError('Failed to queue dispatch worker');
				return {
					success: false,
					error: 'Failed to queue dispatch worker',
					statusCode: 500,
				};
			}

			const durationMs = Date.now() - startTime;

			logger.info(
				`${LOG_PREFIX} Dispatch queued`,
				{
					jobId,
					durationMs,
				},
				LogCategory.JOB
			);

			return {
				success: true,
				data: {
					jobId,
					keywords,
					workersDispatched: 0,
					message: 'Queued dispatch worker',
				},
				statusCode: 200,
			};
		}
	);
}

/**
 * Dispatch worker - expands keywords and fans out search workers
 */
export async function processDispatchWorker(
	message: DispatchWorkerMessage
): Promise<DispatchWorkerResult> {
	const { jobId, platform, keywords, targetResults, userId, enableExpansion = true } = message;

	// Set Sentry context for dispatch worker
	SentryLogger.setContext('dispatch_worker', {
		jobId,
		platform,
		keywordCount: keywords.length,
		targetResults,
		userId,
		enableExpansion,
	});

	// Add breadcrumb for dispatch worker start
	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Dispatch worker starting for job ${jobId}`,
		level: 'info',
		data: { platform, keywordCount: keywords.length },
	});

	if (!process.env.QSTASH_TOKEN) {
		SentryLogger.captureMessage('QSTASH_TOKEN missing in dispatch worker', 'error', {
			tags: { feature: 'search', service: 'qstash' },
			extra: { jobId },
		});
		return { success: false, error: 'QSTASH_TOKEN is missing in production environment' };
	}

	// Wrap entire dispatch worker in a Sentry span for automatic duration tracking
	return SentryLogger.startSpanAsync(
		{
			name: 'dispatch.worker',
			op: 'worker',
			attributes: {
				jobId,
				platform,
				keywordCount: keywords.length,
				targetResults,
			},
		},
		async () => {
			const startTime = Date.now();

			const job = await db.query.scrapingJobs.findFirst({
				where: eq(scrapingJobs.id, jobId),
				columns: {
					id: true,
					userId: true,
				},
			});

			if (!job) {
				return { success: false, error: 'Job not found' };
			}

			if (job.userId !== userId) {
				return { success: false, error: 'Job does not belong to this user' };
			}

			let finalKeywords = keywords;

			if (enableExpansion) {
				try {
					const { keywords: expandedKeywords } = await SentryLogger.startSpanAsync(
						{ name: 'dispatch.expand_keywords', op: 'function' },
						async () => expandKeywordsForTarget(keywords, targetResults)
					);
					finalKeywords = expandedKeywords;

					// Add breadcrumb for state transition
					SentryLogger.addBreadcrumb({
						category: 'dispatch',
						message: `Keywords expanded: ${keywords.length} → ${finalKeywords.length}`,
						level: 'info',
						data: { jobId, original: keywords.length, expanded: finalKeywords.length },
					});

					logger.info(
						`${LOG_PREFIX} Keywords expanded`,
						{
							original: keywords.length,
							expanded: finalKeywords.length,
						},
						LogCategory.JOB
					);
				} catch (error) {
					logger.warn(
						`${LOG_PREFIX} Keyword expansion failed, using original keywords`,
						{ error: error instanceof Error ? error.message : String(error) },
						LogCategory.JOB
					);
				}
			}

			await updateJobKeywords(jobId, finalKeywords);

			const tracker = loadJobTracker(jobId);
			await tracker.markDispatching(finalKeywords.length);

			// Add breadcrumb for state transition
			SentryLogger.addBreadcrumb({
				category: 'dispatch',
				message: `Job marked as dispatching with ${finalKeywords.length} keywords`,
				level: 'info',
				data: { jobId },
			});

			const { successCount, failCount } = await SentryLogger.startSpanAsync(
				{ name: 'dispatch.fanout_workers', op: 'queue' },
				async () =>
					fanoutSearchWorkers({
						jobId,
						platform,
						keywords: finalKeywords,
						userId,
						targetResults,
					})
			);

			await tracker.markSearching();

			// Add breadcrumb for state transition
			SentryLogger.addBreadcrumb({
				category: 'dispatch',
				message: `Job marked as searching, ${successCount} workers dispatched`,
				level: 'info',
				data: { jobId, successCount, failCount },
			});

			const durationMs = Date.now() - startTime;
			logger.info(
				`${LOG_PREFIX} Dispatch worker complete`,
				{
					jobId,
					keywordsDispatched: successCount,
					failedDispatches: failCount,
					durationMs,
				},
				LogCategory.JOB
			);

			return {
				success: true,
				keywordsDispatched: successCount,
				failedDispatches: failCount,
			};
		}
	);
}
