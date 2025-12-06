import { randomUUID } from 'crypto'

import { db } from '@/lib/db'
import { campaigns, scrapingJobs, scrapingResults } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const DEFAULT_USER_ID = process.env.SEED_USER_ID || 'dev-user'
const DEFAULT_CAMPAIGN_NAME = process.env.SEED_CAMPAIGN_NAME || 'Load Test Campaign'

async function main() {
  const userId = DEFAULT_USER_ID
  const campaignName = DEFAULT_CAMPAIGN_NAME

  const existingCampaign = await db.query.campaigns.findFirst({
    where: (table, operators) =>
      operators.and(eq(table.userId, userId), eq(table.name, campaignName)),
  })

  const campaignId = existingCampaign?.id ?? randomUUID()

  if (!existingCampaign) {
    await db.insert(campaigns).values({
      id: campaignId,
      userId,
      name: campaignName,
      description: 'Synthetic campaign seeded for pagination QA.',
      searchType: 'keyword',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  const jobId = randomUUID()

  await db.insert(scrapingJobs).values({
    id: jobId,
    userId,
    campaignId,
    status: 'completed',
    keywords: ['load testing', 'influencers'],
    platform: 'Tiktok',
    region: 'US',
    createdAt: new Date(),
    startedAt: new Date(Date.now() - 60_000),
    completedAt: new Date(),
    processedRuns: 1,
    processedResults: 1000,
    targetResults: 1000,
    updatedAt: new Date(),
    cursor: 0,
    progress: '100',
  })

  const creators = Array.from({ length: 1200 }, (_, index) => ({
    creator: {
      username: `load_test_creator_${index + 1}`,
      followers: 10_000 + index,
      emails: [`creator${index + 1}@example.com`],
    },
    platform: 'tiktok',
    stats: {
      engagementRate: 0.12,
      views: 1_000_000 + index * 10,
    },
  }))

  await db.insert(scrapingResults).values({
    id: randomUUID(),
    jobId,
    creators,
    createdAt: new Date(),
  })

  console.log(JSON.stringify({ campaignId, jobId, creatorCount: creators.length }, null, 2))
}

main().catch((error) => {
  console.error('Failed to seed campaign:', error)
  process.exit(1)
})
