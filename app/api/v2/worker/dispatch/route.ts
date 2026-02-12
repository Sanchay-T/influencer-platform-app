/**
 * V2 Dispatch Worker API Route
 *
 * POST /api/v2/worker/dispatch
 * QStash webhook that expands keywords and fans out search workers.
 *
 * Request body (from QStash):
 * {
 *   jobId: string,
 *   platform: 'tiktok' | 'instagram' | 'youtube',
 *   keywords: string[],
 *   targetResults: number,
 *   userId: string,
 *   enableExpansion?: boolean
 * }
 */

import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';
import { verifyQstashRequestSignature } from '@/lib/queue/qstash-signature';
import {
	processDispatchWorker,
	validateDispatchWorkerMessage,
} from '@/lib/search-engine/v2/workers';

// Vercel Pro: 5 minute timeout for dispatch workers (keyword expansion + fanout)
export const maxDuration = 300;

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
	const startTime = Date.now();

	const rawBody = await req.text();

	const verification = await verifyQstashRequestSignature({
		req,
		rawBody,
		pathname: '/api/v2/worker/dispatch',
	});
	if (!verification.ok) {
		if (verification.error === 'Signature verification failed') {
			logger.error(
				'[v2-dispatch-worker-route] Signature verification error',
				new Error(verification.error),
				{ callbackUrl: verification.callbackUrl },
				LogCategory.JOB
			);
		} else {
			logger.warn(
				'[v2-dispatch-worker-route] QStash signature rejected',
				{ error: verification.error, callbackUrl: verification.callbackUrl },
				LogCategory.JOB
			);
		}
		return NextResponse.json({ error: verification.error }, { status: verification.status });
	}

	let body: unknown;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = validateDispatchWorkerMessage(body);
	if (!(validation.valid && validation.data)) {
		logger.warn(
			'[v2-dispatch-worker-route] Invalid message',
			{ error: validation.error },
			LogCategory.JOB
		);
		return NextResponse.json({ error: validation.error || 'Invalid message' }, { status: 400 });
	}

	const message = validation.data;

	logger.info(
		'[v2-dispatch-worker-route] Processing dispatch',
		{
			jobId: message.jobId,
			platform: message.platform,
			keywordCount: message.keywords.length,
			targetResults: message.targetResults,
		},
		LogCategory.JOB
	);

	const result = await processDispatchWorker(message);
	const durationMs = Date.now() - startTime;

	if (!result.success) {
		logger.warn(
			'[v2-dispatch-worker-route] Dispatch worker failed',
			{ jobId: message.jobId, error: result.error, durationMs },
			LogCategory.JOB
		);

		return NextResponse.json(result);
	}

	logger.info(
		'[v2-dispatch-worker-route] Dispatch worker completed',
		{
			jobId: message.jobId,
			keywordsDispatched: result.keywordsDispatched,
			failedDispatches: result.failedDispatches,
			durationMs,
		},
		LogCategory.JOB
	);

	return NextResponse.json(result);
}
