import assert from 'node:assert/strict';

import type { CandidateHandle } from '../../lib/instagram-us-reels/types.ts';

async function main() {
  const { screenProfiles, setProfileFetcher } = await import(
    '../../lib/instagram-us-reels/steps/profile-screen.ts'
  );
  const stubData: Record<string, any> = {
    uscreator: {
      data: {
        user: {
          username: 'uscreator',
          id: '123',
          full_name: 'US Creator',
          is_private: false,
          biography: 'Teaching fitness in Austin, Texas 🇺🇸',
          business_address_json: JSON.stringify({
            city_name: 'Austin',
            region_name: 'Texas',
            country_code: 'US',
          }),
          edge_followed_by: { count: 12000 },
        },
      },
    },
    globalstar: {
      data: {
        user: {
          username: 'globalstar',
          id: '456',
          full_name: 'Global Star',
          is_private: false,
          biography: 'Based in Berlin 🇩🇪',
          edge_followed_by: { count: 500000 },
        },
      },
    },
  };

  setProfileFetcher(async (handle: string) => {
    const data = stubData[handle];
    if (!data) {
      throw new Error(`Stub profile missing for ${handle}`);
    }
    return data;
  });

  const handles: CandidateHandle[] = [
    { handle: 'uscreator', confidence: 0.8, source: 'serp' },
    { handle: 'globalstar', confidence: 0.6, source: 'serp' },
  ];

  const result = await screenProfiles(handles);

  assert.equal(result.accepted.length, 1, 'One profile should be accepted');
  assert.equal(result.accepted[0].handle, 'uscreator');
  assert.ok(result.accepted[0].isLikelyUS);
  assert.ok(result.accepted[0].countryConfidence >= 0.6);

  assert.equal(result.rejected.length, 1, 'One profile should be rejected');
  assert.equal(result.rejected[0].handle, 'globalstar');
  assert.ok(result.rejected[0].countryConfidence < 0.6);

  console.log('✅ Profile screen test passed.', {
    accepted: result.accepted[0],
    rejected: result.rejected[0],
  });
}

main().catch((error) => {
  console.error('❌ Profile screen test failed:', error);
  process.exitCode = 1;
});
