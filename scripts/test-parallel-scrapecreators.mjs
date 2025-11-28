#!/usr/bin/env node
/**
 * Test script for the new parallel ScrapeCreators provider
 *
 * This tests:
 * 1. AI keyword expansion via OpenRouter
 * 2. Parallel API calls (5 at a time)
 * 3. Result deduplication
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const BASE_URL = 'http://localhost:3001';
const TEST_USER_ID = 'user_test_parallel';
const TEST_KEYWORD = 'fitness';

console.log('='.repeat(60));
console.log('TESTING PARALLEL SCRAPECREATORS PROVIDER');
console.log('='.repeat(60));
console.log('');
console.log('This test will:');
console.log('1. Create a test search job');
console.log('2. Trigger the QStash processor');
console.log('3. Watch AI expand keywords');
console.log('4. Monitor parallel API calls');
console.log('');

async function createTestJob() {
  console.log('📝 Creating test job...');

  const response = await fetch(`${BASE_URL}/api/scraping/instagram-scrapecreators`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': TEST_USER_ID,
      'x-test-email': 'test@parallel.com',
    },
    body: JSON.stringify({
      keywords: [TEST_KEYWORD],
      targetResults: 100,
      skipQstash: true, // Create job but don't auto-trigger
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create job: ${response.status} - ${text}`);
  }

  const data = await response.json();
  console.log('✅ Job created:', data.jobId || data.id);
  return data.jobId || data.id;
}

async function triggerProcessor(jobId) {
  console.log('');
  console.log('🚀 Triggering QStash processor...');
  console.log('   Job ID:', jobId);

  const startTime = Date.now();

  const response = await fetch(`${BASE_URL}/api/qstash/process-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-skip-signature': 'true',
    },
    body: JSON.stringify({ jobId }),
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Processor failed: ${response.status} - ${text}`);
  }

  const data = await response.json();

  console.log('');
  console.log('📊 RESULTS:');
  console.log('-'.repeat(40));
  console.log('Duration:', (duration / 1000).toFixed(1), 'seconds');
  console.log('Status:', data.status);
  console.log('Processed Results:', data.processedResults);
  console.log('Has More:', data.hasMore);

  if (data.metrics) {
    console.log('');
    console.log('📈 Metrics:');
    console.log('   API Calls:', data.metrics.apiCalls);
    console.log('   Processed Creators:', data.metrics.processedCreators);
    if (data.metrics.batches?.length) {
      console.log('   Batches:', data.metrics.batches.length);
      const avgDuration = data.metrics.batches.reduce((s, b) => s + (b.durationMs || 0), 0) / data.metrics.batches.length;
      console.log('   Avg batch duration:', (avgDuration / 1000).toFixed(1), 's');
    }
  }

  return data;
}

async function checkJobStatus(jobId) {
  const response = await fetch(`${BASE_URL}/api/jobs/${jobId}`, {
    headers: {
      'x-test-user-id': TEST_USER_ID,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function main() {
  try {
    // Create test job
    const jobId = await createTestJob();

    if (!jobId) {
      throw new Error('No job ID returned');
    }

    // Trigger processor
    const result = await triggerProcessor(jobId);

    // Check final status
    console.log('');
    console.log('📋 Final job status:');
    const finalStatus = await checkJobStatus(jobId);
    if (finalStatus) {
      console.log('   Status:', finalStatus.status);
      console.log('   Progress:', finalStatus.progress, '%');
      console.log('   Results count:', finalStatus.results?.length || 0);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
