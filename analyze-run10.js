const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

(async () => {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  const job = await db.execute('SELECT * FROM scraping_jobs WHERE id = \'40dbcc73-1b63-49ff-b32e-63120ffde898\'');

  if (job[0]) {
    const j = job[0];
    console.log('=== Run #10 Complete Details ===\n');
    console.log('ID:', j.id);
    console.log('Platform:', j.platform);
    console.log('Status:', j.status);
    console.log('Progress:', j.progress + '%');
    console.log('Results:', j.processed_results + '/' + j.target_results);
    console.log('Keywords:', j.keywords);
    console.log('Created:', j.created_at);
    console.log('Updated:', j.updated_at);
    console.log('Completed:', j.completed_at);
    console.log('\n--- Search Params (Handle Queue) ---');

    if (j.search_params && j.search_params.handleQueue) {
      const queue = j.search_params.handleQueue;
      const entries = Object.entries(queue);
      console.log('Total handles processed:', entries.length);

      // Group by keyword
      const byKeyword = {};
      entries.forEach(([handle, data]) => {
        const kw = data.keyword || 'unknown';
        if (!byKeyword[kw]) byKeyword[kw] = [];
        byKeyword[kw].push({ handle, ...data });
      });

      console.log('\nKeywords processed:');
      Object.entries(byKeyword).forEach(([kw, handles]) => {
        const total = handles.reduce((sum, h) => sum + (h.totalCreators || 0), 0);
        const newC = handles.reduce((sum, h) => sum + (h.newCreators || 0), 0);
        const dupC = handles.reduce((sum, h) => sum + (h.duplicateCreators || 0), 0);
        console.log(`  ${kw}: ${handles.length} handles, ${total} total creators (${newC} new, ${dupC} duplicates)`);
      });
    } else {
      console.log('No handleQueue in searchParams!');
      console.log('searchParams:', JSON.stringify(j.search_params, null, 2));
    }

    // Check results
    const results = await db.execute('SELECT COUNT(*) as count FROM scraping_results WHERE job_id = \'40dbcc73-1b63-49ff-b32e-63120ffde898\'');
    console.log('\nActual results in database:', results[0].count);
  }

  await client.end();
})();
