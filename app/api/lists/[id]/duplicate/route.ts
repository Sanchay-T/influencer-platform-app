import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { duplicateList } from '@/lib/db/queries/list-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const body = await request.json().catch(() => ({}));
		const list = await duplicateList(userId, id, body?.name);
		return NextResponse.json({ list }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
			return NextResponse.json({ error: 'List not found' }, { status: 404 });
		}
		if (message === 'LIST_PERMISSION_DENIED') {
			return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
		}
		structuredConsole.error('[LIST_DUPLICATE_API]', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
