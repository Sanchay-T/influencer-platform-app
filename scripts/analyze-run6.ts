import { sql, desc, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { scrapingJobs, scrapingResults } from '../lib/db/schema';
import { isNumber, toArray, toRecord } from '../lib/utils/type-guards';

async function analyze() {
  // Get most recent job (Run #6)
  const jobs = await db.query.scrapingJobs.findMany({
    orderBy: [desc(scrapingJobs.createdAt)],
    limit: 1,
  });
  
  const job = jobs[0];
  if (!job) {
    console.log('No job found');
    return;
  }
  
  console.log('=== Run #6 Analysis ===\n');
  console.log('Job ID:', job.id);
  console.log('Created:', job.createdAt);
  console.log('Platform:', job.platform);
  console.log('Status:', job.status);
  console.log('');
  console.log('TARGET:', job.targetResults);
  console.log('');
  const keywords = toArray(job.keywords) ?? [];
  console.log('Keywords (original input):', JSON.stringify(keywords.slice(0, 5)), '... total:', keywords.length);
  console.log('Keywords Dispatched:', job.keywordsDispatched);
  console.log('Keywords Completed:', job.keywordsCompleted);
  console.log('');
  const creatorsFound = job.creatorsFound ?? 0;
  console.log('Creators Found (counter):', creatorsFound);
  console.log('Creators Enriched:', job.creatorsEnriched);
  console.log('Enrichment Status:', job.enrichmentStatus);
  console.log('Error:', job.error || 'none');
  
  // Get results
  const results = await db.query.scrapingResults.findFirst({
    where: eq(scrapingResults.jobId, job.id),
  });
  
  const creatorsInDb = Array.isArray(results?.creators) ? results.creators.length : 0;
  console.log('');
  console.log('Creators in DB (actual):', creatorsInDb);
  
  // Get dedup keys
  const keysResult = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM job_creator_keys WHERE job_id = ${job.id}
  `);
  const keysRows = toArray(keysResult) ?? [];
  const firstRow = toRecord(keysRows[0]);
  const rawCount = firstRow?.count;
  const keysCount =
    isNumber(rawCount) ? rawCount : typeof rawCount === 'string' ? Number(rawCount) : 0;
  console.log('Dedup keys:', keysCount);
  
  // Analysis
  console.log('\n=== Analysis ===');
  if (job.targetResults && creatorsInDb < job.targetResults) {
    const gap = job.targetResults - creatorsInDb;
    const pct = ((creatorsInDb / job.targetResults) * 100).toFixed(1);
    console.log(`⚠️  UNDER TARGET: wanted ${job.targetResults}, got ${creatorsInDb} (${pct}%)`);
    console.log(`   Missing: ${gap} creators`);
  }
  if (creatorsFound !== creatorsInDb) {
    console.log(`⚠️  COUNTER MISMATCH: counter=${creatorsFound}, DB=${creatorsInDb}`);
    console.log(`   Lost: ${creatorsFound - creatorsInDb} creators between count and save`);
  }
  if (keysCount !== creatorsInDb) {
    console.log(`📊 Dedup efficiency: ${keysCount} keys for ${creatorsInDb} creators`);
  }
  
  // Check if keywords were expanded
  const originalKeywords = keywords;
  if (originalKeywords.length === job.keywordsDispatched) {
    console.log('📌 Keywords NOT expanded (dispatched same as input)');
  } else {
    console.log(`📌 Keywords WERE expanded: ${originalKeywords.length} input → ${job.keywordsDispatched} dispatched`);
  }
  
  // Check if re-expansion happened
  if (job.keywordsCompleted && job.keywordsDispatched && job.keywordsCompleted > job.keywordsDispatched) {
    console.log(`🔄 Re-expansion happened: completed ${job.keywordsCompleted} > dispatched ${job.keywordsDispatched}`);
  }
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
