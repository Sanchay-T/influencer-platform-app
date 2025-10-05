import path from 'node:path';
import assert from 'node:assert/strict';
import { config as loadEnv } from 'dotenv';

// breadcrumb: test-scripts/search/serp/google-serp-smoke.test.ts -> exercises lib/search-engine/providers/google-serp.ts
loadEnv({ path: path.join(process.cwd(), '.env.local') });

const REQUIRED_VARS = [
  'SERP_API_KEY',
  'SCRAPECREATORS_API_KEY',
  'SCRAPECREATORS_INSTAGRAM_API_URL',
];

for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

async function runSmokeTest() {
  const { fetchGoogleSerpProfiles } = await import('../../../lib/search-engine/providers/google-serp');

  const query = process.env.TEST_SERP_QUERY ?? 'site:instagram.com "coffee roaster"';
  const maxResults = Number.parseInt(process.env.TEST_SERP_LIMIT ?? '5', 10);

  console.log('🔎 Running SerpApi Google test with query:', query);

  const startedAt = Date.now();
  const result = await fetchGoogleSerpProfiles({ query, maxResults });
  const durationMs = Date.now() - startedAt;

  console.log('⏱️ Total duration (ms):', durationMs);
  console.log('📦 Result keys:', Object.keys(result));

  assert(Array.isArray(result.creators), 'Expected creators array in response');
  assert(result.creators.length > 0, 'SerpApi smoke test returned no creators');

  const sample = result.creators[0] as any;
  assert(sample?.creator?.username, 'Sample creator missing username');
  assert(sample?.source?.serp?.link, 'Sample creator missing serp link');

  console.log('✅ Smoke test passed, fetched', result.creators.length, 'creators');
  console.log('🔢 API calls made:', result.metrics.apiCalls);
}

runSmokeTest().catch((error) => {
  console.error('❌ SerpApi smoke test failed:', error);
  process.exitCode = 1;
});
