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

import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';
import { processEnrich, validateEnrichWorkerMessage } from '@/lib/search-engine/v2/workers';

// Vercel Pro: 5 minute timeout for enrichment workers
export const maxDuration = 300;

// ============================================================================
// QStash Signature Verification
// ============================================================================

const receiver = new Receiver({
	currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
	nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

function shouldVerifySignature(): boolean {
	if (process.env.NODE_ENV === 'development') {
		return process.env.VERIFY_QSTASH_SIGNATURE === 'true';
	}
	if (process.env.SKIP_QSTASH_SIGNATURE === 'true') {
		return false;
	}
	return true;
}

function getCallbackUrl(req: Request): string {
	const currentHost = req.headers.get('host') || process.env.VERCEL_URL || '';
	const defaultBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
	const protocol =
		currentHost.includes('localhost') || currentHost.startsWith('127.') ? 'http' : 'https';
	const baseUrl = currentHost ? `${protocol}://${currentHost}` : defaultBase;
	return `${baseUrl}/api/v2/worker/enrich`;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
	const startTime = Date.now();

	// ========================================================================
	// Step 1: Read and Verify Request
	// ========================================================================

	const rawBody = await req.text();
	const signature = req.headers.get('Upstash-Signature');

	if (shouldVerifySignature()) {
		if (!signature) {
			logger.warn('[v2-enrich-worker-route] Missing QStash signature', {}, LogCategory.JOB);
			return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
		}

		const callbackUrl = getCallbackUrl(req);
		try {
			const valid = await receiver.verify({ signature, body: rawBody, url: callbackUrl });
			if (!valid) {
				logger.warn('[v2-enrich-worker-route] Invalid QStash signature', {}, LogCategory.JOB);
				return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
			}
		} catch (error) {
			logger.error(
				'[v2-enrich-worker-route] Signature verification error',
				error instanceof Error ? error : new Error(String(error)),
				{},
				LogCategory.JOB
			);
			return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
		}
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
