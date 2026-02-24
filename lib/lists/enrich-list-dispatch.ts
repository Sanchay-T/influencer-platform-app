/**
 * USE2-77: List Enrichment Fan-Out Dispatch
 *
 * Splits large lists of creators into batches and dispatches each batch
 * as a separate QStash message for parallel processing.
 *
 * Pattern mirrors lib/search-engine/v2/workers/enrich-dispatch.ts.
 */

import { structuredConsole } from '@/lib/logging/console-proxy';
import { getQstashBaseUrl, qstash } from '@/lib/queue/qstash';

const ENRICH_ENDPOINT = '/api/qstash/auto-enrich-list-items';

/**
 * Batch size: number of creators per QStash message.
 * Each batch is processed with internal parallelism in the handler.
 */
const DEFAULT_BATCH_SIZE = parseInt(process.env.LIST_ENRICH_BATCH_SIZE || '5', 10);

export interface ListEnrichCreatorPayload {
	listItemId: string;
	creatorId: string;
	handle: string;
	platform: string;
	externalId: string;
}

export interface DispatchListEnrichmentParams {
	userId: string;
	listId: string;
	addedCreators: ListEnrichCreatorPayload[];
}

export interface DispatchListEnrichmentResult {
	batchesDispatched: number;
	failedBatches: number;
	totalCreators: number;
}

/**
 * Dispatch list enrichment in parallel batches via QStash.
 *
 * For small lists (<=BATCH_SIZE), sends a single message (same as before).
 * For larger lists, fans out into multiple parallel QStash messages.
 */
export async function dispatchListEnrichmentBatches(
	params: DispatchListEnrichmentParams
): Promise<DispatchListEnrichmentResult> {
	const { userId, listId, addedCreators } = params;

	if (addedCreators.length === 0) {
		return { batchesDispatched: 0, failedBatches: 0, totalCreators: 0 };
	}

	const batchSize = Math.max(1, DEFAULT_BATCH_SIZE);
	const url = `${getQstashBaseUrl()}${ENRICH_ENDPOINT}`;

	// Split into batches
	const batches: ListEnrichCreatorPayload[][] = [];
	for (let i = 0; i < addedCreators.length; i += batchSize) {
		batches.push(addedCreators.slice(i, i + batchSize));
	}

	structuredConsole.info('[LIST_ENRICH_DISPATCH] Dispatching enrichment batches', {
		listId,
		totalCreators: addedCreators.length,
		batchCount: batches.length,
		batchSize,
	});

	// Dispatch all batches in parallel via QStash
	const dispatchPromises = batches.map((batch, index) =>
		qstash.publishJSON({
			url,
			body: {
				userId,
				listId,
				addedCreators: batch,
				batchIndex: index,
				totalBatches: batches.length,
			},
			retries: 3,
			// Stagger batches slightly to avoid thundering herd on enrichment APIs
			delay: index > 0 ? (`${index * 2}s` as `${bigint}s`) : undefined,
		})
	);

	const results = await Promise.allSettled(dispatchPromises);

	const batchesDispatched = results.filter((r) => r.status === 'fulfilled').length;
	const failedBatches = results.filter((r) => r.status === 'rejected').length;

	if (failedBatches > 0) {
		structuredConsole.warn('[LIST_ENRICH_DISPATCH] Some batches failed to dispatch', {
			listId,
			batchesDispatched,
			failedBatches,
			totalCreators: addedCreators.length,
		});
	}

	return {
		batchesDispatched,
		failedBatches,
		totalCreators: addedCreators.length,
	};
}
