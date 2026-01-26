#!/usr/bin/env tsx
/**
 * Benchmark: Old stats query (4-table JOIN) vs New approach (cached stats)
 *
 * This measures the actual database performance difference between:
 * - OLD: Running a 4-table JOIN with COUNT/SUM aggregations on every metadata update
 * - NEW: Reading from the cached stats JSON field
 *
 * Usage: npx tsx scripts/benchmark-stats-query.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../lib/db';
import { creatorLists, creatorListItems, creatorProfiles, creatorListCollaborators } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

const NUM_ITERATIONS = 20;

interface BenchmarkResult {
	name: string;
	avg: number;
	min: number;
	max: number;
	p50: number;
	p95: number;
	times: number[];
}

function calculateStats(times: number[], name: string): BenchmarkResult {
	const avg = times.reduce((a, b) => a + b, 0) / times.length;
	const min = Math.min(...times);
	const max = Math.max(...times);
	const sorted = [...times].sort((a, b) => a - b);
	const p50 = sorted[Math.floor(sorted.length * 0.5)];
	const p95 = sorted[Math.floor(sorted.length * 0.95)];
	return { name, avg, min, max, p50, p95, times };
}

async function benchmarkOldStatsQuery(listId: string): Promise<BenchmarkResult> {
	const times: number[] = [];

	console.log('\n📊 Benchmarking OLD approach (4-table JOIN with aggregations)...');

	for (let i = 0; i < NUM_ITERATIONS; i++) {
		const start = performance.now();

		// This is the OLD query that ran on every metadata update
		const [stats] = await db
			.select({
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

		const end = performance.now();
		const duration = end - start;
		times.push(duration);

		if (i < 5 || i === NUM_ITERATIONS - 1) {
			console.log(`   Iteration ${i + 1}: ${duration.toFixed(2)}ms (creatorCount: ${stats?.creatorCount ?? 0})`);
		} else if (i === 5) {
			console.log('   ...');
		}
	}

	return calculateStats(times, 'OLD (4-table JOIN)');
}

async function benchmarkNewCachedStats(listId: string): Promise<BenchmarkResult> {
	const times: number[] = [];

	console.log('\n📊 Benchmarking NEW approach (cached stats lookup)...');

	for (let i = 0; i < NUM_ITERATIONS; i++) {
		const start = performance.now();

		// This is the NEW approach - just read the list's cached stats
		const list = await db.query.creatorLists.findFirst({
			where: eq(creatorLists.id, listId),
			columns: {
				stats: true,
			},
		});

		const cachedStats = list?.stats as Record<string, unknown> | null;
		const creatorCount = typeof cachedStats?.creatorCount === 'number' ? cachedStats.creatorCount : 0;
		const followerSum = typeof cachedStats?.followerSum === 'number' ? cachedStats.followerSum : 0;

		const end = performance.now();
		const duration = end - start;
		times.push(duration);

		if (i < 5 || i === NUM_ITERATIONS - 1) {
			console.log(`   Iteration ${i + 1}: ${duration.toFixed(2)}ms (creatorCount: ${creatorCount})`);
		} else if (i === 5) {
			console.log('   ...');
		}
	}

	return calculateStats(times, 'NEW (cached stats)');
}

async function main() {
	console.log('🔍 Finding a list to benchmark against...');

	// Find any list with some creators to make the benchmark realistic
	const lists = await db.query.creatorLists.findMany({
		limit: 5,
		orderBy: (lists, { desc }) => [desc(lists.createdAt)],
	});

	if (lists.length === 0) {
		console.error('❌ No lists found in database');
		process.exit(1);
	}

	// Pick the first list
	const testList = lists[0];
	console.log(`   Using list: "${testList.name}" (${testList.id})`);

	// Count items in this list
	const [itemCount] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(creatorListItems)
		.where(eq(creatorListItems.listId, testList.id));
	console.log(`   List has ${itemCount?.count ?? 0} creator items\n`);

	// Run benchmarks
	const oldResult = await benchmarkOldStatsQuery(testList.id);
	const newResult = await benchmarkNewCachedStats(testList.id);

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('📈 BENCHMARK RESULTS');
	console.log('='.repeat(60));

	console.log(`\n${oldResult.name}:`);
	console.log(`   Average: ${oldResult.avg.toFixed(2)}ms`);
	console.log(`   Min:     ${oldResult.min.toFixed(2)}ms`);
	console.log(`   Max:     ${oldResult.max.toFixed(2)}ms`);
	console.log(`   P50:     ${oldResult.p50.toFixed(2)}ms`);
	console.log(`   P95:     ${oldResult.p95.toFixed(2)}ms`);

	console.log(`\n${newResult.name}:`);
	console.log(`   Average: ${newResult.avg.toFixed(2)}ms`);
	console.log(`   Min:     ${newResult.min.toFixed(2)}ms`);
	console.log(`   Max:     ${newResult.max.toFixed(2)}ms`);
	console.log(`   P50:     ${newResult.p50.toFixed(2)}ms`);
	console.log(`   P95:     ${newResult.p95.toFixed(2)}ms`);

	const improvement = ((oldResult.avg - newResult.avg) / oldResult.avg) * 100;
	const speedup = oldResult.avg / newResult.avg;

	console.log('\n' + '-'.repeat(60));
	console.log(`🚀 Network-level Performance:`);
	console.log(`   ${improvement.toFixed(1)}% faster (${speedup.toFixed(1)}x speedup)`);
	console.log(`   Saved ${(oldResult.avg - newResult.avg).toFixed(2)}ms per request`);
	console.log('-'.repeat(60));

	// Run EXPLAIN ANALYZE to show database-level performance
	console.log('\n📊 DATABASE-LEVEL METRICS (EXPLAIN ANALYZE):\n');

	const oldQueryPlan = await db.execute(sql`
		EXPLAIN ANALYZE
		SELECT
			COALESCE(COUNT(${creatorListItems.id}), 0) as creator_count,
			COALESCE(SUM(${creatorProfiles.followers}), 0) as follower_sum,
			COALESCE(COUNT(DISTINCT ${creatorListCollaborators.id}), 0) as collaborator_count
		FROM ${creatorLists}
		LEFT JOIN ${creatorListItems} ON ${creatorListItems.listId} = ${creatorLists.id}
		LEFT JOIN ${creatorProfiles} ON ${creatorProfiles.id} = ${creatorListItems.creatorId}
		LEFT JOIN ${creatorListCollaborators} ON ${creatorListCollaborators.listId} = ${creatorLists.id} AND ${creatorListCollaborators.status} = 'accepted'
		WHERE ${creatorLists.id} = ${testList.id}
		GROUP BY ${creatorLists.id}
	`);

	const newQueryPlan = await db.execute(sql`
		EXPLAIN ANALYZE
		SELECT stats
		FROM ${creatorLists}
		WHERE ${creatorLists.id} = ${testList.id}
	`);

	// Extract timing from query plans
	const oldPlanRows = oldQueryPlan as unknown as { 'QUERY PLAN': string }[];
	const newPlanRows = newQueryPlan as unknown as { 'QUERY PLAN': string }[];

	let oldPlanningTime = 0, oldExecTime = 0;
	let newPlanningTime = 0, newExecTime = 0;

	for (const row of oldPlanRows) {
		const plan = row['QUERY PLAN'];
		if (plan.includes('Planning Time:')) {
			oldPlanningTime = parseFloat(plan.match(/Planning Time: ([\d.]+)/)?.[1] ?? '0');
		}
		if (plan.includes('Execution Time:')) {
			oldExecTime = parseFloat(plan.match(/Execution Time: ([\d.]+)/)?.[1] ?? '0');
		}
	}

	for (const row of newPlanRows) {
		const plan = row['QUERY PLAN'];
		if (plan.includes('Planning Time:')) {
			newPlanningTime = parseFloat(plan.match(/Planning Time: ([\d.]+)/)?.[1] ?? '0');
		}
		if (plan.includes('Execution Time:')) {
			newExecTime = parseFloat(plan.match(/Execution Time: ([\d.]+)/)?.[1] ?? '0');
		}
	}

	const oldTotal = oldPlanningTime + oldExecTime;
	const newTotal = newPlanningTime + newExecTime;
	const dbSpeedup = oldTotal / newTotal;

	console.log('OLD (4-table JOIN):');
	console.log(`   Planning:  ${oldPlanningTime.toFixed(3)} ms`);
	console.log(`   Execution: ${oldExecTime.toFixed(3)} ms`);
	console.log(`   Total:     ${oldTotal.toFixed(3)} ms`);

	console.log('\nNEW (cached stats):');
	console.log(`   Planning:  ${newPlanningTime.toFixed(3)} ms`);
	console.log(`   Execution: ${newExecTime.toFixed(3)} ms`);
	console.log(`   Total:     ${newTotal.toFixed(3)} ms`);

	console.log('\n' + '='.repeat(60));
	console.log(`🎯 DATABASE SPEEDUP: ${dbSpeedup.toFixed(1)}x faster`);
	console.log(`   (Network latency ~${oldResult.avg.toFixed(0)}ms dominates, DB diff is ${(oldTotal - newTotal).toFixed(2)}ms)`);
	console.log('='.repeat(60) + '\n');

	process.exit(0);
}

main().catch((err) => {
	console.error('❌ Benchmark failed:', err);
	process.exit(1);
});
