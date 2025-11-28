import assert from 'assert';
import { filterCreatorsByLikes, MIN_LIKES_THRESHOLD } from '@/lib/search-engine/utils/filter-creators';

const make = (likes?: number, extra: Record<string, unknown> = {}) => ({
  platform: 'Instagram',
  creator: { username: 'user' },
  video: likes === undefined ? {} : { statistics: { likes }, ...extra.video },
  ...extra,
});

function run() {
  console.log('Testing with MIN_LIKES_THRESHOLD:', MIN_LIKES_THRESHOLD);

  // NEW BEHAVIOR: null likes are KEPT by default (includeNullLikes=true)
  // This preserves creators without likes data for manual review
  assert.strictEqual(
    filterCreatorsByLikes([make(undefined)], MIN_LIKES_THRESHOLD).length,
    1,
    'null likes should be KEPT by default'
  );

  // Can explicitly exclude null likes with includeNullLikes=false
  assert.strictEqual(
    filterCreatorsByLikes([make(undefined)], MIN_LIKES_THRESHOLD, false).length,
    0,
    'null likes should be DROPPED when includeNullLikes=false'
  );

  // keeps when likes equal threshold
  assert.strictEqual(filterCreatorsByLikes([make(MIN_LIKES_THRESHOLD)], MIN_LIKES_THRESHOLD).length, 1);

  // keeps when likes above threshold
  assert.strictEqual(filterCreatorsByLikes([make(1000)], MIN_LIKES_THRESHOLD).length, 1);

  // drops below threshold (KNOWN likes below threshold are still dropped)
  assert.strictEqual(filterCreatorsByLikes([make(50)], MIN_LIKES_THRESHOLD).length, 0);

  // fallback: like_count field
  assert.strictEqual(filterCreatorsByLikes([{ like_count: 150 }], MIN_LIKES_THRESHOLD).length, 1);

  // fallback: statistics.likes field
  assert.strictEqual(filterCreatorsByLikes([{ statistics: { likes: 120 } }], MIN_LIKES_THRESHOLD).length, 1);

  // negative values should be dropped (invalid data)
  assert.strictEqual(filterCreatorsByLikes([{ like_count: -10 }], MIN_LIKES_THRESHOLD).length, 0);

  // NaN should be treated as null (kept by default)
  // Because extractLikes returns null for NaN
  assert.strictEqual(filterCreatorsByLikes([{ like_count: Number.NaN }], MIN_LIKES_THRESHOLD).length, 1);

  // mixed list - now includes null likes
  const mixed = [
    make(10),          // KNOWN likes below threshold -> DROPPED
    make(101),         // KNOWN likes above threshold -> KEPT
    make(undefined),   // NULL likes -> KEPT (default)
    { platform: 'TikTok', video: { statistics: { likes: 200 } } },  // KEPT
    { platform: 'YouTube', statistics: { likes: 90 } },  // DROPPED
  ];
  const filtered = filterCreatorsByLikes(mixed, MIN_LIKES_THRESHOLD);
  assert.deepStrictEqual(filtered.length, 3, 'Expected 3: 101-likes + null-likes + 200-likes');
}

run();
console.log('filter-creators-by-likes.test.ts ✅');
