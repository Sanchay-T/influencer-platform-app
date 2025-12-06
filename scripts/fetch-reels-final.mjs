#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const apiKey = process.env.SCRAPECREATORS_API_KEY;
const keyword = process.argv[2] || 'fitness workout';

console.log(`\n🔍 Fetching: "${keyword}" - Please wait ~2 min...\n`);

const url = `https://api.scrapecreators.com/v1/instagram/reels/search?query=${encodeURIComponent(keyword)}&amount=60`;

try {
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(180000),
  });

  const text = await response.text();

  // Check if HTML error
  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    console.log('❌ API returned HTML error page. API may be down.');
    process.exit(1);
  }

  const data = JSON.parse(text);

  if (!data.success || !data.reels?.length) {
    console.log('❌ No results:', data);
    process.exit(1);
  }

  const reels = data.reels;
  const quality = reels.filter(r => r.like_count >= 100);

  console.log('═'.repeat(80));
  console.log('RESULTS: ' + reels.length + ' reels fetched, ' + quality.length + ' quality (100+ likes)');
  console.log('═'.repeat(80));
  console.log('\nCSV OUTPUT:\n');
  console.log('USERNAME,LIKES,COMMENTS,PLAYS,REEL_URL,PROFILE_URL');

  quality.sort((a, b) => b.like_count - a.like_count).forEach(r => {
    const username = r.owner?.username || 'unknown';
    const shortcode = r.shortcode || r.code || r.id;
    const reelUrl = `https://instagram.com/reel/${shortcode}`;
    const profileUrl = `https://instagram.com/${username}`;

    console.log(`${username},${r.like_count},${r.comment_count || 0},${r.play_count || 0},${reelUrl},${profileUrl}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('DETAILED VIEW (Top 10):');
  console.log('═'.repeat(80) + '\n');

  quality.slice(0, 10).forEach((r, i) => {
    const username = r.owner?.username || 'unknown';
    const shortcode = r.shortcode || r.code || r.id;

    console.log(`${i+1}. @${username}`);
    console.log(`   ❤️  ${r.like_count.toLocaleString()} likes`);
    console.log(`   🔗 https://instagram.com/reel/${shortcode}`);
    console.log(`   👤 https://instagram.com/${username}`);
    console.log('');
  });

} catch (err) {
  console.error('❌ Error:', err.message);
}
