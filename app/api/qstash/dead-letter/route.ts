/**
 * QStash Dead Letter Queue Endpoint
 *
 * Receives messages that failed after all retries were exhausted.
 * Logs them for monitoring and potential manual retry.
 *
 * @context This endpoint captures failed search workers, enrichment jobs, etc.
 * that couldn't complete after 3 retries. Without this, failures are silent.
 */

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';
import { verifyQstashRequestSignature } from '@/lib/queue/qstash-signature';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface DeadLetterMessage {
	jobId?: string;
	keyword?: string;
	platform?: string;
	type?: string;
	error?: string;
	[key: string]: unknown;
}

export async function POST(req: Request) {
	const rawBody = await req.text();
	const messageId = req.headers.get('Upstash-Message-Id') || 'unknown';
	const retryCount = req.headers.get('Upstash-Retried') || '0';
	const originalUrl = req.headers.get('Upstash-Failed-Callback-Url') || 'unknown';

	const verification = await verifyQstashRequestSignature({
		req,
		rawBody,
		pathname: '/api/qstash/dead-letter',
	});
	if (!verification.ok) {
		logger.warn(
			'DLQ QStash signature rejected',
			{ error: verification.error, callbackUrl: verification.callbackUrl, messageId, originalUrl },
			LogCategory.QSTASH
		);
		return NextResponse.json({ error: verification.error }, { status: verification.status });
	}

	// Parse the failed message body
	let message: DeadLetterMessage = {};
	try {
		message = JSON.parse(rawBody);
	} catch {
		message = { rawBody };
	}

	// Log the failure
	const dlqEvent = {
		messageId,
		retryCount: Number.parseInt(retryCount, 10),
		originalUrl,
		jobId: message.jobId,
		keyword: message.keyword,
		platform: message.platform,
		type: message.type,
		timestamp: new Date().toISOString(),
	};

	logger.error(
		'Dead letter queue received failed message',
		undefined,
		{
			...dlqEvent,
			body: message,
		},
		LogCategory.QSTASH
	);

	// Report to Sentry for alerting
	Sentry.captureMessage('QStash message failed after all retries', {
		level: 'error',
		tags: {
			messageId,
			jobId: message.jobId || 'unknown',
			platform: message.platform || 'unknown',
			originalUrl,
		},
		extra: {
			retryCount,
			message,
		},
	});

	// Return 200 to acknowledge receipt (don't retry DLQ messages)
	return NextResponse.json({
		success: true,
		message: 'Dead letter message received and logged',
		messageId,
	});
}
