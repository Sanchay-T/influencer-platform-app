import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { recordExport } from '@/lib/db/queries/list-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { apiTracker, listTracker, SentryLogger, sessionTracker } from '@/lib/sentry';

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	return apiTracker.trackRoute('list', 'export', async () => {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user and list context for Sentry
		SentryLogger.setContext('list_export', { userId, listId: id });
		sessionTracker.setUser({ userId });

		try {
			const body = await request.json().catch(() => ({ format: 'csv' }));
			const format = body.format ?? 'csv';
			const exportJob = await recordExport(userId, id, format);

			// Track export operation in Sentry
			listTracker.trackOperation('export', { userId, listId: id });

			return NextResponse.json({ export: exportJob }, { status: 202 });
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
				return NextResponse.json({ error: 'List not found' }, { status: 404 });
			}
			if (message === 'LIST_PERMISSION_DENIED') {
				// Track permission denied
				SentryLogger.captureMessage('List export permission denied', 'warning', {
					tags: { feature: 'list', reason: 'permission_denied' },
					extra: { userId, listId: id },
				});
				return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
			}
			structuredConsole.error('[LIST_EXPORT_API]', error);

			// Capture error in Sentry with context
			SentryLogger.captureException(error, {
				tags: { feature: 'list', action: 'export' },
				extra: { userId, listId: id },
			});

			return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
		}
	});
}
