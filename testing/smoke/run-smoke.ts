#!/usr/bin/env tsx
/**
 * Lightweight smoke test that exercises authenticated APIs using the dev bypass headers.
 * Run with: AUTH_BYPASS_TOKEN=dev-bypass SMOKE_USER_ID=... SMOKE_EMAIL=... npx tsx testing/smoke/run-smoke.ts
 */

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001'
const bypassToken = process.env.AUTH_BYPASS_TOKEN || 'dev-bypass'
const ownerUserId = process.env.SMOKE_USER_ID || 'user_33sIjMrYEmLVKd3gvIt4HbtzE57'
const ownerEmail = process.env.SMOKE_EMAIL || 'curawebsite2@gmail.com'

type Check = {
  name: string
  request: () => Promise<Response>
  expectStatus: number
  onPass?: (res: Response, body: any) => void | Promise<void>
}

function buildHeaders(userId: string, email: string) {
  return {
    'x-dev-auth': bypassToken,
    'x-dev-user-id': userId,
    'x-dev-email': email,
  }
}

async function parseBody(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function resolveSmokeTargets(headers: HeadersInit) {
  let resolvedCampaignId = process.env.SMOKE_CAMPAIGN_ID || ''
  let resolvedJobId = process.env.SMOKE_JOB_ID || ''

  if (resolvedCampaignId && resolvedJobId) {
    return { campaignId: resolvedCampaignId, jobId: resolvedJobId }
  }

  const campaignsRes = await fetch(`${baseUrl}/api/campaigns?page=1&limit=20`, { headers })
  if (!campaignsRes.ok) {
    throw new Error(`Failed to list campaigns (status ${campaignsRes.status})`)
  }
  const campaignsPayload = await campaignsRes.json()
  const campaignsList = campaignsPayload?.campaigns || []

  const campaignWithJob = campaignsList.find((campaign: any) => Array.isArray(campaign?.scrapingJobs) && campaign.scrapingJobs.length > 0)

  if (!campaignWithJob) {
    throw new Error('No campaigns with scraping jobs found. Seed data or run a scrape before executing the smoke test.')
  }

  resolvedCampaignId = resolvedCampaignId || campaignWithJob.id

  if (!resolvedJobId) {
    const jobFromList = campaignWithJob.scrapingJobs?.[0]?.id
    if (jobFromList) {
      resolvedJobId = jobFromList
    }
  }

  if (!resolvedJobId) {
    const detailRes = await fetch(`${baseUrl}/api/campaigns/${resolvedCampaignId}`, { headers })
    if (!detailRes.ok) {
      throw new Error(`Failed to fetch campaign detail for ${resolvedCampaignId} (status ${detailRes.status})`)
    }
    const detailPayload = await detailRes.json()
    const job = Array.isArray(detailPayload?.scrapingJobs) ? detailPayload.scrapingJobs[0] : null
    if (!job?.id) {
      throw new Error('Campaign detail did not include scraping jobs. Seed data before running the smoke suite.')
    }
    resolvedJobId = job.id
  }

  return { campaignId: resolvedCampaignId, jobId: resolvedJobId }
}

async function run() {
  const ownerHeaders = buildHeaders(ownerUserId, ownerEmail)
  const strangerHeaders = buildHeaders('user_smoke_stranger', 'stranger@example.com')

  const { campaignId, jobId } = await resolveSmokeTargets(ownerHeaders)

  const checks: Check[] = [
    {
      name: 'Status healthcheck',
      expectStatus: 200,
      request: () => fetch(`${baseUrl}/api/status`),
    },
    {
      name: 'Usage summary (owner)',
      expectStatus: 200,
      request: () => fetch(`${baseUrl}/api/usage/summary`, { headers: ownerHeaders }),
    },
    {
      name: 'Campaign detail (owner)',
      expectStatus: 200,
      request: () => fetch(`${baseUrl}/api/campaigns/${campaignId}`, { headers: ownerHeaders }),
      onPass: (_res, body) => {
        if (!body || body.id !== campaignId) {
          throw new Error('Campaign payload missing expected id')
        }
      },
    },
    {
      name: 'Campaign detail (stranger blocked)',
      expectStatus: 401,
      request: () => fetch(`${baseUrl}/api/campaigns/${campaignId}`, { headers: strangerHeaders }),
    },
    {
      name: 'Scraping results first page (owner)',
      expectStatus: 200,
      request: () => fetch(`${baseUrl}/api/scraping/tiktok?jobId=${jobId}&limit=200`, { headers: ownerHeaders }),
      onPass: (_res, body) => {
        const count = body?.results?.[0]?.creators?.length ?? 0
        if (count !== 200) {
          throw new Error(`Expected 200 creators in page, received ${count}`)
        }
      },
    },
    {
      name: 'Scraping results first page (stranger blocked)',
      expectStatus: 404,
      request: () => fetch(`${baseUrl}/api/scraping/tiktok?jobId=${jobId}&limit=200`, { headers: strangerHeaders }),
    },
    {
      name: 'Scraping pagination last page',
      expectStatus: 200,
      request: () => fetch(`${baseUrl}/api/scraping/tiktok?jobId=${jobId}&limit=200&offset=1000`, { headers: ownerHeaders }),
      onPass: (_res, body) => {
        const count = body?.results?.[0]?.creators?.length ?? 0
        if (count === 0) {
          throw new Error('Expected creators on final page but received none')
        }
        const nextOffset = body?.pagination?.nextOffset ?? null
        if (nextOffset !== null) {
          throw new Error(`Expected no nextOffset on final page, received ${nextOffset}`)
        }
      },
    },
  ]

  let pass = 0

  for (const check of checks) {
    try {
      const res = await check.request()
      const body = await parseBody(res)
      const statusMatches = res.status === check.expectStatus
      console.log(`→ ${check.name}: status ${res.status} ${statusMatches ? '✓' : '✖'}`)
      if (!statusMatches) {
        console.log('   payload:', body)
        continue
      }
      if (check.onPass) {
        await check.onPass(res, body)
      }
      pass += 1
    } catch (error) {
      console.error(`   Error during "${check.name}":`, error)
    }
  }

  console.log(`\n${pass}/${checks.length} smoke checks passed.`)
  if (pass !== checks.length) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error('Smoke suite failed:', error)
  process.exit(1)
})
