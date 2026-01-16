/**
 * Wishlink Delivery Checker - DEBUG VERSION
 * With verbose logging for iteration and improvement
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DEBUG = true;
const WISHLINK_BASE_URL = 'https://www.wishlink.com';

// Logging helpers
const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  debug: (msg) => DEBUG && console.log(`[DEBUG] ${msg}`),
  success: (msg) => console.log(`[✅ SUCCESS] ${msg}`),
  warn: (msg) => console.log(`[⚠️ WARN] ${msg}`),
  error: (msg) => console.log(`[❌ ERROR] ${msg}`),
  step: (num, msg) => console.log(`\n${'═'.repeat(60)}\n[STEP ${num}] ${msg}\n${'═'.repeat(60)}`),
  data: (label, data) => DEBUG && console.log(`[DATA] ${label}:`, JSON.stringify(data, null, 2)),
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function extractReelIds(page, username) {
  log.step(1, 'Extracting Reel IDs from Profile');

  const profileUrl = `${WISHLINK_BASE_URL}/${username}`;
  log.info(`Navigating to: ${profileUrl}`);

  await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  log.success('Page loaded');

  // Take screenshot of initial state
  await page.screenshot({ path: 'debug-01-profile-loaded.png', fullPage: false });
  log.debug('Screenshot saved: debug-01-profile-loaded.png');

  // Check for and dismiss popups
  log.debug('Checking for popups...');
  try {
    const popup = await page.$('text/Do Later');
    if (popup) {
      log.debug('Found "Do Later" popup, clicking...');
      await popup.click();
      await sleep(1000);
      log.success('Popup dismissed');
    }
  } catch (e) {
    log.debug('No popup found or error dismissing: ' + e.message);
  }

  // Scroll to load all content
  log.info('Scrolling to load all content...');
  let previousHeight = 0;
  let scrollCount = 0;
  let noChangeCount = 0;

  while (noChangeCount < 3 && scrollCount < 20) {
    scrollCount++;
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    log.debug(`Scroll #${scrollCount}: height=${currentHeight} (prev=${previousHeight})`);

    if (currentHeight === previousHeight) {
      noChangeCount++;
    } else {
      noChangeCount = 0;
    }

    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);
  }

  log.success(`Scrolling complete after ${scrollCount} scrolls`);
  await page.screenshot({ path: 'debug-02-after-scroll.png', fullPage: false });

  // Extract reel IDs from page content
  log.info('Extracting reel IDs from page content...');
  const pageContent = await page.content();
  log.debug(`Page content length: ${pageContent.length} chars`);

  // Save page source for debugging
  fs.writeFileSync('debug-page-source.html', pageContent);
  log.debug('Page source saved to: debug-page-source.html');

  const reelIds = new Set();

  // Method 1: From thumbnail URLs
  const thumbnailMatches = pageContent.matchAll(/thumbnail_[^_]+_p(\d+)_/g);
  let thumbnailCount = 0;
  for (const match of thumbnailMatches) {
    reelIds.add(match[1]);
    thumbnailCount++;
  }
  log.debug(`Found ${thumbnailCount} matches from thumbnail URLs`);

  // Method 2: From /reels/ hrefs
  const reelHrefMatches = pageContent.matchAll(/\/reels\/(\d+)/g);
  let hrefCount = 0;
  for (const match of reelHrefMatches) {
    reelIds.add(match[1]);
    hrefCount++;
  }
  log.debug(`Found ${hrefCount} matches from /reels/ hrefs`);

  // Method 3: Look for data attributes or JSON data
  const jsonMatches = pageContent.matchAll(/"postId"\s*:\s*"?(\d+)"?/g);
  let jsonCount = 0;
  for (const match of jsonMatches) {
    reelIds.add(match[1]);
    jsonCount++;
  }
  log.debug(`Found ${jsonCount} matches from JSON data`);

  const reelIdArray = Array.from(reelIds);
  log.data('Reel IDs found', reelIdArray.slice(0, 10));
  log.success(`Total unique reel IDs: ${reelIdArray.length}`);

  return reelIdArray;
}

async function extractProductsFromReel(page, username, reelId) {
  const reelUrl = `${WISHLINK_BASE_URL}/${username}/reels/${reelId}`;
  log.debug(`Fetching reel: ${reelUrl}`);

  try {
    await page.goto(reelUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1500);

    // Take screenshot of reel page
    await page.screenshot({ path: `debug-reel-${reelId}.png`, fullPage: false });

    const html = await page.content();
    log.debug(`Reel ${reelId} content length: ${html.length} chars`);

    // Find e-commerce product URLs
    const products = [];
    const patterns = [
      { store: 'Myntra', regex: /href="([^"]*myntra\.com[^"]*)"/gi },
      { store: 'Ajio', regex: /href="([^"]*ajio\.com[^"]*)"/gi },
      { store: 'Amazon', regex: /href="([^"]*amazon\.[^"]*)"/gi },
      { store: 'Flipkart', regex: /href="([^"]*flipkart\.com[^"]*)"/gi },
      { store: 'Nykaa', regex: /href="([^"]*nykaa\.com[^"]*)"/gi },
    ];

    for (const { store, regex } of patterns) {
      const matches = html.matchAll(regex);
      for (const match of matches) {
        let url = match[1].replace(/&amp;/g, '&');
        products.push({ store, url, reelId });
      }
    }

    log.debug(`Reel ${reelId}: found ${products.length} product links`);
    return products;

  } catch (error) {
    log.warn(`Failed to fetch reel ${reelId}: ${error.message}`);
    return [];
  }
}

async function checkMyntraDelivery(page, productUrl, pincode) {
  log.debug(`\n--- Checking Myntra product ---`);
  log.debug(`URL: ${productUrl}`);
  log.debug(`Pincode: ${pincode}`);

  try {
    // Navigate to product
    log.debug('Navigating to product page...');
    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 25000 });
    await sleep(2000);

    // Take screenshot
    const screenshotName = `debug-myntra-${Date.now()}.png`;
    await page.screenshot({ path: screenshotName, fullPage: false });
    log.debug(`Screenshot: ${screenshotName}`);

    // Log current URL (in case of redirects)
    const currentUrl = page.url();
    log.debug(`Current URL: ${currentUrl}`);

    // Check if product page loaded
    const pageTitle = await page.title();
    log.debug(`Page title: ${pageTitle}`);

    // Look for pincode-related elements
    log.debug('Looking for pincode elements...');

    const pincodeSelectors = [
      '.pdp-pincode input',
      'input[class*="pincode"]',
      '.pincode-input-field input',
      '[data-testid="pincode-input"]',
      '.pdp-sizeFitDesc input',
      '#pincode-input'
    ];

    let pincodeInput = null;
    for (const selector of pincodeSelectors) {
      pincodeInput = await page.$(selector);
      if (pincodeInput) {
        log.debug(`Found pincode input with selector: ${selector}`);
        break;
      }
    }

    // Also check for "Check" or "Change" button for pincode
    const changeSelectors = [
      '.pdp-pincode-change',
      'text/Change',
      'text/Check',
      '[class*="pincode"] button',
      '.pincode-check-btn'
    ];

    for (const selector of changeSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          log.debug(`Found pincode change/check button: ${selector}`);
          await btn.click();
          await sleep(1000);
          break;
        }
      } catch (e) {}
    }

    // Try to find pincode input again after clicking change
    if (!pincodeInput) {
      for (const selector of pincodeSelectors) {
        pincodeInput = await page.$(selector);
        if (pincodeInput) {
          log.debug(`Found pincode input after clicking change: ${selector}`);
          break;
        }
      }
    }

    // Enter pincode if input found
    if (pincodeInput) {
      log.debug('Entering pincode...');
      await pincodeInput.click({ clickCount: 3 }); // Select all
      await sleep(200);
      await pincodeInput.type(pincode, { delay: 100 });
      log.debug('Pincode entered, pressing Enter...');
      await page.keyboard.press('Enter');
      await sleep(3000); // Wait for delivery info to update

      await page.screenshot({ path: `debug-myntra-after-pincode-${Date.now()}.png` });
    } else {
      log.warn('Could not find pincode input element');

      // Debug: Log all input elements on page
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
          type: i.type,
          class: i.className,
          id: i.id,
          placeholder: i.placeholder,
          name: i.name
        }));
      });
      log.data('All input elements on page', inputs);
    }

    // Look for delivery information
    log.debug('Looking for delivery information...');

    const deliverySelectors = [
      '.pdp-product-delivery-info',
      '.pdp-deliveryinfo',
      '[class*="delivery-info"]',
      '[class*="deliveryInfo"]',
      '.pdp-product-delivery-info-wrapper',
      '[class*="dispatch"]',
      '[class*="shipping"]'
    ];

    let deliveryText = null;
    for (const selector of deliverySelectors) {
      const el = await page.$(selector);
      if (el) {
        deliveryText = await el.evaluate(e => e.textContent);
        if (deliveryText && deliveryText.trim()) {
          log.debug(`Found delivery info with selector: ${selector}`);
          log.debug(`Delivery text: ${deliveryText.trim().substring(0, 200)}`);
          break;
        }
      }
    }

    // Try broader search if specific selectors didn't work
    if (!deliveryText) {
      log.debug('Trying broader search for delivery text...');
      deliveryText = await page.evaluate(() => {
        // Look for text containing "Get it by" or "Delivery by"
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        while (walker.nextNode()) {
          const text = walker.currentNode.textContent;
          if (text && (text.includes('Get it by') || text.includes('Delivery by') || text.includes('Delivered by'))) {
            // Get parent element's full text
            return walker.currentNode.parentElement.textContent.trim();
          }
        }
        return null;
      });

      if (deliveryText) {
        log.debug(`Found delivery text via tree walker: ${deliveryText.substring(0, 200)}`);
      }
    }

    // Parse the delivery date
    if (deliveryText) {
      log.debug('Parsing delivery date...');

      // Pattern: "Get it by Tue, Jan 20" or "Delivery by 20 Jan"
      const patterns = [
        /Get it by\s+\w+,?\s+(\w+)\s+(\d+)/i,
        /Delivery by\s+(\d+)\s+(\w+)/i,
        /Delivered by\s+\w+,?\s+(\w+)\s+(\d+)/i,
        /by\s+\w+,?\s+(\w+)\s+(\d+)/i,
      ];

      for (const pattern of patterns) {
        const match = deliveryText.match(pattern);
        if (match) {
          log.debug(`Pattern matched: ${pattern}`);
          log.data('Match groups', match);

          // Parse date
          const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

          let month, day;
          for (let i = 1; i < match.length; i++) {
            const part = match[i].toLowerCase();
            const monthNum = months[part.substring(0, 3)];
            if (monthNum !== undefined) {
              month = monthNum;
            } else if (!isNaN(parseInt(part))) {
              day = parseInt(part);
            }
          }

          if (month !== undefined && day) {
            const year = new Date().getFullYear();
            const deliveryDate = new Date(year, month, day);
            log.success(`Parsed delivery date: ${deliveryDate.toDateString()}`);
            return {
              success: true,
              deliveryDate,
              deliveryText: deliveryText.trim().substring(0, 100),
              raw: match[0]
            };
          }
        }
      }

      log.warn('Could not parse delivery date from text');
      return {
        success: false,
        deliveryDate: null,
        deliveryText: deliveryText.trim().substring(0, 100),
        error: 'Could not parse date'
      };
    }

    log.warn('No delivery information found on page');

    // Debug: Dump all text content containing "delivery" or "get it"
    const allDeliveryText = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const texts = [];
      elements.forEach(el => {
        const text = el.textContent || '';
        if ((text.toLowerCase().includes('delivery') || text.toLowerCase().includes('get it')) && text.length < 200) {
          texts.push(text.trim());
        }
      });
      return [...new Set(texts)].slice(0, 10);
    });
    log.data('All delivery-related text on page', allDeliveryText);

    return {
      success: false,
      deliveryDate: null,
      deliveryText: null,
      error: 'No delivery info found'
    };

  } catch (error) {
    log.error(`Error checking Myntra delivery: ${error.message}`);
    return {
      success: false,
      deliveryDate: null,
      deliveryText: null,
      error: error.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const username = args[0] || 'meghansh07';
  const pincode = args[1] || '421204';
  const deadlineStr = args[2] || '2025-01-18';
  const deadline = new Date(deadlineStr);

  console.log(`
${'═'.repeat(70)}
   WISHLINK DELIVERY CHECKER - DEBUG MODE
${'═'.repeat(70)}
   Username: ${username}
   Pincode: ${pincode}
   Deadline: ${deadline.toDateString()}
   Debug: ${DEBUG ? 'ENABLED' : 'DISABLED'}
${'═'.repeat(70)}
  `);

  // Clean up old debug files
  const debugFiles = fs.readdirSync('.').filter(f => f.startsWith('debug-'));
  debugFiles.forEach(f => fs.unlinkSync(f));
  log.debug('Cleaned up old debug files');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: false // Set to true to open Chrome DevTools
  });

  const page = await browser.newPage();

  // Enable request interception for debugging
  await page.setRequestInterception(true);
  page.on('request', request => {
    // Log API calls
    if (request.url().includes('/api/') || request.url().includes('delivery')) {
      log.debug(`[NETWORK] ${request.method()} ${request.url()}`);
    }
    request.continue();
  });

  // Log console messages from page
  page.on('console', msg => {
    if (DEBUG && msg.type() === 'log') {
      log.debug(`[PAGE CONSOLE] ${msg.text()}`);
    }
  });

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Step 1: Extract reel IDs
    const reelIds = await extractReelIds(page, username);

    if (reelIds.length === 0) {
      log.error('No reel IDs found! Check debug-page-source.html for page content.');
      await browser.close();
      return;
    }

    // Step 2: Extract products from first few reels (for testing)
    log.step(2, 'Extracting Product URLs from Reels');

    const testReelCount = Math.min(5, reelIds.length); // Test with first 5 reels
    log.info(`Testing with first ${testReelCount} reels...`);

    const allProducts = [];
    const seenUrls = new Set();

    for (let i = 0; i < testReelCount; i++) {
      const reelId = reelIds[i];
      log.info(`Processing reel ${i + 1}/${testReelCount} (ID: ${reelId})`);

      const products = await extractProductsFromReel(page, username, reelId);

      for (const product of products) {
        // Clean URL for deduplication
        const cleanUrl = product.url.split('?')[0];
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          allProducts.push(product);
        }
      }

      await sleep(500);
    }

    log.success(`Found ${allProducts.length} unique products`);
    log.data('Sample products', allProducts.slice(0, 5));

    // Step 3: Check delivery dates for Myntra products
    log.step(3, 'Checking Delivery Dates');

    const myntraProducts = allProducts.filter(p => p.store === 'Myntra');
    log.info(`Found ${myntraProducts.length} Myntra products to check`);

    // Test with first 3 Myntra products
    const testCount = Math.min(3, myntraProducts.length);
    const results = [];

    for (let i = 0; i < testCount; i++) {
      const product = myntraProducts[i];
      log.info(`\nChecking product ${i + 1}/${testCount}`);

      const result = await checkMyntraDelivery(page, product.url, pincode);
      results.push({
        ...product,
        ...result
      });

      await sleep(1000);
    }

    // Step 4: Summary
    log.step(4, 'Results Summary');

    console.log('\n' + '─'.repeat(70));
    for (const result of results) {
      console.log(`
Store: ${result.store}
URL: ${result.url.substring(0, 80)}...
Delivery Date: ${result.deliveryDate ? result.deliveryDate.toDateString() : 'Unknown'}
Delivery Text: ${result.deliveryText || 'N/A'}
Before Deadline: ${result.deliveryDate ? (result.deliveryDate <= deadline ? '✅ YES' : '❌ NO') : '❓ UNKNOWN'}
Error: ${result.error || 'None'}
${'─'.repeat(70)}`);
    }

    // Save results
    fs.writeFileSync('debug-results.json', JSON.stringify(results, null, 2));
    log.success('Results saved to debug-results.json');

    log.info('\n\nPress Ctrl+C to close browser, or it will close in 30 seconds...');
    await sleep(30000);

  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
