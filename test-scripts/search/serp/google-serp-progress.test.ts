import assert from 'node:assert/strict';

// breadcrumb ledger: guard keyword search progress helpers for Google SERP pipeline
import { buildEndpoint } from '../../../app/components/campaigns/keyword-search/search-progress-helpers';

function expectEndpoint(platform: string, jobId: string, expected: string | null, hasTarget = false) {
  const actual = buildEndpoint(platform, hasTarget, jobId);
  assert.strictEqual(actual, expected, `buildEndpoint(${platform}) should be ${expected}, received ${actual}`);
}

console.log('🔧 Validating keyword search progress endpoint mapping');

expectEndpoint('google-serp', 'job-123', '/api/scraping/google-serp?jobId=job-123');
expectEndpoint('Google-Serp', 'job-456', '/api/scraping/google-serp?jobId=job-456');

console.log('✅ Keyword search progress endpoints validated');
