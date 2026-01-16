/**
 * Wishlink Product Extractor - Direct DOM extraction
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const username = process.argv[2] || 'meghansh07';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log(`\n🔍 Extracting products for: ${username}\n`);

(async () => {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1400, height: 900 } });
  const page = await browser.newPage();

  // Get reel IDs from profile
  console.log('📄 Loading profile...');
  await page.goto(`https://www.wishlink.com/${username}`, { waitUntil: 'networkidle2' });
  try { await page.click('text/Do Later'); } catch (e) {}

  // Scroll
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
  }

  const html = await page.content();
  const reelIds = [...new Set([...html.matchAll(/thumbnail_[^_]+_p(\d+)_/g)].map(m => m[1]))];
  console.log(`Found ${reelIds.length} reels\n`);

  const allProducts = [];

  // Visit each reel and extract product links from the page
  for (let i = 0; i < Math.min(20, reelIds.length); i++) {
    const reelId = reelIds[i];
    console.log(`Processing reel ${i + 1}/${Math.min(20, reelIds.length)} (${reelId})...`);

    try {
      await page.goto(`https://www.wishlink.com/${username}/reels/${reelId}`, { waitUntil: 'networkidle2', timeout: 20000 });
      await sleep(2000);

      // Wait for products to load
      await page.waitForSelector('[class*="product"], [class*="shop"], a[href*="myntra"], a[href*="ajio"]', { timeout: 5000 }).catch(() => {});

      // Extract product info from page
      const products = await page.evaluate(() => {
        const results = [];

        // Method 1: Find all external store links
        const storeLinks = document.querySelectorAll('a[href*="myntra"], a[href*="ajio"], a[href*="amazon"], a[href*="flipkart"], a[href*="nykaa"]');
        storeLinks.forEach(link => {
          // Try to find associated product info
          const container = link.closest('[class*="product"]') || link.closest('div') || link.parentElement;
          const nameEl = container?.querySelector('[class*="name"], [class*="title"], p, span');
          const priceEl = container?.querySelector('[class*="price"]');

          results.push({
            url: link.href,
            name: nameEl?.textContent?.trim() || '',
            price: priceEl?.textContent?.trim() || ''
          });
        });

        // Method 2: Look at the page's internal state
        // Some React apps store data in window.__PRELOADED_STATE__ or similar
        if (window.__NEXT_DATA__) {
          try {
            const data = window.__NEXT_DATA__;
            // Navigate the data structure to find products
          } catch (e) {}
        }

        return results;
      });

      products.forEach(p => {
        if (p.url) {
          console.log(`   ✓ ${p.name?.substring(0, 40) || p.url.substring(0, 40)}...`);
          allProducts.push({ ...p, reelId });
        }
      });

    } catch (e) {
      console.log(`   ✗ Error: ${e.message}`);
    }
  }

  // Deduplicate
  const unique = [];
  const seen = new Set();
  allProducts.forEach(p => {
    const key = p.url.split('?')[0];
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  });

  console.log(`\n✅ Found ${unique.length} unique products\n`);

  // Save
  if (unique.length > 0) {
    const csv = ['Name,Price,URL,ReelID', ...unique.map(p =>
      `"${(p.name || '').replace(/"/g, '""')}","${p.price || ''}","${p.url}","${p.reelId}"`
    )].join('\n');
    fs.writeFileSync(`${username}-products.csv`, csv);
    fs.writeFileSync(`${username}-products.json`, JSON.stringify(unique, null, 2));
    console.log(`📄 Saved to ${username}-products.csv and ${username}-products.json`);

    console.log('\n📦 Products found:');
    unique.slice(0, 15).forEach((p, i) => {
      console.log(`${i + 1}. ${p.url.substring(0, 80)}`);
    });
  }

  await sleep(3000);
  await browser.close();
})();
