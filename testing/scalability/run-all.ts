#!/usr/bin/env tsx
/**
 * Scalability Test Suite Runner
 *
 * Runs all scalability verification tests and produces a summary report.
 *
 * Usage:
 *   npx tsx testing/scalability/run-all.ts           # Run all tests
 *   npx tsx testing/scalability/run-all.ts --baseline  # Save as baseline
 *   npx tsx testing/scalability/run-all.ts --verify    # Compare with baseline
 *
 * Tests included:
 *   1. Database indexes
 *   2. Webhook safety
 *   3. QStash idempotency
 *   4. API route safety
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Types
// ============================================================================

interface TestSuiteResult {
  name: string;
  passed: boolean;
  exitCode: number;
  duration: number;
}

interface SuiteReport {
  timestamp: string;
  results: TestSuiteResult[];
  totalPassed: number;
  totalFailed: number;
  overallPassed: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const TEST_SUITES = [
  { name: 'Database Indexes', script: 'verify-indexes.ts' },
  { name: 'Webhook Safety', script: 'verify-webhooks.ts' },
  { name: 'QStash Idempotency', script: 'verify-qstash.ts' },
  { name: 'API Route Safety', script: 'verify-api-routes.ts' },
];

const BASELINE_FILE = resolve(process.cwd(), 'testing/scalability/.baseline.json');

// ============================================================================
// Test Runner
// ============================================================================

function runTest(scriptPath: string): Promise<{ exitCode: number; duration: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const fullPath = `testing/scalability/${scriptPath}`;

    const proc = spawn('npx', ['tsx', fullPath], {
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        duration: Date.now() - startTime,
      });
    });

    proc.on('error', () => {
      resolve({
        exitCode: 1,
        duration: Date.now() - startTime,
      });
    });
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const saveBaseline = args.includes('--baseline');
  const compareBaseline = args.includes('--verify');

  console.log('\n' + '═'.repeat(60));
  console.log('  🚀 SCALABILITY TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`  Mode: ${saveBaseline ? 'BASELINE' : compareBaseline ? 'VERIFY' : 'RUN'}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('═'.repeat(60) + '\n');

  const results: TestSuiteResult[] = [];

  for (const suite of TEST_SUITES) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Running: ${suite.name}`);
    console.log('─'.repeat(60) + '\n');

    const { exitCode, duration } = await runTest(suite.script);

    results.push({
      name: suite.name,
      passed: exitCode === 0,
      exitCode,
      duration,
    });
  }

  // Generate report
  const report: SuiteReport = {
    timestamp: new Date().toISOString(),
    results,
    totalPassed: results.filter((r) => r.passed).length,
    totalFailed: results.filter((r) => !r.passed).length,
    overallPassed: results.every((r) => r.passed),
  };

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('  📋 FINAL SUMMARY');
  console.log('═'.repeat(60) + '\n');

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const time = `${(result.duration / 1000).toFixed(1)}s`;
    console.log(`  ${status}  ${result.name} (${time})`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(
    `  Total: ${report.totalPassed}/${results.length} passed, ${report.totalFailed} failed`
  );
  console.log('─'.repeat(60));

  // Handle baseline
  if (saveBaseline) {
    writeFileSync(BASELINE_FILE, JSON.stringify(report, null, 2));
    console.log(`\n  📁 Baseline saved to: ${BASELINE_FILE}`);
  }

  // Compare with baseline
  if (compareBaseline && existsSync(BASELINE_FILE)) {
    const baseline: SuiteReport = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'));

    console.log('\n' + '═'.repeat(60));
    console.log('  📊 COMPARISON WITH BASELINE');
    console.log('═'.repeat(60) + '\n');

    console.log(`  Baseline: ${baseline.timestamp}`);
    console.log(`  Current:  ${report.timestamp}\n`);

    for (const result of results) {
      const baselineResult = baseline.results.find((r) => r.name === result.name);
      if (baselineResult) {
        const improvement =
          !baselineResult.passed && result.passed
            ? ' 🎉 FIXED!'
            : baselineResult.passed && !result.passed
              ? ' ⚠️  REGRESSION!'
              : '';
        console.log(`  ${result.name}: ${baselineResult.passed ? 'PASS' : 'FAIL'} → ${result.passed ? 'PASS' : 'FAIL'}${improvement}`);
      }
    }

    console.log(
      `\n  Overall: ${baseline.totalPassed}/${baseline.results.length} → ${report.totalPassed}/${results.length}`
    );
  }

  // Final status
  const finalStatus = report.overallPassed
    ? '\n  ✅ ALL TESTS PASSED\n'
    : '\n  ❌ SOME TESTS FAILED - See above for details\n';

  console.log('═'.repeat(60));
  console.log(finalStatus);

  process.exit(report.overallPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
