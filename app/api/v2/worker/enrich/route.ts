/**
 * V2 Enrich Worker API Route
 *
 * POST /api/v2/worker/enrich
 * QStash webhook that enriches a batch of creators with full bios.
 *
 * This endpoint is called by QStash with a signed message.
 * It enriches creators, extracts emails, and updates job status.
 *
 * Request body (from QStash):
 * {
 *   jobId: string,
 *   platform: 'tiktok' | 'instagram' | 'youtube',
 *   creatorIds: string[],
 *   batchIndex: number,
 *   totalBatches: number,
 *   userId: string
 * }
 */

import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';
import { verifyQstashRequestSignature } from '@/lib/queue/qstash-signature';
import { processEnrich, validateEnrichWorkerMessage } from '@/lib/search-engine/v2/workers';

// Vercel Pro: 5 minute timeout for enrichment workers
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
		pathname: '/api/v2/worker/enrich',
	});
	if (!verification.ok) {
		if (verification.error === 'Signature verification failed') {
			logger.error(
				'[v2-enrich-worker-route] Signature verification error',
				new Error(verification.error),
				{ callbackUrl: verification.callbackUrl },
				LogCategory.JOB
			);
		} else {
			logger.warn(
				'[v2-enrich-worker-route] QStash signature rejected',
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

	const validation = validateEnrichWorkerMessage(body);
	if (!(validation.valid && validation.data)) {
		logger.warn(
			'[v2-enrich-worker-route] Invalid message',
			{ error: validation.error },
			LogCategory.JOB
		);
		return NextResponse.json({ error: validation.error || 'Invalid message' }, { status: 400 });
	}

	const message = validation.data;

	// ========================================================================
	// Step 3: Process Enrichment
	// ========================================================================

	logger.info(
		'[v2-enrich-worker-route] Processing enrichment batch',
		{
			jobId: message.jobId,
			platform: message.platform,
			creatorCount: message.creatorIds.length,
			batchIndex: message.batchIndex,
			totalBatches: message.totalBatches,
		},
		LogCategory.JOB
	);

	const result = await processEnrich({ message });

	const durationMs = Date.now() - startTime;

	// ========================================================================
	// Step 4: Return Response
	// ========================================================================

	if (result.error) {
		logger.warn(
			'[v2-enrich-worker-route] Enrichment completed with error',
			{
				jobId: message.jobId,
				batchIndex: message.batchIndex,
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
		'[v2-enrich-worker-route] Enrichment completed successfully',
		{
			jobId: message.jobId,
			batchIndex: message.batchIndex,
			creatorsEnriched: result.creatorsEnriched,
			emailsFound: result.emailsFound,
			durationMs,
		},
		LogCategory.JOB
	);

	return NextResponse.json({
		success: true,
		...result,
	});
}
