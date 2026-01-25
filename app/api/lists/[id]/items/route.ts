import { NextResponse } from 'next/server';
import { trackServer } from '@/lib/analytics/track';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { addCreatorsToList, removeListItems, updateListItems } from '@/lib/db/queries/list-queries';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { apiTracker, listTracker, SentryLogger, sessionTracker } from '@/lib/sentry';

function errorToResponse(
	error: unknown,
	context?: { userId?: string; listId?: string; action?: string }
) {
	const message = error instanceof Error ? error.message : '';
	if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
		return NextResponse.json({ error: 'List not found' }, { status: 404 });
	}
	if (message === 'LIST_PERMISSION_DENIED') {
		// Track permission denied
		SentryLogger.captureMessage('List items permission denied', 'warning', {
			tags: { feature: 'list_items', reason: 'permission_denied' },
			extra: { userId: context?.userId, listId: context?.listId },
		});
		return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
	}
	structuredConsole.error('[LIST_ITEMS_API]', error);

	// Capture error in Sentry with context
	SentryLogger.captureException(error, {
		tags: { feature: 'list_items', action: context?.action || 'unknown' },
		extra: { userId: context?.userId, listId: context?.listId },
	});

	return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	return apiTracker.trackRoute('list_items', 'add_creator', async () => {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user and list context for Sentry
		SentryLogger.setContext('list_items_add', { userId, listId: id });
		sessionTracker.setUser({ userId });

		try {
			const body = await request.json();
			const result = await addCreatorsToList(userId, id, body.creators ?? []);

			// Fire-and-forget: Analytics tracking (don't block response)
			if (result.added > 0) {
				// Sentry tracking is fast, keep it sync
				listTracker.trackOperation('add_creator', {
					userId,
					listId: id,
					creatorCount: result.added,
				});

				// GA4 + LogSnag tracking - fire and forget (async HTTP calls)
				getUserProfile(userId)
					.then((user) =>
						trackServer('creator_saved', {
							userId,
							listName: id,
							count: result.added,
							email: user?.email || 'unknown',
							userName: user?.fullName || '',
						})
					)
					.catch((err) =>
						structuredConsole.error('[LIST_ITEMS_API] Analytics tracking failed', err)
					);
			}

			return NextResponse.json(result, { status: 201 });
		} catch (error) {
			return errorToResponse(error, { userId, listId: id, action: 'add_creator' });
		}
	});
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	return apiTracker.trackRoute('list_items', 'update', async () => {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user and list context for Sentry
		SentryLogger.setContext('list_items_update', { userId, listId: id });
		sessionTracker.setUser({ userId });

		try {
			const body = await request.json();
			await updateListItems(userId, id, body.items ?? []);
			return NextResponse.json({ ok: true });
		} catch (error) {
			return errorToResponse(error, { userId, listId: id, action: 'update' });
		}
	});
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	return apiTracker.trackRoute('list_items', 'remove_creator', async () => {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user and list context for Sentry
		SentryLogger.setContext('list_items_remove', { userId, listId: id });
		sessionTracker.setUser({ userId });

		try {
			const body = await request.json();
			const itemIds = body.itemIds ?? [];
			await removeListItems(userId, id, itemIds);

			// Track remove creators operation in Sentry
			listTracker.trackOperation('remove_creator', {
				userId,
				listId: id,
				creatorCount: itemIds.length,
			});

			return NextResponse.json({ ok: true });
		} catch (error) {
			return errorToResponse(error, { userId, listId: id, action: 'remove_creator' });
		}
	});
}
