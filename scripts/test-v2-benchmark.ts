/**
 * V2 Benchmark Test Script
 *
 * Tests the v2 fan-out flow with 100, 500, and 1000 targets
 * Tracks timing and saves results to CSV
 *
 * Usage:
 *   npx tsx scripts/test-v2-benchmark.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 15 * 60 * 1000; // 15 minutes

type BenchmarkTarget = 100 | 500 | 1000;
const TEST_CONFIGS: Array<{ target: BenchmarkTarget; keyword: string }> = [
	{ target: 100, keyword: 'fitness tips' },
	{ target: 500, keyword: 'beauty tutorial' },
	{ target: 1000, keyword: 'tech review' },
];

interface TestResult {
	target: number;
	keyword: string;
	jobId: string;
	status: string;
	keywordsExpanded: number;
	creatorsFound: number;
	creatorsEnriched: number;
	totalDurationMs: number;
	dispatchDurationMs: number;
	searchDurationMs: number;
	enrichDurationMs: number;
	accuracy: number; // creatorsFound / target
	error?: string;
}

// ============================================================================
// Dev Bypass Header Generation
// ============================================================================

function generateDevBypassHeaders(userId: string, email?: string): Record<string, string> {
	return {
		'x-dev-auth': 'dev-bypass',
		'x-dev-user-id': userId,
		'x-dev-email': email || `${userId}@test.local`,
		'Content-Type': 'application/json',
	};
}

// ============================================================================
// API Helpers
// ============================================================================

async function createTestUser(): Promise<{ userId: string; campaignId: string }> {
	const testUserId = `test-bench-${Date.now()}`;
	const testEmail = `e2e.test+bench-${Date.now()}@test.local`;

	// Create test user
	const response = await fetch(`${BASE_URL}/api/admin/e2e/create-test-user`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId: testUserId, email: testEmail }),
	});

	if (!response.ok) {
		throw new Error(`Failed to create test user: ${await response.text()}`);
	}

	// Set plan
	await fetch(`${BASE_URL}/api/admin/e2e/set-plan`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: testEmail,
			plan: 'viral_surge',
			trialStatus: 'active',
			subscriptionStatus: 'active',
		}),
	});

	// Create campaign
	const headers = generateDevBypassHeaders(testUserId, testEmail);
	const campaignResponse = await fetch(`${BASE_URL}/api/campaigns`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			name: `Benchmark Campaign ${Date.now()}`,
			description: 'Benchmark testing',
			searchType: 'keyword',
		}),
	});

	if (!campaignResponse.ok) {
		throw new Error(`Failed to create campaign: ${await campaignResponse.text()}`);
	}

	const campaign = await campaignResponse.json();
	return { userId: testUserId, campaignId: campaign.id };
}

async function dispatchSearch(
	userId: string,
	campaignId: string,
	keyword: string,
	target: 100 | 500 | 1000
): Promise<{ jobId: string; keywords: string[]; dispatchDurationMs: number }> {
	const startTime = Date.now();

	const headers = generateDevBypassHeaders(userId);
	const response = await fetch(`${BASE_URL}/api/v2/dispatch`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			platform: 'tiktok',
			keywords: [keyword],
			targetResults: target,
			campaignId,
			enableExpansion: true,
		}),
	});

	if (!response.ok) {
		throw new Error(`Dispatch failed: ${await response.text()}`);
	}

	const data = await response.json();
	const dispatchDurationMs = Date.now() - startTime;

	return { jobId: data.jobId, keywords: data.keywords, dispatchDurationMs };
}

interface StatusData {
	status: string;
	creatorsFound: number;
	creatorsEnriched: number;
	keywordsDispatched: number;
	keywordsCompleted: number;
	percentComplete: number;
}

async function pollStatus(userId: string, jobId: string): Promise<StatusData> {
	const headers = generateDevBypassHeaders(userId);
	const response = await fetch(`${BASE_URL}/api/v2/status?jobId=${jobId}`, { headers });

	if (!response.ok) {
		throw new Error(`Status check failed: ${await response.text()}`);
	}

	const data = await response.json();
	return {
		status: data.status,
		creatorsFound: data.progress.creatorsFound,
		creatorsEnriched: data.progress.creatorsEnriched,
		keywordsDispatched: data.progress.keywordsDispatched,
		keywordsCompleted: data.progress.keywordsCompleted,
		percentComplete: data.progress.percentComplete,
	};
}

async function waitForCompletion(
	userId: string,
	jobId: string
): Promise<{ status: StatusData; searchDurationMs: number; enrichDurationMs: number }> {
	const startTime = Date.now();
	let searchCompleteTime = 0;
	let lastStatus: StatusData | null = null;

	while (Date.now() - startTime < MAX_POLL_TIME_MS) {
		const status = await pollStatus(userId, jobId);
		lastStatus = status;

		// Track when search phase completes
		if (
			searchCompleteTime === 0 &&
			status.keywordsCompleted >= status.keywordsDispatched &&
			status.keywordsDispatched > 0
		) {
			searchCompleteTime = Date.now() - startTime;
		}

		// Log progress
		const progressBar =
			'█'.repeat(Math.floor(status.percentComplete / 5)) +
			'░'.repeat(20 - Math.floor(status.percentComplete / 5));
		process.stdout.write(
			`\r   [${progressBar}] ${status.percentComplete.toFixed(1)}% | ` +
				`Found: ${status.creatorsFound} | Enriched: ${status.creatorsEnriched}    `
		);

		if (status.status === 'completed' || status.status === 'error' || status.status === 'partial') {
			process.stdout.write('\n');
			const totalTime = Date.now() - startTime;
			return {
				status,
				searchDurationMs: searchCompleteTime || totalTime,
				enrichDurationMs: totalTime - (searchCompleteTime || 0),
			};
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	throw new Error('Timeout waiting for job completion');
}

// ============================================================================
// CSV Export
// ============================================================================

function exportToCsv(results: TestResult[]): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `v2-benchmark-${timestamp}.csv`;
	const filepath = path.join(process.cwd(), 'scripts', filename);

	const headers = [
		'Target',
		'Keyword',
		'Job ID',
		'Status',
		'Keywords Expanded',
		'Creators Found',
		'Creators Enriched',
		'Total Duration (s)',
		'Dispatch Duration (s)',
		'Search Duration (s)',
		'Enrich Duration (s)',
		'Accuracy (%)',
		'Error',
	];

	const rows = results.map((r) => [
		r.target,
		r.keyword,
		r.jobId,
		r.status,
		r.keywordsExpanded,
		r.creatorsFound,
		r.creatorsEnriched,
		(r.totalDurationMs / 1000).toFixed(2),
		(r.dispatchDurationMs / 1000).toFixed(2),
		(r.searchDurationMs / 1000).toFixed(2),
		(r.enrichDurationMs / 1000).toFixed(2),
		r.accuracy.toFixed(1),
		r.error || '',
	]);

	const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

	fs.writeFileSync(filepath, csv);
	return filepath;
}

// ============================================================================
// Main
// ============================================================================

async function runBenchmark(): Promise<void> {
	console.log('╔═══════════════════════════════════════════════════════════╗');
	console.log('║       V2 FAN-OUT BENCHMARK TEST (with Target Capping)     ║');
	console.log('╚═══════════════════════════════════════════════════════════╝');
	console.log('');

	const results: TestResult[] = [];

	for (const config of TEST_CONFIGS) {
		console.log(`\n${'═'.repeat(60)}`);
		console.log(`  Testing Target: ${config.target} | Keyword: "${config.keyword}"`);
		console.log(`${'═'.repeat(60)}`);

		try {
			// Create fresh user for each test
			console.log('📝 Creating test user...');
			const { userId, campaignId } = await createTestUser();
			console.log(`   User: ${userId}`);

			// Dispatch search
			console.log('\n🚀 Dispatching search...');
			const totalStartTime = Date.now();
			const { jobId, keywords, dispatchDurationMs } = await dispatchSearch(
				userId,
				campaignId,
				config.keyword,
				config.target
			);
			console.log(`   Job ID: ${jobId}`);
			console.log(`   Keywords expanded: ${keywords.length}`);
			console.log(`   Dispatch time: ${(dispatchDurationMs / 1000).toFixed(2)}s`);

			// Wait for completion
			console.log('\n⏳ Waiting for completion...');
			const { status, searchDurationMs, enrichDurationMs } = await waitForCompletion(userId, jobId);

			const totalDurationMs = Date.now() - totalStartTime;

			// Calculate accuracy
			const accuracy = (status.creatorsFound / config.target) * 100;

			results.push({
				target: config.target,
				keyword: config.keyword,
				jobId,
				status: status.status,
				keywordsExpanded: keywords.length,
				creatorsFound: status.creatorsFound,
				creatorsEnriched: status.creatorsEnriched,
				totalDurationMs,
				dispatchDurationMs,
				searchDurationMs,
				enrichDurationMs,
				accuracy,
			});

			// Print results
			console.log('\n📊 Results:');
			console.log(`   Status: ${status.status}`);
			console.log(`   Target: ${config.target}`);
			console.log(`   Found: ${status.creatorsFound} (${accuracy.toFixed(1)}% of target)`);
			console.log(`   Enriched: ${status.creatorsEnriched}`);
			console.log(`   Total time: ${(totalDurationMs / 1000).toFixed(2)}s`);
			console.log(
				`   Breakdown: Dispatch ${(dispatchDurationMs / 1000).toFixed(2)}s → ` +
					`Search ${(searchDurationMs / 1000).toFixed(2)}s → ` +
					`Enrich ${(enrichDurationMs / 1000).toFixed(2)}s`
			);

			// Accuracy check
			if (accuracy >= 95 && accuracy <= 105) {
				console.log(`   ✅ PASS: Within 5% of target`);
			} else if (accuracy >= 90 && accuracy <= 110) {
				console.log(`   ⚠️  WARN: Within 10% of target`);
			} else {
				console.log(`   ❌ FAIL: Outside 10% of target`);
			}
		} catch (error) {
			console.error(`\n❌ Test failed: ${error instanceof Error ? error.message : error}`);
			results.push({
				target: config.target,
				keyword: config.keyword,
				jobId: 'N/A',
				status: 'error',
				keywordsExpanded: 0,
				creatorsFound: 0,
				creatorsEnriched: 0,
				totalDurationMs: 0,
				dispatchDurationMs: 0,
				searchDurationMs: 0,
				enrichDurationMs: 0,
				accuracy: 0,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Export to CSV
	console.log(`\n${'═'.repeat(60)}`);
	console.log('  BENCHMARK SUMMARY');
	console.log(`${'═'.repeat(60)}`);

	const csvPath = exportToCsv(results);
	console.log(`\n📁 Results saved to: ${csvPath}`);

	// Summary table
	console.log('\n┌─────────┬───────────┬──────────┬──────────────┬───────────┐');
	console.log('│ Target  │ Found     │ Accuracy │ Total Time   │ Status    │');
	console.log('├─────────┼───────────┼──────────┼──────────────┼───────────┤');

	for (const r of results) {
		const target = r.target.toString().padStart(5);
		const found = r.creatorsFound.toString().padStart(7);
		const accuracy = `${r.accuracy.toFixed(1)}%`.padStart(6);
		const time = `${(r.totalDurationMs / 1000).toFixed(1)}s`.padStart(10);
		const status = r.status.padEnd(9);
		console.log(`│ ${target}   │ ${found}   │ ${accuracy}   │ ${time}   │ ${status} │`);
	}

	console.log('└─────────┴───────────┴──────────┴──────────────┴───────────┘');

	// Overall result
	const allPassed = results.every((r) => r.accuracy >= 90 && r.accuracy <= 110 && r.status !== 'error');
	console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

runBenchmark().catch(console.error);
