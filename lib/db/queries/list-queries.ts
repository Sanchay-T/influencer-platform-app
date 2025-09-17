import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../index';
import {
  creatorListActivities,
  creatorListCollaborators,
  creatorListItems,
  creatorLists,
  creatorProfiles,
  listExports,
  users,
  type CreatorList,
  type CreatorListActivity,
  type CreatorListCollaborator,
  type CreatorListItem,
  type CreatorListPrivacy,
  type CreatorListRole,
  type CreatorListType,
  type CreatorProfile,
} from '../schema';

export type CreatorListSummary = CreatorList & {
  creatorCount: number;
  followerSum: number;
  collaboratorCount: number;
  viewerRole: CreatorListRole;
};

export type CreatorListDetail = {
  list: CreatorListSummary;
  items: Array<CreatorListItem & { creator: CreatorProfile }>;
  collaborators: CreatorListCollaborator[];
  activities: CreatorListActivity[];
};

export type CreateListInput = {
  name: string;
  description?: string | null;
  type?: CreatorListType;
  privacy?: CreatorListPrivacy;
  tags?: string[];
  settings?: Record<string, unknown>;
};

export type UpdateListInput = {
  name?: string;
  description?: string | null;
  type?: CreatorListType;
  privacy?: CreatorListPrivacy;
  tags?: string[];
  settings?: Record<string, unknown>;
  isArchived?: boolean;
};

export type CreatorInput = {
  platform: string;
  externalId: string;
  handle: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  url?: string | null;
  followers?: number | null;
  engagementRate?: number | null;
  category?: string | null;
  metadata?: Record<string, unknown>;
  metricsSnapshot?: Record<string, unknown>;
  bucket?: string;
  notes?: string | null;
  customFields?: Record<string, unknown>;
  pinned?: boolean;
};

export type ListItemUpdate = {
  id: string;
  position?: number;
  bucket?: string;
  notes?: string | null;
  pinned?: boolean;
};

export type CollaboratorInput = {
  userId?: string;
  inviteEmail?: string;
  role: CreatorListRole;
};

async function findInternalUser(clerkUserId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.userId, clerkUserId),
  });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  return user;
}

async function fetchAccessibleList(listId: string, internalUserId: string) {
  const list = await db.query.creatorLists.findFirst({
    where: eq(creatorLists.id, listId),
  });

  if (!list) {
    return null;
  }

  if (list.ownerId === internalUserId) {
    return { list, role: 'owner' as CreatorListRole };
  }

  const collaborator = await db.query.creatorListCollaborators.findFirst({
    where: and(
      eq(creatorListCollaborators.listId, listId),
      eq(creatorListCollaborators.userId, internalUserId),
      eq(creatorListCollaborators.status, 'accepted')
    ),
  });

  if (!collaborator) {
    return null;
  }

  return { list, role: collaborator.role as CreatorListRole };
}

function assertListRole(role: CreatorListRole, required: CreatorListRole | CreatorListRole[]) {
  const allowed = Array.isArray(required) ? required : [required];
  if (!allowed.includes(role)) {
    throw new Error('LIST_PERMISSION_DENIED');
  }
}

function buildStats(count: number, followerSum: number) {
  return {
    creatorCount: count,
    followerSum,
    updatedAt: new Date().toISOString(),
  };
}

