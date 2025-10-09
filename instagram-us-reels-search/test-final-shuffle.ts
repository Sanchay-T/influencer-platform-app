// Test with per-creator limit

const mockReels = [
  { handle: 'creator_a', url: 'url1', score: 95 },
  { handle: 'creator_a', url: 'url2', score: 90 },
  { handle: 'creator_a', url: 'url3', score: 85 },
  { handle: 'creator_a', url: 'url4', score: 80 },
  { handle: 'creator_a', url: 'url5', score: 75 }, // Will be cut
  { handle: 'creator_b', url: 'url6', score: 92 },
  { handle: 'creator_b', url: 'url7', score: 88 },
  { handle: 'creator_b', url: 'url8', score: 84 },
  { handle: 'creator_c', url: 'url9', score: 98 },
  { handle: 'creator_c', url: 'url10', score: 94 },
  { handle: 'creator_c', url: 'url11', score: 90 },
  { handle: 'creator_d', url: 'url12', score: 89 },
  { handle: 'creator_d', url: 'url13', score: 86 },
];

// Limit per creator
const PER_CREATOR_LIMIT = 3;
const limited: any[] = [];
const counts = new Map<string, number>();

for (const reel of mockReels) {
  const count = counts.get(reel.handle) || 0;
  if (count < PER_CREATOR_LIMIT) {
    limited.push(reel);
    counts.set(reel.handle, count + 1);
  }
}

console.log(`\n✂️  LIMITED TO ${PER_CREATOR_LIMIT} PER CREATOR\n`);
console.log(`Before: ${mockReels.length} reels`);
console.log(`After: ${limited.length} reels`);
console.log(`- creator_a: ${limited.filter(r => r.handle === 'creator_a').length}`);
console.log(`- creator_b: ${limited.filter(r => r.handle === 'creator_b').length}`);
console.log(`- creator_c: ${limited.filter(r => r.handle === 'creator_c').length}`);
console.log(`- creator_d: ${limited.filter(r => r.handle === 'creator_d').length}`);

// Now shuffle
function shuffle(reels: any[]): any[] {
  const byHandle = new Map<string, any[]>();
  reels.forEach(r => {
    if (!byHandle.has(r.handle)) byHandle.set(r.handle, []);
    byHandle.get(r.handle)!.push(r);
  });

  byHandle.forEach((list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  });

  const result: any[] = [];
  const pools = Array.from(byHandle.entries());

  while (result.length < reels.length) {
    const available = pools.filter(([_, list]) => list.length > 0);
    if (available.length === 0) break;

    const lastHandle = result.length > 0 ? result[result.length - 1].handle : null;
    let candidates = available.filter(([h, _]) => h !== lastHandle);

    if (candidates.length === 0) candidates = available;

    const randomIdx = Math.floor(Math.random() * candidates.length);
    const [_, list] = candidates[randomIdx];
    result.push(list.shift()!);
  }

  return result;
}

const shuffled = shuffle(limited);

console.log(`\n🎲 SHUFFLED FEED:\n`);
shuffled.forEach((r, i) => {
  const prev = i > 0 ? shuffled[i - 1].handle : null;
  const isDupe = prev === r.handle;
  console.log(`${String(i + 1).padStart(2)}. ${r.handle.padEnd(12)} ${isDupe ? '⚠️  DUPE' : '✅'}`);
});

let dupes = 0;
for (let i = 1; i < shuffled.length; i++) {
  if (shuffled[i].handle === shuffled[i - 1].handle) dupes++;
}

console.log(`\n📊 Result: ${dupes} consecutive duplicates ${dupes === 0 ? '✅ PERFECT!' : '⚠️'}\n`);
