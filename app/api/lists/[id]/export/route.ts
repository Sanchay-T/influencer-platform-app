import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { recordExport } from '@/lib/db/queries/list-queries';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({ format: 'csv' }));
    const exportJob = await recordExport(userId, params.id, body.format ?? 'csv');
    return NextResponse.json({ export: exportJob }, { status: 202 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'USER_NOT_FOUND' || message === 'LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (message === 'LIST_PERMISSION_DENIED') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('[LIST_EXPORT_API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
