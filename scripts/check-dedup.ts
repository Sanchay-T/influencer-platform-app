import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function check() {
  // Check which jobs have dedup keys
  const result = await db.execute(sql`
    SELECT job_id, COUNT(*)::int as key_count 
    FROM job_creator_keys 
    GROUP BY job_id 
    ORDER BY key_count DESC
    LIMIT 10
  `);
  console.log('Jobs with dedup keys:');
  console.log(JSON.stringify(result, null, 2));
  
  // Check specific jobs from the UI
  const run5 = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM job_creator_keys 
    WHERE job_id = '9de83597-d4b5-4e30-98af-f572c9e1c91e'
  `);
  console.log('\nRun #5 (Dec 23) dedup keys:', JSON.stringify(run5));
  
  const run4 = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM job_creator_keys 
    WHERE job_id = '86a7cd6f-1399-4ddb-9f44-fc1085565124'
  `);
  console.log('Run #4 (Dec 22) dedup keys:', JSON.stringify(run4));
}

check().then(() => process.exit(0));
