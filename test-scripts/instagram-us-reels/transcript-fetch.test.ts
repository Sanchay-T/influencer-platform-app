import assert from 'node:assert/strict';

import type { ReelMedia } from '../../lib/instagram-us-reels/types.ts';

async function main() {
  const { attachTranscripts, setTranscriptFetcher } = await import(
    '../../lib/instagram-us-reels/steps/transcript-fetch.ts'
  );
  const reels: ReelMedia[] = [
    {
      id: '1',
      shortcode: 'ABC123',
      url: 'https://instagram.com/reel/ABC123',
      takenAt: Date.now(),
      owner: {
        handle: 'uscreator',
        userId: '123',
        fullName: 'US Creator',
        isPrivate: false,
        followerCount: 10000,
        locationHints: ['Austin'],
        countryConfidence: 0.9,
        isLikelyUS: true,
        raw: {},
      },
      transcript: null,
    },
  ];

  setTranscriptFetcher(async () => ({
    success: true,
    transcripts: [
      {
        id: '1',
        transcript: 'Welcome to this US-based workout routine!'
      },
    ],
  }));

  await attachTranscripts(reels, { concurrency: 1 });

  assert.ok(reels[0].transcript);
  assert.match(reels[0].transcript ?? '', /US-based/);
  console.log('✅ Transcript fetch test passed.', reels[0].transcript);
}

main().catch((error) => {
  console.error('❌ Transcript fetch test failed:', error);
  process.exitCode = 1;
});
