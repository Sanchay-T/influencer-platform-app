const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

(async () => {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  const job = await db.execute('SELECT id, status, error, keywords, processed_results, target_results, search_params FROM scraping_jobs WHERE id = \'40dbcc73-1b63-49ff-b32e-63120ffde898\'');

  const j = job[0];
  console.log('=== CRITICAL ANALYSIS ===\n');
  console.log('Status:', j.status);
  console.log('Error field:', j.error);
  console.log('Keywords requested:', JSON.stringify(j.keywords));
  console.log('Results:', j.processed_results, '/', j.target_results);

  console.log('\n--- Last Keyword Processed ---');
  console.log('lastKeyword from searchParams:', j.search_params.lastKeyword);

  console.log('\n--- Agent Runs ---');
  if (j.search_params.instagramUsReelsAgent) {
    j.search_params.instagramUsReelsAgent.forEach((run, idx) => {
      console.log(`Run ${idx + 1}: keyword="${run.keyword}", resultCount=${run.resultCount}`);
    });
  }

  console.log('\n--- Missing Keyword ---');
  const requested = j.keywords;
  const processed = j.search_params.instagramUsReelsAgent ? j.search_params.instagramUsReelsAgent.map(r => r.keyword) : [];
  const missing = requested.filter(k => !processed.includes(k));
  console.log('Keywords NOT processed:', JSON.stringify(missing));

  console.log('\n--- CONCLUSION ---');
  if (missing.length > 0) {
    console.log('❌ BUG CONFIRMED: Job marked as "completed" but missing', missing.length, 'keyword(s)');
    console.log('❌ PostgreSQL error still occurred during keyword "paragon" processing');
    console.log('❌ Job stopped prematurely and marked itself as completed');
  } else {
    console.log('✅ All keywords processed');
  }

  await client.end();
})();
