#!/usr/bin/env node
/**
 * Fetch reels and output with full links for sharing
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const apiKey = process.env.SCRAPECREATORS_API_KEY;
const keyword = process.argv[2] || 'fitness tips';

console.log(`\n🔍 Fetching Instagram Reels for: "${keyword}"\n`);
console.log('⏳ Please wait ~2 minutes for API response...\n');

const url = `https://api.scrapecreators.com/v1/instagram/reels/search?query=${encodeURIComponent(keyword)}&amount=60`;

const startTime = Date.now();
const response = await fetch(url, {
  headers: { 'x-api-key': apiKey },
  signal: AbortSignal.timeout(180000),
});
const duration = Date.now() - startTime;

const data = await response.json();

if (!data.success || !data.reels?.length) {
  console.log('❌ No results');
  process.exit(1);
}

const reels = data.reels;
const MIN_LIKES = 100;

// Filter quality reels
const qualityReels = reels.filter(r => r.like_count >= MIN_LIKES);

console.log('═'.repeat(70));
console.log('                    INSTAGRAM REELS SEARCH RESULTS');
console.log('═'.repeat(70));
console.log(`\n📊 Stats: ${reels.length} total → ${qualityReels.length} quality (100+ likes)`);
console.log(`⏱️  API Time: ${(duration/1000).toFixed(1)}s\n`);

// CSV Header
console.log('═'.repeat(70));
console.log('CSV FORMAT (copy below):');
console.log('═'.repeat(70));
console.log('USERNAME,LIKES,COMMENTS,PLAYS,REEL_LINK,PROFILE_LINK,CAPTION');

qualityReels.sort((a, b) => b.like_count - a.like_count).slice(0, 25).forEach(r => {
  const username = r.owner?.username || r.user?.username || 'unknown';
  const code = r.code || r.shortcode || r.id;
  const reelLink = `https://instagram.com/reel/${code}`;
  const profileLink = `https://instagram.com/${username}`;
  const caption = (r.caption || '').replace(/,/g, ';').replace(/\n/g, ' ').substring(0, 40);

  console.log(`${username},${r.like_count},${r.comment_count || 0},${r.play_count || 0},${reelLink},${profileLink},"${caption}"`);
});

// Detailed list
console.log('\n' + '═'.repeat(70));
console.log('                    DETAILED RESULTS (Top 15)');
console.log('═'.repeat(70) + '\n');

qualityReels.slice(0, 15).forEach((r, i) => {
  const username = r.owner?.username || r.user?.username || 'unknown';
  const code = r.code || r.shortcode || r.id;
  const reelLink = `https://instagram.com/reel/${code}`;
  const profileLink = `https://instagram.com/${username}`;
  const caption = (r.caption || '').substring(0, 60);

  console.log(`${i + 1}. @${username}`);
  console.log(`   ❤️  ${r.like_count.toLocaleString()} likes | 💬 ${(r.comment_count || 0).toLocaleString()} comments | ▶️  ${(r.play_count || 0).toLocaleString()} plays`);
  console.log(`   🔗 Reel: ${reelLink}`);
  console.log(`   👤 Profile: ${profileLink}`);
  console.log(`   📝 "${caption}..."`);
  console.log('');
});

console.log('═'.repeat(70));
console.log('✅ DONE - Copy the CSV or detailed results above to share!');
console.log('═'.repeat(70));