async function refreshListStats(listId: string) {
  const [stats] = await db
    .select({
      creatorCount: sql<number>`COUNT(${creatorListItems.id})`,
      followerSum: sql<number>`COALESCE(SUM(${creatorProfiles.followers}), 0)`,
    })
    .from(creatorListItems)
    .leftJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
    .where(eq(creatorListItems.listId, listId));

  await db
    .update(creatorLists)
    .set({
      stats: buildStats(stats?.creatorCount ?? 0, stats?.followerSum ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(creatorLists.id, listId));
}

export async function getListsForUser(clerkUserId: string): Promise<CreatorListSummary[]> {
  const user = await findInternalUser(clerkUserId);
  const collaboratorSubquery = db
    .select({ listId: creatorListCollaborators.listId })
    .from(creatorListCollaborators)
    .where(
      and(
        eq(creatorListCollaborators.userId, user.id),
        eq(creatorListCollaborators.status, 'accepted')
      )
    );

  const rows = await db
    .select({
      list: creatorLists,
      creatorCount: sql<number>`COALESCE(COUNT(${creatorListItems.id}), 0)` ,
      followerSum: sql<number>`COALESCE(SUM(${creatorProfiles.followers}), 0)` ,
      collaboratorCount: sql<number>`COALESCE(COUNT(DISTINCT ${creatorListCollaborators.id}), 0)` ,
    })
    .from(creatorLists)
    .leftJoin(creatorListItems, eq(creatorListItems.listId, creatorLists.id))
    .leftJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
    .leftJoin(
      creatorListCollaborators,
      and(eq(creatorListCollaborators.listId, creatorLists.id), eq(creatorListCollaborators.status, 'accepted'))
    )
    .where(or(eq(creatorLists.ownerId, user.id), inArray(creatorLists.id, collaboratorSubquery)))
    .groupBy(creatorLists.id)
    .orderBy(desc(creatorLists.updatedAt));

  return rows.map((row) => ({
    ...row.list,
    creatorCount: Number(row.creatorCount ?? 0),
    followerSum: Number(row.followerSum ?? 0),
    collaboratorCount: Number(row.collaboratorCount ?? 0),
    viewerRole: row.list.ownerId === user.id ? 'owner' : 'viewer',
  }));
}

export async function getListDetail(clerkUserId: string, listId: string): Promise<CreatorListDetail> {
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }

  const [listRow] = await db
    .select({
      list: creatorLists,
      creatorCount: sql<number>`COALESCE(COUNT(${creatorListItems.id}), 0)` ,
      followerSum: sql<number>`COALESCE(SUM(${creatorProfiles.followers}), 0)` ,
      collaboratorCount: sql<number>`COALESCE(COUNT(DISTINCT ${creatorListCollaborators.id}), 0)` ,
    })
    .from(creatorLists)
    .leftJoin(creatorListItems, eq(creatorListItems.listId, creatorLists.id))
    .leftJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
    .leftJoin(
      creatorListCollaborators,
      and(eq(creatorListCollaborators.listId, creatorLists.id), eq(creatorListCollaborators.status, 'accepted'))
    )
    .where(eq(creatorLists.id, listId))
    .groupBy(creatorLists.id);

  if (!listRow) {
    throw new Error('LIST_NOT_FOUND');
  }

  const items = await db
    .select({
      item: creatorListItems,
      creator: creatorProfiles,
    })
    .from(creatorListItems)
    .innerJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
    .where(eq(creatorListItems.listId, listId))
    .orderBy(creatorListItems.bucket, creatorListItems.position, desc(creatorListItems.addedAt));

  const collaborators = await db
    .select()
    .from(creatorListCollaborators)
    .where(eq(creatorListCollaborators.listId, listId));

  const activities = await db
    .select()
    .from(creatorListActivities)
    .where(eq(creatorListActivities.listId, listId))
    .orderBy(desc(creatorListActivities.createdAt))
    .limit(50);

  return {
    list: {
      ...listRow.list,
      creatorCount: Number(listRow.creatorCount ?? 0),
      followerSum: Number(listRow.followerSum ?? 0),
      collaboratorCount: Number(listRow.collaboratorCount ?? 0),
      viewerRole: access.role,
    },
    items: items.map(({ item, creator }) => ({ ...item, creator })),
    collaborators,
    activities,
  };
}

export async function createList(clerkUserId: string, input: CreateListInput): Promise<CreatorListSummary> {
  const user = await findInternalUser(clerkUserId);
  const [list] = await db
    .insert(creatorLists)
    .values({
      ownerId: user.id,
      name: input.name,
      description: input.description ?? null,
      type: input.type ?? 'custom',
      privacy: input.privacy ?? 'private',
      tags: input.tags ?? [],
      settings: input.settings ?? {},
      stats: buildStats(0, 0),
    })
    .returning();

  await db.insert(creatorListActivities).values({
    listId: list.id,
    actorId: user.id,
    action: 'list_created',
    payload: {
      name: list.name,
    },
  });

  return {
    ...list,
    creatorCount: 0,
    followerSum: 0,
    collaboratorCount: 0,
    viewerRole: 'owner',
  };
}

export async function updateList(
  clerkUserId: string,
  listId: string,
  updates: UpdateListInput
): Promise<CreatorListSummary> {
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, ['owner', 'editor']);

  const [updated] = await db
    .update(creatorLists)
    .set({
      ...(updates.name ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.type ? { type: updates.type } : {}),
      ...(updates.privacy ? { privacy: updates.privacy } : {}),
      ...(updates.tags ? { tags: updates.tags } : {}),
      ...(updates.settings ? { settings: updates.settings } : {}),
      ...(updates.isArchived !== undefined ? { isArchived: updates.isArchived } : {}),
      updatedAt: new Date(),
    })
    .where(eq(creatorLists.id, listId))
    .returning();

  await db.insert(creatorListActivities).values({
    listId,
    actorId: user.id,
    action: 'list_updated',
    payload: updates,
  });

  const [stats] = await db
    .select({
      creatorCount: sql<number>`COALESCE(COUNT(${creatorListItems.id}), 0)` ,
      followerSum: sql<number>`COALESCE(SUM(${creatorProfiles.followers}), 0)` ,
      collaboratorCount: sql<number>`COALESCE(COUNT(DISTINCT ${creatorListCollaborators.id}), 0)` ,
    })
    .from(creatorLists)
    .leftJoin(creatorListItems, eq(creatorListItems.listId, creatorLists.id))
    .leftJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
    .leftJoin(
      creatorListCollaborators,
      and(eq(creatorListCollaborators.listId, creatorLists.id), eq(creatorListCollaborators.status, 'accepted'))
    )
    .where(eq(creatorLists.id, listId))
    .groupBy(creatorLists.id);

  return {
    ...updated,
    creatorCount: Number(stats?.creatorCount ?? 0),
    followerSum: Number(stats?.followerSum ?? 0),
    collaboratorCount: Number(stats?.collaboratorCount ?? 0),
    viewerRole: access.role,
  };
}

