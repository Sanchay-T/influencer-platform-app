import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { creatorListItems, creatorLists } from '@/lib/db/schema';
import {
	createTestCreatorProfile,
	createTestList,
	createTestUser,
} from '@/lib/test-utils/db-helpers';
import { addCreatorsToList, removeListItems } from './list-queries';

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------
let testUser: Awaited<ReturnType<typeof createTestUser>>;
let testList: Awaited<ReturnType<typeof createTestList>>;
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
	testUser = await createTestUser();
	cleanups.push(testUser.cleanup);

	testList = await createTestList(testUser.userId);
	cleanups.push(testList.cleanup);
});

afterAll(async () => {
	// Reverse order: list first, then user (cascade)
	for (const fn of cleanups.reverse()) {
		await fn();
	}
});

// ---------------------------------------------------------------------------
// Fix D: refreshListStats inside transaction
// ---------------------------------------------------------------------------
describe('removeListItems — stats stay consistent', () => {
	it('stats match actual item count after removal', async () => {
		// Create 3 creator profiles and add them to the list
		const profiles = await Promise.all([
			createTestCreatorProfile('instagram', { followers: 1000 }),
			createTestCreatorProfile('instagram', { followers: 2000 }),
			createTestCreatorProfile('instagram', { followers: 3000 }),
		]);
		for (const p of profiles) cleanups.push(p.cleanup);

		await addCreatorsToList(testUser.clerkId, testList.listId, [
			{ platform: 'instagram', externalId: profiles[0].externalId, handle: profiles[0].handle },
			{ platform: 'instagram', externalId: profiles[1].externalId, handle: profiles[1].handle },
			{ platform: 'instagram', externalId: profiles[2].externalId, handle: profiles[2].handle },
		]);

		// Get item IDs so we can remove one
		const items = await db
			.select({ id: creatorListItems.id })
			.from(creatorListItems)
			.where(eq(creatorListItems.listId, testList.listId));

		expect(items.length).toBe(3);

		// Remove the first item
		await removeListItems(testUser.clerkId, testList.listId, [items[0].id]);

		// Verify actual count in DB
		const [actual] = await db
			.select({ count: sql<number>`COUNT(${creatorListItems.id})` })
			.from(creatorListItems)
			.where(eq(creatorListItems.listId, testList.listId));

		// Verify cached stats on the list match
		const [list] = await db
			.select({ stats: creatorLists.stats })
			.from(creatorLists)
			.where(eq(creatorLists.id, testList.listId));

		const stats = list.stats as Record<string, unknown>;
		expect(Number(actual.count)).toBe(2);
		expect(Number(stats.creatorCount)).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Fix E: addCreatorsToList — Zod validation
// ---------------------------------------------------------------------------
describe('addCreatorsToList — input validation', () => {
	it('rejects empty platform', async () => {
		await expect(
			addCreatorsToList(testUser.clerkId, testList.listId, [
				{ platform: '', externalId: '123', handle: 'test' },
			])
		).rejects.toThrow();
	});

	it('rejects invalid platform', async () => {
		await expect(
			addCreatorsToList(testUser.clerkId, testList.listId, [
				{ platform: 'fakebook', externalId: '123', handle: 'test' },
			])
		).rejects.toThrow();
	});

	it('rejects empty externalId', async () => {
		await expect(
			addCreatorsToList(testUser.clerkId, testList.listId, [
				{ platform: 'instagram', externalId: '', handle: 'test' },
			])
		).rejects.toThrow();
	});

	it('accepts valid input', async () => {
		const profile = await createTestCreatorProfile('youtube', { followers: 500 });
		cleanups.push(profile.cleanup);

		const result = await addCreatorsToList(testUser.clerkId, testList.listId, [
			{ platform: 'youtube', externalId: profile.externalId, handle: profile.handle },
		]);

		expect(result.added).toBe(1);
		expect(result.attempted).toBe(1);
	});
});
