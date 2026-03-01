#!/usr/bin/env npx tsx
/**
 * Usage TOCTOU Concurrency Smoke Test
 *
 * Proves (best-effort) that our "validate -> increment" flows no longer race past limits:
 * - Campaign creation: 2 concurrent requests at limit-1 should yield 1 success + 1 403.
 * - Creator usage: 2 concurrent saves at creatorsLimit-1 should insert + charge <= remaining.
 *
 * This script intentionally creates temporary DB records and cleans them up.
 *
 * Run:
 *   BASE_URL=http://localhost:3001 npx tsx scripts/tests/usage-toctou-concurrency.ts
 */

import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { createUser, updateUserProfile } from '@/lib/db/queries/user-queries';
import { campaigns, scrapingJobs, userUsage, users } from '@/lib/db/schema';
import { saveCreatorsToJob } from '@/lib/search-engine/v2/workers/save-creators';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

async function getUsageCounts(clerkUserId: string): Promise<{
	usageCampaignsCurrent: number;
	usageCreatorsCurrentMonth: number;
}> {
	const rows = await db
		.select({
			usageCampaignsCurrent: userUsage.usageCampaignsCurrent,
			usageCreatorsCurrentMonth: userUsage.usageCreatorsCurrentMonth,
		})
		.from(users)
		.innerJoin(userUsage, eq(userUsage.userId, users.id))
		.where(eq(users.userId, clerkUserId))
		.limit(1);

	const row = rows[0];
	assert(row, `Missing user_usage row for ${clerkUserId}`);
	return {
		usageCampaignsCurrent: row.usageCampaignsCurrent ?? 0,
		usageCreatorsCurrentMonth: row.usageCreatorsCurrentMonth ?? 0,
	};
}

async function cleanupTestData(clerkUserId: string) {
	// These tables use clerk user IDs (text) without FKs to normalized user tables,
	// so we must delete them explicitly.
	await db.delete(campaigns).where(eq(campaigns.userId, clerkUserId));
	await db.delete(scrapingJobs).where(eq(scrapingJobs.userId, clerkUserId));

	// Normalized user tables cascade-delete children (usage/subscriptions/billing/system data).
	await db.delete(users).where(eq(users.userId, clerkUserId));
}

async function createTestUser(clerkUserId: string) {
	await createUser({
		userId: clerkUserId,
		email: `${clerkUserId}@test.local`,
		fullName: 'Usage TOCTOU Test',
		onboardingStep: 'completed',
		currentPlan: 'glow_up',
		intendedPlan: 'glow_up',
	});

	// ValidateAccess requires subscription/trial + onboarding.
	// For this smoke script we force an active subscription state.
	await updateUserProfile(clerkUserId, {
		subscriptionStatus: 'active',
		onboardingStep: 'completed',
		currentPlan: 'glow_up',
		intendedPlan: 'glow_up',
	});
}

async function runCampaignConcurrencyTest(clerkUserId: string) {
	// glow_up has campaignsLimit=3; set usage to 2 so 1 slot remains.
	await updateUserProfile(clerkUserId, { usageCampaignsCurrent: 2 });

	const headers = {
		'content-type': 'application/json',
		'x-dev-auth': 'dev-bypass',
		'x-dev-user-id': clerkUserId,
	};

	const payloadA = JSON.stringify({
		name: `TOCTOU Campaign A ${Date.now()}`,
		description: 'concurrency test',
		searchType: 'keyword',
	});
	const payloadB = JSON.stringify({
		name: `TOCTOU Campaign B ${Date.now()}`,
		description: 'concurrency test',
		searchType: 'keyword',
	});

	const [resA, resB] = await Promise.allSettled([
		fetch(`${BASE_URL}/api/campaigns`, { method: 'POST', headers, body: payloadA }),
		fetch(`${BASE_URL}/api/campaigns`, { method: 'POST', headers, body: payloadB }),
	]);

	assert(resA.status === 'fulfilled', `Request A failed: ${String(resA)}`);
	assert(resB.status === 'fulfilled', `Request B failed: ${String(resB)}`);

	const statuses = [resA.value.status, resB.value.status].sort();
	// Expect exactly one success and one limit denial.
	assert(
		statuses[0] === 200 && statuses[1] === 403,
		`Expected statuses [200,403], got [${statuses.join(',')}]`
	);

	const usage = await getUsageCounts(clerkUserId);
	assert(usage.usageCampaignsCurrent === 3, `Expected usageCampaignsCurrent=3, got ${usage.usageCampaignsCurrent}`);
}

