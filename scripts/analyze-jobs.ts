import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { scrapingJobs, scrapingResults } from '../lib/db/schema';
import { getNumberProperty, toRecord } from '../lib/utils/type-guards';

async function analyze() {
  const jobs = await db.query.scrapingJobs.findMany({
    orderBy: [desc(scrapingJobs.createdAt)],
    limit: 10,
  });
  
  console.log('=== Recent Jobs ===\n');
  
  for (const job of jobs) {
    const keywords = job.keywords || [];
    const hasNutrition = JSON.stringify(keywords).toLowerCase().includes('nutrition');
    if (!hasNutrition) continue;
    
    console.log('Job ID:', job.id);
    console.log('Created:', job.createdAt);
    console.log('Platform:', job.platform);
    console.log('Status:', job.status);
    console.log('Target Results:', job.targetResults);
    console.log('Keywords (original):', JSON.stringify(job.keywords));
    console.log('Keywords Dispatched:', job.keywordsDispatched);
    console.log('Keywords Completed:', job.keywordsCompleted);
    console.log('Creators Found (counter):', job.creatorsFound);
    console.log('Creators Enriched:', job.creatorsEnriched);
    console.log('Enrichment Status:', job.enrichmentStatus);
    console.log('Error:', job.error || 'none');
    
    // Get results count
    const results = await db.query.scrapingResults.findFirst({
      where: eq(scrapingResults.jobId, job.id),
    });
    
    const creatorsInDb = Array.isArray(results?.creators) ? results.creators.length : 0;
    console.log('Creators in DB (actual):', creatorsInDb);
    
    // Get dedup keys count
    const keysResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM job_creator_keys WHERE job_id = ${job.id}
    `);
    const keysRow = Array.isArray(keysResult) && keysResult.length > 0 ? toRecord(keysResult[0]) : null;
    const keysCount = keysRow ? getNumberProperty(keysRow, 'count') ?? 0 : 0;
    console.log('Dedup keys in job_creator_keys:', keysCount);
    
    if (job.creatorsFound !== creatorsInDb) {
      console.log('⚠️  MISMATCH: counter=' + job.creatorsFound + ', DB=' + creatorsInDb);
    }
    console.log('---\n');
  }
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
