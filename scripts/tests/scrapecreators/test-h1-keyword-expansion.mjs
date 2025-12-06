#!/usr/bin/env node
/**
 * H1: Keyword Expansion Test
 *
 * Tests AI keyword expansion latency vs result diversity
 * Compares original keyword results vs expanded keyword results
 *
 * Usage:
 *   node scripts/tests/scrapecreators/test-h1-keyword-expansion.mjs
 *   node scripts/tests/scrapecreators/test-h1-keyword-expansion.mjs --dry-run
 */

import dotenv from 'dotenv';
import { ScrapeCreatorsClient, calculateStats, formatTimestamp } from './lib/api-client.mjs';
import { MarkdownReportGenerator, generateStatsTable } from './lib/report-generator.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

// Configuration
const CONFIG = {
  testKeywords: [
    'meditation',
    'vegan recipes',
    'home workout',
  ],
  expansionMap: {
    'meditation': ['mindfulness meditation', 'guided meditation', 'meditation for beginners', 'morning meditation'],
    'vegan recipes': ['easy vegan recipes', 'vegan meal prep', 'plant-based cooking', 'vegan desserts'],
    'home workout': ['home gym workout', 'bodyweight exercises', 'no equipment workout', 'home fitness routine'],
  },
  resultsPerKeyword: 15,
  reportPath: 'docs/testing/reports/h1-keyword-expansion-report.md',
};

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function testKeyword(client, keyword, isExpanded = false) {
  console.log(`  ${isExpanded ? '📝' : '🔍'} Testing: "${keyword}"`);

  if (isDryRun) {
    const numReels = Math.floor(Math.random() * 5) + CONFIG.resultsPerKeyword - 2;
    return {
      keyword,
      isExpanded,
      success: true,
      reels: Array(numReels).fill(null).map((_, i) => ({
        id: `sim_${keyword}_${i}`,
        username: `user_${keyword.replace(/\s+/g, '_')}_${i}`,
        likes: Math.floor(Math.random() * 100000),
      })),
      credits_remaining: 24953,
      timing: Math.random() * 1500 + 300,
    };
  }

  try {
    const result = await client.searchReels(keyword, CONFIG.resultsPerKeyword);
    console.log(`     ✓ ${result.reels?.length || 0} reels, ${result.timing.toFixed(0)}ms`);
    return { keyword, isExpanded, ...result };
  } catch (error) {
    console.log(`     ✗ Error: ${error.error || error.message}`);
    return {
      keyword,
      isExpanded,
      error: error.error || error.message,
      timing: error.timing,
      success: false,
    };
  }
}

function extractUniqueCreators(results) {
  const creators = new Set();

  results.forEach(result => {
    if (result.reels) {
      result.reels.forEach(reel => {
        // Fix: API returns reel.owner.username, not reel.username
        const username = reel.owner?.username;
        if (username) {
          creators.add(username.toLowerCase());
        }
      });
    }
  });

  return creators;
}

