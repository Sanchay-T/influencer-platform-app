import { createClient } from '@/utils/supabase/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 [CAMPAIGN-DETAIL-API] GET request received for campaign:', id);
    
    console.log('🔄 [CAMPAIGN-DETAIL-API] Creating Supabase client');
    const supabase = await createClient()
    
    console.log('🔐 [CAMPAIGN-DETAIL-API] Getting authenticated user');
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('❌ [CAMPAIGN-DETAIL-API] Unauthorized - No valid user session', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('✅ [CAMPAIGN-DETAIL-API] User authenticated', { userId: user.id });

    console.log('🔄 [CAMPAIGN-DETAIL-API] Querying campaign with scraping jobs and results');
    // Obtener la campaña con sus scraping jobs y resultados
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, id),
      with: {
        scrapingJobs: {
          with: {
            results: {
              columns: {
                id: true,
                jobId: true,
                creators: true,
                createdAt: true
              }
            }
          },
          orderBy: (jobs, { desc }) => [desc(jobs.createdAt)]
        }
      }
    })

    if (!campaign) {
      console.error('❌ [CAMPAIGN-DETAIL-API] Campaign not found:', id);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    console.log('✅ [CAMPAIGN-DETAIL-API] Campaign found:', { id: campaign.id, name: campaign.name });

    // Verificar que la campaña pertenece al usuario
    if (campaign.userId !== user.id) {
      console.error('❌ [CAMPAIGN-DETAIL-API] Unauthorized - Campaign belongs to different user', {
        campaignUserId: campaign.userId,
        requestUserId: user.id
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('✅ [CAMPAIGN-DETAIL-API] User authorized to access campaign');

    console.log('📊 [CAMPAIGN-DETAIL-API] Campaign details:', {
      id: campaign.id,
      name: campaign.name,
      searchType: campaign.searchType,
      jobsCount: campaign.scrapingJobs?.length,
      jobs: campaign.scrapingJobs?.map(job => ({
        id: job.id,
        status: job.status,
        resultsCount: job.results?.length || 0
      }))
    });

    console.log('✅ [CAMPAIGN-DETAIL-API] Returning campaign details successfully');
    return NextResponse.json(campaign)
  } catch (error) {
    console.error('💥 [CAMPAIGN-DETAIL-API] Error fetching campaign:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
