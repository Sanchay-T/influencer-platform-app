import { and, count, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getRecordProperty, getStringProperty, isString, toRecord } from '@/lib/utils/type-guards';
import { db } from '../index';
import {
	campaigns,
	creatorListActivities,
	creatorListCollaborators,
	creatorListItems,
	creatorLists,
	creatorProfiles,
	jobCreators,
	scrapingJobs,
	users,
} from '../schema';

export type DashboardFavoriteInfluencer = {
	id: string;
	displayName: string;
	handle: string | null;
	category: string | null;
	platform: string;
	followers: number | null;
	avatarUrl: string | null;
	listName: string | null;
	pinned: boolean;
	profileUrl: string | null;
};

type SearchTelemetrySummary = {
	totalJobs: number;
	completedJobs: number;
	averageDurationMs: number;
};

// Shared with dashboard overview API to translate Clerk user -> internal id
async function resolveInternalUserId(clerkUserId: string): Promise<string | null> {
	const user = await db.query.users.findFirst({
		where: eq(users.userId, clerkUserId),
	});

	if (!user) {
		// Return null instead of throwing - let caller handle gracefully
		structuredConsole.log(`⚠️ [DASHBOARD-QUERIES] User not found (likely new user): ${clerkUserId}`);
		return null;
	}

	return user.id;
}

function accessibleListFilter(userId: string) {
	const collaboratorSubquery = db
		.select({ listId: creatorListCollaborators.listId })
		.from(creatorListCollaborators)
		.where(
			and(
				eq(creatorListCollaborators.userId, userId),
				eq(creatorListCollaborators.status, 'accepted')
			)
		);

	return or(eq(creatorLists.ownerId, userId), inArray(creatorLists.id, collaboratorSubquery));
}

// Consumed by app/api/dashboard/overview/route.ts to hydrate dashboard favorites
export async function getFavoriteInfluencersForDashboard(
	clerkUserId: string,
	limit = 10
): Promise<DashboardFavoriteInfluencer[]> {
	const internalUserId = await resolveInternalUserId(clerkUserId);

	// If user not found (new user, webhook pending), return empty array
	if (!internalUserId) {
		return [];
	}

	const rows = await db
		.select({
			itemId: creatorListItems.id,
			listName: creatorLists.name,
			pinned: creatorListItems.pinned,
			updatedAt: creatorListItems.updatedAt,
			displayName: creatorProfiles.displayName,
			handle: creatorProfiles.handle,
			category: creatorProfiles.category,
			platform: creatorProfiles.platform,
			followers: creatorProfiles.followers,
			avatarUrl: creatorProfiles.avatarUrl,
			profileUrl: creatorProfiles.url,
			metadata: creatorProfiles.metadata,
		})
		.from(creatorListItems)
		.leftJoin(creatorLists, eq(creatorListItems.listId, creatorLists.id))
		.leftJoin(creatorProfiles, eq(creatorListItems.creatorId, creatorProfiles.id))
		.where(
			and(
				eq(creatorLists.isArchived, false),
				eq(creatorListItems.pinned, true),
				accessibleListFilter(internalUserId)
			)
		)
		.orderBy(desc(creatorListItems.pinned), desc(creatorListItems.updatedAt))
		.limit(limit);

	return rows
		.filter((row) => Boolean(row.itemId) && Boolean(row.displayName))
		.map((row) => ({
			id: row.itemId,
			displayName: row.displayName ?? 'Unknown creator',
			handle: row.handle ?? null,
			category: row.category ?? null,
			platform: (row.platform ?? 'unknown').toLowerCase(),
			followers: row.followers ?? null,
			avatarUrl: row.avatarUrl ?? null,
			listName: row.listName ?? null,
			pinned: row.pinned ?? false,
			profileUrl: resolveProfileUrl(row.profileUrl, row.handle, row.platform, row.metadata),
		}));
}

function resolveProfileUrl(
	storedUrl: string | null | undefined,
	handle: string | null | undefined,
	platform: string | null | undefined,
	metadata: unknown
) {
	if (typeof storedUrl === 'string' && storedUrl.trim().length > 0) {
		return storedUrl.trim();
	}

	const metadataObject = toRecord(metadata) ?? {};
	const metadataCreator = getRecordProperty(metadataObject, 'creator');
	const metadataCandidates: Array<string | null | undefined> = [
		getStringProperty(metadataObject, 'profileUrl'),
		getStringProperty(metadataObject, 'url'),
		getStringProperty(metadataObject, 'profile_link'),
		getStringProperty(metadataObject, 'profileLink'),
		getStringProperty(metadataObject, 'link'),
		getStringProperty(metadataCreator ?? {}, 'profileUrl'),
		getStringProperty(metadataCreator ?? {}, 'url'),
	];

	for (const candidate of metadataCandidates) {
		if (isString(candidate) && candidate.trim().length > 0) {
			return candidate.trim();
		}
	}

	const normalizedHandle = (handle ?? '').replace(/^@/, '').trim();
	if (!normalizedHandle) {
		return null;
	}

	const normalizedPlatform = (platform ?? '').toLowerCase();
	switch (normalizedPlatform) {
		case 'tiktok':
			return `https://www.tiktok.com/@${normalizedHandle}`;
		case 'instagram':
			return `https://www.instagram.com/${normalizedHandle}`;
		case 'youtube':
			return `https://www.youtube.com/@${normalizedHandle}`;
		default:
			return null;
	}
}

