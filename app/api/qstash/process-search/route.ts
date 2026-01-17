// api/qstash/process-search — lightweight QStash entrypoint for the modular search runner

import { Receiver } from '@upstash/qstash';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapingJobs } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { qstash } from '@/lib/queue/qstash';
import { runSearchJob } from '@/lib/search-engine/runner';
import { toError } from '@/lib/utils/type-guards';
import { getWebhookUrl } from '@/lib/utils/url-utils';

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

export async function POST(req: Request) {
	const rawBody = await req.text();
	const signature = req.headers.get('Upstash-Signature');

	const currentHost = req.headers.get('host') || process.env.VERCEL_URL || '';
	const defaultBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
	const protocol =
		currentHost.includes('localhost') || currentHost.startsWith('127.') ? 'http' : 'https';
	const baseUrl = currentHost ? `${protocol}://${currentHost}` : defaultBase;
	const callbackUrl = `${baseUrl}/api/qstash/process-search`;

	if (shouldVerifySignature()) {
		if (!signature) {
			return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
		}
		const verificationUrl =
			callbackUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/api/qstash/process-search`;
		const valid = await receiver.verify({ signature, body: rawBody, url: verificationUrl });
		if (!valid) {
			return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
		}
	}

	let jobId: string;
	try {
		const parsed = JSON.parse(rawBody);
		jobId = parsed?.jobId;
	} catch (error: unknown) {
		const parsedError = toError(error);
		return NextResponse.json(
			{ error: `Invalid JSON body: ${parsedError.message}` },
			{ status: 400 }
		);
	}

	if (!jobId || typeof jobId !== 'string') {
		return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
	}

	// Set Sentry context for this job processing
	SentryLogger.setContext('qstash_process_search', {
		jobId,
		callbackUrl,
	});

	// Add breadcrumb for job processing
	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Processing search job via QStash: ${jobId}`,
		level: 'info',
		data: { jobId },
	});

	// --- FIX 1.2: Idempotency Check ---
	// Skip if job already completed/errored/timed out (prevents duplicate processing)
	const [existingJob] = await db
		.select({ id: scrapingJobs.id, status: scrapingJobs.status, timeoutAt: scrapingJobs.timeoutAt })
		.from(scrapingJobs)
		.where(eq(scrapingJobs.id, jobId))
		.limit(1);

	if (!existingJob) {
		logger.warn('Job not found for processing', { jobId }, LogCategory.JOB);
		return NextResponse.json({ error: 'Job not found' }, { status: 404 });
	}

	// Skip already-processed jobs (idempotency)
	if (
		existingJob.status === 'completed' ||
		existingJob.status === 'error' ||
		existingJob.status === 'timeout'
	) {
		logger.info(
			'Skipping already-processed job (idempotency check)',
			{
				jobId,
			},
			LogCategory.JOB
		);
		return NextResponse.json({
			skipped: true,
			reason: 'already_processed',
			status: existingJob.status,
		});
	}

	// @performance Skip jobs already being processed (prevents concurrent processing)
	// QStash may deliver duplicate messages - this ensures only one processes at a time
	if (existingJob.status === 'processing') {
		logger.info(
			'Skipping job already in processing status (concurrent delivery)',
			{
				jobId,
				currentStatus: existingJob.status,
			},
			LogCategory.JOB
		);
		return NextResponse.json({
			skipped: true,
			reason: 'already_processing',
			status: existingJob.status,
		});
	}

	// --- FIX 1.3: Timeout Enforcement ---
	// Check if job has exceeded its timeout before processing
	if (existingJob.timeoutAt && new Date(existingJob.timeoutAt) < new Date()) {
		logger.warn(
			'Job exceeded timeout, marking as timed out',
			{
				jobId,
			},
			LogCategory.JOB
		);

		// Mark job as timeout in database
		await db
			.update(scrapingJobs)
			.set({
				status: 'timeout',
				error: 'Job exceeded maximum allowed processing time',
				completedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, jobId));

		return NextResponse.json(
			{
				status: 'timeout',
				error: 'Job timed out',
				jobId,
			},
			{ status: 408 }
		);
	}

	try {
		// Add breadcrumb for search execution start
		SentryLogger.addBreadcrumb({
			category: 'search',
			message: `Starting search job execution`,
			level: 'info',
			data: { jobId },
		});

		const execution = await runSearchJob(jobId);
		const { result, service, config } = execution;
		const snapshot = service.snapshot();

		// Add breadcrumb for search execution result
		SentryLogger.addBreadcrumb({
			category: 'search',
			message: `Search job execution completed`,
			level: 'info',
			data: {
				jobId,
				status: result.status,
				hasMore: result.hasMore,
				processedResults: snapshot.processedResults,
				targetResults: snapshot.targetResults,
			},
		});

		// --- FIX 1.1: Status Override Bug ---
		// Only mark as completed if provider actually succeeded
		// Previously: `if (result.status === 'completed' || !result.hasMore)` would mark
		// errors as completed because `!result.hasMore` could be true for error status
		logger.info(
			'QStash handler determining final status',
			{
				jobId,
			},
			LogCategory.JOB
		);

		if (result.status === 'completed') {
			// Provider explicitly completed - mark as completed
			await service.complete('completed', {});
			logger.info('Job marked as completed (provider succeeded)', { jobId }, LogCategory.JOB);
		} else if (result.status === 'error') {
			// Provider returned error - preserve the error status (don't override!)
			// Note: service.complete('error') should have been called by provider,
			// but we call it here as a safety net in case it wasn't
			await service.complete('error', {
				error: 'Provider returned error status',
			});
			logger.warn('Job marked as error (provider failed)', { jobId }, LogCategory.JOB);

			// Add breadcrumb for error status
			SentryLogger.addBreadcrumb({
				category: 'search',
				message: `Job marked as error`,
				level: 'warning',
				data: { jobId },
			});
		} else if (!result.hasMore) {
			// Provider finished but with partial status (no more results to fetch)
			// This happens when target wasn't reached but there's nothing more to fetch
			await service.complete('completed', {});
			logger.info(
				'Job marked as completed (partial - no more results available)',
				{ jobId },
				LogCategory.JOB
			);
		}
		// If hasMore=true and status is not error/completed, job continues (no completion call)

		const needsContinuation =
			result.status !== 'error' &&
			result.hasMore &&
			(snapshot.processedResults ?? 0) < (snapshot.targetResults ?? 0);

		if (needsContinuation) {
			const callbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;
			// Convert ms to seconds for QStash delay format
			const delaySeconds = Math.ceil(config.continuationDelayMs / 1000);
			await qstash.publishJSON({
				url: callbackUrl,
				body: { jobId },
				delay: `${BigInt(delaySeconds)}s`,
				retries: 3,
				notifyOnFailure: true,
			});

			// Add breadcrumb for continuation scheduled
			SentryLogger.addBreadcrumb({
				category: 'search',
				message: `Search continuation scheduled`,
				level: 'info',
				data: { jobId, delaySeconds },
			});
		}

		logger.info('Search runner completed', { jobId }, LogCategory.JOB);

		return NextResponse.json({
			status: result.status,
			job: snapshot,
			metrics: result.metrics,
			continuationScheduled: needsContinuation,
		});
	} catch (error: unknown) {
		const runnerError = toError(error);
		logger.error('Search runner failed', runnerError, { jobId }, LogCategory.JOB);

		// Capture error in Sentry
		SentryLogger.captureException(runnerError, {
			tags: {
				feature: 'search',
				service: 'qstash',
				stage: 'process_search',
			},
			extra: {
				jobId,
			},
		});

		// Attempt to mark job as failed to prevent stuck "processing" status
		try {
			const { SearchJobService } = await import('@/lib/search-engine/job-service');
			const service = await SearchJobService.load(jobId);
			if (service) {
				await service.complete('error', { error: runnerError.message });
				logger.info('Job marked as error after failure', { jobId }, LogCategory.JOB);
			}
		} catch (completionError) {
			logger.error(
				'Failed to mark job as error',
				completionError instanceof Error ? completionError : new Error(String(completionError)),
				{ jobId },
				LogCategory.JOB
			);
		}

		return NextResponse.json(
			{
				error: runnerError.message,
				jobId,
				marked: 'error',
			},
			{ status: 500 }
		);
	}
}
