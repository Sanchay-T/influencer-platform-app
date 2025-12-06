import {
  E2EContext,
  JobStatusPayload,
  createCampaign,
  createContext,
  pollJob,
  startScrape,
} from '../shared-e2e'

type InstagramOptions = {
  campaignId?: string
  username?: string
}

export async function runInstagramSimilarE2E(
  context?: E2EContext,
  options: InstagramOptions = {}
): Promise<{ campaignId: string; jobId: string; status: JobStatusPayload }> {
  const ctx = context || createContext()

  const campaignId = await createCampaign(ctx, {
    searchType: 'similar',
    label: 'Instagram similar',
    reuseId: options.campaignId,
  })

  const { jobId } = await startScrape(ctx, {
    path: '/api/scraping/instagram',
    label: 'Instagram similar',
    body: {
      username: options.username ?? 'nasa',
      campaignId,
    },
  })

  const status = await pollJob(ctx, {
    statusPath: `/api/scraping/instagram?jobId=${jobId}`,
    label: 'Instagram similar',
  })

  return { campaignId, jobId, status }
}
