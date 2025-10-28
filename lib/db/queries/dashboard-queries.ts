import { and, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { db } from '../index';
import {
  creatorListCollaborators,
  creatorListItems,
  creatorLists,
  creatorProfiles,
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
    console.log(`⚠️ [DASHBOARD-QUERIES] User not found (likely new user): ${clerkUserId}`);
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

function favoriteListCondition() {
  const favoriteCondition = or(
    sql<boolean>`((${creatorLists.settings}->>'dashboardFavorite')::boolean IS TRUE)`,
    and(
      eq(creatorLists.type, 'favorites'),
      sql<boolean>`(${creatorLists.settings}->>'dashboardFavorite') IS NULL`
    )
  );

  return favoriteCondition;
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
        or(
          eq(creatorListItems.pinned, true),
          favoriteListCondition()
        ),
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

  const metadataObject = (metadata as Record<string, unknown>) ?? {};
  const metadataCandidates: Array<string | undefined> = [
    metadataObject.profileUrl as string | undefined,
    metadataObject.url as string | undefined,
    metadataObject.profile_link as string | undefined,
    metadataObject.profileLink as string | undefined,
    metadataObject.link as string | undefined,
    (metadataObject.creator as Record<string, unknown> | undefined)?.profileUrl as string | undefined,
    (metadataObject.creator as Record<string, unknown> | undefined)?.url as string | undefined,
  ];

  for (const candidate of metadataCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
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
    .where(
      and(
        eq(scrapingJobs.userId, clerkUserId),
        gte(scrapingJobs.createdAt, since)
      )
    );

  if (!jobs.length) {
    return { totalJobs: 0, completedJobs: 0, averageDurationMs: 0 };
  }

  let totalDuration = 0;
  let completedJobs = 0;
  for (const job of jobs) {
    const start = job.startedAt ?? job.createdAt;
    const end = job.completedAt;
    if (!start || !end) continue;
    const duration = end.getTime() - start.getTime();
    if (duration < 0) continue;
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
