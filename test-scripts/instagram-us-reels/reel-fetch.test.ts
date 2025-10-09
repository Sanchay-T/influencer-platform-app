import assert from 'node:assert/strict';

import type { ProfileSummary, ReelMedia } from '../../lib/instagram-us-reels/types.ts';

async function main() {
  const { fetchReelsForProfiles, setReelFetchers } = await import(
    '../../lib/instagram-us-reels/steps/reel-fetch.ts'
  );
  const profile: ProfileSummary = {
    handle: 'uscreator',
    userId: '123',
    fullName: 'US Creator',
    isPrivate: false,
    followerCount: 10000,
    locationHints: ['Austin, TX'],
    countryConfidence: 0.9,
    isLikelyUS: true,
    raw: {},
  };

  setReelFetchers(
    async () => [
      {
        media: {
          pk: '1',
          code: 'ABC123',
          taken_at: 1730000000,
          play_count: 5000,
          like_count: 200,
        },
      },
    ],
    async () => ({
      data: {
        xdt_shortcode_media: {
          video_url: 'https://video.cdn/reel.mp4',
          video_view_count: 6000,
          edge_media_preview_like: { count: 250 },
          edge_media_to_caption: {
            edges: [
              {
                node: {
                  text: 'Great workout for USA moms!'
                }
              }
            ]
          }
        },
      },
    }),
  );

  const reels = await fetchReelsForProfiles([profile], {
    amountPerProfile: 5,
    fetchDetails: true,
  });

  assert.equal(reels.length, 1, 'Expected one reel');
  const reel: ReelMedia = reels[0];
  assert.equal(reel.shortcode, 'ABC123');
  assert.equal(reel.url, 'https://video.cdn/reel.mp4');
  assert.equal(reel.viewCount, 6000);
  assert.equal(reel.likeCount, 250);
  assert.match(reel.caption ?? '', /workout/);
  console.log('✅ Reel fetch test passed.', reel);
}

main().catch((error) => {
  console.error('❌ Reel fetch test failed:', error);
  process.exitCode = 1;
});