function calculateDiversity(originalResults, expandedResults) {
  const originalCreators = extractUniqueCreators(originalResults);
  const expandedCreators = extractUniqueCreators(expandedResults);

  const allCreators = new Set([...originalCreators, ...expandedCreators]);
  const newCreators = new Set([...expandedCreators].filter(c => !originalCreators.has(c)));

  return {
    originalUnique: originalCreators.size,
    expandedUnique: expandedCreators.size,
    totalUnique: allCreators.size,
    newCreatorsFromExpansion: newCreators.size,
    diversityGain: originalCreators.size > 0
      ? ((newCreators.size / originalCreators.size) * 100).toFixed(2)
      : 0,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('H1: Keyword Expansion Test');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Mode: ${isDryRun ? '🧪 DRY RUN (no API calls)' : '🚀 LIVE'}`);
  console.log(`Started: ${formatTimestamp()}\n`);

  // Initialize client
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!isDryRun && !apiKey) {
    console.error('❌ Error: SCRAPECREATORS_API_KEY not found in environment');
    console.error('   Set the key in .env.local or use --dry-run flag');
    process.exit(1);
  }

  const client = new ScrapeCreatorsClient(apiKey);

  // Run tests
  const testResults = [];

  for (const originalKeyword of CONFIG.testKeywords) {
    console.log(`\n🎯 Testing keyword: "${originalKeyword}"`);

    const startTime = Date.now();

    // Test original keyword
    const originalResult = await testKeyword(client, originalKeyword, false);
    const originalResults = [originalResult];

    // Test expanded keywords
    const expandedKeywords = CONFIG.expansionMap[originalKeyword] || [];
    console.log(`  📋 Expanded to ${expandedKeywords.length} variations`);

    const expandedResults = [];
    for (const expandedKeyword of expandedKeywords) {
      const result = await testKeyword(client, expandedKeyword, true);
      expandedResults.push(result);

      // Small delay to avoid rate limiting
      if (!isDryRun) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate diversity metrics
    const diversity = calculateDiversity(originalResults, expandedResults);

    testResults.push({
      originalKeyword,
      originalResults,
      expandedResults,
      expandedKeywords,
      totalTime,
      diversity,
    });

    console.log(`  ⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  📊 Diversity: +${diversity.newCreatorsFromExpansion} new creators (+${diversity.diversityGain}%)`);

    // Delay between test keywords
    if (!isDryRun) {
      console.log('  ⏳ Waiting 2s before next keyword...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate report
  console.log('\n📊 Generating report...');
  const report = generateReport(testResults);

  const reportPath = path.join(process.cwd(), CONFIG.reportPath);
  report.save(reportPath);

  console.log(`✅ Report saved: ${reportPath}`);
  console.log(`\nFinished: ${formatTimestamp()}`);

  // Print summary
  printSummary(testResults);
}

function generateReport(testResults) {
  const report = new MarkdownReportGenerator(
    'H1: Keyword Expansion Test Report',
    'Compares original keyword search vs expanded keyword variations to measure latency cost and result diversity gain'
  );

  // Executive Summary
  report.addSection('Executive Summary', `
This test evaluates the trade-off between keyword expansion and result quality:
- **Latency Cost:** How much longer does expansion take?
- **Diversity Gain:** How many new unique creators are discovered?
- **Value Assessment:** Is the extra time worth the additional results?
  `);

  // Overall Metrics
  const totalOriginalTime = testResults.reduce((sum, tr) => {
    const originalStats = calculateStats(tr.originalResults);
    return sum + parseFloat(originalStats.timing.avg);
  }, 0);

  const totalExpandedTime = testResults.reduce((sum, tr) => {
    const expandedStats = calculateStats(tr.expandedResults);
    return sum + parseFloat(expandedStats.timing.avg) * tr.expandedResults.length;
  }, 0);

  const totalNewCreators = testResults.reduce((sum, tr) => sum + tr.diversity.newCreatorsFromExpansion, 0);
  const avgDiversityGain = testResults.reduce((sum, tr) => sum + parseFloat(tr.diversity.diversityGain), 0) / testResults.length;

  report.addSection('Overall Metrics', `
- **Original Keywords Tested:** ${testResults.length}
- **Total Expanded Keywords:** ${testResults.reduce((sum, tr) => sum + tr.expandedKeywords.length, 0)}
- **Avg Time per Original Keyword:** ${(totalOriginalTime / testResults.length).toFixed(2)}ms
- **Avg Time per Expanded Search:** ${(totalExpandedTime / testResults.reduce((sum, tr) => sum + tr.expandedResults.length, 0)).toFixed(2)}ms
- **Total New Creators Discovered:** ${totalNewCreators}
- **Avg Diversity Gain:** ${avgDiversityGain.toFixed(2)}%
  `);

  // Detailed Results per Keyword
  testResults.forEach(tr => {
    report.addSection(`Keyword: "${tr.originalKeyword}"`, '');

    // Diversity table
    const diversityRows = [
      ['Metric', 'Value'],
      ['Original Unique Creators', tr.diversity.originalUnique],
      ['Expanded Unique Creators', tr.diversity.expandedUnique],
      ['Total Unique Creators', tr.diversity.totalUnique],
      ['New Creators from Expansion', tr.diversity.newCreatorsFromExpansion],
      ['Diversity Gain', `${tr.diversity.diversityGain}%`],
      ['Total Time', `${(tr.totalTime / 1000).toFixed(2)}s`],
    ];

    report.addTable(`Diversity Metrics - "${tr.originalKeyword}"`, diversityRows[0], diversityRows.slice(1));

    // Original result stats
    const originalStats = calculateStats(tr.originalResults);
    const originalStatsTable = generateStatsTable(originalStats);
    report.addTable(`Original Keyword Stats`, originalStatsTable.headers, originalStatsTable.rows);

    // Expanded results stats
    const expandedStats = calculateStats(tr.expandedResults);
    const expandedStatsTable = generateStatsTable(expandedStats);
    report.addTable(`Expanded Keywords Stats (${tr.expandedKeywords.length} variations)`, expandedStatsTable.headers, expandedStatsTable.rows);

    // List expanded keywords
    report.addSection(`Expanded Variations`, '');
    report.addList(tr.expandedKeywords);
  });

  // Recommendations
  const worthIt = avgDiversityGain > 30; // If we get >30% more creators, it's worth it

  report.addSection('Recommendations', `
${worthIt
    ? '✅ **Keyword expansion is recommended** - significant diversity gain justifies the latency cost'
    : '⚠️ **Keyword expansion may not be worth it** - limited diversity gain for the added latency'
}

**Key Insights:**
- Expansion adds ~${((totalExpandedTime - totalOriginalTime) / totalOriginalTime * 100).toFixed(0)}% more API call time
- Discovers ~${avgDiversityGain.toFixed(0)}% more unique creators on average
- Consider selective expansion for high-value keywords only
  `);

  // Configuration
  report.addSection('Test Configuration', '');
  report.addCodeBlock('json', JSON.stringify(CONFIG, null, 2));

  return report;
}

function printSummary(testResults) {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                     SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  testResults.forEach(tr => {
    console.log(`"${tr.originalKeyword}":`);
    console.log(`  Original: ${tr.diversity.originalUnique} creators`);
    console.log(`  Expanded: ${tr.diversity.expandedUnique} creators (${tr.expandedKeywords.length} variations)`);
    console.log(`  Gain: +${tr.diversity.newCreatorsFromExpansion} creators (+${tr.diversity.diversityGain}%)`);
    console.log(`  Time: ${(tr.totalTime / 1000).toFixed(2)}s`);
    console.log('');
  });
}

// Run the test
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
