import {
  E2EContext,
  JobStatusPayload,
  createCampaign,
  createContext,
  pollJob,
  startScrape,
} from '../shared-e2e'

type YoutubeOptions = {
  campaignId?: string
  keywords?: string[]
  targetResults?: number
}

export async function runYoutubeKeywordE2E(
  context?: E2EContext,
  options: YoutubeOptions = {}
): Promise<{ campaignId: string; jobId: string; status: JobStatusPayload }> {
  const ctx = context || createContext()

  const campaignId = await createCampaign(ctx, {
    searchType: 'keyword',
    label: 'YouTube keyword',
    reuseId: options.campaignId,
  })

  const { jobId } = await startScrape(ctx, {
    path: '/api/scraping/youtube',
    label: 'YouTube keyword',
    body: {
      keywords: options.keywords ?? ['automation testing youtube'],
      targetResults: options.targetResults ?? 100,
      campaignId,
    },
  })

  const status = await pollJob(ctx, {
    statusPath: `/api/scraping/youtube?jobId=${jobId}`,
    label: 'YouTube keyword',
  })

  return { campaignId, jobId, status }
}
