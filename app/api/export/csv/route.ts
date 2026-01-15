/**
 * CSV Export API Route
 *
 * @context Queues CSV export to background worker via QStash.
 * Returns immediately with exportId - user gets email when ready.
 *
 * Query params:
 * - campaignId: Export all creators from all jobs in campaign
 * - jobId: Export creators from a single job
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { trackServer } from '@/lib/analytics/track';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { FeatureGateService } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns, exportJobs, scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getDeadLetterQueueUrl, getQstashBaseUrl, qstash } from '@/lib/queue/qstash';

export async function GET(req: Request) {
	try {
		structuredConsole.log('CSV Export: Starting export process');
		const { searchParams } = new URL(req.url);
		const jobId = searchParams.get('jobId');
		const campaignId = searchParams.get('campaignId');

		if (!(jobId || campaignId)) {
			return NextResponse.json({ error: 'Job ID or campaign ID is required' }, { status: 400 });
		}

		// Verify authentication
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Feature gate: ensure CSV export is allowed for this plan
		const gate = await FeatureGateService.assertExportFormat(userId, 'CSV');
		if (!gate.allowed) {
			return NextResponse.json(
				{
					error: 'CSV export not available on your plan',
					upgrade: true,
					currentPlan: gate.currentPlan,
					reason: gate.reason,
				},
				{ status: 403 }
			);
		}

		// Validate ownership
		if (campaignId) {
			const campaign = await db.query.campaigns.findFirst({
				where: eq(campaigns.id, campaignId),
				columns: { userId: true },
			});
			if (!campaign || campaign.userId !== userId) {
				return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
			}
		}

		if (jobId) {
			const job = await db.query.scrapingJobs.findFirst({
				where: eq(scrapingJobs.id, jobId),
				columns: { userId: true },
			});
			if (!job || job.userId !== userId) {
				return NextResponse.json({ error: 'Job not found' }, { status: 404 });
			}
		}

		// Create export job in DB
		const [newExportJob] = await db
			.insert(exportJobs)
			.values({
				userId,
				campaignId: campaignId || undefined,
				jobId: jobId || undefined,
				status: 'pending',
			})
			.returning();

		structuredConsole.log('CSV Export: Created export job', { exportId: newExportJob.id });

		// Queue to QStash for background processing
		const workerUrl = `${getQstashBaseUrl()}/api/export/csv-worker`;

		await qstash.publishJSON({
			url: workerUrl,
			body: {
				exportId: newExportJob.id,
				campaignId,
				jobId,
				userId,
			},
			retries: 3,
			timeout: 300, // 5 minutes for large exports
			failureCallback: getDeadLetterQueueUrl(),
		});

		structuredConsole.log('CSV Export: Queued to QStash', {
			exportId: newExportJob.id,
			workerUrl,
		});

		// Track export event (fire and forget - don't block response)
		trackServer('csv_exported', {
			userId,
			email: '', // Email not available in this context
			creatorCount: 0, // Count determined by worker
			source: campaignId ? 'campaign' : 'list',
		}).catch(() => {}); // Ignore tracking errors

		return NextResponse.json({
			exportId: newExportJob.id,
			status: 'processing',
			message: 'Export started. You will receive an email when ready.',
		});
	} catch (error) {
		structuredConsole.error('CSV Export: Error starting export', error);
		return NextResponse.json(
			{
				error: 'Failed to start export',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
