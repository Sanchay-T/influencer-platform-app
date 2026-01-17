/**
 * Export Status API Route
 *
 * @context Returns status of a background export job.
 * Used for polling from frontend to check if export is ready.
 */

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { exportJobs } from '@/lib/db/schema';
import { apiTracker, SentryLogger } from '@/lib/sentry';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	return apiTracker.trackRoute('/api/export/status', 'GET', async () => {
		try {
			const { userId } = await getAuthOrTest();
			if (!userId) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}

			const { id: exportId } = await params;

			SentryLogger.setContext('export_status', {
				exportId,
				userId,
			});

			const [exportJob] = await db
				.select()
				.from(exportJobs)
				.where(and(eq(exportJobs.id, exportId), eq(exportJobs.userId, userId)))
				.limit(1);

			if (!exportJob) {
				return NextResponse.json({ error: 'Export not found' }, { status: 404 });
			}

			SentryLogger.addBreadcrumb({
				category: 'export',
				message: 'Export status checked',
				data: { exportId, status: exportJob.status },
			});

			return NextResponse.json({
				id: exportJob.id,
				status: exportJob.status,
				downloadUrl: exportJob.downloadUrl,
				expiresAt: exportJob.expiresAt,
				totalCreators: exportJob.totalCreators,
				error: exportJob.error,
				createdAt: exportJob.createdAt,
				completedAt: exportJob.completedAt,
			});
		} catch (error) {
			SentryLogger.captureException(error, {
				tags: { feature: 'export', operation: 'status_check' },
			});
			return NextResponse.json(
				{
					error: 'Failed to get export status',
					details: error instanceof Error ? error.message : 'Unknown error',
				},
				{ status: 500 }
			);
		}
	});
}
