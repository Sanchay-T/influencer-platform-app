// test-scripts/test-scrapecreators-fix.ts
// Test the Instagram ScrapeCreators fixes

import { runSearchJob } from '../lib/search-engine/runner';
import { db } from '../lib/db';
import { scrapingJobs, scrapingResults } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const jobId = process.argv[2] || 'e1649e35-626a-4a05-b444-fa3871d13b4b';

async function runTest() {
  console.log('=== Testing Instagram ScrapeCreators Fix ===');
  console.log('Job ID:', jobId);
  console.log('Time:', new Date().toISOString());
  console.log('---\n');

  try {
    // Run the search
    console.log('Running search job...');
    const { service, result, config } = await runSearchJob(jobId);

    const job = service.snapshot();

    console.log('\n=== SEARCH COMPLETED ===');
    console.log('Provider Status:', result.status);
    console.log('Processed Results:', result.processedResults);
    console.log('Has More:', result.hasMore);
    console.log('Job Status in DB:', job.status);
    console.log('\nConfig Used:');
    console.log('  maxApiCalls:', config.maxApiCalls);
    console.log('  continuationDelayMs:', config.continuationDelayMs);

    console.log('\nMetrics:');
    console.log('  API Calls:', result.metrics.apiCalls);
    console.log('  Processed Creators:', result.metrics.processedCreators);
    console.log('  Batches:', result.metrics.batches?.length || 0);

    // Check database state
    const dbJob = await db.query.scrapingJobs.findFirst({
      where: (j, { eq }) => eq(j.id, jobId),
    });

    const dbResults = await db.query.scrapingResults.findFirst({
      where: (r, { eq }) => eq(r.jobId, jobId),
    });

    console.log('\n=== DATABASE STATE ===');
    console.log('Job Status:', dbJob?.status);
    console.log('Job Completed At:', dbJob?.completedAt);
    console.log('Processed Results:', dbJob?.processedResults);

    if (dbResults && Array.isArray(dbResults.creators)) {
      const creators = dbResults.creators as any[];
      console.log('\nCreators in DB:', creators.length);

      // Analyze likes distribution
      let withLikes100Plus = 0;
      let withLikesBelow100 = 0;
      let withNullLikes = 0;

      for (const c of creators) {
        const likes = c?.video?.statistics?.likes;
        if (likes === null || likes === undefined) {
          withNullLikes++;
        } else if (likes >= 100) {
          withLikes100Plus++;
        } else {
          withLikesBelow100++;
        }
      }

      console.log('\nLikes Distribution:');
      console.log('  Likes >= 100:', withLikes100Plus);
      console.log('  Likes < 100:', withLikesBelow100);
      console.log('  Null/Unknown:', withNullLikes);
      console.log('\n✅ All creators in DB should have likes >= 100 or null (kept by default)');

      if (withLikesBelow100 > 0) {
        console.log('⚠️  WARNING: Found creators with likes < 100 - filter may not be working!');
      } else {
        console.log('✅ Filter is working correctly!');
      }
    }

    // Verify job completed properly
    if (dbJob?.status === 'completed') {
      console.log('\n✅ Job properly marked as completed!');
    } else {
      console.log('\n⚠️  Job status is:', dbJob?.status, '- expected "completed"');
    }

  } catch (err: any) {
    console.error('\n❌ Search failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }

  process.exit(0);
}

runTest();
