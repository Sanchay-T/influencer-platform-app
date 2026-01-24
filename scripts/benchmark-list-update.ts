/**
 * Benchmark script for list update performance
 * Measures API response time for metadata-only updates (rename)
 *
 * Run with: npx tsx scripts/benchmark-list-update.ts
 */

const LIST_ID = '7ac0c898-1d2f-47d4-9d6e-6336f72d01c7'; // Test list ID
const BASE_URL = 'http://localhost:3002';
const NUM_REQUESTS = 10;

// Get session token from testing directory
import { readFileSync } from 'fs';
import { join } from 'path';

async function getSessionToken(): Promise<string> {
	try {
		const tokenPath = join(process.cwd(), 'testing/clerk-session-token/.session-token');
		const token = readFileSync(tokenPath, 'utf-8').trim();
		return token;
	} catch {
		console.error('Could not read session token from testing/clerk-session-token/.session-token');
		process.exit(1);
	}
}

async function benchmarkListUpdate() {
	const token = await getSessionToken();
	const times: number[] = [];

	console.log(`\n📊 Benchmarking list update (${NUM_REQUESTS} requests)`);
	console.log(`   List ID: ${LIST_ID}`);
	console.log(`   Endpoint: PATCH ${BASE_URL}/api/lists/${LIST_ID}\n`);

	for (let i = 0; i < NUM_REQUESTS; i++) {
		const newName = `Benchmark Test ${Date.now()}`;

		const start = performance.now();

		const response = await fetch(`${BASE_URL}/api/lists/${LIST_ID}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': `__session=${token}`,
			},
			body: JSON.stringify({ name: newName }),
		});

		const end = performance.now();
		const duration = end - start;
		times.push(duration);

		if (!response.ok) {
			console.error(`❌ Request ${i + 1} failed: ${response.status}`);
			const text = await response.text();
			console.error(text);
			continue;
		}

		console.log(`   Request ${i + 1}: ${duration.toFixed(2)}ms`);
	}

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

	return { avg, min, max, p50, p95 };
}

benchmarkListUpdate().catch(console.error);
