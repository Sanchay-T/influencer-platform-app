/**
 * Test V2 Parallel Streaming Pipeline
 *
 * Compares parallel pipeline performance vs sequential pipeline.
 * The parallel pipeline fetches and enriches concurrently.
 *
 * Usage:
 *   npx tsx scripts/test-v2-parallel.ts
 *   npx tsx scripts/test-v2-parallel.ts --target=100
 *   npx tsx scripts/test-v2-parallel.ts --target=200 --keywords="fitness,gym,workout"
 */

import { buildConfig, COST, LOG_PREFIX } from '../lib/search-engine/v2/core/config';
import { runParallelStandalone } from '../lib/search-engine/v2/core/parallel-pipeline';
// Import TikTok adapter to register it
import '../lib/search-engine/v2/adapters/tiktok';

// ============================================================================
// Parse CLI Arguments
// ============================================================================

interface TestOptions {
	keywords: string[];
	targetResults: number;
	enableBioEnrichment: boolean;
	enrichWorkers: number;
}

function parseArgs(): TestOptions {
	const args = process.argv.slice(2);
	const options: TestOptions = {
		keywords: ['fitness influencer'],
		targetResults: 50,
		enableBioEnrichment: true,
		enrichWorkers: 5,
	};

	for (const arg of args) {
		if (arg.startsWith('--keywords=')) {
			options.keywords = arg
				.replace('--keywords=', '')
				.split(',')
				.map((k) => k.trim())
				.filter((k) => k.length > 0);
		} else if (arg.startsWith('--target=')) {
			options.targetResults = parseInt(arg.replace('--target=', ''), 10);
		} else if (arg === '--no-bio') {
			options.enableBioEnrichment = false;
		} else if (arg.startsWith('--workers=')) {
			options.enrichWorkers = parseInt(arg.replace('--workers=', ''), 10);
		}
	}

	return options;
}

// ============================================================================
// Main Test Function
// ============================================================================

