import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteList, getListDetail, updateList } from '@/lib/db/queries/list-queries';

function handleError(error: unknown) {
  console.error('[LIST_DETAIL_API]', error);
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
  const { userId } = await auth();
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
  const { userId } = await auth();
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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    console.debug('[LIST-DELETE-API] Request received', { listId: id, userId });
    await deleteList(userId, id);
    console.debug('[LIST-DELETE-API] Completed', { listId: id, userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
