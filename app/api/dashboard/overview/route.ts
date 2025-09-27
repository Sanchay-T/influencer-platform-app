import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getFavoriteInfluencersForDashboard,
  getSearchTelemetryForDashboard,
} from '@/lib/db/queries/dashboard-queries';
import { getListsForUser } from '@/lib/db/queries/list-queries';
import { PlanValidator } from '@/lib/services/plan-validator';

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
    const [favorites, lists, searchTelemetry, planStatus] = await Promise.all([
      getFavoriteInfluencersForDashboard(userId, 10),
      getListsForUser(userId),
      getSearchTelemetryForDashboard(userId),
      PlanValidator.getUserPlanStatus(userId),
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

    const searchLimit = planStatus?.planConfig.creatorsLimit ?? null;
    const normalizedLimit = searchLimit === -1 ? null : searchLimit;

    return NextResponse.json({
      favorites,
      recentLists,
      metrics: {
        averageSearchMs: searchTelemetry.averageDurationMs,
        searchesLast30Days: searchTelemetry.totalJobs,
        completedSearchesLast30Days: searchTelemetry.completedJobs,
        searchLimit: normalizedLimit,
        totalFavorites: favorites.length,
      },
    });
  } catch (error) {
    if ((error as Error).message === 'USER_NOT_FOUND') {
      return errorResponse('User record not found', 404);
    }
    return errorResponse(error);
  }
}