async function main() {
	console.log('');
	console.log('═══════════════════════════════════════════════════════════════');
	console.log('  V2 Parallel Streaming Pipeline Test');
	console.log('═══════════════════════════════════════════════════════════════');
	console.log('');

	const options = parseArgs();

	console.log('Options:');
	console.log(`  Keywords: ${options.keywords.join(', ')}`);
	console.log(`  Target Results: ${options.targetResults}`);
	console.log(`  Bio Enrichment: ${options.enableBioEnrichment ? 'enabled' : 'disabled'}`);
	console.log(`  Enrich Workers: ${options.enrichWorkers}`);
	console.log('');

	// Validate environment
	if (!process.env.SCRAPECREATORS_API_KEY) {
		console.error('❌ Missing SCRAPECREATORS_API_KEY environment variable');
		console.error('   Set it in your .env.local file');
		process.exit(1);
	}

	// Build config
	const config = buildConfig('tiktok');
	config.enableBioEnrichment = options.enableBioEnrichment;

	console.log('Config:');
	console.log(`  API Base URL: ${config.apiBaseUrl}`);
	console.log(`  Fetch Timeout: ${config.fetchTimeoutMs}ms`);
	console.log(`  Bio Enrichment Timeout: ${config.bioEnrichmentTimeoutMs}ms`);
	console.log(`  Max Parallel Enrichments: ${config.maxParallelEnrichments}`);
	console.log('');

	console.log('Starting parallel search...');
	console.log('───────────────────────────────────────────────────────────────');
	console.log('');

	const startTime = Date.now();
	let lastProgressTime = startTime;
	let creatorsReceived = 0;

	try {
		const { creators, metrics } = await runParallelStandalone(
			'tiktok',
			options.keywords,
			options.targetResults,
			config
		);

		const durationSec = (Date.now() - startTime) / 1000;
		const estimatedCost = metrics.totalApiCalls * COST.perApiCall;

		console.log('');
		console.log('───────────────────────────────────────────────────────────────');
		console.log('');
		console.log('✅ Parallel Search Complete!');
		console.log('');
		console.log('Results Summary:');
		console.log(`  Total Creators: ${creators.length}`);
		console.log(`  Target: ${options.targetResults}`);
		console.log(`  API Calls: ${metrics.totalApiCalls}`);
		console.log(`  Duration: ${durationSec.toFixed(2)}s`);
		console.log(`  Speed: ${metrics.creatorsPerSecond.toFixed(2)} creators/sec`);
		console.log(`  Estimated Cost: $${estimatedCost.toFixed(4)}`);
		console.log('');
		console.log('Bio Enrichment:');
		console.log(`  Attempted: ${metrics.bioEnrichmentsAttempted}`);
		console.log(`  Succeeded: ${metrics.bioEnrichmentsSucceeded}`);
		if (metrics.bioEnrichmentsAttempted > 0) {
			const successRate = (
				(metrics.bioEnrichmentsSucceeded / metrics.bioEnrichmentsAttempted) *
				100
			).toFixed(1);
			console.log(`  Success Rate: ${successRate}%`);
		}
		console.log('');

		// Show sample creators
		if (creators.length > 0) {
			console.log('Sample Creators (first 5):');
			console.log('───────────────────────────────────────────────────────────────');

			for (const creator of creators.slice(0, 5)) {
				console.log('');
				console.log(`  @${creator.creator.username}`);
				console.log(`    Name: ${creator.creator.name}`);
				console.log(`    Followers: ${creator.creator.followers.toLocaleString()}`);
				console.log(`    Verified: ${creator.creator.verified ? 'Yes' : 'No'}`);
				console.log(
					`    Bio: ${creator.creator.bio?.slice(0, 100) || '(none)'}${creator.creator.bio && creator.creator.bio.length > 100 ? '...' : ''}`
				);
				console.log(`    Bio Enriched: ${creator.bioEnriched ? 'Yes' : 'No'}`);
				console.log(
					`    Emails: ${creator.creator.emails?.length ? creator.creator.emails.join(', ') : '(none)'}`
				);
				console.log(`    Video: ${creator.content.description?.slice(0, 60) || '(no desc)'}...`);
				console.log(`    Views: ${creator.content.statistics.views.toLocaleString()}`);
			}
			console.log('');
		}

		// Stats on creators with emails
		const withEmails = creators.filter((c) => c.creator.emails && c.creator.emails.length > 0);
		const withBio = creators.filter((c) => c.creator.bio && c.creator.bio.trim().length > 0);
		const enriched = creators.filter((c) => c.bioEnriched);

		console.log('Creator Stats:');
		console.log(
			`  With Bio: ${withBio.length}/${creators.length} (${((withBio.length / creators.length) * 100).toFixed(1)}%)`
		);
		console.log(
			`  Bio Enriched: ${enriched.length}/${creators.length} (${((enriched.length / creators.length) * 100).toFixed(1)}%)`
		);
		console.log(
			`  With Email: ${withEmails.length}/${creators.length} (${((withEmails.length / creators.length) * 100).toFixed(1)}%)`
		);
		console.log('');

		// Performance comparison hint
		console.log('Performance Notes:');
		console.log('  - Parallel pipeline fetches and enriches concurrently');
		console.log('  - Each keyword runs as its own fetch worker');
		console.log('  - Multiple enrich workers process the queue simultaneously');
		console.log('  - Results stream immediately (not batched at end)');
		console.log('');
		console.log('═══════════════════════════════════════════════════════════════');
	} catch (error) {
		console.error('');
		console.error('❌ Parallel Search Failed!');
		console.error('Error:', error instanceof Error ? error.message : String(error));
		if (error instanceof Error && error.stack) {
			console.error('Stack:', error.stack);
		}
		process.exit(1);
	}
}

main();
