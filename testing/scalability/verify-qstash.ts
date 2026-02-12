#!/usr/bin/env tsx
/**
 * QStash Idempotency Verification Tests
 *
 * Verifies that QStash job handlers have proper idempotency:
 * 1. process-search checks job status before processing
 * 2. process-results is decommissioned (returns 410)
 *
 * Usage: npx tsx testing/scalability/verify-qstash.ts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Types
// ============================================================================

interface QStashCheck {
  file: string;
  name: string;
  hasStatusCheck: boolean;
  checksProcessingStatus: boolean;
  checksCompletedStatus: boolean;
  hasEarlyReturn: boolean;
  issues: string[];
}

interface TestResult {
  passed: boolean;
  qstashChecks: QStashCheck[];
  summary: string;
}

// ============================================================================
// QStash Files to Check
// ============================================================================

const QSTASH_FILES = [
  {
    path: 'app/api/qstash/process-search/route.ts',
    name: 'Process Search Handler',
    requiredChecks: ['completed', 'error', 'timeout', 'processing'],
  },
  {
    path: 'app/api/qstash/process-results/route.ts',
    name: 'Process Results Handler (Decommissioned)',
    requiredChecks: ['decommissioned', '410'],
  },
];

// ============================================================================
// Check Functions
// ============================================================================

function checkQStashFile(filePath: string, config: typeof QSTASH_FILES[0]): QStashCheck {
  const fullPath = resolve(process.cwd(), filePath);
  const issues: string[] = [];

  if (!existsSync(fullPath)) {
    return {
      file: filePath,
      name: config.name,
      hasStatusCheck: false,
      checksProcessingStatus: false,
      checksCompletedStatus: false,
      hasEarlyReturn: false,
      issues: ['File not found'],
    };
  }

  const content = readFileSync(fullPath, 'utf-8');

  // Check for status checks
  const hasStatusCheck =
    content.includes('.status') ||
    content.includes('status ===') ||
    content.includes('status !==');

  // Check specifically for 'processing' status check
  const checksProcessingStatus =
    content.includes("status === 'processing'") ||
    content.includes("status !== 'processing'") ||
    content.includes('status === "processing"') ||
    content.includes('status !== "processing"');

  // Check for 'completed' status check
  const checksCompletedStatus =
    content.includes("status === 'completed'") ||
    content.includes("'completed'") ||
    content.includes('"completed"');

  // Check for early return patterns
  const hasEarlyReturn =
    content.includes('return NextResponse.json') &&
    (content.includes('skipped') || content.includes('already'));

  // Analyze for specific issues
  if (config.name === 'Process Results Handler (Decommissioned)') {
    const decommissioned =
      content.includes('Endpoint decommissioned') || content.includes('status: 410');
    if (!decommissioned) {
      issues.push('Missing: process-results route should be explicitly decommissioned (410)');
    }
  }

  if (config.name === 'Process Search Handler') {
    // This handler should skip processing for completed/error/timeout jobs
    const skipsCompletedJobs =
      content.includes("status === 'completed'") ||
      content.includes("'completed'");

    const skipsErrorJobs =
      content.includes("status === 'error'") || content.includes("'error'");

    const skipsTimeoutJobs =
      content.includes("status === 'timeout'") || content.includes("'timeout'");

    if (!skipsCompletedJobs) {
      issues.push("Missing: Skip jobs with status === 'completed'");
    }
    if (!skipsErrorJobs) {
      issues.push("Missing: Skip jobs with status === 'error'");
    }
    if (!skipsTimeoutJobs) {
      issues.push("Missing: Skip jobs with status === 'timeout'");
    }

    // CRITICAL: Should also check for 'processing' to prevent concurrent processing
    if (!checksProcessingStatus) {
      issues.push(
        "Missing: Skip jobs with status === 'processing' (prevents concurrent processing)"
      );
    }
  }

  return {
    file: filePath,
    name: config.name,
    hasStatusCheck,
    checksProcessingStatus,
    checksCompletedStatus,
    hasEarlyReturn,
    issues,
  };
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests(): Promise<TestResult> {
  console.log('\n⚡ QSTASH IDEMPOTENCY VERIFICATION\n');
  console.log('═'.repeat(60));

  const qstashChecks: QStashCheck[] = [];
  let totalIssues = 0;

  for (const config of QSTASH_FILES) {
    console.log(`\n📄 ${config.name}:\n`);
    console.log(`   ${config.path}\n`);

    const check = checkQStashFile(config.path, config);
    qstashChecks.push(check);

    // Status check presence
    if (check.hasStatusCheck) {
      console.log(`  ✅ Has job status checks`);
    } else {
      console.log(`  ❌ No job status checks found`);
    }

    // Processing status check
    if (check.checksProcessingStatus) {
      console.log(`  ✅ Checks 'processing' status`);
    } else {
      console.log(`  ❌ Does NOT check 'processing' status`);
    }

    // Completed status check
    if (check.checksCompletedStatus) {
      console.log(`  ✅ Checks 'completed' status`);
    } else {
      console.log(`  ⚠️  Does not check 'completed' status`);
    }

    // Early return
    if (check.hasEarlyReturn) {
      console.log(`  ✅ Has early return for skipped jobs`);
    } else {
      console.log(`  ⚠️  No early return pattern found`);
    }

    totalIssues += check.issues.length;

    if (check.issues.length > 0) {
      console.log(`\n  🚨 Issues to fix:`);
      for (const issue of check.issues) {
        console.log(`    - ${issue}`);
      }
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 SUMMARY:\n');

  const passed = totalIssues === 0;

  if (passed) {
    console.log('  ✅ All QStash idempotency checks passed');
  } else {
    console.log(`  ❌ ${totalIssues} issues found`);
    console.log('\n  ⚠️  Without these fixes:');
    console.log('    - Duplicate job processing is possible');
    console.log('    - QStash message explosion can occur');
    console.log('    - API costs will multiply');
  }

  const summary = passed
    ? '✅ QSTASH IDEMPOTENCY: PASSED'
    : `❌ QSTASH IDEMPOTENCY: FAILED (${totalIssues} issues)`;

  console.log(`\n${summary}\n`);

  return {
    passed,
    qstashChecks,
    summary,
  };
}

// ============================================================================
// Execute
// ============================================================================

runTests()
  .then((result) => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
