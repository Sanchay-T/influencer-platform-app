/**
 * V2 Dispatch Test Script
 *
 * Tests the full v2 fan-out flow:
 * 1. Creates a test user + campaign (or uses existing)
 * 2. Calls POST /api/v2/dispatch
 * 3. Polls GET /api/v2/status until complete
 * 4. Reports results
 *
 * Usage:
 *   npx tsx scripts/test-v2-dispatch.ts
 *   npx tsx scripts/test-v2-dispatch.ts --keyword="fitness"
 *   npx tsx scripts/test-v2-dispatch.ts --campaign-id=xxx
 */

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
	const arg = args.find((a) => a.startsWith(`--${name}=`));
	return arg?.split('=')[1];
};

const KEYWORD = getArg('keyword') || 'fitness influencer';
const PLATFORM = getArg('platform') || 'tiktok';
const CAMPAIGN_ID = getArg('campaign-id');
const TARGET_RESULTS = Number.parseInt(getArg('target') || '100', 10) as 100 | 500 | 1000;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Dev Bypass Header Generation
// ============================================================================

function generateDevBypassHeaders(userId: string, email?: string): Record<string, string> {
	// Use the x-dev-auth bypass mechanism which doesn't require ENABLE_TEST_AUTH
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
	console.log('📝 Creating test user...');

	const testUserId = `test-v2-${Date.now()}`;
	const testEmail = `e2e.test+v2-${Date.now()}@test.local`;

	// Use the E2E endpoint to create a test user
	const response = await fetch(`${BASE_URL}/api/admin/e2e/create-test-user`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			userId: testUserId,
			email: testEmail,
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to create test user: ${response.status} - ${text}`);
	}

	const data = await response.json();
	const internalUserId = data.internalId;
	console.log(`✅ Test user created: ${internalUserId} (Clerk ID: ${testUserId})`);

	// Set the user's plan to viral_surge for testing
	console.log('📝 Setting user plan...');
	const planResponse = await fetch(`${BASE_URL}/api/admin/e2e/set-plan`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: testEmail,
			plan: 'viral_surge',
			trialStatus: 'active',
			subscriptionStatus: 'active',
		}),
	});

	if (!planResponse.ok) {
		const text = await planResponse.text();
		throw new Error(`Failed to set plan: ${planResponse.status} - ${text}`);
	}
	console.log('✅ Plan set to viral_surge');

	// Create a campaign for the test - use CLERK ID for auth (getUserProfile queries by users.userId column)
	const headers = generateDevBypassHeaders(testUserId, testEmail);
	const campaignResponse = await fetch(`${BASE_URL}/api/campaigns`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			name: `V2 Test Campaign ${Date.now()}`,
			description: 'Testing v2 fan-out architecture',
			searchType: 'keyword',
		}),
	});

	if (!campaignResponse.ok) {
		const text = await campaignResponse.text();
		throw new Error(`Failed to create campaign: ${campaignResponse.status} - ${text}`);
	}

	const campaign = await campaignResponse.json();
	console.log(`✅ Campaign created: ${campaign.id}`);

	return { userId: testUserId, campaignId: campaign.id };
}

async function dispatchSearch(
	userId: string,
	campaignId: string
): Promise<{ jobId: string; keywords: string[] }> {
	console.log('\n🚀 Dispatching v2 search...');
	console.log(`   Platform: ${PLATFORM}`);
	console.log(`   Keyword: "${KEYWORD}"`);
	console.log(`   Target: ${TARGET_RESULTS} creators`);

	const headers = generateDevBypassHeaders(userId);
	const response = await fetch(`${BASE_URL}/api/v2/dispatch`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			platform: PLATFORM,
			keywords: [KEYWORD],
			targetResults: TARGET_RESULTS,
			campaignId,
			enableExpansion: true,
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Dispatch failed: ${response.status} - ${text}`);
	}

	const data = await response.json();
	console.log(`✅ Dispatch successful!`);
	console.log(`   Job ID: ${data.jobId}`);
	console.log(`   Keywords: ${data.keywords.length} (expanded from 1)`);
	console.log(`   Workers dispatched: ${data.workersDispatched}`);

	return { jobId: data.jobId, keywords: data.keywords };
}

