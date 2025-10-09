import assert from 'node:assert/strict';

import type { KeywordExpansionResult } from '../../lib/instagram-us-reels/types.ts';

async function main() {
  const { harvestHandles } = await import(
    '../../lib/instagram-us-reels/steps/handle-harvest.ts'
  );

  const expansion: KeywordExpansionResult = {
    seedKeyword: 'fitness coach',
    enrichedQueries: ['fitness coach usa', 'us fitness reels'],
    hashtags: ['fitness', 'coach'],
    candidateHandles: [
      {
        handle: 'fitcoachamy',
        confidence: 0.9,
        source: 'sonar',
      },
    ],
  };

  const serpStub = async (query: string): Promise<string[]> => {
    if (query.includes('usa')) {
      return ['fitcoachamy', 'healthy_johnny'];
    }
    return ['wellnesslife.us'];
  };

  const result = await harvestHandles(expansion, {
    serpFetcher: serpStub,
    serpLimit: 5,
  });

  assert.ok(result.handles.length >= 2, 'Expected merged handles');
  const deduped = result.handles.find((item) => item.handle === 'fitcoachamy');
  assert.ok(deduped, 'Original handle should remain');
  assert.equal(deduped?.source, 'sonar', 'Existing source should be preserved');

  const serpOnly = result.handles.find((item) => item.handle === 'healthy_johnny');
  assert.ok(serpOnly, 'SERP handle should be added');
  assert.equal(serpOnly?.source, 'serp');

  console.log('✅ Handle harvest test passed.', result.handles);
}

main().catch((error) => {
  console.error('❌ Handle harvest test failed:', error);
  process.exitCode = 1;
});
