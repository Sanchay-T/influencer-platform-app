import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { manageCollaborators } from '@/lib/db/queries/list-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function POST(request: Request, { params }: { params: { id: string } }) {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const body = await request.json();
		await manageCollaborators(userId, params.id, body.collaborators ?? []);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = (error as Error).message;
		if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
			return NextResponse.json({ error: 'List not found' }, { status: 404 });
		}
		if (message === 'LIST_PERMISSION_DENIED') {
			return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
		}
		structuredConsole.error('[LIST_SHARE_API]', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
