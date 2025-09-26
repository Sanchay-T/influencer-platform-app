import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../index';
import {
  creatorListCollaborators,
  creatorListItems,
  creatorLists,
  creatorProfiles,
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
};

// Shared with dashboard overview API to translate Clerk user -> internal id
async function resolveInternalUserId(clerkUserId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.userId, clerkUserId),
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  return user.id;
}

function nonArchivedFavoritesFilter(userId: string) {
  const collaboratorSubquery = db
    .select({ listId: creatorListCollaborators.listId })
    .from(creatorListCollaborators)
    .where(
      and(
        eq(creatorListCollaborators.userId, userId),
        eq(creatorListCollaborators.status, 'accepted')
      )
    );

  const favoriteCondition = or(
    sql<boolean>`((${creatorLists.settings}->>'dashboardFavorite')::boolean IS TRUE)`,
    and(
      eq(creatorLists.type, 'favorites'),
      sql<boolean>`(${creatorLists.settings}->>'dashboardFavorite') IS NULL`
    )
  );

  return and(
    eq(creatorLists.isArchived, false),
    favoriteCondition,
    or(eq(creatorLists.ownerId, userId), inArray(creatorLists.id, collaboratorSubquery))
  );
}

// Consumed by app/api/dashboard/overview/route.ts to hydrate dashboard favorites
export async function getFavoriteInfluencersForDashboard(
  clerkUserId: string,
  limit = 10
): Promise<DashboardFavoriteInfluencer[]> {
  const internalUserId = await resolveInternalUserId(clerkUserId);

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
    })
    .from(creatorListItems)
    .leftJoin(creatorLists, eq(creatorListItems.listId, creatorLists.id))
    .leftJoin(creatorProfiles, eq(creatorListItems.creatorId, creatorProfiles.id))
    .where(nonArchivedFavoritesFilter(internalUserId))
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
    }));
}
