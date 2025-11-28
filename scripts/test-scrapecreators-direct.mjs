#!/usr/bin/env node
// scripts/test-scrapecreators-direct.mjs
// Test ScrapeCreators provider directly

import 'dotenv/config';

// Dynamic import to handle ES modules
const main = async () => {
  console.log('=== Testing Instagram ScrapeCreators Provider ===\n');

  const jobId = process.argv[2] || 'e1649e35-626a-4a05-b444-fa3871d13b4b';
  console.log('Job ID:', jobId);
  console.log('Time:', new Date().toISOString());

  try {
    // Import the runner
    const { runSearchJob } = await import('../lib/search-engine/runner.js');
    const { db } = await import('../lib/db/index.js');

    console.log('\nRunning search job...');
    const startTime = Date.now();

    const { service, result, config } = await runSearchJob(jobId);

    const duration = Date.now() - startTime;
    const job = service.snapshot();

    console.log('\n=== RESULTS ===');
    console.log('Duration:', duration, 'ms');
    console.log('Provider Status:', result.status);
    console.log('Processed Results:', result.processedResults);
    console.log('Has More:', result.hasMore);
    console.log('Job Status:', job.status);
    console.log('API Calls:', result.metrics?.apiCalls || 0);

    if (job.status === 'completed') {
      console.log('\n✅ Job completed successfully!');
    } else {
      console.log('\n⚠️  Job status:', job.status);
    }

    // Check what's in the DB
    const dbResults = await db.query.scrapingResults.findFirst({
      where: (r, { eq }) => eq(r.jobId, jobId),
    });

    if (dbResults?.creators) {
      const creators = dbResults.creators;
      console.log('\nCreators stored:', creators.length);

      // Analyze likes
      let above100 = 0, below100 = 0, nullLikes = 0;
      for (const c of creators) {
        const likes = c?.video?.statistics?.likes;
        if (likes == null) nullLikes++;
        else if (likes >= 100) above100++;
        else below100++;
      }

      console.log('  Likes >= 100:', above100);
      console.log('  Likes < 100:', below100, '(should be 0 after fix!)');
      console.log('  Null likes:', nullLikes);

      if (below100 === 0) {
        console.log('\n✅ Filter working correctly - no creators with known likes < 100');
      } else {
        console.log('\n❌ FILTER BUG - found creators with likes < 100');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

main();
