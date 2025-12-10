/**
 * Test keyword expansion scaling
 */

import {
	calculateKeywordsNeeded,
	expandKeywordsForTarget,
} from '../lib/search-engine/v2/core/keyword-expander';

async function test() {
	console.log('Testing keyword expansion scaling...\n');

	// Test calculation
	console.log('Calculation test (CREATORS_PER_KEYWORD = 25):');
	console.log(`  100 target -> ${calculateKeywordsNeeded(100)} keywords needed`);
	console.log(`  500 target -> ${calculateKeywordsNeeded(500)} keywords needed`);
	console.log(`  1000 target -> ${calculateKeywordsNeeded(1000)} keywords needed`);

	console.log('\nActual expansion test (500 target):');
	const start = Date.now();
	const result = await expandKeywordsForTarget(['fitness influencer'], 500);
	console.log(`  Time: ${Date.now() - start}ms`);
	console.log(`  Keywords expanded: ${result.keywords.length}`);
	console.log(`  Keywords:`);
	for (const kw of result.keywords) {
		console.log(`    - ${kw}`);
	}
}

test().catch(console.error);
