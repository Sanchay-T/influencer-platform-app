import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/backend-auth';
import { getDashboardOverview } from '@/lib/dashboard/overview';

function errorResponse(error: unknown, status = 500) {
  console.error('[DASHBOARD_OVERVIEW_API]', error);
  const message = status === 500 ? 'Internal server error' : (error as Error).message ?? 'Request failed';
  return NextResponse.json({ error: message }, { status });
}

// Surface favorites + recency snapshots to dashboard UI
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getDashboardOverview(userId);

    return NextResponse.json(data);
  } catch (error) {
    if ((error as Error).message === 'USER_NOT_FOUND') {
      return errorResponse('User record not found', 404);
    }
    return errorResponse(error);
  }
}
