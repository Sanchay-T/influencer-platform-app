/**
 * CSV Export Worker
 *
 * @context Background worker called by QStash to generate CSV exports.
 * Handles large exports without timeout by running in background.
 * Frontend polls for status and auto-downloads when ready.
 *
 * Flow:
 * 1. Verify QStash signature
 * 2. Fetch creators from DB
 * 3. Generate CSV content
 * 4. Upload to Vercel Blob
 * 5. Update export job status (frontend polls this)
 */

import { Receiver } from '@upstash/qstash';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exportJobs, scrapingJobs } from '@/lib/db/schema';
import { dedupeCreators, formatEmailsForCsv } from '@/lib/export/csv-utils';
import { getCreatorsForJobs } from '@/lib/export/get-creators';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { SentryLogger } from '@/lib/sentry';

export const maxDuration = 300; // 5 minutes
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

interface ExportWorkerMessage {
	exportId: string;
	campaignId?: string;
	jobId?: string;
	userId: string;
}

export async function POST(req: Request) {
	const rawBody = await req.text();
	const signature = req.headers.get('Upstash-Signature');

	// Verify signature in production
	if (shouldVerifySignature()) {
		if (!signature) {
			return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
		}
		const currentHost = req.headers.get('host') || process.env.VERCEL_URL || '';
		const protocol = currentHost.includes('localhost') ? 'http' : 'https';
		const baseUrl = currentHost ? `${protocol}://${currentHost}` : process.env.NEXT_PUBLIC_SITE_URL;
		const verificationUrl = `${baseUrl}/api/export/csv-worker`;

		try {
			await receiver.verify({ signature, body: rawBody, url: verificationUrl });
		} catch {
			structuredConsole.error('CSV Worker: Signature verification failed');
			return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
		}
	}

	let message: ExportWorkerMessage;
	try {
		message = JSON.parse(rawBody);
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { exportId, campaignId, jobId, userId } = message;

	// Set Sentry context for this worker
	SentryLogger.setContext('export_worker', {
		exportId,
		campaignId,
		jobId,
		userId,
	});

	structuredConsole.log('CSV Worker: Starting export', { exportId, campaignId, jobId });

	return SentryLogger.startSpanAsync({ name: 'export.csv.process', op: 'background' }, async () => {
		try {
			// Update status to processing
			SentryLogger.addBreadcrumb({
				category: 'export',
				message: 'Updating export status to processing',
				data: { exportId },
			});
			await db.update(exportJobs).set({ status: 'processing' }).where(eq(exportJobs.id, exportId));

			// Get job IDs to fetch creators from
			let jobIds: string[] = [];
			let keywords: string[] = [];

			if (campaignId) {
				const jobs = await db.query.scrapingJobs.findMany({
					where: eq(scrapingJobs.campaignId, campaignId),
					columns: { id: true, keywords: true },
				});
				jobIds = jobs.map((j) => j.id);
				jobs.forEach((job) => {
					if (Array.isArray(job.keywords)) {
						keywords = keywords.concat(job.keywords as string[]);
					}
				});
				keywords = [...new Set(keywords)];
			} else if (jobId) {
				jobIds = [jobId];
				const job = await db.query.scrapingJobs.findFirst({
					where: eq(scrapingJobs.id, jobId),
					columns: { keywords: true },
				});
				if (job && Array.isArray(job.keywords)) {
					keywords = job.keywords as string[];
				}
			}

			if (jobIds.length === 0) {
				throw new Error('No jobs found for export');
			}

			// Fetch creators
			SentryLogger.addBreadcrumb({
				category: 'export',
				message: 'Fetching creators from DB',
				data: { jobCount: jobIds.length },
			});
			const { creators: rawCreators, source } = await getCreatorsForJobs(jobIds);
			structuredConsole.log(`CSV Worker: Found ${rawCreators.length} creators from ${source}`);

			if (rawCreators.length === 0) {
				throw new Error('No creators found to export');
			}

			// Dedupe creators
			const creators = dedupeCreators(rawCreators);
			structuredConsole.log(`CSV Worker: Deduped to ${creators.length} creators`);

			SentryLogger.addBreadcrumb({
				category: 'export',
				message: `Generating CSV for ${creators.length} creators`,
				data: { creatorCount: creators.length, source },
			});

			// Generate CSV content
			const csvContent = generateCsvContent(creators, keywords);

			// Upload to Vercel Blob
			const filename = campaignId
				? `exports/campaign-${campaignId}-${Date.now()}.csv`
				: `exports/job-${jobId}-${Date.now()}.csv`;

			SentryLogger.addBreadcrumb({
				category: 'export',
				message: 'Uploading to blob storage',
				data: { size: csvContent.length, filename },
			});

			const blob = await put(filename, csvContent, {
				access: 'public',
				contentType: 'text/csv',
			});

			structuredConsole.log('CSV Worker: Uploaded to Blob', { url: blob.url });

			// Calculate expiration (7 days)
			const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

			// Update export job
			SentryLogger.addBreadcrumb({
				category: 'export',
				message: 'Export completed successfully',
				level: 'info',
				data: { totalCreators: creators.length, downloadUrl: blob.url },
			});
			await db
				.update(exportJobs)
				.set({
					status: 'completed',
					downloadUrl: blob.url,
					totalCreators: creators.length,
					expiresAt,
					completedAt: new Date(),
				})
				.where(eq(exportJobs.id, exportId));

			// Skip email - frontend polls for status and auto-downloads

			return NextResponse.json({
				success: true,
				exportId,
				downloadUrl: blob.url,
				totalCreators: creators.length,
			});
		} catch (error) {
			structuredConsole.error('CSV Worker: Export failed', error);

			SentryLogger.captureException(error, {
				tags: { feature: 'export', operation: 'csv_worker' },
				extra: {
					exportId,
					campaignId,
					jobId,
					userId,
				},
			});

			// Update status to failed
			await db
				.update(exportJobs)
				.set({
					status: 'failed',
					error: error instanceof Error ? error.message : 'Unknown error',
				})
				.where(eq(exportJobs.id, exportId));

			return NextResponse.json(
				{
					error: 'Export failed',
					details: error instanceof Error ? error.message : 'Unknown error',
				},
				{ status: 500 }
			);
		}
	});
}

/**
 * Generate CSV content from creators array
 */
type CreatorItem = {
	creator?: Record<string, unknown>;
	video?: Record<string, unknown>;
	hashtags?: unknown;
	platform?: string;
	[key: string]: unknown;
};

function generateCsvContent(creators: CreatorItem[], keywords: string[]): string {
	if (creators.length === 0) {
		return '';
	}

	const firstCreator = creators[0];
	const keywordsStr = keywords.join(';');

	// Detect format and generate appropriate CSV
	if (firstCreator.creator && firstCreator.video) {
		// Video-based format (TikTok, YouTube keyword search)
		const headers = [
			'Platform',
			'Creator/Channel Name',
			'Followers',
			'Video/Content URL',
			'Title/Description',
			'Views',
			'Likes',
			'Comments',
			'Shares',
			'Duration (seconds)',
			'Hashtags',
			'Date',
			'Keywords',
			'Email',
		];

		let csv = `${headers.join(',')}\n`;

		for (const item of creators) {
			const creator = item.creator || {};
			const video = item.video || {};
			const stats = video.statistics || {};
			const hashtags = Array.isArray(item.hashtags) ? item.hashtags.join(';') : '';
			const platform = item.platform || 'Unknown';
			const emailCell = formatEmailsForCsv([item, creator]);

			let dateStr = '';
			if (platform === 'YouTube' && item.publishedTime) {
				dateStr = new Date(item.publishedTime).toISOString().split('T')[0];
			} else if (item.createTime) {
				dateStr = new Date(item.createTime * 1000).toISOString().split('T')[0];
			}

			const row = [
				`"${platform}"`,
				`"${escapeCSV(creator.name || '')}"`,
				`"${creator.followers || 0}"`,
				`"${video.url || ''}"`,
				`"${escapeCSV(video.description || '')}"`,
				`"${stats.views || 0}"`,
				`"${stats.likes || 0}"`,
				`"${stats.comments || 0}"`,
				`"${stats.shares || 0}"`,
				`"${item.lengthSeconds || 0}"`,
				`"${hashtags}"`,
				`"${dateStr}"`,
				`"${keywordsStr}"`,
				`"${emailCell}"`,
			];
			csv += `${row.join(',')}\n`;
		}

		return csv;
	}

	if (firstCreator.username && (firstCreator.is_verified !== undefined || firstCreator.full_name)) {
		// Similar search format (Instagram, TikTok similar)
		const headers = [
			'Username',
			'Full Name',
			'Followers',
			'Email',
			'Verified',
			'Private',
			'Platform',
			'Profile URL',
		];

		let csv = `${headers.join(',')}\n`;

		for (const creator of creators) {
			const emailCell = formatEmailsForCsv(creator);
			const platform = creator.platform || 'Instagram';
			const profileUrl =
				platform === 'TikTok'
					? `https://www.tiktok.com/@${creator.username}`
					: `https://instagram.com/${creator.username}`;

			const row = [
				`"${creator.username || ''}"`,
				`"${escapeCSV(creator.full_name || creator.displayName || '')}"`,
				`"${creator.followerCount || creator.followers || 0}"`,
				`"${emailCell}"`,
				`"${creator.is_verified || creator.verified ? 'Yes' : 'No'}"`,
				`"${creator.is_private || creator.isPrivate ? 'Yes' : 'No'}"`,
				`"${platform}"`,
				`"${profileUrl}"`,
			];
			csv += `${row.join(',')}\n`;
		}

		return csv;
	}

	// Fallback: use all keys from first creator
	const fields = Object.keys(firstCreator);
	let csv = `${fields.join(',')}\n`;

	for (const creator of creators) {
		const values = fields.map((field) => {
			const value = creator[field];
			if (typeof value === 'object' && value !== null) {
				return `"${escapeCSV(JSON.stringify(value))}"`;
			}
			return `"${escapeCSV(String(value || ''))}"`;
		});
		csv += `${values.join(',')}\n`;
	}

	return csv;
}

function escapeCSV(value: string): string {
	return value.replace(/"/g, '""');
}