async function runCreatorConcurrencyTest(clerkUserId: string) {
	// glow_up has creatorsPerMonth=1000; set usage to 999 so 1 slot remains.
	await updateUserProfile(clerkUserId, { usageCreatorsCurrentMonth: 999 });

	const [job] = await db
		.insert(scrapingJobs)
		.values({
			userId: clerkUserId,
			status: 'processing',
			targetResults: 50,
		})
		.returning();

	assert(job?.id, 'Failed to create scraping job');

	const creatorsA = Array.from({ length: 10 }).map((_, i) => ({
		id: `a_${i}`,
		platform: 'tiktok',
		creator: { username: `toctou_a_${Date.now()}_${i}` },
		content: { id: `content_a_${i}` },
	}));

	const creatorsB = Array.from({ length: 10 }).map((_, i) => ({
		id: `b_${i}`,
		platform: 'tiktok',
		creator: { username: `toctou_b_${Date.now()}_${i}` },
		content: { id: `content_b_${i}` },
	}));

	const getKey = (c: any) => String(c?.creator?.username || c?.id || 'unknown');

	const [saveA, saveB] = await Promise.allSettled([
		saveCreatorsToJob(job.id, clerkUserId, creatorsA as any, getKey, 50, 'kw_a'),
		saveCreatorsToJob(job.id, clerkUserId, creatorsB as any, getKey, 50, 'kw_b'),
	]);

	assert(saveA.status === 'fulfilled', `Save A failed: ${saveA.status === 'rejected' ? String(saveA.reason) : ''}`);
	assert(saveB.status === 'fulfilled', `Save B failed: ${saveB.status === 'rejected' ? String(saveB.reason) : ''}`);

	const insertedTotal = saveA.value.newCount + saveB.value.newCount;
	assert(insertedTotal <= 1, `Expected insertedTotal<=1, got ${insertedTotal}`);

	const usage = await getUsageCounts(clerkUserId);
	assert(
		usage.usageCreatorsCurrentMonth === 1000,
		`Expected usageCreatorsCurrentMonth=1000, got ${usage.usageCreatorsCurrentMonth}`
	);

	const jobCreatorCountRows = await db.execute(
		sql<{ count: number }>`
			SELECT count(*)::int AS count
			FROM job_creators
			WHERE job_id = ${job.id}
		`
	);
	const jobCreatorCount = (jobCreatorCountRows as any)[0]?.count ?? 0;
	assert(jobCreatorCount <= 1, `Expected job_creators<=1, got ${jobCreatorCount}`);
}

async function main() {
	if (process.env.NODE_ENV === 'production') {
		throw new Error('Refusing to run usage TOCTOU concurrency test in production');
	}

	const testUserId = `user_usage_toctou_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

	console.log(`\n🧪 Usage TOCTOU Concurrency Smoke Test\n`);
	console.log(`BASE_URL: ${BASE_URL}`);
	console.log(`TEST_USER_ID: ${testUserId}`);

	try {
		await cleanupTestData(testUserId);
		await createTestUser(testUserId);

		console.log('\n1) Campaign concurrency test...');
		await runCampaignConcurrencyTest(testUserId);
		console.log('   ✅ Passed');

		console.log('\n2) Creator concurrency test...');
		await runCreatorConcurrencyTest(testUserId);
		console.log('   ✅ Passed');
	} finally {
		await cleanupTestData(testUserId);
	}

	console.log('\n✅ All usage TOCTOU concurrency checks passed.\n');
}

main().catch((error) => {
	console.error('\n❌ Usage TOCTOU concurrency test failed\n');
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
