/**
 * Enrich Dispatch - Fan-out Enrichment Batches
 *
 * Handles dispatching enrichment workers via QStash after
 * search workers find new creators.
 */

import { LogCategory, logger } from '@/lib/logging';
import { getDeadLetterQueueUrl, qstash } from '@/lib/queue/qstash';
import type { Platform } from '../core/types';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[v2-enrich-dispatch]';
const BATCH_SIZE = 10;

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
// Main Function
// ============================================================================

export interface DispatchEnrichmentParams {
	jobId: string;
	platform: Platform;
	creatorIds: string[];
	userId: string;
}

export interface DispatchEnrichmentResult {
	batchesDispatched: number;
	failedBatches: number;
}

/**
 * Dispatch enrichment batches for creators found by a search worker
 * Called by search-worker.ts after saving creators
 */
export async function dispatchEnrichmentBatches(
	params: DispatchEnrichmentParams
): Promise<DispatchEnrichmentResult> {
	const { jobId, platform, creatorIds, userId } = params;

	if (creatorIds.length === 0) {
		return { batchesDispatched: 0, failedBatches: 0 };
	}

	const baseUrl = getWorkerBaseUrl();
	const enrichWorkerUrl = `${baseUrl}/api/v2/worker/enrich`;

	// Split creators into batches
	const batches: string[][] = [];
	for (let i = 0; i < creatorIds.length; i += BATCH_SIZE) {
		batches.push(creatorIds.slice(i, i + BATCH_SIZE));
	}

	logger.info(
		`${LOG_PREFIX} Dispatching ${batches.length} enrichment batches`,
		{
			jobId,
			platform,
			totalCreators: creatorIds.length,
			batchCount: batches.length,
		},
		LogCategory.JOB
	);

	const dispatchPromises = batches.map((batch, index) =>
		qstash.publishJSON({
			url: enrichWorkerUrl,
			body: {
				jobId,
				platform,
				creatorIds: batch,
				batchIndex: index,
				totalBatches: batches.length,
				userId,
			},
			retries: 3,
			failureCallback: getDeadLetterQueueUrl(),
		})
	);

	const results = await Promise.allSettled(dispatchPromises);

	const batchesDispatched = results.filter((r) => r.status === 'fulfilled').length;
	const failedBatches = results.filter((r) => r.status === 'rejected').length;

	if (failedBatches > 0) {
		logger.warn(
			`${LOG_PREFIX} Some enrichment batches failed to dispatch`,
			{
				jobId,
				batchesDispatched,
				failedBatches,
			},
			LogCategory.JOB
		);
	}

	return { batchesDispatched, failedBatches };
}
