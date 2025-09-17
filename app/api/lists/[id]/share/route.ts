import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { manageCollaborators } from '@/lib/db/queries/list-queries';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
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
    console.error('[LIST_SHARE_API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
