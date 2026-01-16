/**
 * Wishlink API-Based Product Extractor
 * Uses Wishlink's internal API to fetch products directly (much faster!)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DEBUG = true;
const WISHLINK_API_BASE = 'https://www.wishlink.com/api/next/store';

const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  debug: (msg) => DEBUG && console.log(`[DEBUG] ${msg}`),
  success: (msg) => console.log(`[✅] ${msg}`),
  warn: (msg) => console.log(`[⚠️] ${msg}`),
  error: (msg) => console.log(`[❌] ${msg}`),
  step: (num, msg) => console.log(`\n${'═'.repeat(60)}\n[STEP ${num}] ${msg}\n${'═'.repeat(60)}`),
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWishlinkAPI(page, endpoint) {
  const url = `${WISHLINK_API_BASE}${endpoint}`;
  log.debug(`Fetching: ${url}`);

  try {
    const response = await page.evaluate(async (apiUrl) => {
      const res = await fetch(apiUrl);
      return res.json();
    }, url);

    return response;
  } catch (error) {
    log.error(`API fetch failed: ${error.message}`);
    return null;
  }
}

async function getAllReels(page, username) {
  log.step(1, 'Fetching All Reels via API');

  const allReels = [];
  let currentPage = 1;
  const limit = 50; // Fetch more per page for speed

  while (true) {
    const endpoint = `/getCreatorContent?page=${currentPage}&limit=${limit}&tab=REELS&username=${username}&sourceApp=STOREFRONT`;
    const response = await fetchWishlinkAPI(page, endpoint);

    if (!response || !response.data || response.data.length === 0) {
      break;
    }

    log.debug(`Page ${currentPage}: Got ${response.data.length} reels`);
    allReels.push(...response.data);

    if (response.data.length < limit) {
      break; // Last page
    }

    currentPage++;
    await sleep(200); // Be polite to the API
  }

  log.success(`Fetched ${allReels.length} total reels`);
  return allReels;
}

async function getProductsForReel(page, username, reelId) {
  const endpoint = `/getPostOrCollectionProducts?page=1&limit=50&postType=POST&postOrCollectionId=${reelId}&username=${username}&sourceApp=STOREFRONT`;
  const response = await fetchWishlinkAPI(page, endpoint);

  if (!response || !response.data) {
    return [];
  }

  return response.data;
}

async function checkMyntraDelivery(page, productUrl, pincode) {
  log.debug(`Checking Myntra: ${productUrl.substring(0, 60)}...`);

  try {
    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 25000 });
    await sleep(2000);

    // Wait for product page to load
    await page.waitForSelector('.pdp-price, [class*="pdp-price"], .pdp-name', { timeout: 10000 }).catch(() => {});

    // Get product name
    const productName = await page.evaluate(() => {
      const nameEl = document.querySelector('.pdp-name, .pdp-title, h1[class*="title"]');
      return nameEl ? nameEl.textContent.trim() : 'Unknown Product';
    });

    // Find pincode input area and enter pincode
    // First, look for the change button or the input directly
    const hasPincodeSection = await page.evaluate(() => {
      return !!document.querySelector('.pdp-pincode, [class*="pincode"], [class*="delivery"]');
    });

    if (hasPincodeSection) {
      // Try clicking "Change" if pincode is already set
      try {
        const changeBtn = await page.$('.pdp-pincode-refresh, [class*="pincode-change"], [class*="change-pincode"]');
        if (changeBtn) {
          await changeBtn.click();
          await sleep(500);
        }
      } catch (e) {}

      // Find the input
      const pincodeInput = await page.$('.pdp-pincode-textbox input, input[class*="pincode"], .pincode-input-container input');

      if (pincodeInput) {
        await pincodeInput.click({ clickCount: 3 });
        await pincodeInput.type(pincode, { delay: 50 });
        await page.keyboard.press('Enter');
        await sleep(3000);
      }
    }

    // Extract delivery information
    const deliveryInfo = await page.evaluate(() => {
      // Look for delivery date text
      const selectors = [
        '.pdp-product-delivery-info',
        '[class*="delivery-info"]',
        '.pdp-delivery',
        '[class*="deliveryDate"]',
        '[class*="dispatch"]'
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text.includes('Get it') || text.includes('Delivery') || text.includes('by')) {
            return text;
          }
        }
      }

      // Fallback: search all text for delivery info
      const allText = document.body.innerText;
      const match = allText.match(/Get it by[^\.]+/i) || allText.match(/Delivery by[^\.]+/i);
      return match ? match[0] : null;
    });

    // Parse delivery date
    let deliveryDate = null;
    let beforeDeadline = null;

    if (deliveryInfo) {
      const dateMatch = deliveryInfo.match(/(?:by\s+)?(\w+),?\s+(\w+)\s+(\d+)/i);
      if (dateMatch) {
        const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const monthStr = dateMatch[2].toLowerCase().substring(0, 3);
        const day = parseInt(dateMatch[3]);
        const month = months[monthStr];

        if (month !== undefined && day) {
          deliveryDate = new Date(2025, month, day);
          const deadline = new Date('2025-01-18');
          beforeDeadline = deliveryDate <= deadline;
        }
      }
    }

    return {
      productName,
      deliveryText: deliveryInfo ? deliveryInfo.substring(0, 100) : null,
      deliveryDate: deliveryDate ? deliveryDate.toDateString() : null,
      beforeDeadline,
      success: !!deliveryDate
    };

  } catch (error) {
    log.warn(`Error checking ${productUrl.substring(0, 40)}...: ${error.message}`);
    return {
      productName: 'Error',
      deliveryText: null,
      deliveryDate: null,
      beforeDeadline: null,
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const username = args[0] || 'meghansh07';
  const pincode = args[1] || '421204';
  const deadline = new Date('2025-01-18');

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        WISHLINK API-BASED DELIVERY CHECKER                       ║
╠══════════════════════════════════════════════════════════════════╣
║  Username: ${username.padEnd(53)}║
║  Pincode: ${pincode.padEnd(54)}║
║  Deadline: ${deadline.toDateString().padEnd(53)}║
╚══════════════════════════════════════════════════════════════════╝
  `);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  try {
    // Navigate to Wishlink first (needed to make API calls from same origin)
    log.info('Initializing Wishlink session...');
    await page.goto(`https://www.wishlink.com/${username}`, { waitUntil: 'networkidle2' });

    // Dismiss popup if present
    try {
      await page.click('text/Do Later');
    } catch (e) {}

    // Step 1: Fetch all reels via API
    const reels = await getAllReels(page, username);

    if (reels.length === 0) {
      log.error('No reels found!');
      await browser.close();
      return;
    }

    // Step 2: Fetch products for each reel
    log.step(2, 'Fetching Products for Each Reel');

    const allProducts = [];
    const seenUrls = new Set();

    for (let i = 0; i < reels.length; i++) {
      const reel = reels[i];
      const reelId = reel.id || reel.postId;

      process.stdout.write(`\r  Fetching products for reel ${i + 1}/${reels.length}...`);

      const products = await getProductsForReel(page, username, reelId);

      for (const product of products) {
        // Extract the store URL
        const storeUrl = product.productUrl || product.affiliateUrl || product.url;
        if (!storeUrl) continue;

        // Clean URL for deduplication
        const cleanUrl = storeUrl.split('?')[0];
        if (seenUrls.has(cleanUrl)) continue;
        seenUrls.add(cleanUrl);

        // Determine store
        let store = 'Other';
        if (storeUrl.includes('myntra')) store = 'Myntra';
        else if (storeUrl.includes('ajio')) store = 'Ajio';
        else if (storeUrl.includes('amazon')) store = 'Amazon';
        else if (storeUrl.includes('flipkart')) store = 'Flipkart';
        else if (storeUrl.includes('nykaa')) store = 'Nykaa';

        allProducts.push({
          reelId,
          store,
          productName: product.productName || product.name || 'Unknown',
          price: product.price || product.sellingPrice || '',
          originalPrice: product.mrp || product.originalPrice || '',
          url: storeUrl,
          imageUrl: product.imageUrl || product.image || ''
        });
      }

      await sleep(100);
    }

    console.log(''); // New line after progress
    log.success(`Found ${allProducts.length} unique products`);

    // Show breakdown by store
    const storeBreakdown = {};
    allProducts.forEach(p => {
      storeBreakdown[p.store] = (storeBreakdown[p.store] || 0) + 1;
    });
    log.info('Products by store:');
    Object.entries(storeBreakdown).forEach(([store, count]) => {
      console.log(`   ${store}: ${count}`);
    });

    // Step 3: Check delivery dates for Myntra products
    log.step(3, 'Checking Delivery Dates on Myntra');

    const myntraProducts = allProducts.filter(p => p.store === 'Myntra');
    log.info(`Found ${myntraProducts.length} Myntra products to check`);

    const results = [];
    const deliverableBeforeDeadline = [];

    // Limit to first 50 for testing, remove limit for full run
    const productsToCheck = myntraProducts.slice(0, 50);

    for (let i = 0; i < productsToCheck.length; i++) {
      const product = productsToCheck[i];
      process.stdout.write(`\r  Checking product ${i + 1}/${productsToCheck.length}: ${product.productName.substring(0, 30)}...`);

      const deliveryInfo = await checkMyntraDelivery(page, product.url, pincode);

      const result = {
        ...product,
        ...deliveryInfo
      };

      results.push(result);

      if (deliveryInfo.beforeDeadline === true) {
        deliverableBeforeDeadline.push(result);
        log.debug(`\n   ✅ ${product.productName.substring(0, 40)} - Delivery: ${deliveryInfo.deliveryDate}`);
      }

      await sleep(500);
    }

    console.log('\n');

    // Step 4: Generate results
    log.step(4, 'Results');

    // Save full results to JSON
    fs.writeFileSync('wishlink-results.json', JSON.stringify(results, null, 2));
    log.success('Full results saved to: wishlink-results.json');

    // Save CSV
    const csvHeaders = ['Product Name', 'Store', 'Price', 'Delivery Date', 'Before Jan 18?', 'URL'];
    const csvRows = results.map(r => [
      `"${(r.productName || '').replace(/"/g, '""')}"`,
      r.store,
      r.price,
      r.deliveryDate || 'Unknown',
      r.beforeDeadline === true ? 'YES' : (r.beforeDeadline === false ? 'NO' : 'Unknown'),
      `"${r.url}"`
    ]);

    const csvContent = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    fs.writeFileSync('wishlink-products.csv', csvContent);
    log.success('CSV saved to: wishlink-products.csv');

    // Summary
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                        FINAL SUMMARY                             ║
╠══════════════════════════════════════════════════════════════════╣
║  Total Products Found: ${String(allProducts.length).padEnd(41)}║
║  Myntra Products Checked: ${String(productsToCheck.length).padEnd(38)}║
║                                                                  ║
║  ✅ Deliverable BEFORE Jan 18: ${String(deliverableBeforeDeadline.length).padEnd(33)}║
╚══════════════════════════════════════════════════════════════════╝
    `);

    if (deliverableBeforeDeadline.length > 0) {
      console.log('\n📦 PRODUCTS DELIVERABLE BEFORE JAN 18:');
      console.log('─'.repeat(70));

      deliverableBeforeDeadline.forEach((p, i) => {
        console.log(`
${i + 1}. ${p.productName}
   Price: ${p.price}
   Delivery: ${p.deliveryDate}
   URL: ${p.url}
        `);
      });

      // Save deliverable products to separate file
      fs.writeFileSync('deliverable-before-jan18.json', JSON.stringify(deliverableBeforeDeadline, null, 2));
      log.success('Deliverable products saved to: deliverable-before-jan18.json');
    } else {
      console.log('\n❌ No products found that can be delivered before Jan 18.');
    }

    log.info('\nBrowser will close in 10 seconds...');
    await sleep(10000);

  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
