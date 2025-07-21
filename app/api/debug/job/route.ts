import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  
  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  }
  
  try {
    // Get job details
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId),
      with: {
        results: true
      }
    });
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Analyze results
    const totalCreators = job.results?.reduce((acc, result) => {
      return acc + (result.creators?.length || 0);
    }, 0) || 0;
    
    // Debug analysis
    const debugAnalysis = {
      jobDetails: {
        id: job.id,
        status: job.status,
        platform: job.platform,
        targetResults: job.targetResults,
        processedResults: job.processedResults,
        processedRuns: job.processedRuns,
        progress: job.progress
      },
      results: {
        totalCreatorsInDB: totalCreators,
        resultsCount: job.results?.length || 0,
        firstResultCreators: job.results?.[0]?.creators?.length || 0
      },
      analysis: {
        targetVsActual: `Target: ${job.targetResults}, Delivered: ${job.processedResults}`,
        shortfall: job.targetResults - job.processedResults,
        percentageDelivered: Math.round((job.processedResults / job.targetResults) * 100)
      }
    };
    
    return NextResponse.json(debugAnalysis);
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Failed to analyze job' }, { status: 500 });
  }
}