// Dashboard overview → quick search telemetry summary for 30 day window
export async function getSearchTelemetryForDashboard(
	clerkUserId: string,
	lookbackDays = 30
): Promise<SearchTelemetrySummary> {
	const since = new Date();
	since.setDate(since.getDate() - lookbackDays);

	const jobs = await db
		.select({
			createdAt: scrapingJobs.createdAt,
			startedAt: scrapingJobs.startedAt,
			completedAt: scrapingJobs.completedAt,
		})
		.from(scrapingJobs)
		.where(and(eq(scrapingJobs.userId, clerkUserId), gte(scrapingJobs.createdAt, since)));

	if (!jobs.length) {
		return { totalJobs: 0, completedJobs: 0, averageDurationMs: 0 };
	}

	let totalDuration = 0;
	let completedJobs = 0;
	for (const job of jobs) {
		const start = job.startedAt ?? job.createdAt;
		const end = job.completedAt;
		if (!(start && end)) {
			continue;
		}
		const duration = end.getTime() - start.getTime();
		if (duration < 0) {
			continue;
		}
		totalDuration += duration;
		completedJobs += 1;
	}

	const averageDurationMs = completedJobs ? totalDuration / completedJobs : 0;
	return {
		totalJobs: jobs.length,
		completedJobs,
		averageDurationMs,
	};
}

// Dashboard overview → campaign count for empty state detection
export async function getCampaignCountForDashboard(clerkUserId: string): Promise<number> {
	const result = await db
		.select({ count: count() })
		.from(campaigns)
		.where(eq(campaigns.userId, clerkUserId));

	return result[0]?.count ?? 0;
}

// Dashboard overview → pipeline bucket counts (backlog/shortlist/contacted/booked)
export async function getPipelineSummaryForDashboard(clerkUserId: string) {
	const internalUserId = await resolveInternalUserId(clerkUserId);
	if (!internalUserId) {
		return { total: 0, backlog: 0, shortlist: 0, contacted: 0, booked: 0 };
	}

	const rows = await db
		.select({
			bucket: creatorListItems.bucket,
			count: count(),
		})
		.from(creatorListItems)
		.innerJoin(creatorLists, eq(creatorListItems.listId, creatorLists.id))
		.where(and(eq(creatorLists.isArchived, false), accessibleListFilter(internalUserId)))
		.groupBy(creatorListItems.bucket);

	const buckets: Record<string, number> = {};
	for (const row of rows) {
		buckets[row.bucket] = row.count;
	}

	const backlog = buckets.backlog ?? 0;
	const shortlist = buckets.shortlist ?? 0;
	const contacted = buckets.contacted ?? 0;
	const booked = buckets.booked ?? 0;

	return { total: backlog + shortlist + contacted + booked, backlog, shortlist, contacted, booked };
}

// Dashboard overview → campaign count + search count + creators discovered
export async function getCampaignStatsForDashboard(clerkUserId: string) {
	const [campaignResult, jobResult] = await Promise.all([
		db.select({ count: count() }).from(campaigns).where(eq(campaigns.userId, clerkUserId)),
		db
			.select({
				totalSearches: count(),
				totalCreatorsDiscovered: sql<number>`coalesce(sum(${scrapingJobs.creatorsFound}), 0)`,
			})
			.from(scrapingJobs)
			.where(eq(scrapingJobs.userId, clerkUserId)),
	]);

	return {
		totalCampaigns: campaignResult[0]?.count ?? 0,
		totalSearches: jobResult[0]?.totalSearches ?? 0,
		totalCreatorsDiscovered: Number(jobResult[0]?.totalCreatorsDiscovered ?? 0),
	};
}

// Dashboard overview → platform distribution across searches
export async function getPlatformBreakdownForDashboard(clerkUserId: string) {
	const rows = await db
		.select({
			platform: sql<string>`lower(${scrapingJobs.platform})`,
			count: count(),
		})
		.from(scrapingJobs)
		.where(eq(scrapingJobs.userId, clerkUserId))
		.groupBy(sql`lower(${scrapingJobs.platform})`)
		.orderBy(desc(count()));

	return rows.map((r) => ({ platform: r.platform, count: r.count }));
}

// Dashboard overview → top searched keywords
export async function getTopKeywordsForDashboard(clerkUserId: string, limit = 8) {
	const rows = await db
		.select({
			keyword: jobCreators.keyword,
			count: count(),
		})
		.from(jobCreators)
		.innerJoin(scrapingJobs, eq(jobCreators.jobId, scrapingJobs.id))
		.where(and(eq(scrapingJobs.userId, clerkUserId), sql`${jobCreators.keyword} is not null`))
		.groupBy(jobCreators.keyword)
		.orderBy(desc(count()))
		.limit(limit);

	return rows
		.filter((r): r is typeof r & { keyword: string } => r.keyword !== null)
		.map((r) => ({ keyword: r.keyword, count: r.count }));
}

// Dashboard overview → recent list activity log
export async function getRecentActivityForDashboard(clerkUserId: string, limit = 10) {
	const internalUserId = await resolveInternalUserId(clerkUserId);
	if (!internalUserId) {
		return [];
	}

	const rows = await db
		.select({
			id: creatorListActivities.id,
			action: creatorListActivities.action,
			payload: creatorListActivities.payload,
			listId: creatorListActivities.listId,
			listName: creatorLists.name,
			listSlug: creatorLists.slug,
			createdAt: creatorListActivities.createdAt,
		})
		.from(creatorListActivities)
		.innerJoin(creatorLists, eq(creatorListActivities.listId, creatorLists.id))
		.where(and(eq(creatorLists.isArchived, false), accessibleListFilter(internalUserId)))
		.orderBy(desc(creatorListActivities.createdAt))
		.limit(limit);

	return rows.map((r) => ({
		id: r.id,
		action: r.action,
		payload: toRecord(r.payload) ?? {},
		listId: r.listId,
		listName: r.listName,
		listSlug: r.listSlug ?? null,
		createdAt: r.createdAt,
	}));
}
