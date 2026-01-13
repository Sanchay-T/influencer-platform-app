/**
 * V2 Multi-Platform Test Script
 *
 * Tests all three platforms (TikTok, Instagram, YouTube) with the v2 fan-out system.
 *
 * Usage:
 *   npx tsx scripts/test-v2-multi-platform.ts
 *   npx tsx scripts/test-v2-multi-platform.ts --platform=instagram
 *   npx tsx scripts/test-v2-multi-platform.ts --platform=youtube --target=100
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 10 * 60 * 1000; // 10 minutes

type Platform = 'tiktok' | 'instagram' | 'youtube';
type Target = 100 | 500 | 1000;

interface TestConfig {
	platform: Platform;
	target: Target;
	keyword: string;
}

const DEFAULT_TESTS: TestConfig[] = [
	{ platform: 'tiktok', target: 100, keyword: 'fitness motivation' },
	{ platform: 'instagram', target: 100, keyword: 'beauty tips' },
	{ platform: 'youtube', target: 100, keyword: 'tech tutorial' },
];

interface TestResult {
	platform: Platform;
	target: number;
	keyword: string;
	jobId: string;
	status: string;
	keywordsExpanded: number;
	creatorsFound: number;
	creatorsEnriched: number;
	totalDurationMs: number;
	dispatchDurationMs: number;
	accuracy: number;
	error?: string;
}

// ============================================================================
// Parse Args
// ============================================================================

function parseArgs(): { tests: TestConfig[] } {
	const args = process.argv.slice(2);
	const isPlatform = (value: string): value is Platform =>
		value === 'tiktok' || value === 'instagram' || value === 'youtube';
	const isTarget = (value: number): value is Target =>
		value === 100 || value === 500 || value === 1000;

	let platform: Platform | null = null;
	let target: Target = 100;
	let keyword: string | null = null;

	for (const arg of args) {
		if (arg.startsWith('--platform=')) {
			const p = arg.split('=')[1];
			if (p && isPlatform(p)) {
				platform = p;
			}
		} else if (arg.startsWith('--target=')) {
			const t = Number.parseInt(arg.split('=')[1], 10);
			if (isTarget(t)) {
				target = t;
			}
		} else if (arg.startsWith('--keyword=')) {
			const nextKeyword = arg.split('=')[1];
			if (nextKeyword) {
				keyword = nextKeyword;
			}
		}
	}

	// If specific platform provided, test only that platform
	if (platform) {
		return {
			tests: [{
				platform,
				target,
				keyword: keyword || getDefaultKeyword(platform),
			}],
		};
	}

	// Otherwise run all default tests
	return { tests: DEFAULT_TESTS };
}

function getDefaultKeyword(platform: Platform): string {
	const defaults: Record<Platform, string> = {
		tiktok: 'fitness motivation',
		instagram: 'beauty tips',
		youtube: 'tech tutorial',
	};
	return defaults[platform];
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
	const testUserId = `test-mp-${Date.now()}`;
	const testEmail = `e2e.test+mp-${Date.now()}@test.local`;

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
			plan: 'fame_flex', // Unlimited plan for testing
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
			name: `Multi-Platform Test ${Date.now()}`,
			description: 'Multi-platform testing',
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
	platform: Platform,
	keyword: string,
	target: Target
): Promise<{ jobId: string; keywords: string[]; dispatchDurationMs: number }> {
	const startTime = Date.now();

	const headers = generateDevBypassHeaders(userId);
	const response = await fetch(`${BASE_URL}/api/v2/dispatch`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			platform,
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
): Promise<{ status: StatusData; durationMs: number }> {
	const startTime = Date.now();
	let lastStatus: StatusData | null = null;

	while (Date.now() - startTime < MAX_POLL_TIME_MS) {
		const status = await pollStatus(userId, jobId);
		lastStatus = status;

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
			return {
				status,
				durationMs: Date.now() - startTime,
			};
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	throw new Error('Timeout waiting for job completion');
}

// ============================================================================
// Test Runner
// ============================================================================

async function runTest(config: TestConfig, testIndex: number, totalTests: number): Promise<TestResult> {
	const { platform, target, keyword } = config;

	console.log(`\n${'─'.repeat(60)}`);
	console.log(`  Test ${testIndex + 1}/${totalTests}: ${platform.toUpperCase()}`);
	console.log(`  Target: ${target} | Keyword: "${keyword}"`);
	console.log(`${'─'.repeat(60)}`);

	try {
		// Create fresh user for this test
		console.log('📝 Creating test user...');
		const { userId, campaignId } = await createTestUser();
		console.log(`   User: ${userId}`);

		// Dispatch search
		console.log(`\n🚀 Dispatching ${platform} search...`);
		const totalStartTime = Date.now();
		const { jobId, keywords, dispatchDurationMs } = await dispatchSearch(
			userId,
			campaignId,
			platform,
			keyword,
			target
		);
		console.log(`   Job ID: ${jobId}`);
		console.log(`   Keywords expanded: ${keywords.length}`);
		console.log(`   Dispatch time: ${(dispatchDurationMs / 1000).toFixed(2)}s`);

		// Wait for completion
		console.log('\n⏳ Waiting for completion...');
		const { status, durationMs } = await waitForCompletion(userId, jobId);

		const totalDurationMs = Date.now() - totalStartTime;
		const accuracy = (status.creatorsFound / target) * 100;

		// Print results
		console.log('\n📊 Results:');
		console.log(`   Status: ${status.status}`);
		console.log(`   Target: ${target}`);
		console.log(`   Found: ${status.creatorsFound} (${accuracy.toFixed(1)}% of target)`);
		console.log(`   Enriched: ${status.creatorsEnriched}`);
		console.log(`   Total time: ${(totalDurationMs / 1000).toFixed(2)}s`);

		// Accuracy check
		const icon = accuracy >= 95 && accuracy <= 105
			? '✅'
			: accuracy >= 80
				? '⚠️'
				: '❌';
		console.log(`   ${icon} Accuracy: ${accuracy.toFixed(1)}%`);

		return {
			platform,
			target,
			keyword,
			jobId,
			status: status.status,
			keywordsExpanded: keywords.length,
			creatorsFound: status.creatorsFound,
			creatorsEnriched: status.creatorsEnriched,
			totalDurationMs,
			dispatchDurationMs,
			accuracy,
		};
	} catch (error) {
		console.error(`\n❌ Test failed: ${error instanceof Error ? error.message : error}`);
		return {
			platform,
			target,
			keyword,
			jobId: 'N/A',
			status: 'error',
			keywordsExpanded: 0,
			creatorsFound: 0,
			creatorsEnriched: 0,
			totalDurationMs: 0,
			dispatchDurationMs: 0,
			accuracy: 0,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ============================================================================
// CSV Export
// ============================================================================

function exportToCsv(results: TestResult[]): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `v2-multi-platform-${timestamp}.csv`;
	const filepath = path.join(process.cwd(), 'scripts', filename);

	const headers = [
		'Platform',
		'Target',
		'Keyword',
		'Job ID',
		'Status',
		'Keywords Expanded',
		'Creators Found',
		'Creators Enriched',
		'Total Duration (s)',
		'Dispatch Duration (s)',
		'Accuracy (%)',
		'Error',
	];

	const rows = results.map((r) => [
		r.platform,
		r.target,
		`"${r.keyword}"`,
		r.jobId,
		r.status,
		r.keywordsExpanded,
		r.creatorsFound,
		r.creatorsEnriched,
		(r.totalDurationMs / 1000).toFixed(2),
		(r.dispatchDurationMs / 1000).toFixed(2),
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

async function main(): Promise<void> {
	console.log('╔═══════════════════════════════════════════════════════════════════╗');
	console.log('║       V2 MULTI-PLATFORM TEST (TikTok, Instagram, YouTube)         ║');
	console.log('╚═══════════════════════════════════════════════════════════════════╝');
	console.log('');

	const { tests } = parseArgs();

	console.log(`Running ${tests.length} test(s):`);
	for (const test of tests) {
		console.log(`  • ${test.platform}: target=${test.target}, keyword="${test.keyword}"`);
	}

	const results: TestResult[] = [];

	for (let i = 0; i < tests.length; i++) {
		const result = await runTest(tests[i], i, tests.length);
		results.push(result);
	}

	// Export to CSV
	console.log(`\n${'═'.repeat(68)}`);
	console.log('  SUMMARY');
	console.log(`${'═'.repeat(68)}`);

	const csvPath = exportToCsv(results);
	console.log(`\n📁 Results saved to: ${csvPath}`);

	// Summary table
	console.log('\n┌───────────┬─────────┬───────────┬──────────┬──────────────┬───────────┐');
	console.log('│ Platform  │ Target  │ Found     │ Accuracy │ Duration     │ Status    │');
	console.log('├───────────┼─────────┼───────────┼──────────┼──────────────┼───────────┤');

	for (const r of results) {
		const platform = r.platform.padEnd(9);
		const target = r.target.toString().padStart(5);
		const found = r.creatorsFound.toString().padStart(7);
		const accuracy = `${r.accuracy.toFixed(1)}%`.padStart(6);
		const time = `${(r.totalDurationMs / 1000).toFixed(1)}s`.padStart(10);
		const status = r.status.padEnd(9);
		console.log(`│ ${platform} │ ${target}   │ ${found}   │ ${accuracy}   │ ${time}   │ ${status} │`);
	}

	console.log('└───────────┴─────────┴───────────┴──────────┴──────────────┴───────────┘');

	// Overall result
	const allPassed = results.every((r) => r.accuracy >= 80 && r.status !== 'error');
	console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

	// Platform-specific insights
	console.log('\n📊 Platform Insights:');
	for (const r of results) {
		if (r.status !== 'error') {
			const enrichmentRate = r.creatorsEnriched > 0
				? ((r.creatorsEnriched / r.creatorsFound) * 100).toFixed(1)
				: 'N/A';
			console.log(`   ${r.platform.toUpperCase()}: ${r.creatorsFound} found, ${enrichmentRate}% enriched`);
		}
	}
}

main().catch(console.error);
