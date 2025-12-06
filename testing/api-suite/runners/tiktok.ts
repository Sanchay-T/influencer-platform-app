import {
  E2EContext,
  JobStatusPayload,
  createCampaign,
  createContext,
  pollJob,
  startScrape,
} from '../shared-e2e'

type TiktokOptions = {
  campaignId?: string
  keywords?: string[]
  targetResults?: number
}

export async function runTiktokKeywordE2E(
  context?: E2EContext,
  options: TiktokOptions = {}
): Promise<{ campaignId: string; jobId: string; status: JobStatusPayload }> {
  const ctx = context || createContext()

  const campaignId = await createCampaign(ctx, {
    searchType: 'keyword',
    label: 'TikTok keyword',
    reuseId: options.campaignId,
  })

  const { jobId } = await startScrape(ctx, {
    path: '/api/scraping/tiktok',
    label: 'TikTok keyword',
    body: {
      keywords: options.keywords ?? ['automation testing tiktok'],
      targetResults: options.targetResults ?? 100,
      campaignId,
    },
  })

  const status = await pollJob(ctx, {
    statusPath: `/api/scraping/tiktok?jobId=${jobId}`,
    label: 'TikTok keyword',
  })

  return { campaignId, jobId, status }
}
