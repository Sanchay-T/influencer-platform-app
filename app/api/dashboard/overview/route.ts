import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFavoriteInfluencersForDashboard } from '@/lib/db/queries/dashboard-queries';
import { getListsForUser } from '@/lib/db/queries/list-queries';

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
    const [favorites, lists] = await Promise.all([
      getFavoriteInfluencersForDashboard(userId, 10),
      getListsForUser(userId),
    ]);

    const recentLists = lists
      .filter((list) => !list.isArchived)
      .slice(0, 3)
      .map((list) => ({
        id: list.id,
        name: list.name,
        description: list.description,
        creatorCount: list.creatorCount,
        updatedAt: (list.updatedAt instanceof Date ? list.updatedAt : new Date(list.updatedAt)).toISOString(),
        slug: list.slug ?? null,
      }));

    return NextResponse.json({ favorites, recentLists });
  } catch (error) {
    if ((error as Error).message === 'USER_NOT_FOUND') {
      return errorResponse('User record not found', 404);
    }
    return errorResponse(error);
  }
}
