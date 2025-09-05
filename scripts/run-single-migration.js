const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const fileArg = process.argv[2] || process.env.MIGRATION_FILE;
  if (!fileArg) {
    console.error('Usage: node scripts/run-single-migration.js supabase/migrations/XXXX.sql');
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error('Migration file not found:', filePath);
    process.exit(1);
  }

  const sqlText = fs.readFileSync(filePath, 'utf8');
  const parts = sqlText
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(Boolean);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const useSsl = /supabase|amazonaws|\.pooler\./i.test(dbUrl);
  const client = new Client({ connectionString: dbUrl, ssl: useSsl ? { rejectUnauthorized: false } : undefined });
  await client.connect();

  try {
    for (let i = 0; i < parts.length; i++) {
      const stmt = parts[i];
      console.log(`\n-- Executing statement ${i + 1}/${parts.length} --`);
      console.log(stmt.split('\n').slice(0, 5).join('\n') + (stmt.length > 200 ? '\n...' : ''));
      await client.query(stmt);
      console.log('✅ OK');
    }
    console.log('\n🎉 Migration executed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

