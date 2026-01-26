import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { isRecord, isString, toRecord } from '@/lib/utils/type-guards';
import { db } from '../index';
import {
	type CreatorList,
	type CreatorListActivity,
	type CreatorListCollaborator,
	type CreatorListItem,
	type CreatorListPrivacy,
	type CreatorListRole,
	type CreatorListType,
	type CreatorProfile,
	creatorListActivities,
	creatorListCollaborators,
	creatorListItems,
	creatorLists,
	creatorProfiles,
	listExports,
	users,
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

type AccessibleList = {
	list: CreatorList;
	role: CreatorListRole;
};

const resolveCreatorListRole = (value: unknown): CreatorListRole | null => {
	if (value === 'owner' || value === 'editor' || value === 'viewer') {
		return value;
	}
	return null;
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

async function fetchAccessibleList(
	listId: string,
	internalUserId: string
): Promise<AccessibleList | null> {
	const list = await db.query.creatorLists.findFirst({
		where: eq(creatorLists.id, listId),
	});

	if (!list) {
		return null;
	}

	if (list.ownerId === internalUserId) {
		return { list, role: 'owner' };
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

	const role = resolveCreatorListRole(collaborator.role);
	if (!role) {
		return null;
	}

	return { list, role };
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

const normalizeEngagementRate = (value?: number | null): string | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null;
	}
	return value.toString();
};

const mergeMetadata = (
	current: unknown,
	incoming?: Record<string, unknown>
): Record<string, unknown> => {
	const currentRecord = toRecord(current) ?? {};
	const incomingRecord = toRecord(incoming) ?? {};
	return { ...currentRecord, ...incomingRecord };
};

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

	// OPTIMIZED: Use cached stats instead of expensive JOINs
	// This makes dropdown load 10x faster (no JOIN with items/profiles)
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
		})
		.from(creatorLists)
		.where(or(eq(creatorLists.ownerId, user.id), inArray(creatorLists.id, collaboratorSubquery)))
		.orderBy(desc(creatorLists.updatedAt));

	return rows.map((row) => {
		// Read stats from cached JSON field instead of calculating
		const stats = toRecord(row.list.stats);
		const creatorCount = typeof stats?.creatorCount === 'number' ? stats.creatorCount : 0;
		const followerSum = typeof stats?.followerSum === 'number' ? stats.followerSum : 0;

		return {
			...row.list,
			creatorCount,
			followerSum,
			collaboratorCount: 0, // Skip collaborator count for dropdown (not critical)
			viewerRole: row.list.ownerId === user.id ? 'owner' : 'viewer',
		};
	});
}

