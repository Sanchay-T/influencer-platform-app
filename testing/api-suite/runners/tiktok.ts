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
    path: '/api/v2/dispatch',
    label: 'TikTok keyword (v2)',
    body: {
      platform: 'tiktok',
      keywords: options.keywords ?? ['automation testing tiktok'],
      targetResults: options.targetResults ?? 100,
      campaignId,
    },
  })

  const status = await pollJob(ctx, {
    statusPath: `/api/v2/status?jobId=${jobId}&limit=0`,
    label: 'TikTok keyword (v2)',
  })

  return { campaignId, jobId, status }
}
