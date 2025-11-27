import assert from 'assert';
import { filterCreatorsByLikes, MIN_LIKES_THRESHOLD } from '@/lib/search-engine/utils/filter-creators';

const make = (likes?: number, extra: Record<string, unknown> = {}) => ({
  platform: 'Instagram',
  creator: { username: 'user' },
  video: likes === undefined ? {} : { statistics: { likes }, ...extra.video },
  ...extra,
});

function run() {
  // drops when missing likes
  assert.strictEqual(filterCreatorsByLikes([make(undefined)], MIN_LIKES_THRESHOLD).length, 0);

  // keeps when likes equal threshold
  assert.strictEqual(filterCreatorsByLikes([make(MIN_LIKES_THRESHOLD)], MIN_LIKES_THRESHOLD).length, 1);

  // keeps when likes above threshold
  assert.strictEqual(filterCreatorsByLikes([make(1000)], MIN_LIKES_THRESHOLD).length, 1);

  // drops below threshold
  assert.strictEqual(filterCreatorsByLikes([make(50)], MIN_LIKES_THRESHOLD).length, 0);

  // fallback: like_count field
  assert.strictEqual(filterCreatorsByLikes([{ like_count: 150 }], MIN_LIKES_THRESHOLD).length, 1);

  // fallback: statistics.likes field
  assert.strictEqual(filterCreatorsByLikes([{ statistics: { likes: 120 } }], MIN_LIKES_THRESHOLD).length, 1);

  // negative / NaN dropped
  assert.strictEqual(filterCreatorsByLikes([{ like_count: -10 }], MIN_LIKES_THRESHOLD).length, 0);
  assert.strictEqual(filterCreatorsByLikes([{ like_count: Number.NaN }], MIN_LIKES_THRESHOLD).length, 0);

  // mixed list
  const mixed = [
    make(10),
    make(101),
    { platform: 'TikTok', video: { statistics: { likes: 200 } } },
    { platform: 'YouTube', statistics: { likes: 90 } },
  ];
  const filtered = filterCreatorsByLikes(mixed, MIN_LIKES_THRESHOLD);
  assert.deepStrictEqual(filtered.length, 2);
}

run();
console.log('filter-creators-by-likes.test.ts ✅');
