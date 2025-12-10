/**
 * Trigger V2 Pipeline Test via QStash
 *
 * This script queues a test job to run in the background with QStash's
 * 2-hour timeout. Results are saved to the database.
 *
 * Usage:
 *   npx tsx scripts/trigger-v2-test.ts
 *   npx tsx scripts/trigger-v2-test.ts --target=100
 *   npx tsx scripts/trigger-v2-test.ts --target=200 --keywords="fitness,gym"
 *   npx tsx scripts/trigger-v2-test.ts --direct  # Skip QStash, call directly
 */

import { Client } from '@upstash/qstash';

// ============================================================================
// Parse CLI Arguments
// ============================================================================

interface TestOptions {
	keywords: string[];
	target: number;
	enableBio: boolean;
	direct: boolean; // Call endpoint directly instead of via QStash
}

function parseArgs(): TestOptions {
	const args = process.argv.slice(2);
	const options: TestOptions = {
		keywords: ['fitness influencer'],
		target: 50,
		enableBio: true,
		direct: false,
	};

	for (const arg of args) {
		if (arg.startsWith('--keywords=')) {
			options.keywords = arg
				.replace('--keywords=', '')
				.split(',')
				.map((k) => k.trim())
				.filter((k) => k.length > 0);
		} else if (arg.startsWith('--target=')) {
			options.target = parseInt(arg.replace('--target=', ''), 10);
		} else if (arg === '--no-bio') {
			options.enableBio = false;
		} else if (arg === '--direct') {
			options.direct = true;
		}
	}

	return options;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	console.log('');
	console.log('═══════════════════════════════════════════════════════════════');
	console.log('  V2 Pipeline Test Trigger');
	console.log('═══════════════════════════════════════════════════════════════');
	console.log('');

	const options = parseArgs();
	const testId = `v2-test-${Date.now()}`;

	console.log('Test Configuration:');
	console.log(`  Test ID: ${testId}`);
	console.log(`  Keywords: ${options.keywords.join(', ')}`);
	console.log(`  Target: ${options.target}`);
	console.log(`  Bio Enrichment: ${options.enableBio ? 'enabled' : 'disabled'}`);
	console.log(`  Mode: ${options.direct ? 'Direct call' : 'QStash background job'}`);
	console.log('');

	const payload = {
		platform: 'tiktok',
		keywords: options.keywords,
		target: options.target,
		enableBio: options.enableBio,
		testId,
	};

	// The endpoint URL (via ngrok for local dev)
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usegemz.ngrok.app';
	const endpoint = `${baseUrl}/api/scraping/v2-test`;

	if (options.direct) {
		// Call directly (will timeout if too long)
		console.log(`Calling endpoint directly: ${endpoint}`);
		console.log('');

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const result = await response.json();
		console.log('Result:', JSON.stringify(result, null, 2));
	} else {
		// Queue via QStash
		const qstashToken = process.env.QSTASH_TOKEN;
		if (!qstashToken) {
			console.error('❌ Missing QSTASH_TOKEN environment variable');
			process.exit(1);
		}

		const client = new Client({ token: qstashToken });

		console.log(`Queuing job via QStash to: ${endpoint}`);
		console.log('');

		const response = await client.publishJSON({
			url: endpoint,
			body: payload,
			retries: 0, // Don't retry on failure
		});

		console.log('✅ Job queued successfully!');
		console.log('');
		console.log('QStash Response:');
		console.log(`  Message ID: ${response.messageId}`);
		console.log('');
		console.log('The job is now running in the background with a 2-hour timeout.');
		console.log('');
		console.log('To check results:');
		console.log(`  curl "${baseUrl}/api/scraping/v2-test?testId=${testId}"`);
		console.log('');
		console.log('Or check all recent tests:');
		console.log(`  curl "${baseUrl}/api/scraping/v2-test"`);
	}

	console.log('');
	console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((error) => {
	console.error('❌ Error:', error);
	process.exit(1);
});
