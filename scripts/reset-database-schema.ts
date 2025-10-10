import { Client } from 'pg';

async function resetSchema() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('🔄 Resetting database schema (public & drizzle)…');

    await client.query('BEGIN');
    try {
      await client.query('DROP SCHEMA IF EXISTS public CASCADE');
      await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
      await client.query('CREATE SCHEMA public');
      await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
      await client.query('GRANT ALL ON SCHEMA public TO public');
      await client.query('COMMIT');
    } catch (schemaError) {
      await client.query('ROLLBACK');
      throw schemaError;
    }

    console.log('✅ Schemas recreated. Ensuring required extensions…');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    console.log('✅ Extensions ready. Run "npm run db:migrate" next.');
  } catch (error) {
    console.error('❌ Failed to reset schema:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetSchema();
