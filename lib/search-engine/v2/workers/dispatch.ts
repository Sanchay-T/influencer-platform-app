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
import { validateCreatorSearch } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
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
			platform: platform as Platform,
			keyword,
			batchIndex: i,
			totalKeywords: keywords.length,
			userId,
			targetResults,
		};

		const workerTimeoutSeconds = Math.ceil(
			(PLATFORM_TIMEOUTS[platform as Platform] || 120_000) / 1000
		);

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

	const startTime = Date.now();

	// 🔍 DEBUG: Log environment check
	console.log('[GEMZ-DEBUG] 🚀 dispatch() called', {
		userId,
		platform,
		keywordCount: keywords.length,
		targetResults,
		campaignId,
		QSTASH_TOKEN_SET: !!process.env.QSTASH_TOKEN,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		V2_WORKER_URL: process.env.V2_WORKER_URL,
		NODE_ENV: process.env.NODE_ENV,
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
	// Step 1: Validate Campaign Ownership
	// ============================================================================

	const step1Start = Date.now();
	const campaign = await db.query.campaigns.findFirst({
		where: eq(campaigns.id, campaignId),
	});
	const step1Ms = Date.now() - step1Start;

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

	// ============================================================================
	// Step 2: Validate Billing / Plan Limits
	// ============================================================================

	const step2Start = Date.now();
	const validation = await validateCreatorSearch(userId, targetResults);
	const step2Ms = Date.now() - step2Start;

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
	// Step 3: Create Job in Database (fast path)
	// ============================================================================

	const step3Start = Date.now();
	const jobId = await createV2Job({
		userId,
		campaignId,
		platform,
		keywords,
		targetResults,
	});
	const step3Ms = Date.now() - step3Start;

	// ============================================================================
	// Step 4: Queue Dispatch Worker (fan-out happens async)
	// ============================================================================

	const baseUrl = getWorkerBaseUrl();
	const dispatchWorkerUrl = `${baseUrl}/api/v2/worker/dispatch`;

	// 🔍 DEBUG: Log worker URL
	console.log('[GEMZ-DEBUG] 📡 QStash publish target', {
		jobId,
		baseUrl,
		dispatchWorkerUrl,
		getWorkerBaseUrl_result: getWorkerBaseUrl(),
	});

	const step4Start = Date.now();
	try {
		const message: DispatchWorkerMessage = {
			jobId,
			platform: platform as Platform,
			keywords,
			targetResults,
			userId,
			enableExpansion,
		};

		console.log('[GEMZ-DEBUG] 📤 About to publish to QStash', {
			url: dispatchWorkerUrl,
			messageKeys: Object.keys(message),
			jobId,
		});

		const qstashResult = await qstash.publishJSON({
			url: dispatchWorkerUrl,
			body: message,
			retries: 3,
			timeout: 60,
			failureCallback: getDeadLetterQueueUrl(),
		});

		console.log('[GEMZ-DEBUG] ✅ QStash publish SUCCESS', {
			jobId,
			qstashMessageId: qstashResult?.messageId,
		});
	} catch (qstashError) {
		console.error('[GEMZ-DEBUG] ❌ QStash publish FAILED', {
			jobId,
			error: qstashError instanceof Error ? qstashError.message : String(qstashError),
			stack: qstashError instanceof Error ? qstashError.stack : undefined,
		});

		const tracker = loadJobTracker(jobId);
		await tracker.markError('Failed to queue dispatch worker');
		return {
			success: false,
			error: 'Failed to queue dispatch worker',
			statusCode: 500,
		};
	}
	const step4Ms = Date.now() - step4Start;

	const durationMs = Date.now() - startTime;

	// Detailed timing breakdown for diagnostics
	console.log(`[GEMZ-DISPATCH] ⏱️ Timing breakdown`, {
		step1_campaignQuery: step1Ms + 'ms',
		step2_billingValidation: step2Ms + 'ms',
		step3_createJob: step3Ms + 'ms',
		step4_qstashPublish: step4Ms + 'ms',
		total: durationMs + 'ms',
		jobId,
	});

	logger.info(
		`${LOG_PREFIX} Dispatch queued`,
		{
			jobId,
			durationMs,
			step1Ms,
			step2Ms,
			step3Ms,
			step4Ms,
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

/**
 * Dispatch worker - expands keywords and fans out search workers
 */
export async function processDispatchWorker(
	message: DispatchWorkerMessage
): Promise<DispatchWorkerResult> {
	const { jobId, platform, keywords, targetResults, userId, enableExpansion = true } = message;
	const startTime = Date.now();

	if (!process.env.QSTASH_TOKEN) {
		return { success: false, error: 'QSTASH_TOKEN is missing in production environment' };
	}

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
			const { keywords: expandedKeywords } = await expandKeywordsForTarget(keywords, targetResults);
			finalKeywords = expandedKeywords;

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

	const { successCount, failCount } = await fanoutSearchWorkers({
		jobId,
		platform: platform as Platform,
		keywords: finalKeywords,
		userId,
		targetResults,
	});

	await tracker.markSearching();

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