async function pollStatus(
	userId: string,
	jobId: string
): Promise<{
	status: string;
	creatorsFound: number;
	creatorsEnriched: number;
	percentComplete: number;
}> {
	const headers = generateDevBypassHeaders(userId);
	const response = await fetch(`${BASE_URL}/api/v2/status?jobId=${jobId}`, {
		headers,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Status check failed: ${response.status} - ${text}`);
	}

	const data = await response.json();
	return {
		status: data.status,
		creatorsFound: data.progress.creatorsFound,
		creatorsEnriched: data.progress.creatorsEnriched,
		percentComplete: data.progress.percentComplete,
	};
}

async function waitForCompletion(userId: string, jobId: string): Promise<void> {
	console.log('\n⏳ Polling for completion...');

	const startTime = Date.now();
	let lastStatus = '';
	let lastProgress = -1;

	while (Date.now() - startTime < MAX_POLL_TIME_MS) {
		const status = await pollStatus(userId, jobId);

		// Only log when something changes
		if (status.status !== lastStatus || Math.floor(status.percentComplete) !== lastProgress) {
			const progressBar = '█'.repeat(Math.floor(status.percentComplete / 5)) +
				'░'.repeat(20 - Math.floor(status.percentComplete / 5));
			console.log(
				`   [${progressBar}] ${status.percentComplete.toFixed(1)}% | ` +
				`Status: ${status.status} | ` +
				`Found: ${status.creatorsFound} | ` +
				`Enriched: ${status.creatorsEnriched}`
			);
			lastStatus = status.status;
			lastProgress = Math.floor(status.percentComplete);
		}

		if (status.status === 'completed' || status.status === 'error' || status.status === 'partial') {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	throw new Error('Timeout waiting for job completion');
}

async function fetchFinalResults(userId: string, jobId: string): Promise<void> {
	console.log('\n📊 Fetching final results...');

	const headers = generateDevBypassHeaders(userId);
	const response = await fetch(`${BASE_URL}/api/v2/status?jobId=${jobId}&limit=10`, {
		headers,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch results: ${response.status}`);
	}

	const data = await response.json();

	console.log('\n═══════════════════════════════════════════════════════════');
	console.log('  V2 FAN-OUT TEST RESULTS');
	console.log('═══════════════════════════════════════════════════════════');
	console.log(`  Status: ${data.status}`);
	console.log(`  Total Creators: ${data.totalCreators}`);
	console.log(`  Target: ${data.targetResults}`);
	console.log(`  Keywords Used: ${data.keywords.length}`);
	console.log('───────────────────────────────────────────────────────────');
	console.log('  Progress:');
	console.log(`    Keywords Dispatched: ${data.progress.keywordsDispatched}`);
	console.log(`    Keywords Completed: ${data.progress.keywordsCompleted}`);
	console.log(`    Creators Found: ${data.progress.creatorsFound}`);
	console.log(`    Creators Enriched: ${data.progress.creatorsEnriched}`);
	console.log('───────────────────────────────────────────────────────────');

	// Show sample creators
	if (data.results?.[0]?.creators?.length > 0) {
		console.log('  Sample Creators:');
		const sample = data.results[0].creators.slice(0, 3);
		for (const creator of sample) {
			const c = creator.creator || creator;
			console.log(`    - @${c.username || c.uniqueId} (${c.followers?.toLocaleString() || '?'} followers)`);
			if (c.emails?.length > 0) {
				console.log(`      📧 ${c.emails[0]}`);
			}
		}
	}

	console.log('═══════════════════════════════════════════════════════════');

	if (data.status === 'completed') {
		console.log('\n✅ TEST PASSED');
	} else if (data.status === 'partial') {
		console.log('\n⚠️ TEST PARTIAL (some keywords may have failed)');
	} else {
		console.log('\n❌ TEST FAILED');
	}
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	console.log('╔═══════════════════════════════════════════════════════════╗');
	console.log('║           V2 FAN-OUT ARCHITECTURE TEST                    ║');
	console.log('╚═══════════════════════════════════════════════════════════╝');

	try {
		let userId: string;
		let campaignId: string;

		if (CAMPAIGN_ID) {
			// Use provided campaign ID - need to figure out user
			console.log(`Using existing campaign: ${CAMPAIGN_ID}`);
			// For now, use auth bypass
			userId = process.env.AUTH_BYPASS_USER_ID || 'dev-user';
			campaignId = CAMPAIGN_ID;
		} else {
			// Create new test user and campaign
			const result = await createTestUser();
			userId = result.userId;
			campaignId = result.campaignId;
		}

		// Dispatch the search
		const { jobId } = await dispatchSearch(userId, campaignId);

		// Wait for completion
		await waitForCompletion(userId, jobId);

		// Fetch and display results
		await fetchFinalResults(userId, jobId);
	} catch (error) {
		console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

main();
