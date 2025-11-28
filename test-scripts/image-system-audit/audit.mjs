/**
 * ============================================================================
 * IMAGE LOADING SYSTEM - COMPREHENSIVE AUDIT
 * ============================================================================
 *
 * This audit tests the entire image loading pipeline:
 * 1. CDN URL patterns and their failure modes
 * 2. Proxy endpoint behavior
 * 3. Frontend error handling (mocked)
 * 4. Proposed fixes with comparison
 *
 * RUN: node test-scripts/image-system-audit/audit.mjs
 *
 * NO PRODUCTION CODE IS MODIFIED
 * ============================================================================
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3002';

// ============================================================================
// TEST DATA - Real-world scenarios
// ============================================================================

const TEST_SCENARIOS = [
  // Working scenarios
  {
    id: 'working-direct',
    name: 'Direct image URL (should always work)',
    url: 'https://picsum.photos/400/600',
    expectedBehavior: 'success',
    category: 'working'
  },
  {
    id: 'working-placeholder',
    name: 'Placeholder service',
    url: 'https://via.placeholder.com/400x600',
    expectedBehavior: 'success',
    category: 'working'
  },

  // Instagram failure scenarios
  {
    id: 'ig-scontent-expired',
    name: 'Instagram scontent CDN (expired/blocked)',
    url: 'https://scontent-iad3-1.cdninstagram.com/v/t51.2885-19/44884218_n.jpg?_nc_ht=scontent&oh=abc123',
    expectedBehavior: 'fail-403',
    category: 'instagram',
    failureReason: 'Instagram CDN blocks server-side requests without proper auth tokens'
  },
  {
    id: 'ig-fbcdn-expired',
    name: 'Instagram fbcdn CDN (expired)',
    url: 'https://instagram.fmaa2-1.fna.fbcdn.net/v/t51.2885-15/123456.jpg?stp=dst-jpg&_nc_cat=1',
    expectedBehavior: 'fail-403',
    category: 'instagram',
    failureReason: 'Facebook CDN URLs expire after ~24 hours'
  },
  {
    id: 'ig-profile-pic',
    name: 'Instagram profile picture',
    url: 'https://scontent.cdninstagram.com/v/t51.2885-19/123_n.jpg',
    expectedBehavior: 'fail-403',
    category: 'instagram',
    failureReason: 'Profile pic CDN URLs are short-lived'
  },

  // TikTok failure scenarios
  {
    id: 'tt-p16-expired',
    name: 'TikTok p16 CDN (expired signature)',
    url: 'https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/video123.webp',
    expectedBehavior: 'fail-placeholder',
    category: 'tiktok',
    failureReason: 'TikTok CDN signatures expire within hours'
  },
  {
    id: 'tt-p77-expired',
    name: 'TikTok p77 CDN',
    url: 'https://p77-sign-va.tiktokcdn.com/tos-maliva-avt-0068/avatar.jpeg',
    expectedBehavior: 'fail-400',
    category: 'tiktok',
    failureReason: 'Invalid or expired CDN path'
  },
  {
    id: 'tt-muscdn',
    name: 'TikTok muscdn (music CDN)',
    url: 'https://p16-amd-va.tiktokcdn.com/img/tos-useast2a-v-0068/thumb.jpeg',
    expectedBehavior: 'fail-placeholder',
    category: 'tiktok',
    failureReason: 'CDN domain may be blocked or expired'
  },

  // Edge cases
  {
    id: 'empty-url',
    name: 'Empty URL',
    url: '',
    expectedBehavior: 'fail-empty',
    category: 'edge-case',
    failureReason: 'No URL provided'
  },
  {
    id: 'malformed-url',
    name: 'Malformed URL',
    url: 'not-a-valid-url',
    expectedBehavior: 'fail-placeholder',
    category: 'edge-case',
    failureReason: 'Invalid URL format'
  },
  {
    id: 'null-url',
    name: 'Null/undefined URL',
    url: null,
    expectedBehavior: 'fail-empty',
    category: 'edge-case',
    failureReason: 'Null URL'
  },
  {
    id: 'timeout-slow',
    name: 'Slow CDN (potential timeout)',
    url: 'https://httpstat.us/200?sleep=5000',
    expectedBehavior: 'success-slow',
    category: 'edge-case',
    failureReason: 'May timeout on slow connections'
  }
];

// ============================================================================
// CURRENT SYSTEM MOCK - Replicates production behavior
// ============================================================================

class CurrentSystemMock {
  constructor() {
    this.hiddenImages = new Set();
    this.loadedImages = new Set();
    this.errors = [];
  }

  /**
   * Mocks the current handleImageError behavior
   * Current code: img.style.display = "none"
   */
  handleImageError(imageId, error) {
    this.hiddenImages.add(imageId);
    this.errors.push({ imageId, error, action: 'HIDDEN' });
    return {
      visible: false,
      fallbackShown: false,
      userSees: 'BLANK_SPACE'
    };
  }

  /**
   * Mocks the current image rendering logic
   */
  renderImage(scenario) {
    // If no URL, current system shows "No preview available"
    if (!scenario.url) {
      return {
        rendered: 'fallback-text',
        visible: true,
        userSees: 'NO_PREVIEW_TEXT'
      };
    }

    // If URL exists but fails, current system HIDES the image
    if (scenario.expectedBehavior.startsWith('fail')) {
      return this.handleImageError(scenario.id, scenario.failureReason);
    }

    // Success case
    this.loadedImages.add(scenario.id);
    return {
      rendered: 'image',
      visible: true,
      userSees: 'ACTUAL_IMAGE'
    };
  }

  getReport() {
    return {
      totalImages: TEST_SCENARIOS.length,
      loaded: this.loadedImages.size,
      hidden: this.hiddenImages.size,
      blankSpaces: this.hiddenImages.size,
      errors: this.errors
    };
  }
}

