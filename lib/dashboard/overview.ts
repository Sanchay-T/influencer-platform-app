import { unstable_noStore as noStore } from 'next/cache';
import { getFavoriteInfluencersForDashboard, getSearchTelemetryForDashboard } from '@/lib/db/queries/dashboard-queries';
import { getListsForUser } from '@/lib/db/queries/list-queries';
import { PlanValidator } from '@/lib/services/plan-validator';
import type { DashboardFavoriteInfluencer } from '@/lib/db/queries/dashboard-queries';

// Breadcrumb: getDashboardOverview -> consumed by RSC dashboard page & REST API -> relies on db/queries + plan validator.

export type DashboardFavorite = DashboardFavoriteInfluencer;

export interface DashboardRecentList {
  id: string;
  name: string;
  description: string | null;
  creatorCount: number;
  updatedAt: string;
  slug: string | null;
}

export interface DashboardOverviewMetrics {
  averageSearchMs: number | null;
  searchesLast30Days: number;
  completedSearchesLast30Days: number;
  searchLimit: number | null | undefined;
  totalFavorites: number;
}

export interface DashboardOverviewData {
  favorites: DashboardFavorite[];
  recentLists: DashboardRecentList[];
  metrics: DashboardOverviewMetrics;
}

function normalizeRecentLists(lists: Awaited<ReturnType<typeof getListsForUser>>): DashboardRecentList[] {
  return lists
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
}

export async function getDashboardOverview(clerkUserId: string): Promise<DashboardOverviewData> {
  noStore();
  const [favorites, lists, searchTelemetry, planStatus] = await Promise.all([
    getFavoriteInfluencersForDashboard(clerkUserId, 10),
    getListsForUser(clerkUserId),
    getSearchTelemetryForDashboard(clerkUserId),
    PlanValidator.getUserPlanStatus(clerkUserId),
  ]);

  const normalizedLists = normalizeRecentLists(lists);
  const searchLimit = planStatus?.planConfig.creatorsLimit ?? null;
  const normalizedLimit = searchLimit === -1 ? null : searchLimit;

  return {
    favorites,
    recentLists: normalizedLists,
    metrics: {
      averageSearchMs: searchTelemetry.averageDurationMs,
      searchesLast30Days: searchTelemetry.totalJobs,
      completedSearchesLast30Days: searchTelemetry.completedJobs,
      searchLimit: normalizedLimit,
      totalFavorites: favorites.length,
    },
  };
}
