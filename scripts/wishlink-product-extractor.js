/**
 * Wishlink Product Extractor
 *
 * This script extracts all product links from a Wishlink influencer profile
 * and outputs them to a CSV file for manual delivery date checking.
 *
 * Usage:
 *   node scripts/wishlink-product-extractor.js <username> [pincode]
 *
 * Example:
 *   node scripts/wishlink-product-extractor.js meghansh07 421204
 *
 * Output:
 *   Creates a CSV file with product name, store, URL, and a column for delivery date
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const WISHLINK_BASE_URL = 'https://www.wishlink.com';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractReelIds(page, username) {
  console.log(`\n📋 Extracting reels from ${username}'s profile...`);

  await page.goto(`${WISHLINK_BASE_URL}/${username}`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Dismiss any popups
  try {
    await page.waitForSelector('text/Do Later', { timeout: 5000 });
    await page.click('text/Do Later');
    await sleep(1000);
  } catch (e) {
    // No popup, continue
  }

  // Scroll to load all content
  console.log('📜 Scrolling to load all content...');
  let previousHeight = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 20;

  while (scrollAttempts < maxScrollAttempts) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    if (currentHeight === previousHeight) {
      scrollAttempts++;
      if (scrollAttempts >= 3) break; // Stop if no new content after 3 attempts
    } else {
      scrollAttempts = 0;
    }

    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1000);

  // Extract reel IDs from thumbnail URLs
  const reelIds = await page.evaluate(() => {
    const ids = new Set();

    // Method 1: Find from image URLs (thumbnails contain reel IDs)
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const src = img.src || '';
      const match = src.match(/thumbnail_[^_]+_p(\d+)_/);
      if (match) {
        ids.add(match[1]);
      }
    });

    // Method 2: Find from any href containing /reels/
    const links = document.querySelectorAll('[href*="/reels/"]');
    links.forEach(link => {
      const match = link.href.match(/\/reels\/(\d+)/);
      if (match) {
        ids.add(match[1]);
      }
    });

    // Method 3: Check data attributes
    const elements = document.querySelectorAll('[data-reel-id], [data-post-id]');
    elements.forEach(el => {
      const id = el.getAttribute('data-reel-id') || el.getAttribute('data-post-id');
      if (id) ids.add(id);
    });

    return Array.from(ids);
  });

  console.log(`✅ Found ${reelIds.length} reels`);
  return reelIds;
}

async function extractProductsFromReel(page, username, reelId) {
  const reelUrl = `${WISHLINK_BASE_URL}/${username}/reels/${reelId}`;

  try {
    await page.goto(reelUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2000);

    // Extract product information from the page
    const products = await page.evaluate(() => {
      const productList = [];

      // Look for product cards (usually at the bottom of reel pages)
      // Common patterns: divs with price, store name, product image
      const productElements = document.querySelectorAll('[class*="product"], [class*="shop"], [class*="item"]');

      productElements.forEach(el => {
        // Try to find product link
        const link = el.querySelector('a[href*="myntra"], a[href*="ajio"], a[href*="amazon"], a[href*="flipkart"]');
        if (!link) return;

        // Try to extract price
        const priceEl = el.querySelector('[class*="price"], [class*="Price"]');
        const price = priceEl ? priceEl.textContent.trim() : '';

        // Try to extract store name
        let store = 'Unknown';
        const href = link.href.toLowerCase();
        if (href.includes('myntra')) store = 'Myntra';
        else if (href.includes('ajio')) store = 'Ajio';
        else if (href.includes('amazon')) store = 'Amazon';
        else if (href.includes('flipkart')) store = 'Flipkart';
        else if (href.includes('nykaa')) store = 'Nykaa';

        productList.push({
          url: link.href,
          price: price,
          store: store
        });
      });

      // Also check for any links that look like product links
      const allLinks = document.querySelectorAll('a');
      allLinks.forEach(link => {
        const href = link.href || '';
        if (href.includes('myntra.com') ||
            href.includes('ajio.com') ||
            href.includes('amazon.') ||
            href.includes('flipkart.com')) {

          // Avoid duplicates
          if (!productList.some(p => p.url === href)) {
            let store = 'Unknown';
            if (href.includes('myntra')) store = 'Myntra';
            else if (href.includes('ajio')) store = 'Ajio';
            else if (href.includes('amazon')) store = 'Amazon';
            else if (href.includes('flipkart')) store = 'Flipkart';

            productList.push({
              url: href,
              price: '',
              store: store
            });
          }
        }
      });

      return productList;
    });

    return products.map(p => ({ ...p, reelId }));
  } catch (error) {
    console.log(`  ⚠️ Error extracting reel ${reelId}: ${error.message}`);
    return [];
  }
}

async function getDeliveryDate(page, productUrl, pincode) {
  if (!pincode) return 'N/A (no pincode provided)';

  try {
    // Navigate to product page
    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2000);

    // For Myntra
    if (productUrl.includes('myntra')) {
      // Enter pincode
      const pincodeInput = await page.$('input[placeholder*="pincode"], input[class*="pincode"]');
      if (pincodeInput) {
        await pincodeInput.click({ clickCount: 3 });
        await pincodeInput.type(pincode);
        await sleep(2000);
      }

      // Extract delivery date
      const deliveryText = await page.evaluate(() => {
        const deliveryEl = document.querySelector('[class*="delivery"], [class*="Delivery"]');
        return deliveryEl ? deliveryEl.textContent : null;
      });

      if (deliveryText) {
        const match = deliveryText.match(/(?:Get it by|Delivery by)[^,]*([\w]+,\s*[\w]+\s*\d+)/i);
        return match ? match[1].trim() : deliveryText.substring(0, 50);
      }
    }

    return 'Could not extract';
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function cleanProductUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remove tracking parameters for cleaner URLs
    const cleanParams = ['utm_source', 'utm_medium', 'utm_campaign', 'af_', 'clickid', 'atgSessionId'];
    cleanParams.forEach(param => {
      urlObj.searchParams.delete(param);
      // Also remove params that start with these prefixes
      for (const key of urlObj.searchParams.keys()) {
        if (key.startsWith('af_') || key.startsWith('utm_')) {
          urlObj.searchParams.delete(key);
        }
      }
    });
    return urlObj.toString();
  } catch {
    return url;
  }
}

function generateCSV(products, filename) {
  const headers = ['Store', 'Product URL', 'Reel ID', 'Price', 'Delivery Before Jan 18?', 'Notes'];
  const rows = products.map(p => [
    p.store,
    cleanProductUrl(p.url),
    p.reelId,
    p.price,
    '', // Empty column for manual checking
    ''  // Notes column
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  fs.writeFileSync(filename, csvContent);
  console.log(`\n📄 CSV saved to: ${filename}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
Usage: node scripts/wishlink-product-extractor.js <username> [pincode]

Arguments:
  username  - Wishlink username (e.g., meghansh07)
  pincode   - Your delivery pincode (optional, for delivery date checking)

Example:
  node scripts/wishlink-product-extractor.js meghansh07 421204
    `);
    process.exit(1);
  }

  const username = args[0];
  const pincode = args[1];

  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Wishlink Product Extractor                       ║
║                                                            ║
║  Extracting products from: ${username.padEnd(30)}║
║  Pincode: ${(pincode || 'Not provided').padEnd(43)}║
╚════════════════════════════════════════════════════════════╝
  `);

  const browser = await puppeteer.launch({
    headless: false, // Set to true for background execution
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Step 1: Extract reel IDs
    const reelIds = await extractReelIds(page, username);

    if (reelIds.length === 0) {
      console.log('\n⚠️ No reels found. Trying alternative extraction...');

      // Alternative: Extract from network requests
      // Navigate back and intercept API calls
      await page.goto(`${WISHLINK_BASE_URL}/${username}`, { waitUntil: 'networkidle2' });

      // Get IDs from thumbnail URLs in page source
      const pageContent = await page.content();
      const matches = pageContent.matchAll(/thumbnail_[^_]+_p(\d+)_/g);
      for (const match of matches) {
        if (!reelIds.includes(match[1])) {
          reelIds.push(match[1]);
        }
      }

      console.log(`✅ Found ${reelIds.length} reels from page source`);
    }

    // Step 2: Extract products from each reel
    console.log('\n🔍 Extracting products from each reel...');
    const allProducts = [];

    for (let i = 0; i < reelIds.length; i++) {
      const reelId = reelIds[i];
      console.log(`  Processing reel ${i + 1}/${reelIds.length} (ID: ${reelId})...`);

      const products = await extractProductsFromReel(page, username, reelId);
      console.log(`    Found ${products.length} products`);

      allProducts.push(...products);

      // Add a small delay between requests to be polite
      await sleep(500);
    }

    // Remove duplicates based on URL
    const uniqueProducts = [];
    const seenUrls = new Set();

    for (const product of allProducts) {
      const cleanUrl = cleanProductUrl(product.url);
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        uniqueProducts.push(product);
      }
    }

    console.log(`\n📊 Total unique products found: ${uniqueProducts.length}`);

    // Step 3: Generate CSV
    const timestamp = new Date().toISOString().split('T')[0];
    const outputFile = path.join(__dirname, `${username}-products-${timestamp}.csv`);
    generateCSV(uniqueProducts, outputFile);

    // Summary
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                      Summary                               ║
╠════════════════════════════════════════════════════════════╣
║  Total Reels Processed: ${String(reelIds.length).padEnd(34)}║
║  Total Products Found:  ${String(uniqueProducts.length).padEnd(34)}║
║                                                            ║
║  Products by Store:                                        ║`);

    const storeCount = {};
    uniqueProducts.forEach(p => {
      storeCount[p.store] = (storeCount[p.store] || 0) + 1;
    });

    Object.entries(storeCount).forEach(([store, count]) => {
      console.log(`║    ${store}: ${String(count).padEnd(43)}║`);
    });

    console.log(`╚════════════════════════════════════════════════════════════╝

Next Steps:
1. Open the CSV file: ${outputFile}
2. For each product URL, visit the page
3. Enter your pincode (${pincode || 'your pincode'})
4. Check if delivery date is before Jan 18
5. Mark "Yes" or "No" in the "Delivery Before Jan 18?" column
    `);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
