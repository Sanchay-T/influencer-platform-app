#!/usr/bin/env tsx
/**
 * Webhook Safety Verification Tests
 *
 * Verifies that webhook handlers have:
 * 1. maxDuration configuration (prevents timeout)
 * 2. Stale event detection (prevents out-of-order processing)
 * 3. Proper idempotency checks
 *
 * Usage: npx tsx testing/scalability/verify-webhooks.ts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Types
// ============================================================================

interface WebhookCheck {
  file: string;
  name: string;
  hasMaxDuration: boolean;
  maxDurationValue?: number;
  hasStaleCheck: boolean;
  hasIdempotencyCheck: boolean;
  issues: string[];
}

interface TestResult {
  passed: boolean;
  webhookChecks: WebhookCheck[];
  summary: string;
}

// ============================================================================
// Webhook Files to Check
// ============================================================================

const WEBHOOK_FILES = [
  {
    path: 'app/api/stripe/webhook/route.ts',
    name: 'Stripe Webhook',
    requiredMaxDuration: 60,
    requiresStaleCheck: true,
  },
  {
    path: 'app/api/webhooks/clerk/route.ts',
    name: 'Clerk Webhook',
    requiredMaxDuration: 60,
    requiresStaleCheck: false, // Clerk handles ordering differently
  },
];

// ============================================================================
// Check Functions
// ============================================================================

function checkWebhookFile(filePath: string, config: typeof WEBHOOK_FILES[0]): WebhookCheck {
  const fullPath = resolve(process.cwd(), filePath);
  const issues: string[] = [];

  if (!existsSync(fullPath)) {
    return {
      file: filePath,
      name: config.name,
      hasMaxDuration: false,
      hasStaleCheck: false,
      hasIdempotencyCheck: false,
      issues: ['File not found'],
    };
  }

  const content = readFileSync(fullPath, 'utf-8');

  // Check for maxDuration export
  const maxDurationMatch = content.match(/export\s+const\s+maxDuration\s*=\s*(\d+)/);
  const hasMaxDuration = !!maxDurationMatch;
  const maxDurationValue = maxDurationMatch ? parseInt(maxDurationMatch[1]) : undefined;

  if (!hasMaxDuration) {
    issues.push('Missing: export const maxDuration = 60');
  } else if (maxDurationValue && maxDurationValue < config.requiredMaxDuration) {
    issues.push(`maxDuration too low: ${maxDurationValue} (should be >= ${config.requiredMaxDuration})`);
  }

  // Check for stale event detection (Stripe only)
  const hasStaleCheck = content.includes('isEventStale');
  if (config.requiresStaleCheck && !hasStaleCheck) {
    issues.push('Missing: isEventStale() call for out-of-order event detection');
  }

  // Check for idempotency
  const hasIdempotencyCheck =
    content.includes('checkWebhookIdempotency') ||
    content.includes('idempotency') ||
    content.includes('shouldProcess');

  if (!hasIdempotencyCheck) {
    issues.push('Missing: Idempotency check for duplicate event handling');
  }

  return {
    file: filePath,
    name: config.name,
    hasMaxDuration,
    maxDurationValue,
    hasStaleCheck,
    hasIdempotencyCheck,
    issues,
  };
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests(): Promise<TestResult> {
  console.log('\n🔐 WEBHOOK SAFETY VERIFICATION\n');
  console.log('═'.repeat(60));

  const webhookChecks: WebhookCheck[] = [];
  let totalIssues = 0;

  for (const config of WEBHOOK_FILES) {
    console.log(`\n📄 ${config.name} (${config.path}):\n`);

    const check = checkWebhookFile(config.path, config);
    webhookChecks.push(check);

    // maxDuration
    if (check.hasMaxDuration) {
      console.log(`  ✅ maxDuration = ${check.maxDurationValue}s`);
    } else {
      console.log(`  ❌ maxDuration not set (will timeout at 25s default)`);
    }

    // Stale check (only for Stripe)
    if (config.requiresStaleCheck) {
      if (check.hasStaleCheck) {
        console.log(`  ✅ isEventStale() called`);
      } else {
        console.log(`  ❌ isEventStale() NOT called (out-of-order events not handled)`);
      }
    }

    // Idempotency
    if (check.hasIdempotencyCheck) {
      console.log(`  ✅ Idempotency check present`);
    } else {
      console.log(`  ⚠️  No idempotency check found`);
    }

    totalIssues += check.issues.length;

    if (check.issues.length > 0) {
      console.log(`\n  Issues to fix:`);
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
    console.log('  ✅ All webhook safety checks passed');
  } else {
    console.log(`  ❌ ${totalIssues} issues found across ${webhookChecks.length} webhook handlers`);
  }

  const summary = passed
    ? '✅ WEBHOOK SAFETY: PASSED'
    : `❌ WEBHOOK SAFETY: FAILED (${totalIssues} issues)`;

  console.log(`\n${summary}\n`);

  return {
    passed,
    webhookChecks,
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
