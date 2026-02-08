/**
 * Real-DB test helpers.
 *
 * Each factory inserts rows into the real dev DB and returns a cleanup()
 * that removes them. Call cleanup in afterEach / afterAll.
 */

import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
	campaigns,
	creatorListItems,
	creatorLists,
	creatorProfiles,
	userSubscriptions,
	users,
	userUsage,
} from '@/lib/db/schema';

function testId() {
	return `test_${crypto.randomUUID().slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function createTestUser(overrides: { clerkId?: string; plan?: string } = {}) {
	const clerkId = overrides.clerkId ?? `clerk_${testId()}`;

	const [user] = await db
		.insert(users)
		.values({
			userId: clerkId,
			email: `${clerkId}@test.gemz.io`,
			fullName: 'Test User',
			onboardingStep: 'completed',
		})
		.returning();

	// Create subscription row
	await db.insert(userSubscriptions).values({
		userId: user.id,
		currentPlan: overrides.plan ?? 'glow_up',
		subscriptionStatus: 'active',
	});

	// Create usage row
	await db.insert(userUsage).values({
		userId: user.id,
		usageCampaignsCurrent: 0,
		usageCreatorsCurrentMonth: 0,
		enrichmentsCurrentMonth: 0,
		usageResetDate: new Date(),
	});

	const cleanup = async () => {
		// Cascade deletes subscriptions, usage, system data
		await db.delete(users).where(eq(users.id, user.id));
	};

	return { userId: user.id, clerkId, cleanup };
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function createTestCampaign(clerkUserId: string) {
	const [campaign] = await db
		.insert(campaigns)
		.values({
			userId: clerkUserId,
			name: `Test Campaign ${testId()}`,
			description: 'Auto-created by test',
			searchType: 'keyword',
			status: 'draft',
		})
		.returning();

	const cleanup = async () => {
		await db.delete(campaigns).where(eq(campaigns.id, campaign.id));
	};

	return { campaignId: campaign.id, cleanup };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function createTestList(ownerId: string) {
	const [list] = await db
		.insert(creatorLists)
		.values({
			ownerId,
			name: `Test List ${testId()}`,
			type: 'custom',
			privacy: 'private',
			tags: [],
			settings: {},
			stats: { creatorCount: 0, followerSum: 0 },
		})
		.returning();

	const cleanup = async () => {
		// Items + activities cascade from list
		await db.delete(creatorLists).where(eq(creatorLists.id, list.id));
	};

	return { listId: list.id, cleanup };
}

// ---------------------------------------------------------------------------
// Creator profiles (for list tests)
// ---------------------------------------------------------------------------

export async function createTestCreatorProfile(
	platform: string = 'instagram',
	overrides: { externalId?: string; handle?: string; followers?: number } = {}
) {
	const externalId = overrides.externalId ?? testId();
	const handle = overrides.handle ?? `handle_${externalId}`;

	const [profile] = await db
		.insert(creatorProfiles)
		.values({
			platform,
			externalId,
			handle,
			displayName: handle,
			followers: overrides.followers ?? 10000,
			metadata: {},
		})
		.returning();

	const cleanup = async () => {
		// Delete items referencing this profile first
		await db.delete(creatorListItems).where(eq(creatorListItems.creatorId, profile.id));
		await db.delete(creatorProfiles).where(eq(creatorProfiles.id, profile.id));
	};

	return { profileId: profile.id, externalId, handle, cleanup };
}

// ---------------------------------------------------------------------------
// Usage helpers
// ---------------------------------------------------------------------------

export async function getUserUsage(internalUserId: string) {
	const [row] = await db.select().from(userUsage).where(eq(userUsage.userId, internalUserId));
	return row ?? null;
}

export async function setUserUsage(
	internalUserId: string,
	updates: {
		usageCampaignsCurrent?: number;
		usageCreatorsCurrentMonth?: number;
		enrichmentsCurrentMonth?: number;
	}
) {
	await db
		.update(userUsage)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(userUsage.userId, internalUserId));
}

// ---------------------------------------------------------------------------
// Smoke test helper
// ---------------------------------------------------------------------------

export async function dbPing(): Promise<boolean> {
	const [result] = await db.execute(sql`SELECT 1 AS ok`);
	return (result as Record<string, unknown>)?.ok === 1;
}
