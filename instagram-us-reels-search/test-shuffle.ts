// test-shuffle.ts - Test the shuffle algorithm

// Mock data
const mockReels = [
  { handle: 'creator_a', url: 'url1', usConfidence: 90, usReason: '', relevance: 80 },
  { handle: 'creator_a', url: 'url2', usConfidence: 90, usReason: '', relevance: 75 },
  { handle: 'creator_a', url: 'url3', usConfidence: 90, usReason: '', relevance: 70 },
  { handle: 'creator_a', url: 'url4', usConfidence: 90, usReason: '', relevance: 85 },
  { handle: 'creator_b', url: 'url5', usConfidence: 85, usReason: '', relevance: 90 },
  { handle: 'creator_b', url: 'url6', usConfidence: 85, usReason: '', relevance: 88 },
  { handle: 'creator_b', url: 'url7', usConfidence: 85, usReason: '', relevance: 82 },
  { handle: 'creator_c', url: 'url8', usConfidence: 95, usReason: '', relevance: 95 },
  { handle: 'creator_c', url: 'url9', usConfidence: 95, usReason: '', relevance: 92 },
  { handle: 'creator_d', url: 'url10', usConfidence: 80, usReason: '', relevance: 85 },
  { handle: 'creator_d', url: 'url11', usConfidence: 80, usReason: '', relevance: 80 },
  { handle: 'creator_d', url: 'url12', usConfidence: 80, usReason: '', relevance: 78 },
  { handle: 'creator_d', url: 'url13', usConfidence: 80, usReason: '', relevance: 88 },
  { handle: 'creator_d', url: 'url14', usConfidence: 80, usReason: '', relevance: 84 },
];

function shuffle(reels: any[]): any[] {
  if (reels.length === 0) return [];

  // Step 1: Group by creator and shuffle each group
  const byHandle = new Map<string, any[]>();
  reels.forEach(r => {
    if (!byHandle.has(r.handle)) byHandle.set(r.handle, []);
    byHandle.get(r.handle)!.push(r);
  });

  // Shuffle each creator's reels internally
  byHandle.forEach((list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  });

  // Step 2: Sort creators by count (most reels first)
  const creators = Array.from(byHandle.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // Step 3: Interleave intelligently
  const result: any[] = [];

  while (creators.length > 0) {
    // Remove exhausted creators
    const active = creators.filter(([_, reels]) => reels.length > 0);
    if (active.length === 0) break;

    // Get last creator added (to avoid consecutive)
    const lastHandle = result.length > 0 ? result[result.length - 1].handle : null;

    // Find creators that aren't the last one
    let candidates = active.filter(([h, _]) => h !== lastHandle);

    // If all remaining are same as last (edge case), pick one with most reels left
    if (candidates.length === 0) {
      candidates = active.sort((a, b) => b[1].length - a[1].length);
    }

    // Pick random from candidates (weighted toward those with more reels)
    const randomIdx = Math.floor(Math.random() * Math.min(3, candidates.length));
    const [chosenHandle, chosenReels] = candidates[randomIdx];

    // Add one reel
    result.push(chosenReels.shift()!);

    // Update creators list
    creators.sort((a, b) => b[1].length - a[1].length);
  }

  return result;
}

// Test the shuffle
console.log('\n🎲 TESTING SHUFFLE ALGORITHM\n');
console.log('Input:');
console.log('- creator_a: 4 reels');
console.log('- creator_b: 3 reels');
console.log('- creator_c: 2 reels');
console.log('- creator_d: 5 reels');
console.log('- Total: 14 reels\n');

const shuffled = shuffle(mockReels);

console.log('Output Feed:');
shuffled.forEach((reel, i) => {
  const prev = i > 0 ? shuffled[i - 1].handle : null;
  const consecutive = prev === reel.handle ? '⚠️  DUPLICATE' : '✅';
  console.log(`${i + 1}. ${reel.handle.padEnd(12)} ${reel.url.padEnd(8)} ${consecutive}`);
});

// Check for consecutive duplicates
let consecutiveCount = 0;
for (let i = 1; i < shuffled.length; i++) {
  if (shuffled[i].handle === shuffled[i - 1].handle) {
    consecutiveCount++;
  }
}

console.log(`\n📊 Results:`);
console.log(`   Total Reels: ${shuffled.length}`);
console.log(`   Consecutive Duplicates: ${consecutiveCount}`);
console.log(`   Success: ${consecutiveCount === 0 ? '✅ PASS' : '❌ FAIL'}\n`);
