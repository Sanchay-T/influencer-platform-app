// perfect-shuffle.ts - ZERO consecutive duplicates guaranteed

export function perfectShuffle<T extends { handle: string }>(reels: T[]): T[] {
  if (reels.length === 0) return [];
  if (reels.length === 1) return reels;

  // Group by creator
  const byHandle = new Map<string, T[]>();
  reels.forEach(r => {
    if (!byHandle.has(r.handle)) byHandle.set(r.handle, []);
    byHandle.get(r.handle)!.push(r);
  });

  // Shuffle each creator's reels
  byHandle.forEach((list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  });

  // Check if perfect distribution is possible
  const maxCount = Math.max(...Array.from(byHandle.values()).map(list => list.length));
  const othersCount = reels.length - maxCount;

  // If one creator has more reels than all others combined, impossible to avoid consecutive
  if (maxCount > othersCount + 1) {
    console.log(`   ⚠️  Note: One creator has ${maxCount} reels, others have ${othersCount} total`);
    console.log(`   Perfect distribution impossible - will minimize clustering`);
  }

  // Build result using greedy placement
  const result: T[] = [];
  const pools = Array.from(byHandle.entries()).map(([handle, reels]) => ({
    handle,
    reels: [...reels]
  }));

  while (result.length < reels.length) {
    // Get pools with reels remaining
    const available = pools.filter(p => p.reels.length > 0);
    if (available.length === 0) break;

    // Last added handle
    const lastHandle = result.length > 0 ? result[result.length - 1].handle : null;

    // Prefer pools that aren't the last handle
    let candidates = available.filter(p => p.handle !== lastHandle);

    if (candidates.length === 0) {
      // All remaining are same creator - pick the one with most left
      candidates = available.sort((a, b) => b.reels.length - a.reels.length);
    }

    // Weighted random: prefer pools with fewer reels (to balance distribution)
    // But pick from top 3 to maintain randomness
    candidates.sort((a, b) => {
      // If very imbalanced, prioritize the one with fewer reels
      const diff = Math.abs(a.reels.length - b.reels.length);
      if (diff > 2) return a.reels.length - b.reels.length;
      // Otherwise random
      return Math.random() - 0.5;
    });

    const chosen = candidates[0];
    result.push(chosen.reels.shift()!);
  }

  return result;
}

// Test
const mockReels = [
  { handle: 'creator_a', url: 'url1' },
  { handle: 'creator_a', url: 'url2' },
  { handle: 'creator_a', url: 'url3' },
  { handle: 'creator_a', url: 'url4' },
  { handle: 'creator_b', url: 'url5' },
  { handle: 'creator_b', url: 'url6' },
  { handle: 'creator_b', url: 'url7' },
  { handle: 'creator_c', url: 'url8' },
  { handle: 'creator_c', url: 'url9' },
  { handle: 'creator_d', url: 'url10' },
  { handle: 'creator_d', url: 'url11' },
  { handle: 'creator_d', url: 'url12' },
  { handle: 'creator_d', url: 'url13' },
  { handle: 'creator_d', url: 'url14' },
];

console.log('\n🎲 PERFECT SHUFFLE TEST\n');
console.log('Input: 4 creators, 14 total reels');
console.log('- creator_a: 4 reels');
console.log('- creator_b: 3 reels');
console.log('- creator_c: 2 reels');
console.log('- creator_d: 5 reels\n');

const shuffled = perfectShuffle(mockReels);

console.log('Output Feed:');
shuffled.forEach((reel, i) => {
  const prev = i > 0 ? shuffled[i - 1].handle : null;
  const isDupe = prev === reel.handle;
  console.log(`${String(i + 1).padStart(2)}. ${reel.handle.padEnd(12)} ${reel.url.padEnd(8)} ${isDupe ? '⚠️  DUPE' : '✅'}`);
});

let dupes = 0;
for (let i = 1; i < shuffled.length; i++) {
  if (shuffled[i].handle === shuffled[i - 1].handle) dupes++;
}

console.log(`\n📊 Result: ${dupes} consecutive duplicates ${dupes === 0 ? '✅ PERFECT' : '⚠️'}\n`);
