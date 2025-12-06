#!/usr/bin/env node
/**
 * Generate a quality report from ScrapeCreators API for sharing
 * v2 - Fixed username extraction
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const apiKey = process.env.SCRAPECREATORS_API_KEY;
const keyword = process.argv[2] || 'fitness tips';

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║     GEMZ INSTAGRAM SEARCH QUALITY REPORT                        ║');
console.log('║     ScrapeCreators Provider - Real-time Results                 ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`📍 Search Keyword: "${keyword}"`);
console.log(`🕐 Generated: ${new Date().toISOString()}`);
console.log('');

const MIN_LIKES = 100; // Filter threshold

async function fetchReels(query) {
  const url = `https://api.scrapecreators.com/v1/instagram/reels/search?query=${encodeURIComponent(query)}&amount=60`;

  const startTime = Date.now();
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(180000), // 3 min timeout
  });
  const duration = Date.now() - startTime;

  const data = await response.json();

  return {
    success: data.success,
    reels: data.reels || [],
    duration,
    creditsUsed: data.credits_used || 0,
    creditsRemaining: data.credits_remaining || 0,
  };
}

function getUsername(reel) {
  // Try multiple field paths for username
  return reel.owner?.username ||
         reel.user?.username ||
         reel.username ||
         reel.owner_username ||
         reel.author?.username ||
         null;
}

function getFollowers(reel) {
  return reel.owner?.follower_count ||
         reel.user?.follower_count ||
         reel.follower_count ||
         reel.owner_follower_count ||
         0;
}

async function main() {
  try {
    console.log('⏳ Fetching results from ScrapeCreators API...');
    console.log('   (This may take 60-120 seconds)');
    console.log('');

    const result = await fetchReels(keyword);

    if (!result.success || result.reels.length === 0) {
      console.log('❌ No results returned from API');
      return;
    }

    // Debug: Show first reel structure
    console.log('DEBUG - First reel structure:', JSON.stringify(result.reels[0], null, 2).substring(0, 500));
    console.log('');

    // Process results
    const reels = result.reels;
    const withLikes = reels.filter(r => r.like_count !== undefined && r.like_count !== -1);
    const qualityReels = withLikes.filter(r => r.like_count >= MIN_LIKES);

    // Deduplicate by username
    const uniqueCreators = new Map();
    qualityReels.forEach(r => {
      const username = getUsername(r);
      if (username && !uniqueCreators.has(username)) {
        uniqueCreators.set(username, r);
      }
    });

    // Stats
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                          SUMMARY STATS                            ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  📊 Total Reels Fetched:       ${reels.length}`);
    console.log(`  ✅ With Valid Likes Data:     ${withLikes.length}`);
    console.log(`  🌟 Quality Reels (100+ likes): ${qualityReels.length}`);
    console.log(`  👤 Unique Creators Found:     ${uniqueCreators.size}`);
    console.log(`  ⏱️  API Response Time:         ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`  💰 API Credits Used:          ${result.creditsUsed}`);
    console.log(`  💳 Credits Remaining:         ${result.creditsRemaining}`);
    console.log('');

    if (qualityReels.length === 0) {
      console.log('No quality reels found. Try a different keyword.');
      return;
    }

    // Likes distribution
    const likes = qualityReels.map(r => r.like_count);
    const minLikes = Math.min(...likes);
    const maxLikes = Math.max(...likes);
    const avgLikes = Math.round(likes.reduce((a, b) => a + b, 0) / likes.length);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                        ENGAGEMENT QUALITY                         ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  📈 Likes Range:        ${minLikes.toLocaleString()} - ${maxLikes.toLocaleString()}`);
    console.log(`  📊 Average Likes:      ${avgLikes.toLocaleString()}`);
    console.log('');

    // Likes breakdown
    const tier1 = qualityReels.filter(r => r.like_count >= 100 && r.like_count < 1000).length;
    const tier2 = qualityReels.filter(r => r.like_count >= 1000 && r.like_count < 10000).length;
    const tier3 = qualityReels.filter(r => r.like_count >= 10000 && r.like_count < 100000).length;
    const tier4 = qualityReels.filter(r => r.like_count >= 100000).length;

    console.log('  Engagement Tiers:');
    console.log(`    • 100-999 likes:       ${tier1} reels`);
    console.log(`    • 1K-9.9K likes:       ${tier2} reels`);
    console.log(`    • 10K-99.9K likes:     ${tier3} reels`);
    console.log(`    • 100K+ likes:         ${tier4} reels`);
    console.log('');

    // CSV Output - Use all quality reels even without deduplication
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                         CREATOR DATA (CSV)                        ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('USERNAME,PLATFORM,FOLLOWERS,LIKES,COMMENTS,PLAYS,PROFILE_URL,CAPTION_PREVIEW');

    const sortedReels = [...qualityReels].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));

    sortedReels.slice(0, 30).forEach(r => {
      const username = getUsername(r) || 'unknown';
      const followers = getFollowers(r);
      const likes = r.like_count || 0;
      const comments = r.comment_count || 0;
      const plays = r.play_count || 0;
      const profileUrl = username !== 'unknown' ? `https://instagram.com/${username}` : '-';
      const caption = (r.caption || '').replace(/,/g, ';').replace(/\n/g, ' ').substring(0, 30);

      console.log(`${username},Instagram,${followers},${likes},${comments},${plays},${profileUrl},"${caption}..."`);
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                         TOP 10 RESULTS                            ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    sortedReels.slice(0, 10).forEach((r, i) => {
      const username = getUsername(r) || 'unknown';
      const followers = getFollowers(r);
      const likes = r.like_count || 0;
      const caption = (r.caption || '').substring(0, 50);

      console.log(`  ${i + 1}. @${username}`);
      console.log(`     📊 ${likes.toLocaleString()} likes | 👥 ${followers.toLocaleString()} followers`);
      console.log(`     📝 "${caption}..."`);
      console.log(`     🔗 https://instagram.com/reel/${r.id || r.code || 'unknown'}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                           CONCLUSION                              ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  ✅ Successfully found ${qualityReels.length} quality reels`);
    console.log(`     from ${reels.length} total reels`);
    console.log('');
    console.log(`  🎯 Quality Rate: ${((qualityReels.length / reels.length) * 100).toFixed(1)}%`);
    console.log(`     (reels with 100+ likes)`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
