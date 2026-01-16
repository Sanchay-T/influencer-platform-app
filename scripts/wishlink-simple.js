/**
 * Simple Wishlink Product Extractor
 * Directly visits reel pages and captures product URLs from API
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const username = process.argv[2] || 'meghansh07';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log(`\n🔍 Extracting products for: ${username}\n`);

(async () => {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1400, height: 900 } });
  const page = await browser.newPage();

  const products = [];

  // Intercept API responses containing products
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('getPostOrCollectionProducts')) {
      try {
        const json = await response.json();
        if (json.data) {
          json.data.forEach(item => {
            const productUrl = item.productUrl || item.affiliateUrl;
            if (productUrl) {
              products.push({
                name: item.productName || item.name,
                price: item.sellingPrice || item.price,
                url: productUrl
              });
              console.log(`   Found: ${(item.productName || item.name || '').substring(0, 50)}`);
            }
          });
        }
      } catch (e) {}
    }
  });

  // First, get reel IDs from the profile page HTML
  console.log('📄 Loading profile to get reel IDs...');
  await page.goto(`https://www.wishlink.com/${username}`, { waitUntil: 'networkidle2' });

  // Dismiss popup
  try { await page.click('text/Do Later'); } catch (e) {}

  // Scroll a bit to load more
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
  }

  // Extract reel IDs from page source
  const html = await page.content();
  const reelMatches = html.matchAll(/thumbnail_[^_]+_p(\d+)_/g);
  const reelIds = [...new Set([...reelMatches].map(m => m[1]))];

  console.log(`\n📺 Found ${reelIds.length} reels. Visiting each to get products...\n`);

  // Visit each reel page to trigger the product API call
  for (let i = 0; i < Math.min(30, reelIds.length); i++) {
    const reelId = reelIds[i];
    process.stdout.write(`\r   Processing reel ${i + 1}/${Math.min(30, reelIds.length)} (ID: ${reelId})...`);

    try {
      await page.goto(`https://www.wishlink.com/${username}/reels/${reelId}`, {
        waitUntil: 'networkidle2',
        timeout: 15000
      });
      await sleep(1500);
    } catch (e) {}
  }

  console.log('\n');

  // Deduplicate
  const unique = [];
  const seen = new Set();
  products.forEach(p => {
    const key = p.url.split('?')[0];
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  });

  console.log(`\n✅ Found ${unique.length} unique products!\n`);

  // Save
  const csv = ['Name,Price,URL', ...unique.map(p => `"${(p.name || '').replace(/"/g, '""')}",${p.price || ''},"${p.url}"`)].join('\n');
  fs.writeFileSync(`${username}-products.csv`, csv);
  fs.writeFileSync(`${username}-products.json`, JSON.stringify(unique, null, 2));

  console.log(`📄 Saved ${unique.length} products to ${username}-products.csv`);
  console.log(`📄 Saved ${unique.length} products to ${username}-products.json\n`);

  // Show sample
  console.log('📦 First 10 products:');
  unique.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${(p.name || 'Unknown').substring(0, 50)}`);
    console.log(`   ${p.url.substring(0, 80)}`);
  });

  await sleep(3000);
  await browser.close();
})();
