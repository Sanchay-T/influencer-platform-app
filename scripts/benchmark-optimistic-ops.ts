#!/usr/bin/env tsx
/**
 * Benchmark script for list operations API performance
 * Measures Create, Delete, and Update operations to establish baseline latencies
 *
 * Usage: npx tsx scripts/benchmark-optimistic-ops.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import {
	setupClerkTestUser,
	cleanupClerkTestUser,
	buildClerkAuthHeaders,
} from '../testing/api-suite/lib/clerk-auth';

const BASE_URL = process.env.SESSION_BASE_URL || 'http://localhost:3001';
const NUM_REQUESTS = 5;

interface BenchmarkResult {
	operation: string;
	avg: number;
	min: number;
	max: number;
	p50: number;
	p95: number;
	times: number[];
}

function calculateStats(times: number[]): Omit<BenchmarkResult, 'operation' | 'times'> {
	const avg = times.reduce((a, b) => a + b, 0) / times.length;
	const min = Math.min(...times);
	const max = Math.max(...times);
	const sorted = [...times].sort((a, b) => a - b);
	const p50 = sorted[Math.floor(sorted.length * 0.5)];
	const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
	return { avg, min, max, p50, p95 };
}

async function benchmarkCreate(
	headers: Record<string, string>
): Promise<{ result: BenchmarkResult; listIds: string[] }> {
	const times: number[] = [];
	const listIds: string[] = [];

	console.log(`\n📝 Benchmarking CREATE (${NUM_REQUESTS} requests)`);
	console.log(`   Endpoint: POST ${BASE_URL}/api/lists\n`);

	for (let i = 0; i < NUM_REQUESTS; i++) {
		const start = performance.now();

		const res = await fetch(`${BASE_URL}/api/lists`, {
			method: 'POST',
			headers: {
				...headers,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: `Benchmark List ${i + 1} - ${Date.now()}`,
				type: 'custom',
				description: 'Auto-generated for benchmark',
			}),
		});

		const duration = performance.now() - start;
		times.push(duration);

		if (!res.ok) {
			console.error(`   ❌ Request ${i + 1} failed: ${res.status}`);
			continue;
		}

		const { list } = await res.json();
		listIds.push(list.id);
		console.log(`   Request ${i + 1}: ${duration.toFixed(2)}ms (id: ${list.id})`);
	}

	return {
		result: { operation: 'CREATE', times, ...calculateStats(times) },
		listIds,
	};
}

async function benchmarkUpdate(
	headers: Record<string, string>,
	listId: string
): Promise<BenchmarkResult> {
	const times: number[] = [];

	console.log(`\n✏️  Benchmarking UPDATE (${NUM_REQUESTS} requests)`);
	console.log(`   Endpoint: PATCH ${BASE_URL}/api/lists/${listId}\n`);

	for (let i = 0; i < NUM_REQUESTS; i++) {
		const start = performance.now();

		const res = await fetch(`${BASE_URL}/api/lists/${listId}`, {
			method: 'PATCH',
			headers: {
				...headers,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: `Updated Name ${i + 1} - ${Date.now()}`,
				description: `Updated at iteration ${i + 1}`,
			}),
		});

		const duration = performance.now() - start;
		times.push(duration);

		if (!res.ok) {
			console.error(`   ❌ Request ${i + 1} failed: ${res.status}`);
			continue;
		}

		console.log(`   Request ${i + 1}: ${duration.toFixed(2)}ms`);
	}

	return { operation: 'UPDATE', times, ...calculateStats(times) };
}

async function benchmarkDelete(
	headers: Record<string, string>,
	listIds: string[]
): Promise<BenchmarkResult> {
	const times: number[] = [];

	console.log(`\n🗑️  Benchmarking DELETE (${listIds.length} requests)`);
	console.log(`   Endpoint: DELETE ${BASE_URL}/api/lists/[id]\n`);

	for (let i = 0; i < listIds.length; i++) {
		const listId = listIds[i];
		const start = performance.now();

		const res = await fetch(`${BASE_URL}/api/lists/${listId}`, {
			method: 'DELETE',
			headers,
		});

		const duration = performance.now() - start;
		times.push(duration);

		if (!res.ok) {
			console.error(`   ❌ Request ${i + 1} failed: ${res.status}`);
			continue;
		}

		console.log(`   Request ${i + 1}: ${duration.toFixed(2)}ms (deleted: ${listId})`);
	}

	return { operation: 'DELETE', times, ...calculateStats(times) };
}

function printSummary(results: BenchmarkResult[]) {
	console.log('\n' + '='.repeat(70));
	console.log('📊 BENCHMARK SUMMARY - API Response Times');
	console.log('='.repeat(70));
	console.log('\n┌────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
	console.log('│ Operation  │ Avg (ms) │ Min (ms) │ Max (ms) │ P50 (ms) │ P95 (ms) │');
	console.log('├────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

	for (const r of results) {
		console.log(
			`│ ${r.operation.padEnd(10)} │ ${r.avg.toFixed(0).padStart(8)} │ ${r.min.toFixed(0).padStart(8)} │ ${r.max.toFixed(0).padStart(8)} │ ${r.p50.toFixed(0).padStart(8)} │ ${r.p95.toFixed(0).padStart(8)} │`
		);
	}

	console.log('└────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

	// Calculate optimistic speedup estimates
	const OPTIMISTIC_LATENCY = 16; // ~1 frame at 60fps
	console.log('\n📈 OPTIMISTIC UPDATE IMPACT (Perceived Latency: ~16ms)');
	console.log('┌────────────┬──────────────┬──────────────┬───────────┐');
	console.log('│ Operation  │ API Time     │ Perceived    │ Speedup   │');
	console.log('├────────────┼──────────────┼──────────────┼───────────┤');

	for (const r of results) {
		const speedup = (r.avg / OPTIMISTIC_LATENCY).toFixed(1);
		console.log(
			`│ ${r.operation.padEnd(10)} │ ${r.avg.toFixed(0).padStart(8)}ms   │ ${OPTIMISTIC_LATENCY.toString().padStart(8)}ms   │ ${speedup.padStart(6)}x  │`
		);
	}

	console.log('└────────────┴──────────────┴──────────────┴───────────┘');
	console.log('\nOptimistic updates make UI feel instant regardless of API latency.');
}

async function main() {
	console.log('🚀 Optimistic Updates Benchmark');
	console.log(`   Target: ${BASE_URL}`);
	console.log(`   Iterations per operation: ${NUM_REQUESTS}`);

	console.log('\n🔐 Setting up Clerk test user...');
	const clerkAuth = await setupClerkTestUser();
	const headers = buildClerkAuthHeaders(clerkAuth.sessionToken!);

	const results: BenchmarkResult[] = [];

	try {
		// 1. Benchmark CREATE
		const { result: createResult, listIds } = await benchmarkCreate(headers);
		results.push(createResult);

		if (listIds.length === 0) {
			throw new Error('No lists were created, cannot continue benchmark');
		}

		// 2. Benchmark UPDATE (use first created list)
		const updateResult = await benchmarkUpdate(headers, listIds[0]);
		results.push(updateResult);

		// Keep one list for reference, delete the rest
		const listsToDelete = listIds.slice(1);

		// 3. Benchmark DELETE
		if (listsToDelete.length > 0) {
			const deleteResult = await benchmarkDelete(headers, listsToDelete);
			results.push(deleteResult);
		}

		// Cleanup remaining list
		console.log('\n🧹 Cleaning up remaining test data...');
		await fetch(`${BASE_URL}/api/lists/${listIds[0]}`, {
			method: 'DELETE',
			headers,
		});

		// Print summary
		printSummary(results);

		// Output JSON for programmatic use
		console.log('\n📋 Raw JSON results:');
		console.log(JSON.stringify(results, null, 2));
	} finally {
		console.log('\n🔐 Cleaning up Clerk test user...');
		await cleanupClerkTestUser(clerkAuth.userId);
	}
}

main()
	.then(() => {
		console.log('\n✅ Benchmark complete');
		process.exit(0);
	})
	.catch((err) => {
		console.error('\n❌ Benchmark failed:', err);
		process.exit(1);
	});
