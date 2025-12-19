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

import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';
import {
	processDispatchWorker,
	validateDispatchWorkerMessage,
} from '@/lib/search-engine/v2/workers';

// ============================================================================
// QStash Signature Verification
// ============================================================================

const receiver = new Receiver({
	// biome-ignore lint/style/noNonNullAssertion: QStash keys are required in deployed environments.
	currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
	// biome-ignore lint/style/noNonNullAssertion: QStash keys are required in deployed environments.
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
	return `${baseUrl}/api/v2/worker/dispatch`;
}

// ============================================================================
// Route Handler
// ============================================================================

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST(req: Request) {
	const startTime = Date.now();

	const rawBody = await req.text();
	const signature = req.headers.get('Upstash-Signature');

	if (shouldVerifySignature()) {
		if (!signature) {
			logger.warn('[v2-dispatch-worker-route] Missing QStash signature', {}, LogCategory.JOB);
			return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
		}

		const callbackUrl = getCallbackUrl(req);
		try {
			const valid = await receiver.verify({ signature, body: rawBody, url: callbackUrl });
			if (!valid) {
				logger.warn('[v2-dispatch-worker-route] Invalid QStash signature', {}, LogCategory.JOB);
				return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
			}
		} catch (error) {
			logger.error(
				'[v2-dispatch-worker-route] Signature verification error',
				error instanceof Error ? error : new Error(String(error)),
				{},
				LogCategory.JOB
			);
			return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
		}
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

		return NextResponse.json({ success: false, error: result.error, ...result });
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

	return NextResponse.json({ success: true, ...result });
}
