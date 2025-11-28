/**
 * Image Loading System Test
 * Tests actual image proxy and CDN behavior
 */

const BASE_URL = 'http://localhost:3002';

// Test cases representing real-world scenarios
const testCases = [
  {
    name: 'Direct image (should work)',
    url: 'https://picsum.photos/200/300',
    expectedIssue: null
  },
  {
    name: 'Instagram CDN (typical)',
    url: 'https://scontent-iad3-1.cdninstagram.com/v/t51.2885-19/123456_n.jpg',
    expectedIssue: 'Instagram CDNs block non-browser requests (403)'
  },
  {
    name: 'TikTok CDN (thumbnail)',
    url: 'https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/123456.webp',
    expectedIssue: 'TikTok CDNs expire quickly'
  },
  {
    name: 'Empty URL',
    url: '',
    expectedIssue: 'Should return error'
  },
  {
    name: 'Malformed URL',
    url: 'not-a-valid-url',
    expectedIssue: 'Should handle gracefully'
  }
];

async function testProxyEndpoint(testCase) {
  if (!testCase.url) {
    return {
      name: testCase.name,
      status: 'SKIPPED',
      success: false,
      reason: 'Empty URL'
    };
  }

  const startTime = Date.now();
  const proxyUrl = BASE_URL + '/api/proxy/image?url=' + encodeURIComponent(testCase.url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });

    clearTimeout(timeout);
    const duration = Date.now() - startTime;

    const contentType = response.headers.get('content-type') || 'unknown';
    const contentLength = response.headers.get('content-length') || '0';

    // Check if it's an SVG placeholder (failure indicator)
    const isPlaceholder = contentType.includes('svg');

    return {
      name: testCase.name,
      url: testCase.url.slice(0, 60),
      status: response.status,
      contentType: contentType.split(';')[0],
      size: Math.round(parseInt(contentLength) / 1024) + 'KB',
      duration: duration + 'ms',
      isPlaceholder,
      success: response.ok && !isPlaceholder,
      expectedIssue: testCase.expectedIssue
    };
  } catch (error) {
    return {
      name: testCase.name,
      url: testCase.url.slice(0, 60),
      status: 'ERROR',
      error: error.name === 'AbortError' ? 'TIMEOUT (>10s)' : error.message,
      success: false,
      expectedIssue: testCase.expectedIssue
    };
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('IMAGE LOADING SYSTEM TEST');
  console.log('='.repeat(70));
  console.log('');

  // Check if server is running
  console.log('1. Checking if dev server is running...');
  try {
    const health = await fetch(BASE_URL + '/api/status', {
      signal: AbortSignal.timeout(5000)
    });
    if (health.ok) {
      console.log('   ✅ Server is running on port 3002');
    }
  } catch (e) {
    console.log('   ❌ Server not running! Start with: npm run dev:wt2');
    console.log('   Error:', e.message);
    process.exit(1);
  }
  console.log('');

  // Test proxy endpoint
  console.log('2. Testing /api/proxy/image endpoint...');
  console.log('-'.repeat(70));

  const results = [];
  for (const testCase of testCases) {
    const result = await testProxyEndpoint(testCase);
    results.push(result);

    const statusIcon = result.success ? '✅' : '❌';
    console.log('');
    console.log('   ' + statusIcon + ' ' + result.name);
    console.log('      URL: ' + (result.url || 'N/A'));
    console.log('      Status: ' + result.status + ' | Type: ' + (result.contentType || 'N/A') + ' | Time: ' + (result.duration || 'N/A'));
    if (result.error) console.log('      Error: ' + result.error);
    if (result.isPlaceholder) console.log('      ⚠️  Returned SVG placeholder (original image failed)');
    if (result.expectedIssue) console.log('      Expected: ' + result.expectedIssue);
  }
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const failures = results.filter(r => !r.success);
  const successes = results.filter(r => r.success);

  console.log('');
  console.log('✅ Passed: ' + successes.length + '/' + results.length);
  console.log('❌ Failed: ' + failures.length + '/' + results.length);
  console.log('');

  console.log('='.repeat(70));
  console.log('ROOT CAUSES FOR IMAGE FAILURES');
  console.log('='.repeat(70));
  console.log('');
  console.log('1. CDN URL EXPIRATION');
  console.log('   - Instagram/TikTok CDN URLs expire after 24-48 hours');
  console.log('   - Stored URLs in database become invalid');
  console.log('   - Results in 403 Forbidden errors');
  console.log('   → FIX: Cache images to blob storage on first load');
  console.log('');
  console.log('2. CDN ACCESS BLOCKING');
  console.log('   - Social media CDNs check User-Agent and Referer');
  console.log('   - Server-side requests often blocked');
  console.log('   → FIX: Proxy adds proper headers (already implemented)');
  console.log('');
  console.log('3. NO FALLBACK UI (MAIN VISIBLE ISSUE)');
  console.log('   - Current code: img.style.display = "none" on error');
  console.log('   - Users see BLANK SPACE instead of fallback');
  console.log('   → FIX: Track failed images in state, show placeholder');
  console.log('');
  console.log('4. PLACEHOLDER SHOWN BUT STILL "BROKEN" FEEL');
  console.log('   - Proxy returns SVG placeholder on failure');
  console.log('   - But frontend may still hide it');
  console.log('   → FIX: Consistent fallback handling');
  console.log('');
  console.log('='.repeat(70));
  console.log('RECOMMENDED SOLUTION');
  console.log('='.repeat(70));
  console.log('');
  console.log('IMMEDIATE FIX (Frontend):');
  console.log('  Replace handleImageError to track failures in state');
  console.log('  Show nice fallback UI with platform badge + user initial');
  console.log('');
  console.log('LONG-TERM FIX (Backend):');
  console.log('  1. On first image load, cache to Vercel Blob storage');
  console.log('  2. Return blob URL for subsequent requests');
  console.log('  3. CDN URLs expire, but blob URLs are permanent');
  console.log('');
}

runTests().catch(console.error);
