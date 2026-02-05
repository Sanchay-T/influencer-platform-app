/**
 * V2 Dispatch API Route
 *
 * POST /api/v2/dispatch
 * Creates a new search job and fans out to search workers via QStash.
 *
 * Request body:
 * {
 *   platform: 'tiktok' | 'instagram' | 'youtube',
 *   keywords: string[],
 *   targetResults: 100 | 500 | 1000,
 *   campaignId: string,
 *   enableExpansion?: boolean (default true)
 * }
 *
 * Response:
 * {
 *   jobId: string,
 *   keywords: string[],
 *   workersDispatched: number,
 *   message: string
 * }
 */

import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { LogCategory, logger } from '@/lib/logging';
import { dispatch, validateDispatchRequest } from '@/lib/search-engine/v2/workers';

export async function POST(req: Request) {
	const startTime = Date.now();
	const vercelId = req.headers.get('x-vercel-id') ?? req.headers.get('x-vercel-trace');

	try {
		// ========================================================================
		// Step 1: Authenticate User
		// ========================================================================

		const auth = await getAuthOrTest();
		if (!auth.userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = auth.userId;

		// ========================================================================
		// Step 2: Parse and Validate Request
		// ========================================================================

		let body: unknown;
		try {
			body = await req.json();
		} catch {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
		}

		const validation = validateDispatchRequest(body);
		if (!(validation.valid && validation.data)) {
			return NextResponse.json({ error: validation.error || 'Invalid request' }, { status: 400 });
		}

		// ========================================================================
		// Step 3: Dispatch to Workers
		// ========================================================================

		logger.info(
			'[v2-dispatch-route] Processing dispatch request',
			{
				userId,
				platform: validation.data.platform,
				keywordCount: validation.data.keywords.length,
				targetResults: validation.data.targetResults,
				campaignId: validation.data.campaignId,
				vercelId,
			},
			LogCategory.JOB
		);

		const result = await dispatch({
			userId,
			request: validation.data,
		});

		const durationMs = Date.now() - startTime;

		// ========================================================================
		// Step 4: Return Response
		// ========================================================================

		if (!result.success) {
			logger.warn(
				'[v2-dispatch-route] Dispatch failed',
				{
					userId,
					error: result.error,
					durationMs,
					vercelId,
				},
				LogCategory.JOB
			);

			return NextResponse.json({ error: result.error, vercelId }, { status: result.statusCode });
		}

		logger.info(
			'[v2-dispatch-route] Dispatch successful',
			{
				userId,
				jobId: result.data?.jobId,
				workersDispatched: result.data?.workersDispatched,
				durationMs,
				vercelId,
			},
			LogCategory.JOB
		);

		return NextResponse.json({ ...result.data, vercelId });
	} catch (error) {
		const durationMs = Date.now() - startTime;
		logger.error(
			'[v2-dispatch-route] Unhandled error while dispatching',
			error instanceof Error ? error : new Error(String(error)),
			{ durationMs, vercelId },
			LogCategory.JOB
		);
		return NextResponse.json(
			{
				error: 'DISPATCH_INTERNAL_ERROR',
				message: error instanceof Error ? error.message : String(error),
				vercelId,
			},
			{ status: 500 }
		);
	}
}
