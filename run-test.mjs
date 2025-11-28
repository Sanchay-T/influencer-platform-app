const apiKey = 'SPPv8ILr6ydcwat6NCr9gpp3pZA3';
const keyword = process.argv[2] || 'meditation wellness';
const url = `https://api.scrapecreators.com/v1/instagram/reels/search?query=${encodeURIComponent(keyword)}&amount=60`;

console.log(`Fetching 60 reels for "${keyword}"...`);
const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
const data = await res.json();

console.log('Success:', data.success);
console.log('Total Reels:', data.reels?.length);

if (data.reels?.length) {
  const quality = data.reels.filter(r => r.like_count >= 100);
  const lowQuality = data.reels.filter(r => r.like_count < 100);

  console.log('\n' + '='.repeat(80));
  console.log(`QUALITY REELS (100+ likes): ${quality.length}`);
  console.log('='.repeat(80));
  console.log('USERNAME,LIKES,REEL_URL,PROFILE_URL');
  quality.forEach(r => {
    const u = r.owner?.username || 'unknown';
    const c = r.shortcode || r.id;
    console.log(`${u},${r.like_count},https://instagram.com/reel/${c},https://instagram.com/${u}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`LOW ENGAGEMENT REELS (<100 likes): ${lowQuality.length}`);
  console.log('='.repeat(80));
  console.log('USERNAME,LIKES,REEL_URL,PROFILE_URL');
  lowQuality.forEach(r => {
    const u = r.owner?.username || 'unknown';
    const c = r.shortcode || r.id;
    console.log(`${u},${r.like_count},https://instagram.com/reel/${c},https://instagram.com/${u}`);
  });
}
