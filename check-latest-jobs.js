#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { desc, eq } from 'drizzle-orm';
import * as schema from './lib/db/schema.js';

async function checkJobs() {
  const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.cufwvosytcmaggyyfsix:0oKhdrooT8vfqaiP@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

  const queryClient = postgres(DATABASE_URL);
  const db = drizzle(queryClient, { schema });

  const jobs = await db.select().from(schema.scrapingJobs)
    .where(eq(schema.scrapingJobs.platform, 'Instagram'))
    .orderBy(desc(schema.scrapingJobs.createdAt))
    .limit(3);

  console.log('\n📋 Latest Instagram Jobs:\n');
  jobs.forEach((job, i) => {
    console.log(`\n${i + 1}. Job ID: ${job.id}`);
    console.log(`   Created: ${job.createdAt}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Progress: ${job.progress}%`);
    console.log(`   Results: ${job.processedResults}/${job.targetResults}`);
    console.log(`   Keywords: ${JSON.stringify(job.keywords)}`);
    console.log(`   QStash ID: ${job.qstashMessageId || 'N/A'}`);
  });

  await queryClient.end();
}

checkJobs();
