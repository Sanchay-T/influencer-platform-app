/**
 * V2 Search Worker API Route
 *
 * POST /api/v2/worker/search
 * QStash webhook that processes a single keyword search.
 *
 * This endpoint is called by QStash with a signed message.
 * It processes one keyword, saves results, and dispatches enrichment batches.
 *
 * Request body (from QStash):
 * {
 *   jobId: string,
 *   platform: 'tiktok' | 'instagram' | 'youtube',
 *   keyword: string,
 *   batchIndex: number,
 *   totalKeywords: number,
 *   userId: string
 * }
 */

import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';
import { verifyQstashRequestSignature } from '@/lib/queue/qstash-signature';
import { processSearch, validateSearchWorkerMessage } from '@/lib/search-engine/v2/workers';

// Vercel Pro: 5 minute timeout for search workers (API calls can be slow)
export const maxDuration = 300;

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
	const startTime = Date.now();

	// ========================================================================
	// Step 1: Read and Verify Request
	// ========================================================================

	const rawBody = await req.text();

	const verification = await verifyQstashRequestSignature({
		req,
		rawBody,
		pathname: '/api/v2/worker/search',
	});
	if (!verification.ok) {
		if (verification.error === 'Signature verification failed') {
			logger.error(
				'[v2-search-worker-route] Signature verification error',
				new Error(verification.error),
				{ callbackUrl: verification.callbackUrl },
				LogCategory.JOB
			);
		} else {
			logger.warn(
				'[v2-search-worker-route] QStash signature rejected',
				{ error: verification.error, callbackUrl: verification.callbackUrl },
				LogCategory.JOB
			);
		}
		return NextResponse.json({ error: verification.error }, { status: verification.status });
	}

	// ========================================================================
	// Step 2: Parse and Validate Message
	// ========================================================================

	let body: unknown;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = validateSearchWorkerMessage(body);
	if (!(validation.valid && validation.data)) {
		logger.warn(
			'[v2-search-worker-route] Invalid message',
			{ error: validation.error },
			LogCategory.JOB
		);
		return NextResponse.json({ error: validation.error || 'Invalid message' }, { status: 400 });
	}

	const message = validation.data;

	// ========================================================================
	// Step 3: Process Search
	// ========================================================================

	logger.info(
		'[v2-search-worker-route] Processing keyword',
		{
			jobId: message.jobId,
			platform: message.platform,
			keyword: message.keyword,
			batchIndex: message.batchIndex,
			totalKeywords: message.totalKeywords,
		},
		LogCategory.JOB
	);

	const result = await processSearch({ message });

	const durationMs = Date.now() - startTime;

	// ========================================================================
	// Step 4: Return Response
	// ========================================================================

	if (result.error) {
		logger.warn(
			'[v2-search-worker-route] Search completed with error',
			{
				jobId: message.jobId,
				keyword: message.keyword,
				error: result.error,
				durationMs,
			},
			LogCategory.JOB
		);

		// Return 200 even on error to prevent QStash retries for expected failures
		return NextResponse.json({
			success: false,
			error: result.error,
			...result,
		});
	}

	logger.info(
		'[v2-search-worker-route] Search completed successfully',
		{
			jobId: message.jobId,
			keyword: message.keyword,
			creatorsFound: result.creatorsFound,
			newCreators: result.newCreators,
			enrichmentBatches: result.enrichmentBatchesDispatched,
			durationMs,
		},
		LogCategory.JOB
	);

	return NextResponse.json({
		success: true,
		...result,
	});
}
