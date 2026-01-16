/**
 * Wishlink Product Link Extractor
 * Intercepts API responses to get actual product URLs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const username = process.argv[2] || 'meghansh07';
const pincode = process.argv[3] || '421204';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log(`\n🔍 Extracting products for: ${username}\n`);

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 }
  });

  const page = await browser.newPage();

  // Collect all product data from API responses
  const allProducts = [];

  // Intercept API responses
  page.on('response', async (response) => {
    const url = response.url();

    // Capture product data from API
    if (url.includes('getPostOrCollectionProducts') || url.includes('getCreatorContent')) {
      try {
        const json = await response.json();
        if (json.data && Array.isArray(json.data)) {
          for (const item of json.data) {
            // Products from getPostOrCollectionProducts
            if (item.productUrl || item.affiliateUrl) {
              allProducts.push({
                name: item.productName || item.name || 'Unknown',
                price: item.price || item.sellingPrice,
                url: item.productUrl || item.affiliateUrl,
                store: getStore(item.productUrl || item.affiliateUrl)
              });
            }
            // Reels from getCreatorContent - just log count
            if (item.id && !item.productUrl) {
              // This is a reel, not a product
            }
          }
        }
      } catch (e) {}
    }
  });

  function getStore(url) {
    if (!url) return 'Unknown';
    if (url.includes('myntra')) return 'Myntra';
    if (url.includes('ajio')) return 'Ajio';
    if (url.includes('amazon')) return 'Amazon';
    if (url.includes('flipkart')) return 'Flipkart';
    if (url.includes('nykaa')) return 'Nykaa';
    return 'Other';
  }

  // Go to profile
  console.log('📄 Loading profile page...');
  await page.goto(`https://www.wishlink.com/${username}`, { waitUntil: 'networkidle2' });

  // Dismiss popup
  try {
    await page.click('text/Do Later');
  } catch (e) {}

  // Click on "My Viral Reels" tab to load more content
  console.log('📺 Loading reels tab...');
  try {
    await page.click('text/My Viral Reels');
    await sleep(2000);
  } catch (e) {}

  // Scroll to load all reels
  console.log('📜 Scrolling to load all content...');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);
    process.stdout.write(`\r   Scroll ${i + 1}/10...`);
  }
  console.log('');

  // Now click on several reels to load their products
  console.log('\n🛍️ Clicking reels to load products...');

  // Get all clickable reel thumbnails
  const reelElements = await page.$$('[class*="thumbnail"], [class*="reel"] img, [class*="post"] img');
  console.log(`   Found ${reelElements.length} clickable elements`);

  // Click on first 20 reels to load their products
  const reelsToClick = Math.min(20, reelElements.length);
  for (let i = 0; i < reelsToClick; i++) {
    try {
      process.stdout.write(`\r   Clicking reel ${i + 1}/${reelsToClick}...`);

      // Click the reel
      await reelElements[i].click();
      await sleep(2000);

      // Go back
      await page.goBack({ waitUntil: 'networkidle2' });
      await sleep(1000);

      // Re-get elements after navigation
      const newElements = await page.$$('[class*="thumbnail"], [class*="reel"] img, [class*="post"] img');
      if (newElements[i + 1]) {
        reelElements[i + 1] = newElements[i + 1];
      }
    } catch (e) {
      // Continue on error
    }
  }

  console.log('\n');

  // Deduplicate products
  const uniqueProducts = [];
  const seenUrls = new Set();

  for (const product of allProducts) {
    const cleanUrl = product.url?.split('?')[0];
    if (cleanUrl && !seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl);
      uniqueProducts.push(product);
    }
  }

  console.log(`\n✅ Found ${uniqueProducts.length} unique products!\n`);

  // Group by store
  const byStore = {};
  uniqueProducts.forEach(p => {
    byStore[p.store] = byStore[p.store] || [];
    byStore[p.store].push(p);
  });

  console.log('📊 Products by store:');
  Object.entries(byStore).forEach(([store, products]) => {
    console.log(`   ${store}: ${products.length}`);
  });

  // Save to CSV
  const csvLines = ['Name,Store,Price,URL'];
  uniqueProducts.forEach(p => {
    csvLines.push(`"${(p.name || '').replace(/"/g, '""')}",${p.store},${p.price || ''},"${p.url}"`);
  });

  const csvFile = `${username}-products.csv`;
  fs.writeFileSync(csvFile, csvLines.join('\n'));
  console.log(`\n📄 Saved to: ${csvFile}`);

  // Also save JSON
  fs.writeFileSync(`${username}-products.json`, JSON.stringify(uniqueProducts, null, 2));
  console.log(`📄 Saved to: ${username}-products.json`);

  // Print first 10 products
  console.log('\n📦 Sample products:');
  uniqueProducts.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. [${p.store}] ${p.name?.substring(0, 40) || 'Unknown'}`);
    console.log(`   ${p.url?.substring(0, 70)}...`);
  });

  console.log('\n✨ Done! Check the CSV file for all product links.');
  console.log('   Browser will close in 5 seconds...\n');

  await sleep(5000);
  await browser.close();
})();
