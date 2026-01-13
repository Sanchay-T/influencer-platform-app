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
import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
import { LogCategory, logger } from '@/lib/logging';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const receiver = new Receiver({
	currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
	nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

function shouldVerifySignature() {
	if (process.env.NODE_ENV === 'development') {
		return process.env.VERIFY_QSTASH_SIGNATURE === 'true';
	}
	if (process.env.SKIP_QSTASH_SIGNATURE === 'true') {
		return false;
	}
	return true;
}

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
	const signature = req.headers.get('Upstash-Signature');
	const messageId = req.headers.get('Upstash-Message-Id') || 'unknown';
	const retryCount = req.headers.get('Upstash-Retried') || '0';
	const originalUrl = req.headers.get('Upstash-Failed-Callback-Url') || 'unknown';

	// Verify signature in production
	if (shouldVerifySignature()) {
		if (!signature) {
			return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
		}
		const currentHost = req.headers.get('host') || process.env.VERCEL_URL || '';
		const protocol =
			currentHost.includes('localhost') || currentHost.startsWith('127.') ? 'http' : 'https';
		const baseUrl = currentHost ? `${protocol}://${currentHost}` : process.env.NEXT_PUBLIC_SITE_URL;
		const verificationUrl = `${baseUrl}/api/qstash/dead-letter`;

		try {
			const valid = await receiver.verify({ signature, body: rawBody, url: verificationUrl });
			if (!valid) {
				return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
			}
		} catch {
			// Continue anyway - we want to capture the failure
			logger.warn(
				'DLQ signature verification failed, proceeding anyway',
				undefined,
				LogCategory.QSTASH
			);
		}
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
