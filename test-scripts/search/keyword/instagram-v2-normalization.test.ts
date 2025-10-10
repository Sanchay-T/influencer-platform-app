import assert from 'node:assert/strict';
import { normalizeFeedItems } from '../../../lib/search-engine/providers/instagram-v2-normalizer';
import type { FeedRunResult } from '../../../lib/services/instagram-feed';

// [InstagramV2Test] Breadcrumb: sanity-check instagram_v2 normalization stays stable for UI rendering.

const mockFeed: FeedRunResult = {
  keyword: 'sample',
  generatedAt: '2025-01-01T00:00:00.000Z',
  creatorsConsidered: 3,
  candidatesScored: 5,
  items: [
    {
      postId: 'abc123',
      score: 42,
      keywordHits: ['AirPods', 'Pro'],
      createdAt: '2024-12-01T12:00:00.000Z',
      caption: 'Full AirPods Pro review – sound upgrade or not?',
      transcript: 'In this AirPods Pro review we cover noise cancellation and audio quality in depth.',
      audioUrl: 'https://example.com/audio.mp3',
      postUrl: 'https://www.instagram.com/reel/abc123/',
      musicTitle: 'Future Sound',
      metrics: {
        plays: 12000,
        likes: 850,
        comments: 42,
        shares: 15,
      },
      creator: {
        username: 'techreviewer',
        fullName: 'Tech Reviewer',
        profilePicture: 'https://example.com/avatar.jpg',
        followers: 15000,
        engagementPercent: 5.2,
        avgLikes: 600,
      },
    },
  ],
};

async function run() {
  const creators = normalizeFeedItems({ feed: mockFeed, keyword: 'AirPods Pro' });
  assert.equal(creators.length, 1, 'Expected a single normalized creator');

  const [first] = creators;
  assert.equal(first.platform, 'instagram_v2');
  assert.equal(first.creator?.username, 'techreviewer');
  assert(first.metadata?.matchedTerms?.includes('AirPods'), 'Expected matched terms to include AirPods');
  assert.equal(first.video?.statistics?.views, 12000);
  assert.equal(first.metadata?.pipeline, 'instagram_v2');
  assert.ok(typeof first.metadata?.normalizedScore === 'number', 'Expected normalized score number');
  assert(first.metadata?.snippet?.toLowerCase().includes('airpods'), 'Snippet should reference keyword');

  console.log('✅ instagram-v2 normalization test passed');
}

run().catch((error) => {
  console.error('❌ instagram-v2 normalization test failed');
  console.error(error);
  process.exit(1);
});
