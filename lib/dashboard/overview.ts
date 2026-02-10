import { unstable_noStore as noStore } from 'next/cache';
import { getBillingStatus } from '@/lib/billing';
import type { DashboardFavoriteInfluencer } from '@/lib/db/queries/dashboard-queries';
import {
	getCampaignCountForDashboard,
	getFavoriteInfluencersForDashboard,
	getSearchTelemetryForDashboard,
} from '@/lib/db/queries/dashboard-queries';
import { getListsForUser } from '@/lib/db/queries/list-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

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
	campaignCount: number;
}

export interface DashboardOverviewData {
	favorites: DashboardFavorite[];
	recentLists: DashboardRecentList[];
	metrics: DashboardOverviewMetrics;
}

function normalizeRecentLists(
	lists: Awaited<ReturnType<typeof getListsForUser>>
): DashboardRecentList[] {
	return lists
		.filter((list) => !list.isArchived)
		.slice(0, 3)
		.map((list) => ({
			id: list.id,
			name: list.name,
			description: list.description,
			creatorCount: list.creatorCount,
			updatedAt: (list.updatedAt instanceof Date
				? list.updatedAt
				: new Date(list.updatedAt)
			).toISOString(),
			slug: list.slug ?? null,
		}));
}

export async function getDashboardOverview(clerkUserId: string): Promise<DashboardOverviewData> {
	noStore();
	const _overviewStart = Date.now();

	// NOTE: ensureUserProfile is already called by the dashboard page RSC before
	// getDashboardOverview, so we skip it here to avoid redundant DB + Clerk API calls.

	// Run queries with individual timing
	const _queryStart = Date.now();

	const results = await Promise.allSettled([
		getFavoriteInfluencersForDashboard(clerkUserId, 10),
		getListsForUser(clerkUserId),
		getSearchTelemetryForDashboard(clerkUserId),
		getBillingStatus(clerkUserId),
		getCampaignCountForDashboard(clerkUserId),
	]);

	// Extract values with safe fallbacks — never let a single query crash the page
	const favorites = results[0].status === 'fulfilled' ? results[0].value : [];
	const lists = results[1].status === 'fulfilled' ? results[1].value : [];
	const searchTelemetry =
		results[2].status === 'fulfilled'
			? results[2].value
			: { totalJobs: 0, completedJobs: 0, averageDurationMs: 0 };
	const planStatus = results[3].status === 'fulfilled' ? results[3].value : null;
	const campaignCount = results[4].status === 'fulfilled' ? results[4].value : 0;

	// Log any failures for debugging without crashing
	for (const [i, r] of results.entries()) {
		if (r.status === 'rejected') {
			structuredConsole.error(`[DASHBOARD] Query ${i} failed for ${clerkUserId}:`, r.reason);
		}
	}

	const normalizedLists = normalizeRecentLists(lists);
	const searchLimit = planStatus?.usageInfo?.creatorsLimit ?? null;
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
			campaignCount,
		},
	};
}
