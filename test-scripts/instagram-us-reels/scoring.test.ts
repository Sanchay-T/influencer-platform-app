import assert from 'node:assert/strict';

import type { KeywordExpansionResult, ReelMedia } from '../../lib/instagram-us-reels/types.ts';

async function main() {
  const { scoreReels } = await import('../../lib/instagram-us-reels/steps/scoring.ts');
  const expansion: KeywordExpansionResult = {
    seedKeyword: 'vegan snacks',
    enrichedQueries: ['healthy vegan snacks', 'plant-based snacks usa'],
    hashtags: ['vegansnacks'],
    candidateHandles: [],
  };

  const owner = {
    handle: 'uscreator',
    userId: '123',
    fullName: 'Creator',
    isPrivate: false,
    followerCount: 20000,
    locationHints: ['Austin, TX'],
    countryConfidence: 0.9,
    isLikelyUS: true,
    raw: {},
  };

  const reels: ReelMedia[] = [
    {
      id: '1',
      shortcode: 'AAA111',
      url: 'https://instagram.com/reel/AAA111',
      caption: 'Top 5 vegan snacks you can make in USA kitchens',
      transcript: null,
      takenAt: Math.floor(Date.now() / 1000) - 60 * 60,
      viewCount: 5000,
      likeCount: 300,
      owner,
    },
    {
      id: '2',
      shortcode: 'BBB222',
      url: 'https://instagram.com/reel/BBB222',
      caption: 'International street food tour',
      transcript: 'Exploring snacks around the world',
      takenAt: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 120,
      viewCount: 10000,
      likeCount: 600,
      owner: { ...owner, countryConfidence: 0.2 },
    },
  ];

  const scored = scoreReels(reels, expansion);

  assert.equal(scored.length, 2);
  assert.ok(scored[0].relevanceScore >= scored[1].relevanceScore, 'First reel should score higher');
  assert.equal(scored[0].id, '1');
  console.log('✅ Scoring test passed.', scored.map((r) => ({ id: r.id, score: r.relevanceScore })));
}

main().catch((error) => {
  console.error('❌ Scoring test failed:', error);
  process.exitCode = 1;
});
