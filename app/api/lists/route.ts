import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createList, getListsForUser } from '@/lib/db/queries/list-queries';

function errorResponse(error: unknown, status = 500) {
  structuredConsole.error('[LISTS_API]', error);
  if (status === 500) {
    return NextResponse.json({ error: 'Internal server error' }, { status });
  }
  if (status === 404) {
    return NextResponse.json({ error: 'Resource not found' }, { status });
  }
  return NextResponse.json({ error: (error as Error).message ?? 'Request failed' }, { status });
}

export async function GET() {
  const requestId = `lists_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  structuredConsole.log(`[LISTS-API:${requestId}] incoming GET`);
  const { userId } = await getAuthOrTest();
  structuredConsole.log(`[LISTS-API:${requestId}] auth resolved`, { userId });
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const lists = await getListsForUser(userId);
    structuredConsole.log(`[LISTS-API:${requestId}] returning ${lists.length} lists`);
    return NextResponse.json({ lists });
  } catch (error) {
    structuredConsole.error(`[LISTS-API:${requestId}] error`, error);
    if ((error as Error).message === 'USER_NOT_FOUND') {
      return errorResponse('User record not found', 404);
    }
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const { userId } = await getAuthOrTest();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    if ((error as Error).message === 'USER_NOT_FOUND') {
      return errorResponse('User record not found', 404);
    }
    return errorResponse(error);
  }
}
