#!/usr/bin/env node

/**
 * Rescue script to manually trigger stuck Instagram US Reels job
 * Run: node rescue-stuck-job.js
 */

import { Client } from '@upstash/qstash';

const STUCK_JOB_ID = '2ae4f9df-f267-44e7-8601-36e3942d8dec';
const QSTASH_TOKEN = process.env.QSTASH_TOKEN || 'eyJVc2VySUQiOiI2MDlkZWZlNC1mMjY3LTRkNTEtOTRlNy0yMGQ2ZmUyZGYxZDMiLCJQYXNzd29yZCI6ImI2ZGI0YWY5NmZjZjQ5NGVhMzU3MmIyMzQyYzY1YTI1In0=';
const WEBHOOK_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://390d469daddb.ngrok-free.app';

async function rescueStuckJob() {
  console.log('🚑 Attempting to rescue stuck Instagram US Reels job...\n');

  console.log(`Job ID: ${STUCK_JOB_ID}`);
  console.log(`Webhook URL: ${WEBHOOK_URL}/api/qstash/process-search\n`);

  try {
    const qstash = new Client({ token: QSTASH_TOKEN });

    console.log('📤 Sending job to QStash...');

    const result = await qstash.publishJSON({
      url: `${WEBHOOK_URL}/api/qstash/process-search`,
      body: { jobId: STUCK_JOB_ID },
      delay: '1s',
      retries: 3,
      notifyOnFailure: true,
    });

    console.log('✅ Successfully queued job with QStash!');
    console.log(`\nQStash Message ID: ${result.messageId}`);
    console.log('\nThe job should now resume processing. Check the job status in a few moments.');

    console.log('\n📊 Next steps:');
    console.log('1. Monitor the job status: GET /api/scraping/instagram-us-reels?jobId=' + STUCK_JOB_ID);
    console.log('2. Check QStash dashboard: https://console.upstash.com/qstash');
    console.log('3. If it fails again, check the webhook logs in Vercel');

  } catch (error) {
    console.error('❌ Failed to rescue job:', error);
    console.error('\nError details:', error.message);

    if (error.message.includes('404') || error.message.includes('not found')) {
      console.error('\n🚨 Webhook URL is unreachable! Possible issues:');
      console.error('  - ngrok tunnel might be down');
      console.error('  - NEXT_PUBLIC_SITE_URL is incorrect');
      console.error('  - Server is not running');
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.error('\n🚨 QStash authentication failed! Check:');
      console.error('  - QSTASH_TOKEN environment variable');
      console.error('  - Token expiration');
    }
  }
}

rescueStuckJob();
