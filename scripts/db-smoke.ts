#!/usr/bin/env tsx
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

(async () => {
  // Load env file similar to drizzle.config.ts
  const envFile = process.env.DRIZZLE_ENV_FILE || '.env.local';
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Basic connectivity
    const health = await db.execute(sql`select 1 as ok`);
    console.log('select 1 ->', health.rows[0]);

    // Check key tables exist
    const tables = ['users','user_subscriptions','user_billing','subscription_plans'];
    const missing: string[] = [];
    for (const t of tables) {
      const res = await db.execute(sql`select to_regclass(${`public.${t}`}) as exists`);
      if (!res.rows[0].exists) missing.push(t);
    }
    console.log('table check missing:', missing.length ? missing : 'none');

    // Transactional temp table exercise (no persistent writes)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tempName = `tmp_drizzle_smoke_${Date.now()}`;
      await client.query(`CREATE TEMP TABLE ${tempName} (id uuid primary key default gen_random_uuid(), note text)`);
      await client.query(`INSERT INTO ${tempName} (note) VALUES ($1)`, ['smoke']);
      const { rows } = await client.query(`SELECT count(*)::int as c FROM ${tempName}`);
      console.log('temp table row count:', rows[0].c);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    await pool.end();
    console.log('DB smoke test completed successfully');
  } catch (err) {
    await pool.end();
    console.error('DB smoke test failed', err);
    process.exit(1);
  }
})();
