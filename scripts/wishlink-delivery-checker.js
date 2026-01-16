/**
 * Wishlink Delivery Date Checker
 *
 * Extracts all products from a Wishlink profile and automatically checks
 * delivery dates for each product based on your pincode.
 *
 * Usage:
 *   node scripts/wishlink-delivery-checker.js <username> <pincode> [deadline]
 *
 * Example:
 *   node scripts/wishlink-delivery-checker.js meghansh07 421204 "2025-01-18"
 *
 * Output:
 *   - CSV with all products and their delivery dates
 *   - Filtered list of products deliverable before deadline
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const WISHLINK_BASE_URL = 'https://www.wishlink.com';

// Store-specific selectors for delivery date extraction
const STORE_CONFIG = {
  myntra: {
    name: 'Myntra',
    domain: 'myntra.com',
    pincodeSelector: 'input[class*="pincode-input"], input[placeholder*="pincode"], .pdp-pincode input',
    pincodeChangeBtn: '.pdp-pincode-change, [class*="change"]',
    deliverySelector: '.pdp-product-delivery-info, [class*="delivery-info"], [class*="dispatch"]',
    deliveryPattern: /(?:Get it by|Delivery by|dispatched by)[^\d]*(\w+),?\s*(\w+)?\s*(\d+)/i,
  },
  ajio: {
    name: 'Ajio',
    domain: 'ajio.com',
    pincodeSelector: 'input[class*="pincode"], input[placeholder*="pincode"], #pincode-input',
    pincodeChangeBtn: '.pincode-change, [class*="edit-pincode"]',
    deliverySelector: '[class*="delivery-date"], [class*="edd-message"], .prod-delivery',
    deliveryPattern: /(?:Delivery by|Expected by|Get it by)[^\d]*(\d+)\s*(\w+)/i,
  },
  amazon: {
    name: 'Amazon',
    domain: 'amazon.',
    pincodeSelector: '#glow-ingress-block, #contextualIngressPtLabel, input[name="address"]',
    pincodeChangeBtn: '#nav-global-location-popover-link',
    deliverySelector: '#delivery-message, #mir-layout-DELIVERY_BLOCK, [data-csa-c-content-id*="delivery"]',
    deliveryPattern: /(?:Delivery|Get it by|Arriving)[^\d]*(\w+),?\s*(\w+)?\s*(\d+)/i,
  },
  flipkart: {
    name: 'Flipkart',
    domain: 'flipkart.com',
    pincodeSelector: 'input[class*="pincode"], ._2whKao input',
    pincodeChangeBtn: '._2P_LDn, [class*="change"]',
    deliverySelector: '._3XINqE, [class*="delivery-message"]',
    deliveryPattern: /(?:Delivery by|Get it by)[^\d]*(\d+)\s*(\w+)/i,
  },
  nykaa: {
    name: 'Nykaa',
    domain: 'nykaa.com',
    pincodeSelector: 'input[placeholder*="pincode"], .pincode-input',
    pincodeChangeBtn: '.change-pincode',
    deliverySelector: '[class*="delivery"], [class*="eta"]',
    deliveryPattern: /(?:Delivery|Expected)[^\d]*(\d+)\s*(\w+)/i,
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getStoreConfig(url) {
  const urlLower = url.toLowerCase();
  for (const [key, config] of Object.entries(STORE_CONFIG)) {
    if (urlLower.includes(config.domain)) {
      return { key, ...config };
    }
  }
  return null;
}

function parseDeliveryDate(text, pattern) {
  if (!text) return null;

  const match = text.match(pattern);
  if (!match) return null;

  // Try to parse the date
  const months = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  };

  const days = ['sun', 'sunday', 'mon', 'monday', 'tue', 'tuesday', 'wed', 'wednesday',
                'thu', 'thursday', 'fri', 'friday', 'sat', 'saturday'];

  // Extract components
  let day, month, year = new Date().getFullYear();

  for (let i = 1; i < match.length; i++) {
    const part = (match[i] || '').toLowerCase().trim();
    if (!part) continue;

    // Check if it's a day of week (skip)
    if (days.some(d => part.startsWith(d))) continue;

    // Check if it's a month
    const monthMatch = Object.entries(months).find(([m]) => part.startsWith(m));
    if (monthMatch) {
      month = monthMatch[1];
      continue;
    }

    // Check if it's a number (day)
    const num = parseInt(part);
    if (!isNaN(num)) {
      if (num <= 31) {
        day = num;
      } else if (num > 2000) {
        year = num;
      }
    }
  }

  if (day !== undefined && month !== undefined) {
    return new Date(year, month, day);
  }

  return null;
}

async function extractReelIds(page, username) {
  console.log(`\n📋 Extracting reels from ${username}'s profile...`);

  await page.goto(`${WISHLINK_BASE_URL}/${username}`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Dismiss popups
  try {
    const doLaterBtn = await page.waitForSelector('text/Do Later', { timeout: 3000 });
    if (doLaterBtn) await doLaterBtn.click();
    await sleep(500);
  } catch (e) {}

  // Scroll to load content
  console.log('📜 Scrolling to load all content...');
  let previousHeight = 0;
  let scrollAttempts = 0;

  while (scrollAttempts < 15) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) {
      scrollAttempts++;
      if (scrollAttempts >= 3) break;
    } else {
      scrollAttempts = 0;
    }
    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
  }

  // Extract reel IDs
  const pageContent = await page.content();
  const reelIds = new Set();

  const matches = pageContent.matchAll(/thumbnail_[^_]+_p(\d+)_/g);
  for (const match of matches) {
    reelIds.add(match[1]);
  }

  // Also check href attributes
  const hrefMatches = pageContent.matchAll(/\/reels\/(\d+)/g);
  for (const match of hrefMatches) {
    reelIds.add(match[1]);
  }

  console.log(`✅ Found ${reelIds.size} reels`);
  return Array.from(reelIds);
}

async function extractProductUrls(page, username, reelIds) {
  console.log('\n🛍️ Extracting product URLs from reels...');
  const products = [];
  const seenUrls = new Set();

  for (let i = 0; i < reelIds.length; i++) {
    const reelId = reelIds[i];
    process.stdout.write(`\r  Processing reel ${i + 1}/${reelIds.length}...`);

    try {
      const response = await page.goto(`${WISHLINK_BASE_URL}/${username}/reels/${reelId}`, {
        waitUntil: 'networkidle2',
        timeout: 15000
      });

      const html = await page.content();

      // Find all e-commerce links
      const urlPatterns = [
        /href="([^"]*myntra\.com[^"]*)"/gi,
        /href="([^"]*ajio\.com[^"]*)"/gi,
        /href="([^"]*amazon\.[^"]*)"/gi,
        /href="([^"]*flipkart\.com[^"]*)"/gi,
        /href="([^"]*nykaa\.com[^"]*)"/gi,
      ];

      for (const pattern of urlPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          let url = match[1].replace(/&amp;/g, '&');

          // Clean URL
          try {
            const urlObj = new URL(url);
            // Keep only essential params
            const essentialParams = ['id', 'pid', 'skuId', 'dp'];
            const newParams = new URLSearchParams();
            for (const param of essentialParams) {
              if (urlObj.searchParams.has(param)) {
                newParams.set(param, urlObj.searchParams.get(param));
              }
            }
            url = `${urlObj.origin}${urlObj.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`;
          } catch {}

          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            const storeConfig = getStoreConfig(url);
            products.push({
              url,
              reelId,
              store: storeConfig?.name || 'Unknown',
              storeKey: storeConfig?.key || null
            });
          }
        }
      }

      await sleep(300);
    } catch (error) {
      // Skip failed reels
    }
  }

  console.log(`\n✅ Found ${products.length} unique products`);
  return products;
}

async function checkDeliveryDate(page, product, pincode) {
  const config = STORE_CONFIG[product.storeKey];
  if (!config) {
    return { ...product, deliveryDate: null, deliveryText: 'Unsupported store', error: null };
  }

  try {
    // Navigate to product
    await page.goto(product.url, { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2000);

    // Handle Myntra specifically (most common)
    if (product.storeKey === 'myntra') {
      // Wait for page to load
      await page.waitForSelector('.pdp-price, [class*="pdp-price"]', { timeout: 10000 }).catch(() => {});

      // Check if we need to enter/change pincode
      const changeBtn = await page.$('.pdp-pincode-change, [class*="pincode-change"]');
      if (changeBtn) {
        await changeBtn.click();
        await sleep(500);
      }

      // Find and fill pincode input
      const pincodeInput = await page.$('.pdp-pincode input, input[class*="pincode"]');
      if (pincodeInput) {
        await pincodeInput.click({ clickCount: 3 });
        await pincodeInput.type(pincode, { delay: 50 });
        await page.keyboard.press('Enter');
        await sleep(2000);
      }

      // Extract delivery info
      const deliveryInfo = await page.evaluate(() => {
        const selectors = [
          '.pdp-deliveryinfo-deldate',
          '[class*="delivery-info"]',
          '[class*="dispatch"]',
          '.pdp-product-delivery-info'
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim()) {
            return el.textContent.trim();
          }
        }

        // Try finding any element with delivery text
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.match(/Get it by|Delivery by/i) && text.length < 100) {
            return text.trim();
          }
        }

        return null;
      });

      if (deliveryInfo) {
        const parsedDate = parseDeliveryDate(deliveryInfo, config.deliveryPattern);
        return {
          ...product,
          deliveryDate: parsedDate,
          deliveryText: deliveryInfo.substring(0, 100),
          error: null
        };
      }
    }

    // Generic approach for other stores
    // Try to find pincode input
    const pincodeInput = await page.$(config.pincodeSelector);
    if (pincodeInput) {
      await pincodeInput.click({ clickCount: 3 });
      await pincodeInput.type(pincode, { delay: 50 });
      await page.keyboard.press('Enter');
      await sleep(2000);
    }

    // Extract delivery text
    const deliveryText = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? el.textContent.trim() : null;
    }, config.deliverySelector);

    if (deliveryText) {
      const parsedDate = parseDeliveryDate(deliveryText, config.deliveryPattern);
      return {
        ...product,
        deliveryDate: parsedDate,
        deliveryText: deliveryText.substring(0, 100),
        error: null
      };
    }

    return { ...product, deliveryDate: null, deliveryText: 'Could not find delivery info', error: null };

  } catch (error) {
    return { ...product, deliveryDate: null, deliveryText: null, error: error.message };
  }
}

function generateReport(products, deadline, outputDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

  // Separate products by delivery status
  const deliverableBefore = [];
  const deliverableAfter = [];
  const unknown = [];

  for (const product of products) {
    if (product.deliveryDate) {
      if (product.deliveryDate <= deadline) {
        deliverableBefore.push(product);
      } else {
        deliverableAfter.push(product);
      }
    } else {
      unknown.push(product);
    }
  }

  // Generate CSV with all products
  const headers = ['Store', 'Product URL', 'Delivery Date', 'Delivery Text', 'Before Deadline?', 'Error'];
  const rows = products.map(p => [
    p.store,
    p.url,
    p.deliveryDate ? p.deliveryDate.toDateString() : 'Unknown',
    (p.deliveryText || '').replace(/"/g, '""'),
    p.deliveryDate ? (p.deliveryDate <= deadline ? 'YES' : 'NO') : 'UNKNOWN',
    p.error || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const csvFile = path.join(outputDir, `products-delivery-${timestamp}.csv`);
  fs.writeFileSync(csvFile, csvContent);

  // Generate summary report
  const report = `
╔══════════════════════════════════════════════════════════════════╗
║              DELIVERY DATE CHECK RESULTS                         ║
╠══════════════════════════════════════════════════════════════════╣
║  Deadline: ${deadline.toDateString().padEnd(52)}║
║  Total Products Checked: ${String(products.length).padEnd(40)}║
║                                                                  ║
║  ✅ Deliverable BEFORE ${deadline.toDateString()}: ${String(deliverableBefore.length).padEnd(26)}║
║  ❌ Deliverable AFTER deadline: ${String(deliverableAfter.length).padEnd(27)}║
║  ❓ Unknown delivery date: ${String(unknown.length).padEnd(33)}║
╚══════════════════════════════════════════════════════════════════╝

📦 PRODUCTS DELIVERABLE BEFORE ${deadline.toDateString()}:
${'─'.repeat(66)}
${deliverableBefore.length > 0 ?
    deliverableBefore.map((p, i) =>
      `${i + 1}. [${p.store}] ${p.deliveryDate.toDateString()}\n   ${p.url}`
    ).join('\n\n')
    : 'No products found that can be delivered before the deadline.'}

📄 Full CSV report saved to: ${csvFile}
`;

  console.log(report);

  // Save deliverable products to separate file
  if (deliverableBefore.length > 0) {
    const deliverableFile = path.join(outputDir, `deliverable-before-deadline-${timestamp}.txt`);
    const deliverableContent = deliverableBefore.map(p =>
      `[${p.store}] Delivery: ${p.deliveryDate.toDateString()}\n${p.url}`
    ).join('\n\n');
    fs.writeFileSync(deliverableFile, deliverableContent);
    console.log(`\n✅ Deliverable products saved to: ${deliverableFile}`);
  }

  return { deliverableBefore, deliverableAfter, unknown };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: node scripts/wishlink-delivery-checker.js <username> <pincode> [deadline]

Arguments:
  username  - Wishlink username (e.g., meghansh07)
  pincode   - Your delivery pincode (e.g., 421204)
  deadline  - Delivery deadline date (default: 2025-01-18)

Example:
  node scripts/wishlink-delivery-checker.js meghansh07 421204 "2025-01-18"
    `);
    process.exit(1);
  }

  const username = args[0];
  const pincode = args[1];
  const deadlineStr = args[2] || '2025-01-18';
  const deadline = new Date(deadlineStr);
  deadline.setHours(23, 59, 59, 999); // End of day

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           Wishlink Delivery Date Checker                         ║
║                                                                  ║
║  Profile: ${username.padEnd(55)}║
║  Pincode: ${pincode.padEnd(55)}║
║  Deadline: ${deadline.toDateString().padEnd(54)}║
╚══════════════════════════════════════════════════════════════════╝
  `);

  const browser = await puppeteer.launch({
    headless: false, // Set to true for background execution
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Step 1: Extract reel IDs
    const reelIds = await extractReelIds(page, username);

    // Step 2: Extract product URLs
    const products = await extractProductUrls(page, username, reelIds);

    // Step 3: Check delivery dates
    console.log('\n📅 Checking delivery dates (this may take a while)...\n');

    const productsWithDelivery = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      process.stdout.write(`\r  Checking product ${i + 1}/${products.length} [${product.store}]...`);

      const result = await checkDeliveryDate(page, product, pincode);
      productsWithDelivery.push(result);

      // Small delay between checks
      await sleep(500);
    }

    console.log('\n');

    // Step 4: Generate report
    const outputDir = path.dirname(__filename);
    generateReport(productsWithDelivery, deadline, outputDir);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
