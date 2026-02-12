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

import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exportJobs, scrapingJobs } from '@/lib/db/schema';
import { dedupeByCreator, dedupeCreators, formatEmailsForCsv } from '@/lib/export/csv-utils';
import { encryptCsvBytes } from '@/lib/export/csv-encryption';
import { getCreatorsForJobs } from '@/lib/export/get-creators';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { verifyQstashRequestSignature } from '@/lib/queue/qstash-signature';
import { SentryLogger } from '@/lib/sentry';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

interface ExportWorkerMessage {
	exportId: string;
	campaignId?: string;
	jobId?: string;
	userId: string;
}

export async function POST(req: Request) {
	const rawBody = await req.text();

	const verification = await verifyQstashRequestSignature({
		req,
		rawBody,
		pathname: '/api/export/csv-worker',
	});
	if (!verification.ok) {
		structuredConsole.error('CSV Worker: QStash signature rejected', {
			error: verification.error,
			callbackUrl: verification.callbackUrl,
		});
		return NextResponse.json({ error: verification.error }, { status: verification.status });
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

			// Dedupe creators — first by identity fields, then collapse multiple
			// videos per creator into a single row (keeping the best-performing video)
			const identityDeduped = dedupeCreators(rawCreators);
			const creators = dedupeByCreator(identityDeduped);
			structuredConsole.log(
				`CSV Worker: ${rawCreators.length} raw → ${identityDeduped.length} identity-deduped → ${creators.length} creator-deduped`
			);

			SentryLogger.addBreadcrumb({
				category: 'export',
				message: `Generating CSV for ${creators.length} creators`,
				data: { creatorCount: creators.length, source },
			});

			// Generate CSV content
			const csvContent = generateCsvContent(creators, keywords);
			const encryptedBytes = encryptCsvBytes(Buffer.from(csvContent, 'utf8'));

			// Upload to Vercel Blob
			const filename = campaignId
				? `exports/campaign-${campaignId}-${Date.now()}.csv.enc`
				: `exports/job-${jobId}-${Date.now()}.csv.enc`;

			SentryLogger.addBreadcrumb({
				category: 'export',
				message: 'Uploading to blob storage',
				data: { plaintextBytes: csvContent.length, encryptedBytes: encryptedBytes.length, filename },
			});

			const blob = await put(filename, encryptedBytes, {
				access: 'public',
				contentType: 'application/octet-stream',
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

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function readString(value: unknown): string | undefined {
		return typeof value === 'string' ? value : undefined;
	}

	function readNumber(value: unknown): number | undefined {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (!trimmed) {
				return undefined;
			}
			const parsed = Number(trimmed);
			return Number.isFinite(parsed) ? parsed : undefined;
		}
		return undefined;
	}

	function toIsoDate(value: unknown): string | undefined {
		if (value instanceof Date) {
			return Number.isNaN(value.getTime()) ? undefined : value.toISOString().split('T')[0];
		}
		if (typeof value === 'string' || typeof value === 'number') {
			const parsed = new Date(value);
			return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split('T')[0];
		}
		return undefined;
	}

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
				const creator = isRecord(item.creator) ? item.creator : {};
				const video = isRecord(item.video) ? item.video : {};
				const stats = isRecord(video.statistics) ? video.statistics : {};
				const hashtagList = Array.isArray(item.hashtags)
					? item.hashtags.filter((tag): tag is string => typeof tag === 'string')
					: [];
				const hashtags = hashtagList.length > 0 ? hashtagList.join(';') : '';
				const platform = readString(item.platform) ?? 'Unknown';
				const emailCell = formatEmailsForCsv([item, creator]);

				let dateStr = '';
				if (platform === 'YouTube') {
					dateStr = toIsoDate(item.publishedTime) ?? '';
				} else {
					const createTime = readNumber(item.createTime);
					if (createTime !== undefined) {
						dateStr = toIsoDate(createTime * 1000) ?? '';
					}
				}

				const creatorName = readString(creator.name) ?? '';
				const followers = readNumber(creator.followers) ?? 0;
				const videoUrl = readString(video.url) ?? '';
				const description = readString(video.description) ?? '';
				const views = readNumber(stats.views) ?? 0;
				const likes = readNumber(stats.likes) ?? 0;
				const comments = readNumber(stats.comments) ?? 0;
				const shares = readNumber(stats.shares) ?? 0;
				const lengthSeconds = readNumber(item.lengthSeconds) ?? 0;

				const row = [
					`"${platform}"`,
					`"${escapeCSV(creatorName)}"`,
					`"${followers}"`,
					`"${videoUrl}"`,
					`"${escapeCSV(description)}"`,
					`"${views}"`,
					`"${likes}"`,
					`"${comments}"`,
					`"${shares}"`,
					`"${lengthSeconds}"`,
					`"${hashtags}"`,
					`"${dateStr}"`,
					`"${keywordsStr}"`,
					`"${emailCell}"`,
				];
			csv += `${row.join(',')}\n`;
		}

		return csv;
	}

		const isSimilarSearchFormat =
			typeof firstCreator.username === 'string' &&
			(firstCreator.is_verified !== undefined ||
				typeof firstCreator.full_name === 'string' ||
				typeof firstCreator.displayName === 'string');

		if (isSimilarSearchFormat) {
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
				const platform = readString(creator.platform) ?? 'Instagram';
				const username = typeof creator.username === 'string' ? creator.username : '';
				const profileUrl =
					platform === 'TikTok'
						? `https://www.tiktok.com/@${username}`
						: `https://instagram.com/${username}`;

				const fullName =
					readString(creator.full_name) ?? readString(creator.displayName) ?? '';
				const followerCount = readNumber(creator.followerCount) ?? readNumber(creator.followers) ?? 0;
				const isVerified =
					creator.is_verified === true || creator.verified === true ? 'Yes' : 'No';
				const isPrivate =
					creator.is_private === true || creator.isPrivate === true ? 'Yes' : 'No';

				const row = [
					`"${username}"`,
					`"${escapeCSV(fullName)}"`,
					`"${followerCount}"`,
					`"${emailCell}"`,
					`"${isVerified}"`,
					`"${isPrivate}"`,
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
