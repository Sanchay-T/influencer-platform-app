import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { deleteList, getListDetail, updateList } from '@/lib/db/queries/list-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { apiTracker, listTracker, SentryLogger, sessionTracker } from '@/lib/sentry';

function handleError(
	error: unknown,
	context?: { userId?: string; listId?: string; action?: string }
) {
	structuredConsole.error('[LIST_DETAIL_API]', error);

	// Capture error in Sentry with context
	SentryLogger.captureException(error, {
		tags: { feature: 'list', action: context?.action || 'unknown' },
		extra: { userId: context?.userId, listId: context?.listId },
	});

	const message = error instanceof Error ? error.message : '';
	if (message === 'USER_NOT_FOUND') {
		return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
	}
	if (message === 'LIST_NOT_FOUND') {
		return NextResponse.json({ error: 'List not found' }, { status: 404 });
	}
	if (message === 'LIST_PERMISSION_DENIED') {
		// Track permission denied
		SentryLogger.captureMessage('List permission denied', 'warning', {
			tags: { feature: 'list', reason: 'permission_denied' },
			extra: { userId: context?.userId, listId: context?.listId },
		});
		return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
	}
	return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;

	return apiTracker.trackRoute('list', 'get', async () => {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user and list context for Sentry
		SentryLogger.setContext('list_detail', { userId, listId: id });
		sessionTracker.setUser({ userId });

		try {
			const detail = await getListDetail(userId, id);
			return NextResponse.json(detail);
		} catch (error) {
			return handleError(error, { userId, listId: id, action: 'get' });
		}
	});
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	const startTime = performance.now();

	return apiTracker.trackRoute('list', 'update', async () => {
		const authStart = performance.now();
		const { userId } = await getAuthOrTest();
		const authMs = performance.now() - authStart;

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user and list context for Sentry
		SentryLogger.setContext('list_update', { userId, listId: id });
		sessionTracker.setUser({ userId });

		try {
			const body = await request.json();

			const dbStart = performance.now();
			const updated = await updateList(userId, id, body);
			const dbMs = performance.now() - dbStart;

			// Track list update in Sentry
			listTracker.trackOperation('update', { userId, listId: id });

			const totalMs = performance.now() - startTime;

			// Add timing headers for debugging (visible in DevTools Network tab)
			return NextResponse.json(
				{ list: updated },
				{
					headers: {
						'Server-Timing': `auth;dur=${authMs.toFixed(1)}, db;dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
					},
				}
			);
		} catch (error) {
			return handleError(error, { userId, listId: id, action: 'update' });
		}
	});
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;

	return apiTracker.trackRoute('list', 'delete', async () => {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user and list context for Sentry
		SentryLogger.setContext('list_delete', { userId, listId: id });
		sessionTracker.setUser({ userId });

		try {
			structuredConsole.debug('[LIST-DELETE-API] Request received', { listId: id, userId });
			await deleteList(userId, id);
			structuredConsole.debug('[LIST-DELETE-API] Completed', { listId: id, userId });

			// Track list deletion in Sentry
			listTracker.trackOperation('delete', { userId, listId: id });

			return NextResponse.json({ ok: true });
		} catch (error) {
			return handleError(error, { userId, listId: id, action: 'delete' });
		}
	});
}
