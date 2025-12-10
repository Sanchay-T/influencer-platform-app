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

import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';
import { processSearch, validateSearchWorkerMessage } from '@/lib/search-engine/v2/workers';

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
	return `${baseUrl}/api/v2/worker/search`;
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
			logger.warn('[v2-search-worker-route] Missing QStash signature', {}, LogCategory.JOB);
			return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
		}

		const callbackUrl = getCallbackUrl(req);
		try {
			const valid = await receiver.verify({ signature, body: rawBody, url: callbackUrl });
			if (!valid) {
				logger.warn('[v2-search-worker-route] Invalid QStash signature', {}, LogCategory.JOB);
				return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
			}
		} catch (error) {
			logger.error(
				'[v2-search-worker-route] Signature verification error',
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
