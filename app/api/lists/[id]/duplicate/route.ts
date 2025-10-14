import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { duplicateList } from '@/lib/db/queries/list-queries';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const list = await duplicateList(userId, params.id, body?.name);
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (message === 'LIST_PERMISSION_DENIED') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('[LIST_DUPLICATE_API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
