/**
 * Export Download API Route
 *
 * @context CSV exports are stored encrypted in Vercel Blob (public-only).
 * This endpoint authenticates the user, fetches ciphertext from Blob, decrypts it,
 * and returns the plaintext CSV as an attachment.
 */

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { exportJobs } from '@/lib/db/schema';
import { decryptCsvBytes } from '@/lib/export/csv-encryption';
import { apiTracker, SentryLogger } from '@/lib/sentry';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	return apiTracker.trackRoute('/api/export/download', 'GET', async () => {
		try {
			const { userId } = await getAuthOrTest();
			if (!userId) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}

			const { id: exportId } = await params;

			SentryLogger.setContext('export_download', {
				exportId,
				userId,
			});

			const [exportJob] = await db
				.select({
					id: exportJobs.id,
					status: exportJobs.status,
					downloadUrl: exportJobs.downloadUrl,
				})
				.from(exportJobs)
				.where(and(eq(exportJobs.id, exportId), eq(exportJobs.userId, userId)))
				.limit(1);

			// Do not leak existence across users
			if (!exportJob) {
				return NextResponse.json({ error: 'Export not found' }, { status: 404 });
			}

			if (!(exportJob.status === 'completed' && exportJob.downloadUrl)) {
				return NextResponse.json({ error: 'Export not ready' }, { status: 404 });
			}

			const blobResponse = await fetch(exportJob.downloadUrl, { cache: 'no-store' });
			if (!blobResponse.ok) {
				return NextResponse.json({ error: 'Failed to fetch export blob' }, { status: 500 });
			}

			const encryptedBytes = Buffer.from(await blobResponse.arrayBuffer());
			const csvBytes = decryptCsvBytes(encryptedBytes);

			return new NextResponse(csvBytes, {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename=\"gemz-export-${exportJob.id}.csv\"`,
					'Cache-Control': 'no-store',
					'X-Content-Type-Options': 'nosniff',
				},
			});
		} catch (error) {
			SentryLogger.captureException(error, {
				tags: { feature: 'export', operation: 'download' },
			});
			return NextResponse.json(
				{
					error: 'Failed to download export',
					details: error instanceof Error ? error.message : 'Unknown error',
				},
				{ status: 500 }
			);
		}
	});
}

