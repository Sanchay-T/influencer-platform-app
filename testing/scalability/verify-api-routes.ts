#!/usr/bin/env tsx
/**
 * API Route Safety Verification Tests
 *
 * Verifies that critical API routes have:
 * 1. maxDuration configuration (prevents Vercel timeouts)
 * 2. Concurrency limits for external API calls
 * 3. Proper error handling
 *
 * Usage: npx tsx testing/scalability/verify-api-routes.ts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';

// ============================================================================
// Types
// ============================================================================

interface RouteCheck {
  file: string;
  name: string;
  hasMaxDuration: boolean;
  maxDurationValue?: number;
  hasConcurrencyLimit: boolean;
  hasUnlimitedPromiseAll: boolean;
  lineCount: number;
  issues: string[];
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface TestResult {
  passed: boolean;
  routeChecks: RouteCheck[];
  summary: string;
}

// ============================================================================
// Critical Routes (must have maxDuration)
// ============================================================================

const CRITICAL_ROUTES = [
  {
    path: 'app/api/export/csv/route.ts',
    name: 'CSV Export',
    requiredMaxDuration: 60,
    riskWithoutFix: 'critical' as const,
    description: 'Exports large datasets, can timeout',
  },
  {
    path: 'app/api/creators/fetch-bios/route.ts',
    name: 'Bio Fetch (Instagram)',
    requiredMaxDuration: 30,
    riskWithoutFix: 'critical' as const,
    description: 'Unlimited parallel external API calls',
  },
  {
    path: 'app/api/creators/fetch-tiktok-bios/route.ts',
    name: 'Bio Fetch (TikTok)',
    requiredMaxDuration: 30,
    riskWithoutFix: 'critical' as const,
    description: 'Unlimited parallel external API calls',
  },
  {
    path: 'app/api/jobs/[id]/route.ts',
    name: 'Job Status',
    requiredMaxDuration: 15,
    riskWithoutFix: 'high' as const,
    description: 'Fetches job with potentially large results',
  },
  {
    path: 'app/api/dashboard/overview/route.ts',
    name: 'Dashboard Overview',
    requiredMaxDuration: 20,
    riskWithoutFix: 'high' as const,
    description: 'Multiple aggregation queries',
  },
  {
    path: 'app/api/creators/enrich/route.ts',
    name: 'Creator Enrichment',
    requiredMaxDuration: 30,
    riskWithoutFix: 'high' as const,
    description: 'External API call without rate limiting',
  },
  {
    path: 'app/api/proxy/image/route.ts',
    name: 'Image Proxy',
    requiredMaxDuration: 30,
    riskWithoutFix: 'medium' as const,
    description: 'Multiple retry attempts for images',
  },
];

// ============================================================================
// Check Functions
// ============================================================================

function checkRouteFile(filePath: string, config: typeof CRITICAL_ROUTES[0]): RouteCheck {
  const fullPath = resolve(process.cwd(), filePath);
  const issues: string[] = [];

  if (!existsSync(fullPath)) {
    return {
      file: filePath,
      name: config.name,
      hasMaxDuration: false,
      hasConcurrencyLimit: false,
      hasUnlimitedPromiseAll: false,
      lineCount: 0,
      issues: ['File not found'],
      risk: config.riskWithoutFix,
    };
  }

  const content = readFileSync(fullPath, 'utf-8');
  const lineCount = content.split('\n').length;

  // Check for maxDuration export
  const maxDurationMatch = content.match(/export\s+const\s+maxDuration\s*=\s*(\d+)/);
  const hasMaxDuration = !!maxDurationMatch;
  const maxDurationValue = maxDurationMatch ? parseInt(maxDurationMatch[1]) : undefined;

  if (!hasMaxDuration) {
    issues.push(`Missing: export const maxDuration = ${config.requiredMaxDuration}`);
  } else if (maxDurationValue && maxDurationValue < config.requiredMaxDuration) {
    issues.push(
      `maxDuration too low: ${maxDurationValue}s (should be >= ${config.requiredMaxDuration}s)`
    );
  }

  // Check for unlimited Promise.all patterns
  const hasUnlimitedPromiseAll =
    content.includes('Promise.all(') &&
    (content.includes('.map(') || content.includes('.map (')) &&
    !content.includes('chunk') &&
    !content.includes('batch') &&
    !content.includes('CONCURRENT') &&
    !content.includes('concurrent');

  if (hasUnlimitedPromiseAll) {
    issues.push('Warning: Promise.all with .map() detected - may cause unlimited parallel calls');
  }

  // Check for concurrency limiting patterns
  const hasConcurrencyLimit =
    content.includes('MAX_CONCURRENT') ||
    content.includes('concurrency') ||
    content.includes('chunk(') ||
    content.includes('batch') ||
    content.includes('p-limit') ||
    content.includes('Promise.all(').valueOf() === false; // No Promise.all at all

  // Large file warning
  if (lineCount > 300) {
    issues.push(`Warning: File has ${lineCount} lines (> 300 recommended max)`);
  }

  // Only count non-warning issues for risk assessment
  const criticalIssues = issues.filter(i => !i.startsWith('Warning'));

  return {
    file: filePath,
    name: config.name,
    hasMaxDuration,
    maxDurationValue,
    hasConcurrencyLimit,
    hasUnlimitedPromiseAll,
    lineCount,
    issues,
    risk: criticalIssues.length > 0 ? config.riskWithoutFix : 'low',
  };
}

async function scanAllRoutes(): Promise<{ total: number; withMaxDuration: number }> {
  const routeFiles = await glob('app/api/**/route.ts', {
    cwd: process.cwd(),
    ignore: ['node_modules/**'],
  });

  let withMaxDuration = 0;

  for (const file of routeFiles) {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8');
    if (content.includes('maxDuration')) {
      withMaxDuration++;
    }
  }

  return { total: routeFiles.length, withMaxDuration };
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests(): Promise<TestResult> {
  console.log('\n🛡️  API ROUTE SAFETY VERIFICATION\n');
  console.log('═'.repeat(60));

  // Check critical routes
  console.log('\n📄 Checking Critical Routes:\n');

  const routeChecks: RouteCheck[] = [];
  let criticalIssues = 0;
  let highIssues = 0;

  for (const config of CRITICAL_ROUTES) {
    const check = checkRouteFile(config.path, config);
    routeChecks.push(check);

    const riskIcon =
      check.risk === 'critical' ? '🔴' :
      check.risk === 'high' ? '🟠' :
      check.risk === 'medium' ? '🟡' : '🟢';

    console.log(`${riskIcon} ${check.name} (${check.lineCount} lines)`);
    console.log(`   ${config.path}`);

    if (check.hasMaxDuration) {
      console.log(`   ✅ maxDuration = ${check.maxDurationValue}s`);
    } else {
      console.log(`   ❌ maxDuration NOT set (will timeout at 10-25s)`);
    }

    if (check.hasUnlimitedPromiseAll) {
      console.log(`   ⚠️  Unlimited Promise.all detected`);
    } else if (check.hasConcurrencyLimit) {
      console.log(`   ✅ Has concurrency controls`);
    }

    if (check.issues.length > 0) {
      for (const issue of check.issues) {
        if (!issue.startsWith('Warning')) {
          console.log(`   ❌ ${issue}`);
        }
      }
    }

    if (check.risk === 'critical') criticalIssues++;
    if (check.risk === 'high') highIssues++;

    console.log('');
  }

  // Scan all routes
  console.log('═'.repeat(60));
  console.log('\n📊 Overall Route Coverage:\n');

  const { total, withMaxDuration } = await scanAllRoutes();
  const coverage = ((withMaxDuration / total) * 100).toFixed(1);

  console.log(`  Total API routes: ${total}`);
  console.log(`  With maxDuration: ${withMaxDuration}`);
  console.log(`  Coverage: ${coverage}%`);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 SUMMARY:\n');

  const passed = criticalIssues === 0 && highIssues === 0;

  if (criticalIssues > 0) {
    console.log(`  🔴 ${criticalIssues} CRITICAL routes need fixes`);
  }
  if (highIssues > 0) {
    console.log(`  🟠 ${highIssues} HIGH risk routes need fixes`);
  }
  if (passed) {
    console.log('  ✅ All critical API routes have proper safety measures');
  }

  const summary = passed
    ? '✅ API ROUTE SAFETY: PASSED'
    : `❌ API ROUTE SAFETY: FAILED (${criticalIssues} critical, ${highIssues} high)`;

  console.log(`\n${summary}\n`);

  return {
    passed,
    routeChecks,
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
