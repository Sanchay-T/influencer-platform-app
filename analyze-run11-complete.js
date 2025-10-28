const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

(async () => {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  const job = await db.execute('SELECT * FROM scraping_jobs WHERE id = \'71d82daa-f212-4ea9-bb2d-179c66839818\'');

  const j = job[0];
  console.log('=== RUN #11 COMPLETE ANALYSIS ===\n');
  console.log('Job ID:', j.id);
  console.log('Status:', j.status);
  console.log('Progress:', j.progress + '%');
  console.log('Results:', j.processed_results + '/' + j.target_results);
  console.log('Keywords:', JSON.stringify(j.keywords));
  console.log('Created:', j.created_at);
  console.log('Completed:', j.completed_at);
  console.log('Error:', j.error);

  console.log('\n--- Agent Runs ---');
  if (j.search_params && j.search_params.instagramUsReelsAgent) {
    const runs = j.search_params.instagramUsReelsAgent;
    console.log('Total invocations:', runs.length);
    runs.forEach((run, idx) => {
      console.log(`\nInvocation ${idx + 1}:`);
      console.log('  Keyword:', run.keyword);
      console.log('  Results:', run.resultCount);
      console.log('  Session:', run.sessionId);
      console.log('  Total cost: $' + run.costSummary.totalUsd.toFixed(4));
    });
  }

  console.log('\n--- Keyword Coverage ---');
  const requested = j.keywords;
  const processed = j.search_params.instagramUsReelsAgent ? j.search_params.instagramUsReelsAgent.map(r => r.keyword) : [];
  const unique = [...new Set(processed)];
  const missing = requested.filter(k => unique.indexOf(k) === -1);

  console.log('Requested keywords:', JSON.stringify(requested));
  console.log('Unique keywords processed:', JSON.stringify(unique));
  console.log('Keywords processed multiple times:', JSON.stringify(processed));
  console.log('Missing keywords:', JSON.stringify(missing));

  console.log('\n--- DIAGNOSIS ---');
  if (missing.length > 0) {
    console.log('❌ INCOMPLETE: Missing', missing.length, 'keyword(s)');
  }
  if (unique.length < processed.length) {
    console.log('❌ REPETITION BUG: Some keywords processed multiple times');
  }
  if (j.status === 'completed' && j.progress < 100) {
    console.log('❌ STATUS MISMATCH: Marked completed but progress only', j.progress + '%');
  }

  await client.end();
})();
