/**
 * V2 Dispatch Worker - Fan-Out Logic
 *
 * Orchestrates the search process:
 * 1. Validates billing (user can afford this search)
 * 2. Creates job in DB
 * 3. Expands keywords with AI (if needed)
 * 4. Fans out N QStash messages (one per keyword)
 * 5. Returns jobId immediately
 */

import { eq } from 'drizzle-orm';
import { validateCreatorSearch } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { qstash } from '@/lib/queue/qstash';
import { PLATFORM_TIMEOUTS } from '../core/config';
import { createV2Job, loadJobTracker } from '../core/job-tracker';
import { expandKeywordsForTarget } from '../core/keyword-expander';
import type { Platform } from '../core/types';
import type { DispatchRequest, DispatchResponse, SearchWorkerMessage } from './types';

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

/**
 * Main dispatch function - validates, creates job, fans out to workers
 */
export async function dispatch(options: DispatchOptions): Promise<DispatchResult> {
	const { userId, request } = options;
	const { platform, keywords, targetResults, campaignId, enableExpansion = true } = request;

	const startTime = Date.now();

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

	const campaign = await db.query.campaigns.findFirst({
		where: eq(campaigns.id, campaignId),
	});

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

	const validation = await validateCreatorSearch(userId, targetResults);

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
	// Step 3: Expand Keywords (if enabled)
	// ============================================================================

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
			// Log but continue with original keywords
			logger.warn(
				`${LOG_PREFIX} Keyword expansion failed, using original keywords`,
				{ error: error instanceof Error ? error.message : String(error) },
				LogCategory.JOB
			);
		}
	}

	// ============================================================================
	// Step 4: Create Job in Database
	// ============================================================================

	const jobId = await createV2Job({
		userId,
		campaignId,
		platform,
		keywords: finalKeywords,
		targetResults,
	});

	// Mark job as dispatching
	const tracker = loadJobTracker(jobId);
	await tracker.markDispatching(finalKeywords.length);

	// ============================================================================
	// Step 5: Fan-Out to Search Workers via QStash
	// ============================================================================

	const baseUrl = getWorkerBaseUrl();
	const searchWorkerUrl = `${baseUrl}/api/v2/worker/search`;

	logger.info(
		`${LOG_PREFIX} Dispatching ${finalKeywords.length} search workers`,
		{
			jobId,
			workerUrl: searchWorkerUrl,
		},
		LogCategory.JOB
	);

	const dispatchPromises: Promise<unknown>[] = [];

	for (let i = 0; i < finalKeywords.length; i++) {
		const keyword = finalKeywords[i];

		const message: SearchWorkerMessage = {
			jobId,
			platform: platform as Platform,
			keyword,
			batchIndex: i,
			totalKeywords: finalKeywords.length,
			userId,
			targetResults, // Include target for capping
		};

		// Publish to QStash with retry configuration
		// Use platform-specific timeout (QStash default is 30s, but Instagram can take 5min)
		const workerTimeoutSeconds = Math.ceil(
			(PLATFORM_TIMEOUTS[platform as Platform] || 120_000) / 1000
		);

		const publishPromise = qstash.publishJSON({
			url: searchWorkerUrl,
			body: message,
			retries: 3,
			// Add a small delay between messages to prevent thundering herd
			delay: Math.floor(i / 5) * 1, // 1 second delay every 5 messages
			// Set worker timeout based on platform (TikTok: 2min, YouTube: 2min, Instagram: 5min)
			timeout: workerTimeoutSeconds,
		});

		dispatchPromises.push(publishPromise);
	}

	// Wait for all QStash publishes to complete
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
					.slice(0, 3), // Only log first 3 errors
			},
			LogCategory.JOB
		);
	}

	// Mark job as searching (workers are now processing)
	await tracker.markSearching();

	const durationMs = Date.now() - startTime;

	logger.info(
		`${LOG_PREFIX} Dispatch complete`,
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
		data: {
			jobId,
			keywords: finalKeywords,
			workersDispatched: successCount,
			message: `Dispatched ${successCount} search workers for ${finalKeywords.length} keywords`,
		},
		statusCode: 200,
	};
}
