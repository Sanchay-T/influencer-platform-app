import { NextResponse } from 'next/server';
import { trackCreatorSaved } from '@/lib/analytics/logsnag';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { addCreatorsToList, removeListItems, updateListItems } from '@/lib/db/queries/list-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

function errorToResponse(error: unknown) {
	const message = (error as Error).message;
	if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
		return NextResponse.json({ error: 'List not found' }, { status: 404 });
	}
	if (message === 'LIST_PERMISSION_DENIED') {
		return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
	}
	structuredConsole.error('[LIST_ITEMS_API]', error);
	return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const body = await request.json();
		const result = await addCreatorsToList(userId, params.id, body.creators ?? []);

		// Track creators saved in LogSnag
		if (result.added > 0) {
			await trackCreatorSaved({
				userId,
				listName: params.id, // Using list ID as name since we don't have it here
				count: result.added,
			});
		}

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		return errorToResponse(error);
	}
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const body = await request.json();
		await updateListItems(userId, params.id, body.items ?? []);
		return NextResponse.json({ ok: true });
	} catch (error) {
		return errorToResponse(error);
	}
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const body = await request.json();
		await removeListItems(userId, params.id, body.itemIds ?? []);
		return NextResponse.json({ ok: true });
	} catch (error) {
		return errorToResponse(error);
	}
}
