import { unstable_noStore as noStore } from 'next/cache';
import { getBillingStatus } from '@/lib/billing';
import type { DashboardFavoriteInfluencer } from '@/lib/db/queries/dashboard-queries';
import {
	getCampaignCountForDashboard,
	getFavoriteInfluencersForDashboard,
	getSearchTelemetryForDashboard,
} from '@/lib/db/queries/dashboard-queries';
import { getListsForUser } from '@/lib/db/queries/list-queries';
import { ensureUserProfile } from '@/lib/db/queries/user-queries';

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

	// Ensure normalized profile exists before downstream queries (first dashboard load happens pre-billing).
	const _ensureStart = Date.now();
	await ensureUserProfile(clerkUserId);

	// Run queries with individual timing
	const _queryStart = Date.now();

	const [favorites, lists, searchTelemetry, planStatus, campaignCount] = await Promise.all([
		getFavoriteInfluencersForDashboard(clerkUserId, 10).then((r) => {
			return r;
		}),
		getListsForUser(clerkUserId).then((r) => {
			return r;
		}),
		getSearchTelemetryForDashboard(clerkUserId).then((r) => {
			return r;
		}),
		getBillingStatus(clerkUserId).then((r) => {
			return r;
		}),
		getCampaignCountForDashboard(clerkUserId).then((r) => {
			return r;
		}),
	]);

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
