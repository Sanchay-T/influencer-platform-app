/**
 * Export Download API Route
 *
 * @context Authenticated proxy for CSV export downloads.
 * Raw blob URLs are never exposed to clients. Instead, the status endpoint
 * returns /api/export/download/[id], and this route verifies auth + ownership
 * before redirecting to the actual blob URL.
 */

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { exportJobs } from '@/lib/db/schema';
import { SentryLogger } from '@/lib/sentry';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: exportId } = await params;

		const [exportJob] = await db
			.select()
			.from(exportJobs)
			.where(and(eq(exportJobs.id, exportId), eq(exportJobs.userId, userId)))
			.limit(1);

		if (!exportJob) {
			return NextResponse.json({ error: 'Export not found' }, { status: 404 });
		}

		if (exportJob.status !== 'completed' || !exportJob.downloadUrl) {
			return NextResponse.json({ error: 'Export not ready' }, { status: 400 });
		}

		// Check expiration
		if (exportJob.expiresAt && new Date(exportJob.expiresAt) < new Date()) {
			return NextResponse.json({ error: 'Export has expired' }, { status: 410 });
		}

		SentryLogger.addBreadcrumb({
			category: 'export',
			message: 'Authenticated export download',
			data: { exportId, userId },
		});

		// Redirect to the actual blob URL (302 so it's not cached by the browser)
		return NextResponse.redirect(exportJob.downloadUrl, 302);
	} catch (error) {
		SentryLogger.captureException(error, {
			tags: { feature: 'export', operation: 'download' },
		});
		return NextResponse.json({ error: 'Failed to process download' }, { status: 500 });
	}
}
