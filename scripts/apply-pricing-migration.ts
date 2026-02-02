#!/usr/bin/env npx tsx

/**
 * Apply new pricing plans migration to a specific environment
 * Usage: DRIZZLE_ENV=development npx tsx scripts/apply-pricing-migration.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Environment-aware config loading (matches drizzle.config.ts)
const envMap: Record<string, string> = {
  local: '.env.local',
  development: '.env.development',
  production: '.env.production',
};

const targetEnv = process.env.DRIZZLE_ENV || 'local';
const envFile = envMap[targetEnv] || '.env.local';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

async function main() {
  console.log(`🔧 Target environment: ${targetEnv}`);
  console.log(`🔧 Loading from: ${envFile}`);

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment file');
    console.log('\nUsage:');
    console.log('  DRIZZLE_ENV=development npx tsx scripts/apply-pricing-migration.ts');
    console.log('  DRIZZLE_ENV=production npx tsx scripts/apply-pricing-migration.ts');
    process.exit(1);
  }

  console.log(`🔧 Database URL: ${databaseUrl.replace(/\/\/.*@/, '//***@')}\n`);

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Check current state
    console.log('📊 Checking current subscription_plans state...\n');

    try {
      const existing = await pool.query(
        'SELECT plan_key, display_name, monthly_price, creators_limit FROM subscription_plans ORDER BY sort_order'
      );
      console.log('Current plans:');
      console.table(existing.rows);
    } catch (e: any) {
      if (e.message.includes('does not exist')) {
        console.log('⚠️  subscription_plans table does not exist');
        console.log('   Run `npx drizzle-kit push` first to create the schema');
        process.exit(1);
      }
      throw e;
    }

    // Apply migration 0206
    console.log('\n🚀 Applying migration 0206_add_new_pricing_plans.sql...');
    const migration0206 = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/0206_add_new_pricing_plans.sql'),
      'utf8'
    );
    await pool.query(migration0206);
    console.log('✅ Migration 0206 applied');

    // Apply migration 0207 (Stripe price IDs)
    console.log('\n🚀 Applying migration 0207_update_stripe_price_ids.sql...');
    const migration0207 = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/0207_update_stripe_price_ids.sql'),
      'utf8'
    );
    await pool.query(migration0207);
    console.log('✅ Migration 0207 applied');

    // Verify final state
    console.log('\n📊 Final subscription_plans state:');
    const final = await pool.query(
      'SELECT plan_key, display_name, monthly_price, creators_limit, stripe_monthly_price_id FROM subscription_plans ORDER BY sort_order'
    );
    console.table(final.rows);

    console.log('\n✅ All migrations applied successfully!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
