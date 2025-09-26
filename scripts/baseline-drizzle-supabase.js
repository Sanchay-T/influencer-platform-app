const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Set DATABASE_URL to your Supabase connection string');
    process.exit(1);
  }
  const ssl = /supabase|amazonaws|pooler|\.co:/.test(dbUrl);
  const client = new Client({ connectionString: dbUrl, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    // Ensure migrations table exists with expected shape
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id serial PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint NOT NULL
      );
    `);

    const journalPath = path.resolve(process.cwd(), 'supabase/migrations/meta/_journal.json');
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const entries = journal.entries || [];

    // Get existing hashes
    const existing = await client.query('SELECT hash FROM "__drizzle_migrations"');
    const have = new Set(existing.rows.map(r => r.hash));

    for (const e of entries) {
      const tag = e.tag; // e.g., 0011_sharp_blacklash
      const when = Number(e.when || Date.now());
      if (!have.has(tag)) {
        await client.query('INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)', [tag, when]);
        console.log('Baselined migration:', tag);
      } else {
        console.log('Already baselined:', tag);
      }
    }
    console.log('✅ Drizzle baseline complete on remote');
  } finally {
    await client.end();
  }
}

require('dotenv').config({ path: '.env.local' });
main().catch(e => { console.error(e); process.exit(1); });

