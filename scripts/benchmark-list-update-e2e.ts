#!/usr/bin/env tsx
/**
 * Benchmark script for list update performance using real Clerk auth
 *
 * Usage: npx tsx scripts/benchmark-list-update-e2e.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../lib/db';
import { creatorLists, users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import {
	setupClerkTestUser,
	cleanupClerkTestUser,
	buildClerkAuthHeaders,
} from '../testing/api-suite/lib/clerk-auth';

const BASE_URL = process.env.SESSION_BASE_URL || 'http://localhost:3002';
const NUM_REQUESTS = 10;

interface BenchmarkResult {
	avg: number;
	min: number;
	max: number;
	p50: number;
	p95: number;
	times: number[];
}

async function benchmarkListUpdate(): Promise<BenchmarkResult> {
	console.log('\n🔐 Setting up Clerk test user...');
	const clerkAuth = await setupClerkTestUser();
	const headers = buildClerkAuthHeaders(clerkAuth.sessionToken!);

	try {
		// Create a test list
		console.log('📝 Creating test list...');
		const createRes = await fetch(`${BASE_URL}/api/lists`, {
			method: 'POST',
			headers: {
				...headers,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: 'Benchmark Test List',
				type: 'custom',
			}),
		});

		if (!createRes.ok) {
			const text = await createRes.text();
			throw new Error(`Failed to create list: ${createRes.status} - ${text}`);
		}

		const { list } = await createRes.json();
		const listId = list.id;
		console.log(`   Created list: ${listId}`);

		// Run benchmark
		const times: number[] = [];

		console.log(`\n📊 Benchmarking list update (${NUM_REQUESTS} requests)`);
		console.log(`   Endpoint: PATCH ${BASE_URL}/api/lists/${listId}\n`);

		for (let i = 0; i < NUM_REQUESTS; i++) {
			const newName = `Benchmark ${i + 1} - ${Date.now()}`;

			const start = performance.now();

			const response = await fetch(`${BASE_URL}/api/lists/${listId}`, {
				method: 'PATCH',
				headers: {
					...headers,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ name: newName }),
			});

			const end = performance.now();
			const duration = end - start;
			times.push(duration);

			if (!response.ok) {
				console.error(`❌ Request ${i + 1} failed: ${response.status}`);
				const text = await response.text();
				console.error(text.slice(0, 200));
				continue;
			}

			console.log(`   Request ${i + 1}: ${duration.toFixed(2)}ms`);
		}

		// Cleanup - delete the test list
		console.log('\n🧹 Cleaning up test list...');
		await fetch(`${BASE_URL}/api/lists/${listId}`, {
			method: 'DELETE',
			headers,
		});

		// Calculate stats
		const avg = times.reduce((a, b) => a + b, 0) / times.length;
		const min = Math.min(...times);
		const max = Math.max(...times);
		const sorted = [...times].sort((a, b) => a - b);
		const p50 = sorted[Math.floor(sorted.length * 0.5)];
		const p95 = sorted[Math.floor(sorted.length * 0.95)];

		console.log('\n📈 Results:');
		console.log(`   Average: ${avg.toFixed(2)}ms`);
		console.log(`   Min:     ${min.toFixed(2)}ms`);
		console.log(`   Max:     ${max.toFixed(2)}ms`);
		console.log(`   P50:     ${p50.toFixed(2)}ms`);
		console.log(`   P95:     ${p95.toFixed(2)}ms`);
		console.log('');

		return { avg, min, max, p50, p95, times };
	} finally {
		// Always cleanup Clerk user
		console.log('🔐 Cleaning up Clerk test user...');
		await cleanupClerkTestUser(clerkAuth.userId);
	}
}

benchmarkListUpdate()
	.then((result) => {
		console.log('✅ Benchmark complete');
		console.log(JSON.stringify(result, null, 2));
	})
	.catch((err) => {
		console.error('❌ Benchmark failed:', err);
		process.exit(1);
	});
