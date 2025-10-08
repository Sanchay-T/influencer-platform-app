import assert from 'node:assert/strict';

// breadcrumb ledger: tests fetcher extraction logic used by google-serp provider
import { extractInstagramHandle } from '../../../lib/search-engine/providers/google-serp-fetcher';

function expectHandle(url: string, expected: string | null) {
  const actual = extractInstagramHandle(url);
  assert.strictEqual(
    actual,
    expected,
    `extractInstagramHandle(${url}) should return ${expected}, received ${actual}`,
  );
}

async function run() {
  console.log('🔍 Testing extractInstagramHandle helpers');

  expectHandle('https://www.instagram.com/nutritionbykylie/', 'nutritionbykylie');
  expectHandle('https://instagram.com/nutritionist', 'nutritionist');
  expectHandle('https://www.instagram.com/reel/C2h1sO4LU8j/', null);
  expectHandle('https://instagram.com/p/C2h1sO4LU8j/', null);
  expectHandle('https://www.instagram.com/explore/tags/nutritionist/', null);
  expectHandle('https://example.com/not-instagram', null);

  console.log('✅ extractInstagramHandle passed all assertions');
}

run().catch((error) => {
  console.error('❌ extractInstagramHandle tests failed', error);
  process.exitCode = 1;
});