// ============================================================================
// PROPOSED SYSTEM - Fixed behavior
// ============================================================================

class ProposedSystemMock {
  constructor() {
    this.failedImages = new Set();
    this.loadedImages = new Set();
    this.fallbacksShown = new Set();
    this.events = [];
  }

  /**
   * NEW handleImageError - tracks in state, doesn't hide
   */
  handleImageError(imageId, error) {
    this.failedImages.add(imageId);
    this.fallbacksShown.add(imageId);
    this.events.push({ imageId, error, action: 'FALLBACK_SHOWN' });
    return {
      visible: true,
      fallbackShown: true,
      userSees: 'NICE_FALLBACK_UI'
    };
  }

  /**
   * NEW rendering logic - shows fallback for failed images
   */
  renderImage(scenario) {
    // If no URL, show fallback
    if (!scenario.url) {
      this.fallbacksShown.add(scenario.id);
      return {
        rendered: 'fallback-ui',
        visible: true,
        userSees: 'FALLBACK_WITH_INITIAL',
        fallbackContent: {
          platform: scenario.category,
          initial: 'U',
          message: 'No preview'
        }
      };
    }

    // If URL exists but will fail, show fallback AFTER error
    if (scenario.expectedBehavior.startsWith('fail')) {
      return this.handleImageError(scenario.id, scenario.failureReason);
    }

    // Success case
    this.loadedImages.add(scenario.id);
    return {
      rendered: 'image',
      visible: true,
      userSees: 'ACTUAL_IMAGE'
    };
  }

  getReport() {
    return {
      totalImages: TEST_SCENARIOS.length,
      loaded: this.loadedImages.size,
      fallbacksShown: this.fallbacksShown.size,
      blankSpaces: 0, // Key difference!
      events: this.events
    };
  }
}

// ============================================================================
// LIVE PROXY TESTS - Actual HTTP requests
// ============================================================================

