import assert from 'node:assert/strict';

import { dedupeCreators } from '@/lib/utils/dedupe-creators';

const baseCreator = {
  platform: 'TikTok',
  creator: {
    name: 'Sample Creator',
    bio: 'Reach me at creator@example.com',
  },
};

const variantWithHandle = {
  ...baseCreator,
  creator: {
    ...baseCreator.creator,
    username: 'samplecreator',
  },
};

const variantWithProfile = {
  ...baseCreator,
  profile: {
    profileUrl: 'https://www.tiktok.com/@samplecreator',
  },
};

const duplicateWithoutIds = {
  platform: 'TikTok',
  creator: {
    name: 'Sample Creator',
  },
  video: {
    description: 'No identifiers here',
  },
};

const crossJobDuplicate = {
  ...variantWithHandle,
  engine: 'search-engine',
};

const result = dedupeCreators([
  duplicateWithoutIds,
  variantWithHandle,
  variantWithProfile,
  crossJobDuplicate,
]);

assert.equal(
  result.length,
  3,
  'dedupeCreators should collapse redundant entries while preserving unique variants',
);

const usernames = result.filter((item) => item?.creator?.username === 'samplecreator');

assert.equal(
  usernames.length,
  1,
  'dedupeCreators should keep a single entry per unique handle',
);

assert.equal(
  result[0].creator?.name,
  'Sample Creator',
  'First creator should remain the original',
);

console.log('✅ shared dedupe utility removes fallback and cross-job duplicates');
