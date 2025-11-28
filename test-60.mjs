import 'dotenv/config';

const apiKey = process.env.SCRAPECREATORS_API_KEY;
console.log('API Key loaded:', apiKey ? 'Yes' : 'No');

const url = 'https://api.scrapecreators.com/v1/instagram/reels/search?query=fitness&amount=60';

console.log('Fetching...');
const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
const data = await res.json();

console.log('Success:', data.success);
console.log('Reels:', data.reels?.length);

if (data.reels?.length > 0) {
  const quality = data.reels.filter(r => r.like_count >= 100);
  console.log('Quality (100+ likes):', quality.length);
  console.log('\n--- CSV ---');
  console.log('USERNAME,LIKES,REEL_URL,PROFILE_URL');

  quality.slice(0, 20).forEach(r => {
    const user = r.owner?.username || 'unknown';
    const code = r.shortcode || r.code || r.id;
    console.log(`${user},${r.like_count},https://instagram.com/reel/${code},https://instagram.com/${user}`);
  });
}