async function testProxyEndpoint(scenario) {
  if (!scenario.url) {
    return {
      scenario: scenario.name,
      skipped: true,
      reason: 'No URL to test'
    };
  }

  const proxyUrl = `${BASE_URL}/api/proxy/image?url=${encodeURIComponent(scenario.url)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const startTime = Date.now();
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeout);

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || 'unknown';
    const contentLength = parseInt(response.headers.get('content-length') || '0');

    const isSvgPlaceholder = contentType.includes('svg');
    const isRealImage = contentType.includes('image/') && !isSvgPlaceholder;

    return {
      scenario: scenario.name,
      id: scenario.id,
      category: scenario.category,
      status: response.status,
      contentType: contentType.split(';')[0],
      size: contentLength,
      duration,
      isRealImage,
      isSvgPlaceholder,
      expectedBehavior: scenario.expectedBehavior,
      actualResult: isRealImage ? 'SUCCESS' : (isSvgPlaceholder ? 'SVG_PLACEHOLDER' : 'ERROR'),
      matchesExpected: (
        (scenario.expectedBehavior === 'success' && isRealImage) ||
        (scenario.expectedBehavior.startsWith('fail') && !isRealImage)
      )
    };
  } catch (error) {
    return {
      scenario: scenario.name,
      id: scenario.id,
      category: scenario.category,
      status: 'ERROR',
      error: error.name === 'AbortError' ? 'TIMEOUT' : error.message,
      expectedBehavior: scenario.expectedBehavior,
      actualResult: 'ERROR'
    };
  }
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateReport(currentResults, proposedResults, proxyResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      current: currentResults,
      proposed: proposedResults,
      improvement: {
        blankSpacesEliminated: currentResults.blankSpaces - proposedResults.blankSpaces,
        fallbacksAdded: proposedResults.fallbacksShown
      }
    },
    proxyTests: {
      total: proxyResults.length,
      successful: proxyResults.filter(r => r.isRealImage).length,
      placeholders: proxyResults.filter(r => r.isSvgPlaceholder).length,
      errors: proxyResults.filter(r => r.status === 'ERROR' || (!r.isRealImage && !r.isSvgPlaceholder && !r.skipped)).length,
      skipped: proxyResults.filter(r => r.skipped).length
    },
    byCategory: {},
    failureAnalysis: [],
    productionChanges: []
  };

  // Group by category
  for (const result of proxyResults) {
    if (!result.category) continue;
    if (!report.byCategory[result.category]) {
      report.byCategory[result.category] = { total: 0, failed: 0, scenarios: [] };
    }
    report.byCategory[result.category].total++;
    if (!result.isRealImage) report.byCategory[result.category].failed++;
    report.byCategory[result.category].scenarios.push({
      name: result.scenario,
      result: result.actualResult,
      status: result.status
    });
  }

  // Failure analysis
  const failures = proxyResults.filter(r => !r.isRealImage && !r.skipped);
  for (const failure of failures) {
    const scenario = TEST_SCENARIOS.find(s => s.id === failure.id);
    report.failureAnalysis.push({
      scenario: failure.scenario,
      category: failure.category,
      reason: scenario?.failureReason || 'Unknown',
      proxyResponse: failure.actualResult,
      currentUserExperience: 'BLANK_SPACE',
      proposedUserExperience: 'FALLBACK_UI'
    });
  }

  // Production changes needed
  report.productionChanges = [
    {
      file: 'app/components/campaigns/keyword-search/search-results.jsx',
      line: '~557',
      change: 'ADD_STATE',
      code: 'const [failedImageIds, setFailedImageIds] = useState(new Set());'
    },
    {
      file: 'app/components/campaigns/keyword-search/search-results.jsx',
      line: '~1478-1482',
      change: 'REPLACE_HANDLER',
      currentCode: `const handleImageError = (e) => {
  const img = e.target;
  if (img) {
    img.style.display = "none";  // ❌ PROBLEM: Hides image
  }
};`,
      newCode: `const handleImageError = useCallback((imageId) => {
  setFailedImageIds(prev => {
    const next = new Set(prev);
    next.add(imageId);
    return next;
  });
}, []);`
    },
    {
      file: 'app/components/campaigns/keyword-search/search-results.jsx',
      line: '~2236-2252',
      change: 'UPDATE_JSX',
      currentCode: `{previewUrl ? (
  <img
    src={previewUrl}
    onError={(event) => handleImageError(event)}
  />
) : (
  <div>No preview available</div>
)}`,
      newCode: `{(!previewUrl || failedImageIds.has(id)) ? (
  <FallbackPlaceholder
    handle={snapshot.handle}
    platform={platformLabel}
    message={previewUrl ? "Failed to load" : "No preview"}
  />
) : (
  <img
    src={previewUrl}
    onError={() => handleImageError(id)}
  />
)}`
    }
  ];

  return report;
}

// ============================================================================
// MAIN AUDIT EXECUTION
// ============================================================================

async function runAudit() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          IMAGE LOADING SYSTEM - COMPREHENSIVE AUDIT              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check server
  console.log('▸ Checking dev server...');
  try {
    const health = await fetch(`${BASE_URL}/api/status`, { signal: AbortSignal.timeout(5000) });
    if (!health.ok) throw new Error('Server not healthy');
    console.log('  ✓ Server running on port 3002');
  } catch (e) {
    console.log('  ✗ Server not running! Start with: npm run dev:wt2');
    process.exit(1);
  }
  console.log('');

  // Run mock tests
  console.log('▸ Running mock behavior tests...');
  const currentSystem = new CurrentSystemMock();
  const proposedSystem = new ProposedSystemMock();

  for (const scenario of TEST_SCENARIOS) {
    currentSystem.renderImage(scenario);
    proposedSystem.renderImage(scenario);
  }

  const currentResults = currentSystem.getReport();
  const proposedResults = proposedSystem.getReport();

  console.log('  Current System:');
  console.log(`    - Images loaded: ${currentResults.loaded}`);
  console.log(`    - Images hidden (blank space): ${currentResults.hidden}`);
  console.log(`    - User sees blank spaces: ${currentResults.blankSpaces}`);
  console.log('');
  console.log('  Proposed System:');
  console.log(`    - Images loaded: ${proposedResults.loaded}`);
  console.log(`    - Fallbacks shown: ${proposedResults.fallbacksShown}`);
  console.log(`    - User sees blank spaces: ${proposedResults.blankSpaces}`);
  console.log('');

  // Run live proxy tests
  console.log('▸ Running live proxy tests...');
  console.log('  (Testing actual /api/proxy/image endpoint)');
  console.log('');

  const proxyResults = [];
  for (const scenario of TEST_SCENARIOS) {
    process.stdout.write(`  Testing: ${scenario.name.slice(0, 40).padEnd(40)} `);
    const result = await testProxyEndpoint(scenario);
    proxyResults.push(result);

    if (result.skipped) {
      console.log('⊘ SKIPPED');
    } else if (result.isRealImage) {
      console.log(`✓ OK (${result.duration}ms)`);
    } else if (result.isSvgPlaceholder) {
      console.log(`⚠ PLACEHOLDER (${result.duration}ms)`);
    } else {
      console.log(`✗ FAIL (${result.status})`);
    }
  }
  console.log('');

  // Generate report
  const report = generateReport(currentResults, proposedResults, proxyResults);

  // Print summary
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                         AUDIT RESULTS                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ PROXY ENDPOINT RESULTS                                          │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│ Total tests:        ${String(report.proxyTests.total).padStart(3)}                                       │`);
  console.log(`│ Real images:        ${String(report.proxyTests.successful).padStart(3)} ✓                                      │`);
  console.log(`│ SVG placeholders:   ${String(report.proxyTests.placeholders).padStart(3)} ⚠                                      │`);
  console.log(`│ Errors:             ${String(report.proxyTests.errors).padStart(3)} ✗                                      │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ BY CATEGORY                                                     │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  for (const [category, data] of Object.entries(report.byCategory)) {
    const failRate = Math.round((data.failed / data.total) * 100);
    console.log(`│ ${category.padEnd(20)} ${data.failed}/${data.total} failed (${failRate}%)`.padEnd(66) + '│');
  }
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ USER EXPERIENCE COMPARISON                                      │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│                       CURRENT        PROPOSED                   │');
  console.log('│ ─────────────────────────────────────────────────────────────── │');
  console.log(`│ Blank spaces:        ${String(currentResults.blankSpaces).padStart(3)}             ${String(proposedResults.blankSpaces).padStart(3)}                      │`);
  console.log(`│ Fallbacks shown:     ${String(0).padStart(3)}             ${String(proposedResults.fallbacksShown).padStart(3)}                      │`);
  console.log(`│ User confusion:      HIGH            LOW                        │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ ROOT CAUSES OF IMAGE FAILURES                                   │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  const uniqueReasons = [...new Set(report.failureAnalysis.map(f => f.reason))];
  uniqueReasons.forEach((reason, i) => {
    console.log(`│ ${i + 1}. ${reason.slice(0, 60).padEnd(60)} │`);
  });
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Save detailed report
  const reportPath = join(__dirname, 'audit-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✓ Detailed report saved to: ${reportPath}`);
  console.log('');

  // Print production changes
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                  REQUIRED PRODUCTION CHANGES                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const change of report.productionChanges) {
    console.log(`File: ${change.file}`);
    console.log(`Line: ${change.line}`);
    console.log(`Action: ${change.change}`);
    console.log('');
    if (change.currentCode) {
      console.log('CURRENT CODE:');
      console.log('─'.repeat(60));
      console.log(change.currentCode);
      console.log('');
    }
    console.log('NEW CODE:');
    console.log('─'.repeat(60));
    console.log(change.newCode || change.code);
    console.log('');
    console.log('═'.repeat(70));
    console.log('');
  }

  return report;
}

// Run the audit
runAudit().catch(console.error);