export async function deleteList(clerkUserId: string, listId: string) {
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, 'owner');

  console.debug('[LIST-DELETE] Starting removal', { listId, userId: user.id });
  try {
    await db.delete(creatorLists).where(eq(creatorLists.id, listId));
    console.debug('[LIST-DELETE] Base row removed', { listId });
  } catch (error) {
    console.error('[LIST-DELETE] Error during delete sequence', {
      listId,
      userId: user.id,
      message: (error as Error).message,
      code: (error as any)?.code,
      detail: (error as any)?.detail,
    });
    throw error;
  }
}

export async function duplicateList(clerkUserId: string, listId: string, name?: string) {
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, ['owner', 'editor']);

  return db.transaction(async (tx) => {
    const sourceList = await tx.query.creatorLists.findFirst({
      where: eq(creatorLists.id, listId),
    });
    if (!sourceList) {
      throw new Error('LIST_NOT_FOUND');
    }

    const [newList] = await tx
      .insert(creatorLists)
      .values({
        ownerId: user.id,
        name: name ?? `${sourceList.name} (Copy)`,
        description: sourceList.description,
        type: sourceList.type,
        privacy: sourceList.privacy,
        tags: sourceList.tags,
        settings: sourceList.settings,
        stats: buildStats(0, 0),
      })
      .returning();

    const items = await tx
      .select()
      .from(creatorListItems)
      .where(eq(creatorListItems.listId, listId));

    if (items.length) {
      await tx
        .insert(creatorListItems)
        .values(
          items.map((item) => ({
            listId: newList.id,
            creatorId: item.creatorId,
            position: item.position,
            bucket: item.bucket,
            addedBy: user.id,
            metricsSnapshot: item.metricsSnapshot,
            customFields: item.customFields,
            pinned: item.pinned,
            notes: item.notes,
          }))
        )
        .onConflictDoNothing({ target: [creatorListItems.listId, creatorListItems.creatorId] });
    }

    await tx.insert(creatorListActivities).values({
      listId: newList.id,
      actorId: user.id,
      action: 'list_duplicated',
      payload: { sourceListId: listId },
    });

    await refreshListStats(newList.id);

    const [stats] = await tx
      .select({
        creatorCount: sql<number>`COALESCE(COUNT(${creatorListItems.id}), 0)` ,
        followerSum: sql<number>`COALESCE(SUM(${creatorProfiles.followers}), 0)` ,
      })
      .from(creatorListItems)
      .leftJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
      .where(eq(creatorListItems.listId, newList.id));

    return {
      ...newList,
      creatorCount: Number(stats?.creatorCount ?? 0),
      followerSum: Number(stats?.followerSum ?? 0),
      collaboratorCount: 0,
      viewerRole: 'owner' as CreatorListRole,
    };
  });
}

