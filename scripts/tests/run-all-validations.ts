#!/usr/bin/env npx tsx
/**
 * MASTER VALIDATION TEST RUNNER
 * =============================
 *
 * Runs all validation tests in sequence and provides a comprehensive report.
 * Use this before deployments to ensure the system is working correctly.
 *
 * TESTS INCLUDED:
 * 1. Onboarding Validation - Full onboarding flow works
 * 2. Webhook Validation - Webhook endpoints are correct
 * 3. (Optional) K6 Stress Test - System handles load
 *
 * RUN: npx tsx scripts/tests/run-all-validations.ts
 * RUN WITH K6: npx tsx scripts/tests/run-all-validations.ts --include-stress
 * RUN AGAINST STAGING: BASE_URL=https://staging.example.com npx tsx scripts/tests/run-all-validations.ts
 */

import { spawn } from 'child_process';
import path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const INCLUDE_STRESS = process.argv.includes('--include-stress');
const VERBOSE = process.argv.includes('--verbose');

interface TestSuite {
  name: string;
  script: string;
  type: 'tsx' | 'k6';
  required: boolean; // If false, failure is a warning not a blocker
  skipIf?: () => boolean;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Onboarding Validation',
    script: 'scripts/tests/onboarding-validation.ts',
    type: 'tsx',
    required: true,
  },
  {
    name: 'Webhook Validation',
    script: 'scripts/tests/webhook-validation.ts',
    type: 'tsx',
    required: true,
  },
  {
    name: 'Webhook Idempotency',
    script: 'scripts/test-webhook-idempotency.ts',
    type: 'tsx',
    required: true,
  },
  {
    name: 'Concurrent Signup Stress Test',
    script: 'scripts/tests/concurrent-signup-stress.js',
    type: 'k6',
    required: false,
    skipIf: () => !INCLUDE_STRESS,
  },
];

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
  skipped?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function runTest(suite: TestSuite): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    // Check if should skip
    if (suite.skipIf && suite.skipIf()) {
      resolve({
        name: suite.name,
        passed: true,
        duration: 0,
        output: 'Skipped',
        skipped: true,
      });
      return;
    }

    const scriptPath = path.resolve(process.cwd(), suite.script);
    let cmd: string;
    let args: string[];

    if (suite.type === 'k6') {
      cmd = 'k6';
      args = ['run', '--quiet', scriptPath];
    } else {
      cmd = 'npx';
      args = ['tsx', scriptPath];
    }

    let output = '';
    let errorOutput = '';

    const proc = spawn(cmd, args, {
      env: { ...process.env, BASE_URL },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data) => {
      output += data.toString();
      if (VERBOSE) process.stdout.write(data);
    });

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString();
      if (VERBOSE) process.stderr.write(data);
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        name: suite.name,
        passed: code === 0,
        duration,
        output: output + errorOutput,
      });
    });

    proc.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        name: suite.name,
        passed: false,
        duration,
        output: `Failed to start: ${error.message}`,
      });
    });
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function main() {
  const startTime = Date.now();

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           GEMZ SYSTEM VALIDATION SUITE                             ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Target:    ${BASE_URL.padEnd(54)}║`);
  console.log(`║  Time:      ${new Date().toISOString().padEnd(54)}║`);
  console.log(`║  Stress:    ${(INCLUDE_STRESS ? 'Enabled' : 'Disabled (use --include-stress)').padEnd(54)}║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const results: TestResult[] = [];

  // Run each test suite
  for (const suite of TEST_SUITES) {
    console.log(`${'═'.repeat(70)}`);
    console.log(`📋 RUNNING: ${suite.name}`);
    console.log(`   Script: ${suite.script}`);
    console.log(`${'═'.repeat(70)}\n`);

    const result = await runTest(suite);
    results.push(result);

    if (result.skipped) {
      console.log(`⏭️  SKIPPED: ${suite.name}`);
    } else if (result.passed) {
      console.log(`\n✅ PASSED: ${suite.name} (${formatDuration(result.duration)})`);
    } else {
      console.log(`\n❌ FAILED: ${suite.name} (${formatDuration(result.duration)})`);
      if (!VERBOSE) {
        console.log('\n--- Output ---');
        console.log(result.output.slice(-2000)); // Last 2000 chars
        console.log('--- End Output ---\n');
      }
    }
    console.log('\n');
  }

  // Final Summary
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed && !r.skipped);
  const failed = results.filter(r => !r.passed && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  const requiredFailed = failed.filter(r => {
    const suite = TEST_SUITES.find(s => s.name === r.name);
    return suite?.required;
  });

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    VALIDATION SUMMARY                              ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');

  results.forEach(r => {
    let icon: string;
    let status: string;

    if (r.skipped) {
      icon = '⏭️';
      status = 'SKIPPED';
    } else if (r.passed) {
      icon = '✅';
      status = 'PASSED';
    } else {
      icon = '❌';
      status = 'FAILED';
    }

    const name = r.name.slice(0, 40).padEnd(40);
    const duration = r.skipped ? '-' : formatDuration(r.duration);
    console.log(`║  ${icon} ${name} ${status.padEnd(8)} ${duration.padStart(8)} ║`);
  });

  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Passed: ${String(passed.length).padEnd(4)} Failed: ${String(failed.length).padEnd(4)} Skipped: ${String(skipped.length).padEnd(4)} Time: ${formatDuration(totalDuration).padEnd(10)}  ║`);
  console.log('╠════════════════════════════════════════════════════════════════════╣');

  // Verdict
  if (requiredFailed.length === 0) {
    console.log('║                                                                    ║');
    console.log('║  ✅ ALL REQUIRED VALIDATIONS PASSED                               ║');
    console.log('║                                                                    ║');
    console.log('║  The system is ready for deployment.                              ║');
    console.log('║                                                                    ║');

    if (failed.length > 0) {
      console.log('╟────────────────────────────────────────────────────────────────────╢');
      console.log('║  ⚠️  Warning: Some optional tests failed:                         ║');
      failed.forEach(r => {
        console.log(`║     • ${r.name.padEnd(58)}║`);
      });
    }
  } else {
    console.log('║                                                                    ║');
    console.log('║  ❌ CRITICAL VALIDATIONS FAILED - DO NOT DEPLOY                   ║');
    console.log('║                                                                    ║');
    console.log('║  Failed tests:                                                     ║');
    requiredFailed.forEach(r => {
      console.log(`║     • ${r.name.padEnd(58)}║`);
    });
    console.log('║                                                                    ║');
  }

  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Exit with appropriate code
  if (requiredFailed.length > 0) {
    console.log('Run with --verbose to see full test output.');
    console.log('\n');
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(error => {
  console.error('💥 Test runner crashed:', error);
  process.exit(1);
});
