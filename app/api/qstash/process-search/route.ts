// api/qstash/process-search — lightweight QStash entrypoint for the modular search runner
import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { qstash } from '@/lib/queue/qstash';
import { logger, LogCategory } from '@/lib/logging';
import { runSearchJob } from '@/lib/search-engine/runner';
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
  const protocol = currentHost.includes('localhost') || currentHost.startsWith('127.') ? 'http' : 'https';
  const baseUrl = currentHost ? `${protocol}://${currentHost}` : defaultBase;
  const callbackUrl = `${baseUrl}/api/qstash/process-search`;

  if (shouldVerifySignature()) {
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    const verificationUrl = callbackUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/api/qstash/process-search`;
    const valid = await receiver.verify({ signature, body: rawBody, url: verificationUrl });
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let jobId: string;
  try {
    const parsed = JSON.parse(rawBody);
    jobId = parsed?.jobId;
  } catch (error: any) {
    return NextResponse.json({ error: `Invalid JSON body: ${error?.message ?? 'Unknown error'}` }, { status: 400 });
  }

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  try {
    const execution = await runSearchJob(jobId);
    const { result, service, config } = execution;
    const snapshot = service.snapshot();

    // 🔍 DIAGNOSTIC: Log before potentially overriding status
    logger.info('[DIAGNOSTIC] QStash handler checking completion', {
      jobId,
      resultStatus: result.status,
      hasMore: result.hasMore,
      willOverrideToCompleted: (result.status === 'completed' || !result.hasMore),
      currentDbStatus: snapshot.status,
    }, LogCategory.JOB);

    if (result.status === 'completed' || !result.hasMore) {
      logger.warn('[DIAGNOSTIC] QStash handler calling complete("completed") - may override error!', {
        jobId,
        resultStatus: result.status,
        hasMore: result.hasMore,
      }, LogCategory.JOB);
      await service.complete('completed', {});
    }

    const needsContinuation =
      result.status !== 'error' &&
      result.hasMore &&
      (snapshot.processedResults ?? 0) < (snapshot.targetResults ?? 0);

    if (needsContinuation) {
      const callbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;
      await qstash.publishJSON({
        url: callbackUrl,
        body: { jobId },
        delay: `${config.continuationDelayMs}ms`,
        retries: 3,
        notifyOnFailure: true,
      });
    }

    logger.info('Search runner completed', {
      jobId,
      platform: snapshot.platform,
      processedResults: snapshot.processedResults,
      processedRuns: snapshot.processedRuns,
      continuationScheduled: needsContinuation,
      metrics: result.metrics,
    }, LogCategory.JOB);

    return NextResponse.json({
      status: result.status,
      job: snapshot,
      metrics: result.metrics,
      continuationScheduled: needsContinuation,
    });
  } catch (error: any) {
    logger.error('Search runner failed', error, { jobId }, LogCategory.JOB);

    // Attempt to mark job as failed to prevent stuck "processing" status
    try {
      const { SearchJobService } = await import('@/lib/search-engine/job-service');
      const service = await SearchJobService.load(jobId);
      if (service) {
        await service.complete('error', { error: error?.message ?? 'Search runner failure' });
        logger.info('Job marked as error after failure', { jobId }, LogCategory.JOB);
      }
    } catch (completionError) {
      logger.error('Failed to mark job as error', completionError, { jobId }, LogCategory.JOB);
    }

    return NextResponse.json({
      error: error?.message ?? 'Search runner failure',
      jobId,
      marked: 'error'
    }, { status: 500 });
  }
}
