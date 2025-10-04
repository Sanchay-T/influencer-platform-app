import assert from 'node:assert/strict';
import { buildProfileLink } from '../../app/components/campaigns/keyword-search/utils/profile-link';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  try {
    assert.equal(actual, expected, message);
  } catch (error) {
    console.error('\u274c', message);
    throw error;
  }
}

(async () => {
  const youtubeCreatorWithChannelId = {
    creator: {
      name: 'Tech Lab',
      channelId: 'UC123456789',
      handle: '@techlab'
    },
    video: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
  };

  const youtubeCreatorWithHandle = {
    creator: {
      name: 'Creator Hub',
      handle: 'creatorhub'
    },
    video: { url: 'https://www.youtube.com/watch?v=zY1a3' }
  };

  const youtubeCreatorWithOnlyVideo = {
    creator: { name: 'Video Only' },
    video: { url: 'https://www.youtube.com/watch?v=abcdef' }
  };

  const youtubeCreatorWithIncorrectHint = {
    platform: 'YouTube',
    creator: {
      name: 'Signal Boost',
      channelId: 'UC999999999',
      handle: '@signalboost'
    },
    video: { url: 'https://www.youtube.com/watch?v=hybrid' }
  };

  const youtubeCreatorMislabeledAsTikTok = {
    platform: 'TikTok',
    creator: {
      name: 'Deep Dives',
      channelId: 'UC555555555',
      handle: '@deepdives'
    },
    video: { url: 'https://www.youtube.com/watch?v=longform' }
  };

  const tiktokCreator = {
    creator: {
      uniqueId: 'dancequeen',
    },
    video: { url: 'https://www.tiktok.com/@dancequeen/video/123' }
  };

  expectEqual(
    buildProfileLink(youtubeCreatorWithChannelId, 'youtube'),
    'https://www.youtube.com/channel/UC123456789',
    'YouTube link should use channel ID when available'
  );

  expectEqual(
    buildProfileLink(youtubeCreatorWithHandle, 'YouTube'),
    'https://www.youtube.com/@creatorhub',
    'YouTube link should normalize handle with leading @'
  );

  expectEqual(
    buildProfileLink(youtubeCreatorWithOnlyVideo, 'youtube'),
    'https://www.youtube.com/watch?v=abcdef',
    'YouTube link should fall back to video URL when no channel metadata'
  );

  expectEqual(
    buildProfileLink(youtubeCreatorWithIncorrectHint, 'tiktok'),
    'https://www.youtube.com/channel/UC999999999',
    'YouTube link should override incorrect platform hints when creator metadata is authoritative'
  );

  expectEqual(
    buildProfileLink(youtubeCreatorMislabeledAsTikTok, 'tiktok'),
    'https://www.youtube.com/channel/UC555555555',
    'YouTube link should ignore TikTok hints when channel metadata is present'
  );

  expectEqual(
    buildProfileLink(tiktokCreator, 'tiktok'),
    'https://www.tiktok.com/@dancequeen',
    'TikTok link should preserve existing behavior'
  );

  console.log('\u2705 profile-link tests passed');
})();
