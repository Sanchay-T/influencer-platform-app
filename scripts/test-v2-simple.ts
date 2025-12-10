/**
 * Simple V2 dispatch test
 */

async function main() {
	const BASE_URL = process.env.TEST_URL || 'http://localhost:3002';

	console.log('🧪 Testing V2 Dispatch Endpoint...\n');

	// Step 1: Test without auth (should fail with 401)
	console.log('1️⃣ Testing auth check...');
	try {
		const noAuthResponse = await fetch(`${BASE_URL}/api/v2/dispatch`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				platform: 'tiktok',
				keywords: ['fitness'],
				targetResults: 100,
				campaignId: 'test',
			}),
		});
		console.log(`   Status: ${noAuthResponse.status} (expected 401)`);
		const noAuthText = await noAuthResponse.text();
		console.log(`   Response: ${noAuthText}\n`);
	} catch (error) {
		console.log(`   Error: ${error}\n`);
	}

	// Step 2: Test validation (should fail with 400 for invalid campaign)
	console.log('2️⃣ Testing validation with dev bypass...');
	try {
		const validationResponse = await fetch(`${BASE_URL}/api/v2/dispatch`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-dev-auth': 'dev-bypass',
			},
			body: JSON.stringify({
				platform: 'tiktok',
				keywords: ['fitness'],
				targetResults: 100,
				campaignId: 'invalid-uuid', // Invalid UUID
			}),
		});
		console.log(`   Status: ${validationResponse.status}`);
		const validationText = await validationResponse.text();
		console.log(`   Response: ${validationText}\n`);
	} catch (error) {
		console.log(`   Error: ${error}\n`);
	}

	// Step 3: Test status endpoint
	console.log('3️⃣ Testing status endpoint...');
	try {
		const statusResponse = await fetch(
			`${BASE_URL}/api/v2/status?jobId=00000000-0000-0000-0000-000000000000`,
			{
				headers: {
					'x-dev-auth': 'dev-bypass',
				},
			}
		);
		console.log(`   Status: ${statusResponse.status}`);
		const statusText = await statusResponse.text();
		console.log(`   Response: ${statusText}\n`);
	} catch (error) {
		console.log(`   Error: ${error}\n`);
	}

	// Step 4: Test search worker endpoint (without QStash signature - should fail)
	console.log('4️⃣ Testing search worker endpoint (no signature)...');
	try {
		const workerResponse = await fetch(`${BASE_URL}/api/v2/worker/search`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jobId: 'test',
				platform: 'tiktok',
				keyword: 'fitness',
				batchIndex: 0,
				totalKeywords: 1,
				userId: 'test',
			}),
		});
		console.log(`   Status: ${workerResponse.status} (expected 401 in production)`);
		const workerText = await workerResponse.text();
		console.log(`   Response: ${workerText.substring(0, 200)}...\n`);
	} catch (error) {
		console.log(`   Error: ${error}\n`);
	}

	console.log('✅ Endpoint tests complete!');
	console.log('\nNote: Full integration test requires:');
	console.log('  1. A valid campaign in the database');
	console.log('  2. Auth bypass enabled (ENABLE_AUTH_BYPASS=true)');
	console.log('  3. QStash configured for worker callbacks');
}

main().catch(console.error);