async function upsertCreatorProfile(tx: typeof db, creator: CreatorInput) {
  const existing = await tx
    .select()
    .from(creatorProfiles)
    .where(and(eq(creatorProfiles.platform, creator.platform), eq(creatorProfiles.externalId, creator.externalId)))
    .limit(1);

  if (existing[0]) {
    const current = existing[0];
    const needsUpdate =
      (creator.displayName && creator.displayName !== current.displayName) ||
      (creator.avatarUrl && creator.avatarUrl !== current.avatarUrl) ||
      (creator.followers && creator.followers !== current.followers);

    if (needsUpdate) {
      const [updated] = await tx
        .update(creatorProfiles)
        .set({
          handle: creator.handle,
          displayName: creator.displayName ?? current.displayName,
          avatarUrl: creator.avatarUrl ?? current.avatarUrl,
          url: creator.url ?? current.url,
          followers: creator.followers ?? current.followers,
          engagementRate: creator.engagementRate ?? current.engagementRate,
          category: creator.category ?? current.category,
          metadata: { ...current.metadata, ...(creator.metadata ?? {}) },
          updatedAt: new Date(),
        })
        .where(eq(creatorProfiles.id, current.id))
        .returning();
      return updated;
    }
    return current;
  }

  const [profile] = await tx
    .insert(creatorProfiles)
    .values({
      platform: creator.platform,
      externalId: creator.externalId,
      handle: creator.handle,
      displayName: creator.displayName ?? null,
      avatarUrl: creator.avatarUrl ?? null,
      url: creator.url ?? null,
      followers: creator.followers ?? null,
      engagementRate: creator.engagementRate ?? null,
      category: creator.category ?? null,
      metadata: creator.metadata ?? {},
    })
    .returning();

  return profile;
}

export async function addCreatorsToList(
  clerkUserId: string,
  listId: string,
  creators: CreatorInput[]
) {
  if (!creators.length) return { added: 0 };
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, ['owner', 'editor']);

  const added = await db.transaction(async (tx) => {
    const [{ maxPosition }] = await tx
      .select({ maxPosition: sql<number>`COALESCE(MAX(${creatorListItems.position}), 0)` })
      .from(creatorListItems)
      .where(eq(creatorListItems.listId, listId));
    let cursor = Number(maxPosition ?? 0) + 1;

    let inserted = 0;
    for (const creator of creators) {
      const profile = await upsertCreatorProfile(tx, creator);
      const result = await tx
        .insert(creatorListItems)
        .values({
          listId,
          creatorId: profile.id,
          position: cursor++,
          bucket: creator.bucket ?? 'backlog',
          addedBy: user.id,
          notes: creator.notes ?? null,
          metricsSnapshot: creator.metricsSnapshot ?? {},
          customFields: creator.customFields ?? {},
          pinned: creator.pinned ?? false,
        })
        .onConflictDoNothing({ target: [creatorListItems.listId, creatorListItems.creatorId] })
        .returning();

      if (result.length) {
        inserted += 1;
      }
    }

    await refreshListStats(listId);
    await tx.insert(creatorListActivities).values({
      listId,
      actorId: user.id,
      action: 'creators_added',
      payload: { count: creators.length },
    });

    return inserted;
  });

  return { added };
}

