#!/usr/bin/env node
/**
 * Direct test for the parallel ScrapeCreators provider
 * Creates a job directly in DB and triggers the processor
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const BASE_URL = 'http://localhost:3001';

// Use Supabase client to create job directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(60));
console.log('TESTING PARALLEL SCRAPECREATORS PROVIDER (DIRECT)');
console.log('='.repeat(60));
console.log('');

async function createJobDirectly() {
  const jobId = randomUUID();
  const userId = 'user_test_parallel_' + Date.now();

  console.log('📝 Creating job directly in database...');
  console.log('   Job ID:', jobId);

  const { data, error } = await supabase
    .from('scraping_jobs')
    .insert({
      id: jobId,
      user_id: userId,
      platform: 'Instagram',
      status: 'pending',
      keywords: ['fitness'],
      target_results: 100,
      processed_results: 0,
      processed_runs: 0,
      search_params: {
        provider: 'scrapecreators',
        allKeywords: ['fitness'],
        amount: 100,
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  console.log('✅ Job created successfully');
  return data.id;
}

async function triggerProcessor(jobId) {
  console.log('');
  console.log('🚀 Triggering QStash processor...');
  console.log('   Job ID:', jobId);
  console.log('');
  console.log('⏳ This will take ~2-3 minutes (AI expansion + parallel API calls)...');
  console.log('');

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

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log('Raw response:', text.substring(0, 500));
    throw new Error(`Invalid JSON response: ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Processor failed: ${response.status} - ${JSON.stringify(data)}`);
  }

  console.log('');
  console.log('📊 RESULTS:');
  console.log('-'.repeat(40));
  console.log('Total Duration:', (duration / 1000).toFixed(1), 'seconds');
  console.log('Status:', data.status);
  console.log('Processed Results:', data.processedResults);
  console.log('Has More:', data.hasMore);

  if (data.metrics) {
    console.log('');
    console.log('📈 Metrics:');
    console.log('   API Calls:', data.metrics.apiCalls);
    console.log('   Processed Creators:', data.metrics.processedCreators);
    if (data.metrics.batches?.length) {
      console.log('   Keyword Batches:', data.metrics.batches.length);
      const keywords = data.metrics.batches.map(b => b.keyword).slice(0, 10);
      console.log('   Keywords used:', keywords.join(', ') + (data.metrics.batches.length > 10 ? '...' : ''));

      const totalBatchTime = data.metrics.batches.reduce((s, b) => s + (b.durationMs || 0), 0);
      console.log('   Total batch time:', (totalBatchTime / 1000).toFixed(1), 's');
      console.log('   Parallel efficiency:', ((totalBatchTime / duration) * 100).toFixed(0), '% (higher = more parallelism)');
    }
    if (data.metrics.costs?.length) {
      const totalCost = data.metrics.costs.reduce((s, c) => s + (c.totalCostUsd || 0), 0);
      console.log('   Estimated cost: $', totalCost.toFixed(4));
    }
  }

  return data;
}

async function getJobResults(jobId) {
  const { data, error } = await supabase
    .from('scraping_jobs')
    .select('*, scraping_results(*)')
    .eq('id', jobId)
    .single();

  if (error) {
    console.log('Could not fetch final results:', error.message);
    return null;
  }

  return data;
}

async function main() {
  try {
    // Create job directly in DB
    const jobId = await createJobDirectly();

    // Trigger processor
    const result = await triggerProcessor(jobId);

    // Check final results
    console.log('');
    console.log('📋 Final job status:');
    const finalJob = await getJobResults(jobId);
    if (finalJob) {
      console.log('   Status:', finalJob.status);
      console.log('   Progress:', finalJob.progress || 0, '%');
      const resultsCount = finalJob.scraping_results?.[0]?.creators?.length || 0;
      console.log('   Creators saved:', resultsCount);

      if (resultsCount > 0) {
        const creators = finalJob.scraping_results[0].creators;
        const withLikes = creators.filter(c => c.video?.statistics?.likes > 0);
        console.log('   Creators with 100+ likes:', withLikes.filter(c => c.video?.statistics?.likes >= 100).length);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
