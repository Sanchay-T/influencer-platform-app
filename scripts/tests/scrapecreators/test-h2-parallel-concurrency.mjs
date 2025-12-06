#!/usr/bin/env node
/**
 * H2: Parallel Concurrency Test
 *
 * Tests ScrapeCreators API at different concurrency levels (1-5)
 * Measures throughput, error rates, and timing at each level
 *
 * Usage:
 *   node scripts/tests/scrapecreators/test-h2-parallel-concurrency.mjs
 *   node scripts/tests/scrapecreators/test-h2-parallel-concurrency.mjs --dry-run
 */

import dotenv from 'dotenv';
import { ScrapeCreatorsClient, calculateStats, formatTimestamp } from './lib/api-client.mjs';
import { MarkdownReportGenerator, generateStatsTable, generateResultsTable } from './lib/report-generator.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

// Configuration
const CONFIG = {
  concurrencyLevels: [1, 2, 3],
  keywords: [
    'meditation',
    'yoga',
    'fitness',
    'wellness',
    'mindfulness',
  ],
  resultsPerKeyword: 10,
  reportPath: 'docs/testing/reports/h2-parallel-concurrency-report.md',
};

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function runConcurrencyTest(client, concurrency, keywords) {
  console.log(`\n🔄 Testing concurrency level: ${concurrency}`);
  console.log(`   Keywords: ${keywords.length}, Results per keyword: ${CONFIG.resultsPerKeyword}`);

  const startTime = Date.now();

  if (isDryRun) {
    // Simulate results for dry run
    const results = keywords.map(keyword => ({
      keyword,
      success: true,
      reels: Array(CONFIG.resultsPerKeyword).fill(null).map((_, i) => ({
        id: `sim_${i}`,
        username: `user_${keyword}_${i}`,
      })),
      credits_remaining: 24953,
      timing: Math.random() * 2000 + 500,
    }));

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    return { results, totalTime, concurrency };
  }

  // Real API calls
  const results = await client.parallelSearch(keywords, CONFIG.resultsPerKeyword, concurrency);
  const endTime = Date.now();
  const totalTime = endTime - startTime;

  console.log(`   ✓ Completed in ${(totalTime / 1000).toFixed(2)}s`);

  return { results, totalTime, concurrency };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('H2: Parallel Concurrency Test');
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

  // Run tests at each concurrency level
  const testResults = [];

  for (const concurrency of CONFIG.concurrencyLevels) {
    try {
      const result = await runConcurrencyTest(client, concurrency, CONFIG.keywords);
      testResults.push(result);

      // Add delay between concurrency tests to avoid rate limiting
      if (!isDryRun && concurrency < CONFIG.concurrencyLevels[CONFIG.concurrencyLevels.length - 1]) {
        console.log('   ⏳ Waiting 2s before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`   ❌ Error at concurrency ${concurrency}:`, error.message);
      testResults.push({
        concurrency,
        error: error.message,
        results: [],
        totalTime: 0,
      });
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
    'H2: Parallel Concurrency Test Report',
    'Tests ScrapeCreators API performance at different concurrency levels (1-5 parallel requests)'
  );

  // Executive Summary
  const summaryStats = testResults.map(tr => {
    const stats = calculateStats(tr.results);
    return {
      concurrency: tr.concurrency,
      totalTime: (tr.totalTime / 1000).toFixed(2),
      throughput: (tr.results.length / (tr.totalTime / 1000)).toFixed(2),
      ...stats,
    };
  });

  report.addSection('Executive Summary', `
This test evaluates API performance under different concurrency levels to identify:
- Optimal concurrency for throughput
- Error rates at high concurrency
- Response time degradation
- Rate limiting thresholds
  `);

  // Summary Table
  const summaryHeaders = ['Concurrency', 'Total Time (s)', 'Throughput (req/s)', 'Success Rate', 'Avg Timing (ms)', 'Failed Requests'];
  const summaryRows = summaryStats.map(s => [
    s.concurrency,
    s.totalTime,
    s.throughput,
    `${s.successRate}%`,
    s.timing.avg,
    s.failed,
  ]);

  report.addTable('Performance Summary', summaryHeaders, summaryRows);

  // Detailed Results for Each Concurrency Level
  testResults.forEach(tr => {
    const stats = calculateStats(tr.results);

    report.addSection(`Concurrency Level: ${tr.concurrency}`, `
**Total Time:** ${(tr.totalTime / 1000).toFixed(2)}s
**Throughput:** ${(tr.results.length / (tr.totalTime / 1000)).toFixed(2)} requests/second
**Keywords Tested:** ${CONFIG.keywords.length}
**Results per Keyword:** ${CONFIG.resultsPerKeyword}
    `);

    // Stats table
    const statsTable = generateStatsTable(stats);
    report.addTable(`Statistics - Concurrency ${tr.concurrency}`, statsTable.headers, statsTable.rows);

    // Results sample (first 10)
    const resultsTable = generateResultsTable(tr.results, 10);
    report.addTable(`Sample Results - Concurrency ${tr.concurrency}`, resultsTable.headers, resultsTable.rows);
  });

  // Key Findings
  const bestThroughput = summaryStats.reduce((best, curr) =>
    parseFloat(curr.throughput) > parseFloat(best.throughput) ? curr : best
  );

  const bestSuccess = summaryStats.reduce((best, curr) =>
    parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
  );

  report.addSection('Key Findings', `
- **Best Throughput:** Concurrency ${bestThroughput.concurrency} at ${bestThroughput.throughput} req/s
- **Best Success Rate:** Concurrency ${bestSuccess.concurrency} at ${bestSuccess.successRate}%
- **Recommended Concurrency:** ${bestThroughput.concurrency} (balances speed and reliability)
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
    const stats = calculateStats(tr.results);
    const throughput = (tr.results.length / (tr.totalTime / 1000)).toFixed(2);

    console.log(`Concurrency ${tr.concurrency}:`);
    console.log(`  Time: ${(tr.totalTime / 1000).toFixed(2)}s | Throughput: ${throughput} req/s`);
    console.log(`  Success: ${stats.successful}/${stats.total} (${stats.successRate}%) | Avg: ${stats.timing.avg}ms`);
    console.log('');
  });
}

// Run the test
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
