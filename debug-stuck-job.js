#!/usr/bin/env node

/**
 * Debug script to investigate stuck Instagram scraping job
 * Run: node debug-stuck-job.js
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from './lib/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function debugStuckJob() {
  console.log('🔍 Investigating stuck Instagram job...\n');

  const queryClient = postgres(DATABASE_URL);
  const db = drizzle(queryClient, { schema });

  try {
    // Step 1: Find user by email
    console.log('Step 1: Finding user by email (falore7715@filipx.com)...');
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, 'falore7715@filipx.com')
    });

    if (!user) {
      console.log('❌ User not found in users table. Checking legacy user_profiles...');

      // Try finding user ID from scraping_jobs table directly
      const jobs = await db.select().from(schema.scrapingJobs)
        .where(eq(schema.scrapingJobs.platform, 'Instagram'))
        .orderBy(desc(schema.scrapingJobs.createdAt))
        .limit(10);

      console.log(`\nFound ${jobs.length} recent Instagram jobs:`);
      jobs.forEach((job, index) => {
        const keywords = job.keywords ? JSON.stringify(job.keywords) : 'N/A';
        console.log(`\nJob ${index + 1}:`);
        console.log(`  ID: ${job.id}`);
        console.log(`  User ID: ${job.userId}`);
        console.log(`  Status: ${job.status}`);
        console.log(`  Progress: ${job.progress}%`);
        console.log(`  Keywords: ${keywords}`);
        console.log(`  Processed Runs: ${job.processedRuns}`);
        console.log(`  Target Results: ${job.targetResults}`);
        console.log(`  Created: ${job.createdAt}`);
        console.log(`  Error: ${job.error || 'None'}`);
      });

      await queryClient.end();
      return;
    }

    console.log(`✅ Found user: ${user.fullName || user.email} (ID: ${user.userId})\n`);

    // Step 2: Find Instagram jobs for this user
    console.log('Step 2: Finding Instagram scraping jobs...');
    const instagramJobs = await db.select().from(schema.scrapingJobs)
      .where(and(
        eq(schema.scrapingJobs.userId, user.userId),
        eq(schema.scrapingJobs.platform, 'Instagram')
      ))
      .orderBy(desc(schema.scrapingJobs.createdAt))
      .limit(10);

    if (instagramJobs.length === 0) {
      console.log('❌ No Instagram jobs found for this user');
      await queryClient.end();
      return;
    }

    console.log(`✅ Found ${instagramJobs.length} Instagram job(s)\n`);

    // Step 3: Find the specific stuck job (Run #8 at 16%)
    console.log('Step 3: Analyzing jobs for the stuck one (16% progress, keywords: airpods, nike, adidas)...\n');

    let stuckJob = null;
    instagramJobs.forEach((job, index) => {
      const keywords = job.keywords ? JSON.stringify(job.keywords) : 'N/A';
      const progress = job.progress ? parseFloat(job.progress) : 0;

      console.log(`Job ${index + 1} (Run #${job.runId || 'N/A'}):`);
      console.log(`  ID: ${job.id}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Progress: ${progress}%`);
      console.log(`  Keywords: ${keywords}`);
      console.log(`  Processed Runs: ${job.processedRuns}/${job.targetResults}`);
      console.log(`  Processed Results: ${job.processedResults}`);
      console.log(`  QStash Message ID: ${job.qstashMessageId || 'None'}`);
      console.log(`  Created: ${job.createdAt}`);
      console.log(`  Started: ${job.startedAt || 'Not started'}`);
      console.log(`  Completed: ${job.completedAt || 'Not completed'}`);
      console.log(`  Error: ${job.error || 'None'}`);
      console.log(`  Cursor: ${job.cursor}`);
      console.log('');

      // Check if this matches our stuck job criteria
      if (progress > 15 && progress < 20 && job.status === 'processing') {
        const keywordsStr = keywords.toLowerCase();
        if (keywordsStr.includes('airpods') || keywordsStr.includes('nike') || keywordsStr.includes('adidas')) {
          stuckJob = job;
        }
      }
    });

    if (stuckJob) {
      console.log('\n🎯 Found the stuck job!\n');
      console.log('Full Job Details:');
      console.log(JSON.stringify(stuckJob, null, 2));

      // Check if there are any results stored
      console.log('\n\nStep 4: Checking for stored results...');
      const results = await db.select().from(schema.scrapingResults)
        .where(eq(schema.scrapingResults.jobId, stuckJob.id));

      console.log(`✅ Found ${results.length} result record(s)`);

      if (results.length > 0) {
        results.forEach((result, index) => {
          const creators = result.creators;
          const creatorCount = Array.isArray(creators) ? creators.length : 0;
          console.log(`\nResult ${index + 1}:`);
          console.log(`  ID: ${result.id}`);
          console.log(`  Creators Count: ${creatorCount}`);
          console.log(`  Created: ${result.createdAt}`);
        });
      }

      // Step 5: Diagnostic analysis
      console.log('\n\n📊 Diagnostic Analysis:');
      console.log('════════════════════════════════════════════════════════════════');

      const timeSinceCreation = new Date().getTime() - new Date(stuckJob.createdAt).getTime();
      const minutesSinceCreation = Math.floor(timeSinceCreation / 1000 / 60);

      console.log(`\n⏰ Time Analysis:`);
      console.log(`  Job created: ${stuckJob.createdAt}`);
      console.log(`  Job started: ${stuckJob.startedAt || 'Never started!'}`);
      console.log(`  Time elapsed: ${minutesSinceCreation} minutes`);

      console.log(`\n📈 Progress Analysis:`);
      console.log(`  Status: ${stuckJob.status}`);
      console.log(`  Progress: ${stuckJob.progress}%`);
      console.log(`  Processed Runs: ${stuckJob.processedRuns}`);
      console.log(`  Target Results: ${stuckJob.targetResults}`);
      console.log(`  Processed Results: ${stuckJob.processedResults}`);

      console.log(`\n🔄 QStash Integration:`);
      console.log(`  QStash Message ID: ${stuckJob.qstashMessageId || '❌ MISSING - Job may not have been queued!'}`);

      console.log(`\n🚨 Potential Issues:`);

      if (!stuckJob.qstashMessageId) {
        console.log(`  ❌ No QStash message ID - Job was never queued for background processing`);
      }

      if (!stuckJob.startedAt) {
        console.log(`  ❌ Job never started - Webhook may not have been triggered`);
      }

      if (stuckJob.status === 'processing' && minutesSinceCreation > 10) {
        console.log(`  ❌ Job stuck in 'processing' for ${minutesSinceCreation} minutes`);
      }

      if (stuckJob.processedRuns === 0) {
        console.log(`  ❌ No runs processed - API calls may be failing`);
      }

      if (stuckJob.error) {
        console.log(`  ❌ Error recorded: ${stuckJob.error}`);
      }

      console.log('\n════════════════════════════════════════════════════════════════');

    } else {
      console.log('❌ Could not identify the specific stuck job matching the criteria');
      console.log('   Looking for: 15-20% progress, processing status, keywords containing airpods/nike/adidas');
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error);
    console.error(error.stack);
  } finally {
    await queryClient.end();
    console.log('\n✅ Investigation complete');
  }
}

// Run the diagnostic
debugStuckJob();