export async function updateListItems(
  clerkUserId: string,
  listId: string,
  updates: ListItemUpdate[]
) {
  if (!updates.length) return;
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, ['owner', 'editor']);

  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx
        .update(creatorListItems)
        .set({
          ...(update.position !== undefined ? { position: update.position } : {}),
          ...(update.bucket ? { bucket: update.bucket } : {}),
          ...(update.notes !== undefined ? { notes: update.notes } : {}),
          ...(update.pinned !== undefined ? { pinned: update.pinned } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(creatorListItems.id, update.id), eq(creatorListItems.listId, listId)));
    }
    await refreshListStats(listId);
    await tx.insert(creatorListActivities).values({
      listId,
      actorId: user.id,
      action: 'list_items_updated',
      payload: { count: updates.length },
    });
  });
}

export async function removeListItems(clerkUserId: string, listId: string, itemIds: string[]) {
  if (!itemIds.length) return;
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, ['owner', 'editor']);

  await db.transaction(async (tx) => {
    await tx.delete(creatorListItems).where(and(eq(creatorListItems.listId, listId), inArray(creatorListItems.id, itemIds)));
    await refreshListStats(listId);
    await tx.insert(creatorListActivities).values({
      listId,
      actorId: user.id,
      action: 'list_items_removed',
      payload: { count: itemIds.length },
    });
  });
}

export async function manageCollaborators(
  clerkUserId: string,
  listId: string,
  collaborators: CollaboratorInput[]
) {
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, 'owner');

  await db.transaction(async (tx) => {
    for (const collaborator of collaborators) {
      if (collaborator.userId) {
        const invitee = await findInternalUser(collaborator.userId);
        await tx
          .insert(creatorListCollaborators)
          .values({
            listId,
            userId: invitee.id,
            role: collaborator.role,
            status: 'accepted',
            invitedBy: user.id,
          })
          .onConflictDoUpdate({
            target: [creatorListCollaborators.listId, creatorListCollaborators.userId],
            set: {
              role: collaborator.role,
              status: 'accepted',
              updatedAt: new Date(),
            },
          });
      } else if (collaborator.inviteEmail) {
        await tx
          .insert(creatorListCollaborators)
          .values({
            listId,
            inviteEmail: collaborator.inviteEmail,
            role: collaborator.role,
            status: 'pending',
            invitedBy: user.id,
          })
          .onConflictDoUpdate({
            target: [creatorListCollaborators.listId, creatorListCollaborators.inviteEmail],
            set: {
              role: collaborator.role,
              status: 'pending',
              invitedBy: user.id,
              updatedAt: new Date(),
            },
          });
      }
    }

    await tx.insert(creatorListActivities).values({
      listId,
      actorId: user.id,
      action: 'collaborators_updated',
      payload: { count: collaborators.length },
    });
  });
}

export async function recordExport(clerkUserId: string, listId: string, format: string) {
  const user = await findInternalUser(clerkUserId);
  const access = await fetchAccessibleList(listId, user.id);
  if (!access) {
    throw new Error('LIST_NOT_FOUND');
  }
  assertListRole(access.role, ['owner', 'editor']);

  const [exportRow] = await db
    .insert(listExports)
    .values({
      listId,
      requestedBy: user.id,
      format,
      status: 'queued',
    })
    .returning();

  await db.insert(creatorListActivities).values({
    listId,
    actorId: user.id,
    action: 'list_export_requested',
    payload: { exportId: exportRow.id, format },
  });

  return exportRow;
}
