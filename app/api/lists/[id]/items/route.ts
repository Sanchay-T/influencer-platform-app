import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addCreatorsToList, removeListItems, updateListItems } from '@/lib/db/queries/list-queries';

function errorToResponse(error: unknown) {
  const message = (error as Error).message;
  if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }
  if (message === 'LIST_PERMISSION_DENIED') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  console.error('[LIST_ITEMS_API]', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const result = await addCreatorsToList(userId, params.id, body.creators ?? []);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
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
  const { userId } = await auth();
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
