import { Suspense } from 'react'
import DashboardLayout from '@/app/components/layout/dashboard-layout'
import { db } from '@/lib/db'
import { campaigns, PlatformResult } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import ClientCampaignPage from '@/app/campaigns/[id]/client-page'
import { Campaign, ScrapingJob, ScrapingResult } from '@/app/types/campaign'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getCampaign(id: string) {
  console.log('Fetching campaign with id:', id)
  try {
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
      console.log('No campaign found with id:', id)
      return null
    }

    console.log('📊 [CAMPAIGN-DEBUG] Campaign structure:', JSON.stringify({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      jobsCount: campaign.scrapingJobs?.length,
      jobs: campaign.scrapingJobs?.map(job => ({
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        campaignId: job.campaignId,
        platform: job.platform,
        keywords: job.keywords,
        targetUsername: job.targetUsername,
        resultCount: job.results?.length || 0,
        results: job.results?.map(result => ({
          id: result.id,
          creatorsCount: Array.isArray(result.creators) ? result.creators.length : 0
        }))
      }))
    }, null, 2))

    // 🔍 ADDITIONAL LOGGING: Check if multiple jobs exist for this campaign
    console.log('🔍 [CAMPAIGN-RUNS-DEBUG] Total jobs found for campaign:', campaign.scrapingJobs?.length || 0);
    campaign.scrapingJobs?.forEach((job, index) => {
      console.log(`🏃 [RUN-${index + 1}] Job ${job.id}:`, {
        status: job.status,
        createdAt: job.createdAt,
        platform: job.platform,
        hasResults: (job.results?.length || 0) > 0,
        resultsCount: job.results?.length || 0
      });
    });

    // 🔍 COMPLETED JOBS DEBUG: Check how many completed jobs exist
    const completedJobs = campaign.scrapingJobs?.filter(job => 
      job.status === 'completed' && job.results?.length > 0
    ) || [];
    console.log('✅ [COMPLETED-JOBS-DEBUG] Found completed jobs:', completedJobs.length);
    completedJobs.forEach((job, index) => {
      console.log(`✅ [COMPLETED-${index + 1}] Job ${job.id}:`, {
        platform: job.platform,
        createdAt: job.createdAt,
        resultsCount: job.results?.length || 0
      });
    });

    return campaign
  } catch (error) {
    console.error('Error fetching campaign:', error)
    throw error
  }
}

export default async function CampaignPage({ params }: PageProps) {
  const { id } = await params;
  const campaign = await getCampaign(id);

  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
            <p className="text-sm text-gray-500">Loading campaign data...</p>
          </div>
        </div>
      }>
        <ClientCampaignPage campaign={campaign as Campaign | null} />
      </Suspense>
    </DashboardLayout>
  )
}
