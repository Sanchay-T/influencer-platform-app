/**
 * Wishlink Console Product Extractor
 *
 * HOW TO USE:
 * 1. Go to a Wishlink profile page (e.g., https://www.wishlink.com/meghansh07)
 * 2. Open DevTools (Cmd+Option+I on Mac, F12 on Windows)
 * 3. Go to Console tab
 * 4. Paste this entire script and press Enter
 * 5. Wait for extraction to complete
 * 6. A CSV file will be downloaded automatically
 */

(async function extractWishlinkProducts() {
  console.log('%c🔍 Wishlink Product Extractor Started', 'font-size: 16px; font-weight: bold; color: #4CAF50;');

  // Helper function
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Get username from URL
  const username = window.location.pathname.split('/')[1];
  if (!username) {
    console.error('❌ Could not determine username. Make sure you are on a Wishlink profile page.');
    return;
  }
  console.log(`📋 Extracting products for: ${username}`);

  // Step 1: Scroll to load all content
  console.log('📜 Scrolling to load all content...');
  let previousHeight = 0;
  let attempts = 0;

  while (attempts < 15) {
    const currentHeight = document.body.scrollHeight;
    if (currentHeight === previousHeight) {
      attempts++;
      if (attempts >= 3) break;
    } else {
      attempts = 0;
    }
    previousHeight = currentHeight;
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1500);
  }
  window.scrollTo(0, 0);

  // Step 2: Extract reel IDs from thumbnail URLs
  console.log('🎬 Finding reels...');
  const reelIds = new Set();

  // From image URLs
  document.querySelectorAll('img').forEach(img => {
    const match = (img.src || '').match(/thumbnail_[^_]+_p(\d+)_/);
    if (match) reelIds.add(match[1]);
  });

  // From page source
  const pageHTML = document.body.innerHTML;
  const matches = pageHTML.matchAll(/thumbnail_[^_]+_p(\d+)_/g);
  for (const match of matches) {
    reelIds.add(match[1]);
  }

  // Also try to find from href attributes
  document.querySelectorAll('[href*="/reels/"]').forEach(el => {
    const match = el.getAttribute('href').match(/\/reels\/(\d+)/);
    if (match) reelIds.add(match[1]);
  });

  const reelIdArray = Array.from(reelIds);
  console.log(`✅ Found ${reelIdArray.length} reels`);

  // Step 3: Fetch products from each reel
  console.log('🛍️ Extracting products from reels...');
  const allProducts = [];

  for (let i = 0; i < reelIdArray.length; i++) {
    const reelId = reelIdArray[i];
    console.log(`  Processing reel ${i + 1}/${reelIdArray.length} (ID: ${reelId})...`);

    try {
      const response = await fetch(`https://www.wishlink.com/${username}/reels/${reelId}`);
      const html = await response.text();

      // Extract product URLs from the HTML
      const productMatches = html.matchAll(/href="([^"]*(?:myntra|ajio|amazon|flipkart|nykaa)[^"]*)"/gi);

      for (const match of productMatches) {
        let url = match[1];

        // Decode HTML entities
        url = url.replace(/&amp;/g, '&');

        // Determine store
        let store = 'Unknown';
        if (url.includes('myntra')) store = 'Myntra';
        else if (url.includes('ajio')) store = 'Ajio';
        else if (url.includes('amazon')) store = 'Amazon';
        else if (url.includes('flipkart')) store = 'Flipkart';
        else if (url.includes('nykaa')) store = 'Nykaa';

        allProducts.push({
          reelId,
          store,
          url
        });
      }

      // Be polite - small delay between requests
      await sleep(300);
    } catch (error) {
      console.warn(`  ⚠️ Error fetching reel ${reelId}:`, error.message);
    }
  }

  // Step 4: Clean and deduplicate
  console.log('🧹 Cleaning and deduplicating...');

  function cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'af_xp', 'af_force_deeplink',
        'pid', 'is_retargeting', 'af_click_lookback', 'expires', 'signature', 'clickid', 'af_siteid',
        'af_ref', 'atgSessionId', 'af_pmod_priority', 'deep_link_value', 'c'];
      trackingParams.forEach(p => urlObj.searchParams.delete(p));
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  const uniqueProducts = [];
  const seenUrls = new Set();

  for (const product of allProducts) {
    const cleanedUrl = cleanUrl(product.url);
    if (!seenUrls.has(cleanedUrl)) {
      seenUrls.add(cleanedUrl);
      uniqueProducts.push({
        ...product,
        url: cleanedUrl
      });
    }
  }

  console.log(`📊 Total unique products: ${uniqueProducts.length}`);

  // Step 5: Generate and download CSV
  console.log('📄 Generating CSV...');

  const headers = ['Store', 'Product URL', 'Reel ID', 'Delivery Before Jan 18?', 'Actual Delivery Date', 'Notes'];
  const csvRows = [
    headers.join(','),
    ...uniqueProducts.map(p => [
      `"${p.store}"`,
      `"${p.url}"`,
      `"${p.reelId}"`,
      '""', // Delivery Before Jan 18?
      '""', // Actual Delivery Date
      '""'  // Notes
    ].join(','))
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${username}-products-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Summary
  const storeCount = {};
  uniqueProducts.forEach(p => {
    storeCount[p.store] = (storeCount[p.store] || 0) + 1;
  });

  console.log('%c✅ Extraction Complete!', 'font-size: 16px; font-weight: bold; color: #4CAF50;');
  console.log(`
╔════════════════════════════════════════════╗
║           EXTRACTION SUMMARY               ║
╠════════════════════════════════════════════╣
║  Profile: ${username.padEnd(31)}║
║  Total Reels: ${String(reelIdArray.length).padEnd(27)}║
║  Total Products: ${String(uniqueProducts.length).padEnd(24)}║
║                                            ║
║  Products by Store:                        ║`);

  Object.entries(storeCount).forEach(([store, count]) => {
    console.log(`║    ${store}: ${String(count).padEnd(29)}║`);
  });

  console.log(`╚════════════════════════════════════════════╝

📋 Next Steps:
1. Open the downloaded CSV file
2. For each product URL:
   - Open the URL in a new tab
   - Enter your pincode
   - Check the delivery date
3. Fill in "Delivery Before Jan 18?" column (Yes/No)
4. Filter to show only "Yes" products!
  `);

  return uniqueProducts;
})();
