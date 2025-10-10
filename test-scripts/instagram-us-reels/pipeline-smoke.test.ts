import assert from 'node:assert/strict';

import type {
  KeywordExpansionResult,
  PipelineContext,
  ProfileScreenResult,
  ProfileSummary,
  ReelMedia,
  ScoredReel,
} from '../../lib/instagram-us-reels/types.ts';

async function main() {
  const { runInstagramUsReelsPipeline, setPipelineOverrides } = await import(
    '../../lib/instagram-us-reels/index.ts'
  );
  const { scoreReels } = await import('../../lib/instagram-us-reels/steps/scoring.ts');
  const expansion: KeywordExpansionResult = {
    seedKeyword: 'vegan snacks',
    enrichedQueries: ['healthy vegan snacks'],
    hashtags: ['vegansnacks'],
    candidateHandles: [{ handle: 'uscreator', confidence: 0.9, source: 'serp' }],
  };

  const profile: ProfileSummary = {
    handle: 'uscreator',
    userId: '123',
    fullName: 'US Creator',
    isPrivate: false,
    followerCount: 15000,
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
      caption: 'Top vegan snacks in the USA for busy parents',
      transcript: 'Easy vegan snacks for US families',
      takenAt: Math.floor(Date.now() / 1000) - 120,
      viewCount: 8000,
      likeCount: 400,
      owner: profile,
    },
  ];

  setPipelineOverrides({
    expandKeyword: async () => expansion,
    harvestHandles: async () => ({ handles: expansion.candidateHandles }),
    screenProfiles: async () => ({ accepted: [profile], rejected: [] } as ProfileScreenResult),
    fetchReels: async () => reels,
    attachTranscripts: async () => undefined,
    scoreReels: (items) => scoreReels(items, expansion),
  });

  const context: PipelineContext = { keyword: 'vegan snacks' };
  const result: ScoredReel[] = await runInstagramUsReelsPipeline(context, {
    transcripts: false,
  });

  assert.equal(result.length, 1);
  assert.ok(result[0].relevanceScore > 0.5);
  console.log('✅ Pipeline smoke test passed.', result[0]);
}

main().catch((error) => {
  console.error('❌ Pipeline smoke test failed:', error);
  process.exitCode = 1;
});