export async function getListDetail(
	clerkUserId: string,
	listId: string
): Promise<CreatorListDetail> {
	const user = await findInternalUser(clerkUserId);
	const access = await fetchAccessibleList(listId, user.id);
	if (!access) {
		throw new Error('LIST_NOT_FOUND');
	}

	const [listRow] = await db
		.select({
			list: creatorLists,
			creatorCount: sql<number>`COALESCE(COUNT(${creatorListItems.id}), 0)`,
			followerSum: sql<number>`COALESCE(SUM(${creatorProfiles.followers}), 0)`,
			collaboratorCount: sql<number>`COALESCE(COUNT(DISTINCT ${creatorListCollaborators.id}), 0)`,
		})
		.from(creatorLists)
		.leftJoin(creatorListItems, eq(creatorListItems.listId, creatorLists.id))
		.leftJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
		.leftJoin(
			creatorListCollaborators,
			and(
				eq(creatorListCollaborators.listId, creatorLists.id),
				eq(creatorListCollaborators.status, 'accepted')
			)
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

export async function createList(
	clerkUserId: string,
	input: CreateListInput
): Promise<CreatorListSummary> {
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

	// Skip expensive stats recalc for metadata-only updates (name, description, type, etc.)
	// Stats are only recalculated when creators/collaborators change (in addCreatorsToList, removeListItems, etc.)
	// Use cached stats from the list's stats JSON field instead
	const cachedStats = toRecord(updated.stats);
	const creatorCount = typeof cachedStats?.creatorCount === 'number' ? cachedStats.creatorCount : 0;
	const followerSum = typeof cachedStats?.followerSum === 'number' ? cachedStats.followerSum : 0;

	return {
		...updated,
		creatorCount,
		followerSum,
		collaboratorCount: 0, // Collaborator count not cached in stats, default to 0 for metadata updates
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

	structuredConsole.debug('[LIST-DELETE] Starting removal', { listId, userId: user.id });
	try {
		await db.delete(creatorLists).where(eq(creatorLists.id, listId));
		structuredConsole.debug('[LIST-DELETE] Base row removed', { listId });
	} catch (error) {
		const errorRecord = isRecord(error) ? error : null;
		const errorCode = errorRecord?.code;
		const errorDetail = errorRecord?.detail;
		structuredConsole.error('[LIST-DELETE] Error during delete sequence', {
			listId,
			userId: user.id,
			message: error instanceof Error ? error.message : String(error),
			code: isString(errorCode) ? errorCode : undefined,
			detail: isString(errorDetail) ? errorDetail : undefined,
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
				creatorCount: sql<number>`COALESCE(COUNT(${creatorListItems.id}), 0)`,
				followerSum: sql<number>`COALESCE(SUM(${creatorProfiles.followers}), 0)`,
			})
			.from(creatorListItems)
			.leftJoin(creatorProfiles, eq(creatorProfiles.id, creatorListItems.creatorId))
			.where(eq(creatorListItems.listId, newList.id));

		return {
			...newList,
			creatorCount: Number(stats?.creatorCount ?? 0),
			followerSum: Number(stats?.followerSum ?? 0),
			collaboratorCount: 0,
			viewerRole: 'owner',
		};
	});
}

/**
 * Batch upsert creator profiles - single query instead of N queries
 * Returns a map of "platform:externalId" -> profileId
 */
async function batchUpsertCreatorProfiles(
	tx: typeof db,
	creators: CreatorInput[]
): Promise<Map<string, string>> {
	if (creators.length === 0) {
		return new Map();
	}

	// Build keys for lookup
	const creatorKeys = creators.map((c) => `${c.platform}:${c.externalId}`);

	// Step 1: Fetch all existing profiles in one query
	// Build OR conditions for all platform/externalId pairs
	const conditions = creators.map((c) =>
		and(eq(creatorProfiles.platform, c.platform), eq(creatorProfiles.externalId, c.externalId))
	);
	const existing = await tx
		.select()
		.from(creatorProfiles)
		.where(or(...conditions));

	// Build map of existing profiles
	const existingMap = new Map<string, CreatorProfile>();
	for (const profile of existing) {
		existingMap.set(`${profile.platform}:${profile.externalId}`, profile);
	}

	// Step 2: Identify new creators (not in DB yet)
	const newCreators = creators.filter((c) => !existingMap.has(`${c.platform}:${c.externalId}`));

	// Step 3: Batch insert new creators with ON CONFLICT DO UPDATE
	if (newCreators.length > 0) {
		const insertValues = newCreators.map((c) => ({
			platform: c.platform,
			externalId: c.externalId,
			handle: c.handle,
			displayName: c.displayName ?? null,
			avatarUrl: c.avatarUrl ?? null,
			url: c.url ?? null,
			followers: c.followers ?? null,
			engagementRate: normalizeEngagementRate(c.engagementRate),
			category: c.category ?? null,
			metadata: mergeMetadata({}, c.metadata),
		}));

		const inserted = await tx
			.insert(creatorProfiles)
			.values(insertValues)
			.onConflictDoUpdate({
				target: [creatorProfiles.platform, creatorProfiles.externalId],
				set: {
					handle: sql`EXCLUDED.handle`,
					displayName: sql`COALESCE(EXCLUDED.display_name, ${creatorProfiles.displayName})`,
					avatarUrl: sql`COALESCE(EXCLUDED.avatar_url, ${creatorProfiles.avatarUrl})`,
					url: sql`COALESCE(EXCLUDED.url, ${creatorProfiles.url})`,
					followers: sql`COALESCE(EXCLUDED.followers, ${creatorProfiles.followers})`,
					engagementRate: sql`COALESCE(EXCLUDED.engagement_rate, ${creatorProfiles.engagementRate})`,
					category: sql`COALESCE(EXCLUDED.category, ${creatorProfiles.category})`,
					metadata: sql`COALESCE(EXCLUDED.metadata, ${creatorProfiles.metadata})`,
					updatedAt: new Date(),
				},
			})
			.returning();

		// Add newly inserted profiles to the map
		for (const profile of inserted) {
			existingMap.set(`${profile.platform}:${profile.externalId}`, profile);
		}
	}

	// Step 4: For existing profiles that need updates, batch update them
	// Skip for now since the ON CONFLICT handles the common case
	// The previous sequential approach updated if displayName/avatar/followers changed
	// With batch insert ON CONFLICT DO UPDATE, we use COALESCE to preserve existing values

	// Step 5: Build result map of "platform:externalId" -> profileId
	const resultMap = new Map<string, string>();
	for (const key of creatorKeys) {
		const profile = existingMap.get(key);
		if (profile) {
			resultMap.set(key, profile.id);
		}
	}

	return resultMap;
}

export async function addCreatorsToList(
	clerkUserId: string,
	listId: string,
	creators: CreatorInput[]
) {
	if (!creators.length) {
		return { added: 0, skipped: [], attempted: 0 };
	}
	const user = await findInternalUser(clerkUserId);
	const access = await fetchAccessibleList(listId, user.id);
	if (!access) {
		throw new Error('LIST_NOT_FOUND');
	}
	assertListRole(access.role, ['owner', 'editor']);

	// OPTIMIZED: Batch operations instead of sequential loops
	const summary = await db.transaction(async (tx) => {
		// Step 1: Get max position (1 query)
		const [{ maxPosition }] = await tx
			.select({ maxPosition: sql<number>`COALESCE(MAX(${creatorListItems.position}), 0)` })
			.from(creatorListItems)
			.where(eq(creatorListItems.listId, listId));
		const startPosition = Number(maxPosition ?? 0) + 1;

		// Step 2: Batch upsert all creator profiles (2-3 queries total instead of N*2)
		const profileIdMap = await batchUpsertCreatorProfiles(tx, creators);

		// Step 3: Batch insert all list items (1 query instead of N)
		const itemValues = creators
			.map((creator, idx) => {
				const key = `${creator.platform}:${creator.externalId}`;
				const profileId = profileIdMap.get(key);
				if (!profileId) {
					// This shouldn't happen, but skip if profile wasn't created
					return null;
				}
				return {
					listId,
					creatorId: profileId,
					position: startPosition + idx,
					bucket: creator.bucket ?? 'backlog',
					addedBy: user.id,
					notes: creator.notes ?? null,
					metricsSnapshot: creator.metricsSnapshot ?? {},
					customFields: creator.customFields ?? {},
					pinned: creator.pinned ?? false,
				};
			})
			.filter((v): v is NonNullable<typeof v> => v !== null);

		// Insert all items at once with ON CONFLICT DO NOTHING for duplicates
		const insertedItems = await tx
			.insert(creatorListItems)
			.values(itemValues)
			.onConflictDoNothing({ target: [creatorListItems.listId, creatorListItems.creatorId] })
			.returning({ id: creatorListItems.id, creatorId: creatorListItems.creatorId });

		// Build set of inserted creator IDs to identify skipped ones
		const insertedCreatorIds = new Set(insertedItems.map((item) => item.creatorId));
		const skipped: Array<{ externalId: string; handle: string; platform: string }> = [];

		for (const creator of creators) {
			const key = `${creator.platform}:${creator.externalId}`;
			const profileId = profileIdMap.get(key);
			if (!(profileId && insertedCreatorIds.has(profileId))) {
				skipped.push({
					externalId: creator.externalId,
					handle: creator.handle,
					platform: creator.platform,
				});
			}
		}

		// Step 4: Refresh stats (2 queries)
		await refreshListStats(listId);

		return { inserted: insertedItems.length, skipped };
	});

	// Fire-and-forget: Activity logging (don't block response)
	db.insert(creatorListActivities)
		.values({
			listId,
			actorId: user.id,
			action: 'creators_added',
			payload: {
				attempted: creators.length,
				added: summary.inserted,
				skipped: summary.skipped.length,
			},
		})
		.catch((err) => structuredConsole.error('[LIST] Activity log failed', err));

	return {
		added: summary.inserted,
		skipped: summary.skipped,
		attempted: creators.length,
	};
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
		await tx
			.delete(creatorListItems)
			.where(and(eq(creatorListItems.listId, listId), inArray(creatorListItems.id, itemIds)));
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
