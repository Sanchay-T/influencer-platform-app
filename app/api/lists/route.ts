import { NextResponse } from 'next/server';
import { trackServer } from '@/lib/analytics/track';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createList, getListsForUser } from '@/lib/db/queries/list-queries';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { apiTracker, listTracker, SentryLogger, sessionTracker } from '@/lib/sentry';

function errorResponse(error: unknown, status = 500) {
	structuredConsole.error('[LISTS_API]', error);
	if (status === 500) {
		return NextResponse.json({ error: 'Internal server error' }, { status });
	}
	if (status === 404) {
		return NextResponse.json({ error: 'Resource not found' }, { status });
	}
	return NextResponse.json(
		{ error: error instanceof Error ? error.message : 'Request failed' },
		{ status }
	);
}

export async function GET() {
	return apiTracker.trackRoute('list', 'list', async () => {
		const requestId = `lists_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		structuredConsole.log(`[LISTS-API:${requestId}] incoming GET`);
		const { userId } = await getAuthOrTest();
		structuredConsole.log(`[LISTS-API:${requestId}] auth resolved`, { userId });
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user context for Sentry
		SentryLogger.setContext('list_list', { userId });
		sessionTracker.setUser({ userId });

		try {
			const lists = await getListsForUser(userId);
			structuredConsole.log(`[LISTS-API:${requestId}] returning ${lists.length} lists`);
			return NextResponse.json({ lists });
		} catch (error) {
			structuredConsole.error(`[LISTS-API:${requestId}] error`, error);

			// Capture error in Sentry with context
			SentryLogger.captureException(error, {
				tags: { feature: 'list', action: 'list' },
				extra: { userId },
			});

			if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
				return errorResponse('User record not found', 404);
			}
			return errorResponse(error);
		}
	});
}

export async function POST(request: Request) {
	return apiTracker.trackRoute('list', 'create', async () => {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user context for Sentry
		SentryLogger.setContext('list_create', { userId });
		sessionTracker.setUser({ userId });

		try {
			const body = await request.json();
			const list = await createList(userId, {
				name: body.name,
				description: body.description,
				type: body.type,
				privacy: body.privacy,
				tags: body.tags,
				settings: body.settings,
			});

			// Track list creation (GA4 + LogSnag + Sentry) - fire and forget
			getUserProfile(userId)
				.then((user) =>
					trackServer('list_created', {
						userId,
						listName: body.name || 'Untitled List',
						type: body.type || 'custom',
						email: user?.email || 'unknown',
						userName: user?.fullName || '',
					})
				)
				.catch((err) => structuredConsole.error('[ANALYTICS] list_created tracking failed', err));

			// Track list creation in Sentry
			listTracker.trackOperation('create', { userId, listId: list.id });

			return NextResponse.json({ list }, { status: 201 });
		} catch (error) {
			// Capture error in Sentry with context
			SentryLogger.captureException(error, {
				tags: { feature: 'list', action: 'create' },
				extra: { userId },
			});

			if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
				return errorResponse('User record not found', 404);
			}
			return errorResponse(error);
		}
	});
}
