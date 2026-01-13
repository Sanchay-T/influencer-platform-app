#!/usr/bin/env tsx
/**
 * Database Index Verification Tests
 *
 * Verifies that critical indexes exist and are being used by queries.
 * Run BEFORE and AFTER implementing index fixes to compare.
 *
 * Usage: npx tsx testing/scalability/verify-indexes.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';

config({ path: resolve(process.cwd(), '.env.local') });

// ============================================================================
// Types
// ============================================================================

interface IndexCheck {
  name: string;
  table: string;
  columns: string[];
  exists: boolean;
}

interface QueryPlanCheck {
  name: string;
  query: string;
  usesIndex: boolean;
  scanType: string;
  executionTime?: number;
}

interface TestResult {
  passed: boolean;
  indexChecks: IndexCheck[];
  queryPlanChecks: QueryPlanCheck[];
  summary: string;
}

// ============================================================================
// Required Indexes (what we expect AFTER implementation)
// ============================================================================

const REQUIRED_INDEXES: Omit<IndexCheck, 'exists'>[] = [
  { name: 'idx_campaigns_user_id', table: 'campaigns', columns: ['user_id'] },
  { name: 'idx_campaigns_user_status', table: 'campaigns', columns: ['user_id', 'status'] },
  { name: 'idx_scraping_jobs_user_status', table: 'scraping_jobs', columns: ['user_id', 'status'] },
  { name: 'idx_scraping_jobs_user_created', table: 'scraping_jobs', columns: ['user_id', 'created_at'] },
  { name: 'idx_creator_lists_owner', table: 'creator_lists', columns: ['owner_id'] },
  { name: 'idx_creator_lists_owner_archived', table: 'creator_lists', columns: ['owner_id', 'is_archived'] },
  { name: 'idx_users_user_id', table: 'users', columns: ['user_id'] },
];

// ============================================================================
// Test Functions
// ============================================================================

async function checkIndexExists(indexName: string, tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM pg_indexes
      WHERE tablename = ${tableName}
      AND indexname = ${indexName}
    `);
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking index ${indexName}:`, error);
    return false;
  }
}

async function getQueryPlan(query: string): Promise<{ scanType: string; executionTime?: number }> {
  try {
    const result = await db.execute(sql.raw(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`));
    const plan = (result.rows[0] as any)['QUERY PLAN'][0];

    // Extract scan type from plan
    const planText = JSON.stringify(plan);
    let scanType = 'Unknown';

    if (planText.includes('Index Scan') || planText.includes('Index Only Scan')) {
      scanType = 'Index Scan';
    } else if (planText.includes('Bitmap Index Scan')) {
      scanType = 'Bitmap Index Scan';
    } else if (planText.includes('Seq Scan')) {
      scanType = 'Seq Scan';
    }

    const executionTime = plan.Plan?.['Actual Total Time'] || plan['Execution Time'];

    return { scanType, executionTime };
  } catch (error) {
    console.error(`Error getting query plan:`, error);
    return { scanType: 'Error' };
  }
}

async function checkAllIndexes(): Promise<IndexCheck[]> {
  const results: IndexCheck[] = [];

  for (const index of REQUIRED_INDEXES) {
    const exists = await checkIndexExists(index.name, index.table);
    results.push({ ...index, exists });
  }

  return results;
}

async function checkQueryPlans(): Promise<QueryPlanCheck[]> {
  const results: QueryPlanCheck[] = [];

  // Test queries that should use indexes
  const testQueries = [
    {
      name: 'Campaign list by user',
      query: `SELECT * FROM campaigns WHERE user_id = 'test-user-id' LIMIT 10`,
    },
    {
      name: 'Campaign list by user and status',
      query: `SELECT * FROM campaigns WHERE user_id = 'test-user-id' AND status = 'active' LIMIT 10`,
    },
    {
      name: 'Scraping jobs by user and status',
      query: `SELECT * FROM scraping_jobs WHERE user_id = 'test-user-id' AND status = 'processing' LIMIT 10`,
    },
    {
      name: 'User lookup by Clerk ID',
      query: `SELECT * FROM users WHERE user_id = 'test-clerk-id' LIMIT 1`,
    },
  ];

  for (const test of testQueries) {
    const { scanType, executionTime } = await getQueryPlan(test.query);
    results.push({
      name: test.name,
      query: test.query,
      usesIndex: scanType.includes('Index'),
      scanType,
      executionTime,
    });
  }

  return results;
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests(): Promise<TestResult> {
  console.log('\n🔍 DATABASE INDEX VERIFICATION\n');
  console.log('═'.repeat(60));

  // Check indexes
  console.log('\n📊 Checking Required Indexes:\n');
  const indexChecks = await checkAllIndexes();

  let indexesMissing = 0;
  for (const check of indexChecks) {
    const status = check.exists ? '✅' : '❌';
    console.log(`  ${status} ${check.name} on ${check.table}(${check.columns.join(', ')})`);
    if (!check.exists) indexesMissing++;
  }

  // Check query plans
  console.log('\n📈 Checking Query Execution Plans:\n');
  const queryPlanChecks = await checkQueryPlans();

  let queriesUsingSeqScan = 0;
  for (const check of queryPlanChecks) {
    const status = check.usesIndex ? '✅' : '⚠️';
    const time = check.executionTime ? ` (${check.executionTime.toFixed(2)}ms)` : '';
    console.log(`  ${status} ${check.name}`);
    console.log(`     Scan: ${check.scanType}${time}`);
    if (!check.usesIndex) queriesUsingSeqScan++;
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 SUMMARY:\n');

  const passed = indexesMissing === 0 && queriesUsingSeqScan === 0;

  if (indexesMissing > 0) {
    console.log(`  ❌ ${indexesMissing}/${REQUIRED_INDEXES.length} indexes missing`);
  } else {
    console.log(`  ✅ All ${REQUIRED_INDEXES.length} indexes present`);
  }

  if (queriesUsingSeqScan > 0) {
    console.log(`  ⚠️  ${queriesUsingSeqScan}/${queryPlanChecks.length} queries using Seq Scan (slow)`);
  } else {
    console.log(`  ✅ All ${queryPlanChecks.length} queries using Index Scan`);
  }

  const summary = passed
    ? '✅ DATABASE INDEXES: PASSED'
    : `❌ DATABASE INDEXES: FAILED (${indexesMissing} missing, ${queriesUsingSeqScan} slow queries)`;

  console.log(`\n${summary}\n`);

  return {
    passed,
    indexChecks,
    queryPlanChecks,
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
