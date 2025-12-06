#!/usr/bin/env node
/**
 * H3: Deduplication Analysis by Keyword Type
 *
 * Tests generic vs niche keywords and measures duplicate rates
 * Evaluates how keyword specificity affects result overlap
 *
 * Usage:
 *   node scripts/tests/scrapecreators/test-h3-dedup-by-keyword-type.mjs
 *   node scripts/tests/scrapecreators/test-h3-dedup-by-keyword-type.mjs --dry-run
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
  genericKeywords: [
    'fitness',
    'food',
    'travel',
    'fashion',
    'beauty',
  ],
  nicheKeywords: [
    'keto meal prep for beginners',
    'sustainable fashion brands',
    'solo female travel safety',
    'natural skincare routine',
    'home gym equipment reviews',
  ],
  resultsPerKeyword: 20,
  reportPath: 'docs/testing/reports/h3-dedup-by-keyword-type-report.md',
};

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function testKeywordSet(client, keywords, keywordType) {
  console.log(`\n🔍 Testing ${keywordType} keywords (${keywords.length} keywords)`);

  const results = [];

  for (const keyword of keywords) {
    console.log(`  Testing: "${keyword}"`);

    if (isDryRun) {
      // Generate simulated data with different overlap patterns
      const isGeneric = keywordType === 'generic';
      const baseCreators = isGeneric ? 100 : 500; // Generic has more overlap
      const numReels = CONFIG.resultsPerKeyword;

      const reels = Array(numReels).fill(null).map((_, i) => {
        const creatorId = isGeneric
          ? Math.floor(Math.random() * baseCreators) // High overlap for generic
          : Math.floor(Math.random() * baseCreators) + results.length * 100; // Lower overlap for niche

        return {
          id: `sim_${keyword}_${i}`,
          username: `user_${creatorId}`,
          likes: Math.floor(Math.random() * 100000),
          plays: Math.floor(Math.random() * 500000),
        };
      });

      results.push({
        keyword,
        success: true,
        reels,
        credits_remaining: 24953,
        timing: Math.random() * 1500 + 300,
      });

      console.log(`     ✓ ${reels.length} reels (simulated)`);
    } else {
      try {
        const result = await client.searchReels(keyword, CONFIG.resultsPerKeyword);
        results.push({ keyword, ...result });
        console.log(`     ✓ ${result.reels?.length || 0} reels, ${result.timing.toFixed(0)}ms`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          keyword,
          error: error.error || error.message,
          timing: error.timing,
          success: false,
        });
        console.log(`     ✗ Error: ${error.error || error.message}`);
      }
    }
  }

  return results;
}

function analyzeDeduplication(results, keywordType) {
  const allCreators = [];
  const creatorSet = new Set();
  let totalReels = 0;

  results.forEach(result => {
    if (result.reels) {
      result.reels.forEach(reel => {
        // Fix: API returns reel.owner.username, not reel.username
        const username = reel.owner?.username;
        if (username) {
          const lowerUsername = username.toLowerCase();
          allCreators.push(lowerUsername);
          creatorSet.add(lowerUsername);
          totalReels++;
        }
      });
    }
  });

  const uniqueCreators = creatorSet.size;
  const duplicateReels = totalReels - uniqueCreators;
  const duplicationRate = totalReels > 0 ? ((duplicateReels / totalReels) * 100).toFixed(2) : 0;

  // Calculate per-keyword overlap
  const keywordCreatorSets = results.map(r => {
    const creators = new Set();
    if (r.reels) {
      r.reels.forEach(reel => {
        // Fix: API returns reel.owner.username, not reel.username
        const username = reel.owner?.username;
        if (username) creators.add(username.toLowerCase());
      });
    }
    return { keyword: r.keyword, creators };
  });

  // Calculate pairwise overlap
  let totalOverlap = 0;
  let comparisons = 0;

  for (let i = 0; i < keywordCreatorSets.length; i++) {
    for (let j = i + 1; j < keywordCreatorSets.length; j++) {
      const set1 = keywordCreatorSets[i].creators;
      const set2 = keywordCreatorSets[j].creators;
      const intersection = new Set([...set1].filter(c => set2.has(c)));

      if (set1.size > 0 && set2.size > 0) {
        const overlapRate = (intersection.size / Math.min(set1.size, set2.size)) * 100;
        totalOverlap += overlapRate;
        comparisons++;
      }
    }
  }

  const avgPairwiseOverlap = comparisons > 0 ? (totalOverlap / comparisons).toFixed(2) : 0;

  return {
    keywordType,
    totalReels,
    uniqueCreators,
    duplicateReels,
    duplicationRate,
    avgPairwiseOverlap,
    efficiency: totalReels > 0 ? ((uniqueCreators / totalReels) * 100).toFixed(2) : 0,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('H3: Deduplication Analysis by Keyword Type');
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

  // Test generic keywords
  const genericResults = await testKeywordSet(client, CONFIG.genericKeywords, 'generic');
  const genericAnalysis = analyzeDeduplication(genericResults, 'Generic');

  console.log(`\n  📊 Generic Analysis:`);
  console.log(`     Total: ${genericAnalysis.totalReels} reels`);
  console.log(`     Unique: ${genericAnalysis.uniqueCreators} creators`);
  console.log(`     Duplication: ${genericAnalysis.duplicationRate}%`);

  // Delay before niche tests
  if (!isDryRun) {
    console.log('\n⏳ Waiting 3s before niche keyword tests...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Test niche keywords
  const nicheResults = await testKeywordSet(client, CONFIG.nicheKeywords, 'niche');
  const nicheAnalysis = analyzeDeduplication(nicheResults, 'Niche');

  console.log(`\n  📊 Niche Analysis:`);
  console.log(`     Total: ${nicheAnalysis.totalReels} reels`);
  console.log(`     Unique: ${nicheAnalysis.uniqueCreators} creators`);
  console.log(`     Duplication: ${nicheAnalysis.duplicationRate}%`);

  // Generate report
  console.log('\n📊 Generating report...');
  const report = generateReport(genericResults, nicheResults, genericAnalysis, nicheAnalysis);

  const reportPath = path.join(process.cwd(), CONFIG.reportPath);
  report.save(reportPath);

  console.log(`✅ Report saved: ${reportPath}`);
  console.log(`\nFinished: ${formatTimestamp()}`);

  // Print comparison
  printComparison(genericAnalysis, nicheAnalysis);
}

function generateReport(genericResults, nicheResults, genericAnalysis, nicheAnalysis) {
  const report = new MarkdownReportGenerator(
    'H3: Deduplication Analysis by Keyword Type',
    'Compares duplicate rates between generic and niche keywords to optimize search strategy'
  );

  // Executive Summary
  report.addSection('Executive Summary', `
This test evaluates how keyword specificity affects result duplication:
- **Generic Keywords:** Broad terms like "fitness", "food", "travel"
- **Niche Keywords:** Specific long-tail phrases like "keto meal prep for beginners"
- **Goal:** Determine if niche keywords provide better creator diversity
  `);

  // Comparison Table
  const comparisonRows = [
    ['Metric', 'Generic Keywords', 'Niche Keywords', 'Difference'],
    ['Total Reels', genericAnalysis.totalReels, nicheAnalysis.totalReels, '-'],
    ['Unique Creators', genericAnalysis.uniqueCreators, nicheAnalysis.uniqueCreators, '-'],
    ['Duplicate Reels', genericAnalysis.duplicateReels, nicheAnalysis.duplicateReels, '-'],
    ['Duplication Rate', `${genericAnalysis.duplicationRate}%`, `${nicheAnalysis.duplicationRate}%`,
      `${(nicheAnalysis.duplicationRate - genericAnalysis.duplicationRate).toFixed(2)}%`],
    ['Avg Pairwise Overlap', `${genericAnalysis.avgPairwiseOverlap}%`, `${nicheAnalysis.avgPairwiseOverlap}%`,
      `${(nicheAnalysis.avgPairwiseOverlap - genericAnalysis.avgPairwiseOverlap).toFixed(2)}%`],
    ['Efficiency', `${genericAnalysis.efficiency}%`, `${nicheAnalysis.efficiency}%`,
      `${(nicheAnalysis.efficiency - genericAnalysis.efficiency).toFixed(2)}%`],
  ];

  report.addTable('Generic vs Niche Comparison', comparisonRows[0], comparisonRows.slice(1));

  // Generic Keywords Details
  report.addSection('Generic Keywords Analysis', `
**Keywords Tested:** ${CONFIG.genericKeywords.length}
**Total API Calls:** ${genericResults.length}
  `);

  const genericStats = calculateStats(genericResults);
  const genericStatsTable = generateStatsTable(genericStats);
  report.addTable('Generic Keywords Stats', genericStatsTable.headers, genericStatsTable.rows);

  report.addSection('Generic Keywords List', '');
  report.addList(CONFIG.genericKeywords);

  // Niche Keywords Details
  report.addSection('Niche Keywords Analysis', `
**Keywords Tested:** ${CONFIG.nicheKeywords.length}
**Total API Calls:** ${nicheResults.length}
  `);

  const nicheStats = calculateStats(nicheResults);
  const nicheStatsTable = generateStatsTable(nicheStats);
  report.addTable('Niche Keywords Stats', nicheStatsTable.headers, nicheStatsTable.rows);

  report.addSection('Niche Keywords List', '');
  report.addList(CONFIG.nicheKeywords);

  // Key Findings
  const nicheIsBetter = parseFloat(nicheAnalysis.efficiency) > parseFloat(genericAnalysis.efficiency);
  const efficiencyDiff = Math.abs(nicheAnalysis.efficiency - genericAnalysis.efficiency).toFixed(2);

  report.addSection('Key Findings', `
${nicheIsBetter
    ? `✅ **Niche keywords are more efficient** - ${efficiencyDiff}% better creator diversity`
    : `⚠️ **Generic keywords performed better** - ${efficiencyDiff}% better creator diversity`
}

**Insights:**
- Generic duplication rate: ${genericAnalysis.duplicationRate}%
- Niche duplication rate: ${nicheAnalysis.duplicationRate}%
- Generic pairwise overlap: ${genericAnalysis.avgPairwiseOverlap}%
- Niche pairwise overlap: ${nicheAnalysis.avgPairwiseOverlap}%

**Recommendations:**
${nicheIsBetter
    ? '- Prioritize niche, long-tail keywords for better creator discovery\n- Use generic keywords sparingly or as starting points\n- Combine both types for maximum coverage'
    : '- Generic keywords may be sufficient for broad discovery\n- Niche keywords useful for targeted campaigns\n- Consider cost/benefit of longer keyword phrases'
}
  `);

  // Configuration
  report.addSection('Test Configuration', '');
  report.addCodeBlock('json', JSON.stringify(CONFIG, null, 2));

  return report;
}

function printComparison(genericAnalysis, nicheAnalysis) {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                  COMPARISON SUMMARY                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Generic Keywords:');
  console.log(`  Unique: ${genericAnalysis.uniqueCreators}/${genericAnalysis.totalReels} (${genericAnalysis.efficiency}%)`);
  console.log(`  Duplication: ${genericAnalysis.duplicationRate}%`);
  console.log(`  Avg Overlap: ${genericAnalysis.avgPairwiseOverlap}%`);

  console.log('\nNiche Keywords:');
  console.log(`  Unique: ${nicheAnalysis.uniqueCreators}/${nicheAnalysis.totalReels} (${nicheAnalysis.efficiency}%)`);
  console.log(`  Duplication: ${nicheAnalysis.duplicationRate}%`);
  console.log(`  Avg Overlap: ${nicheAnalysis.avgPairwiseOverlap}%`);

  const winner = parseFloat(nicheAnalysis.efficiency) > parseFloat(genericAnalysis.efficiency) ? 'Niche' : 'Generic';
  console.log(`\n🏆 Winner: ${winner} keywords (better efficiency)\n`);
}

// Run the test
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
