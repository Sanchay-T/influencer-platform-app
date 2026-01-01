#!/usr/bin/env npx tsx
/**
 * Verify trial_status column has been removed from user_subscriptions table
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import postgres from 'postgres';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);

async function check() {
  const result = await client`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'user_subscriptions'
      AND column_name = 'trial_status'
  `;

  console.log('trial_status column exists:', result.length > 0 ? 'YES ❌' : 'NO ✅ (correctly removed)');

  if (result.length > 0) {
    console.log('Column still present:', result);
  } else {
    // Show current columns
    const columns = await client`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_subscriptions'
      ORDER BY ordinal_position
    `;
    console.log('\nCurrent columns in user_subscriptions:');
    columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
  }

  await client.end();
}

check().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
