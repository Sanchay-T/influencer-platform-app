import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { deleteList, getListDetail, updateList } from '@/lib/db/queries/list-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

function handleError(error: unknown) {
	structuredConsole.error('[LIST_DETAIL_API]', error);
	const message = (error as Error).message;
	if (message === 'USER_NOT_FOUND') {
		return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
	}
	if (message === 'LIST_NOT_FOUND') {
		return NextResponse.json({ error: 'List not found' }, { status: 404 });
	}
	if (message === 'LIST_PERMISSION_DENIED') {
		return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
	}
	return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const { id } = await context.params;
		const detail = await getListDetail(userId, id);
		return NextResponse.json(detail);
	} catch (error) {
		return handleError(error);
	}
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { id } = await context.params;
		const updated = await updateList(userId, id, body);
		return NextResponse.json({ list: updated });
	} catch (error) {
		return handleError(error);
	}
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const { id } = await context.params;
		structuredConsole.debug('[LIST-DELETE-API] Request received', { listId: id, userId });
		await deleteList(userId, id);
		structuredConsole.debug('[LIST-DELETE-API] Completed', { listId: id, userId });
		return NextResponse.json({ ok: true });
	} catch (error) {
		return handleError(error);
	}
}
