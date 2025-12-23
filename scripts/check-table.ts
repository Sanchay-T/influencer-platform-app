import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function check() {
  try {
    const result = await db.execute(sql`SELECT COUNT(*)::int as count FROM job_creator_keys`);
    console.log('job_creator_keys table EXISTS');
    console.log('Raw result:', JSON.stringify(result));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

check().then(() => process.exit(0));
