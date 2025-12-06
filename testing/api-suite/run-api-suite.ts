#!/usr/bin/env tsx
/**
 * Breadcrumb: testing → api-suite → sequentially exercises key API endpoints with Clerk auth intact.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildTestAuthHeaders } from '@/lib/auth/testable-auth'

type TestContext = {
  baseUrl: string
  campaignId?: string
  similarCampaignId?: string
  youtubeJobId?: string
  tiktokJobId?: string
  instagramJobId?: string
  listId?: string
  listName?: string
}

type ApiTest = {
  name: string
  method?: 'GET' | 'POST'
  path: string | ((ctx: TestContext) => string)
  body?: Record<string, unknown> | ((ctx: TestContext) => Record<string, unknown> | undefined)
  expectStatus?: number
  onSuccess?: (payload: any, ctx: TestContext) => void | Promise<void>
}

const automationUserId = process.env.AUTOMATION_USER_ID || 'user_33neqrnH0OrnbvECgCZF9YT4E7F'
const automationEmail = process.env.AUTOMATION_USER_EMAIL || 'test-automation@gemz.io'
const baseUrl = process.env.SESSION_BASE_URL || process.env.AUTOMATION_BASE_URL || 'http://127.0.0.1:3001'
const tokenPath = resolve(__dirname, '..', 'clerk-session-token', '.session-token')
const cookiePath = resolve(__dirname, '..', 'session-exchange', '.session-cookie')

async function loadSessionToken(): Promise<string> {
  try {
    const raw = await readFile(tokenPath, 'utf8')
    const trimmed = raw.trim()
    if (!trimmed) throw new Error('session token file empty')
    return trimmed
  } catch (err) {
    throw new Error(
      `Failed to read Clerk session token at ${tokenPath}. Run testing/clerk-session-token/mint-session-token.ts first.\n` +
        String(err)
    )
  }
}

async function loadCookieHeader(): Promise<string> {
  try {
    const raw = await readFile(cookiePath, 'utf8')
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) throw new Error('cookie file empty')
    const pairs = lines.map((line) => line.split(';')[0])
    return pairs.join('; ')
  } catch (err) {
    throw new Error(
      `Failed to read Clerk cookie jar at ${cookiePath}. Run testing/session-exchange/run-session-exchange.ts first.\n` +
        String(err)
    )
  }
}

function buildHeaders(sessionToken: string, cookieHeader: string) {
  const testHeaders = buildTestAuthHeaders(
    {
      userId: automationUserId,
      email: automationEmail,
    },
    process.env.TEST_AUTH_SECRET
  )

  return {
    Authorization: `Bearer ${sessionToken}`,
    Cookie: cookieHeader,
    ...testHeaders,
  }
}

function resolvePath(path: ApiTest['path'], ctx: TestContext): string {
  return typeof path === 'function' ? path(ctx) : path
}

function resolveBody(body: ApiTest['body'], ctx: TestContext) {
  if (!body) return undefined
  return typeof body === 'function' ? body(ctx) : body
}

function summarizePayload(payload: any) {
  if (!payload) return payload
  if (Array.isArray(payload)) return payload.slice(0, 3)
  if (typeof payload === 'object') {
    const copy: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' && value.length > 120) {
        copy[key] = `${value.slice(0, 60)}…${value.slice(-10)}`
      } else if (Array.isArray(value)) {
        copy[key] = value.length > 3 ? value.slice(0, 3) : value
      } else {
        copy[key] = value
      }
    }
    return copy
  }
  return payload
}

async function run() {
  const [sessionToken, cookieHeader] = await Promise.all([
    loadSessionToken(),
    loadCookieHeader(),
  ])
  const headers = buildHeaders(sessionToken, cookieHeader)

  const context: TestContext = { baseUrl }

  const tests: ApiTest[] = [
    {
      name: 'Status check',
      method: 'GET',
      path: '/api/status',
      expectStatus: 200,
    },
    {
      name: 'Usage summary',
      method: 'GET',
      path: '/api/usage/summary',
      expectStatus: 200,
    },
    {
      name: 'Onboarding status',
      method: 'GET',
      path: '/api/onboarding/status',
      expectStatus: 200,
    },
    {
      name: 'Create campaign',
      method: 'POST',
      path: '/api/campaigns',
      expectStatus: 200,
      body: () => ({
        name: `Smoke Test Campaign ${new Date().toISOString()}`,
        description: 'Automation campaign created by api-suite',
        searchType: 'keyword',
      }),
      onSuccess: (payload, ctx) => {
        const campaignId = payload?.id
        if (campaignId) {
          ctx.campaignId = campaignId
          console.log(`   ↳ campaignId stored: ${campaignId}`)
        }
      },
    },
    {
      name: 'Create similar campaign',
      method: 'POST',
      path: '/api/campaigns',
      expectStatus: 200,
      body: () => ({
        name: `Smoke Test Similar Campaign ${new Date().toISOString()}`,
        description: 'Automation similar campaign created by api-suite',
        searchType: 'similar',
      }),
      onSuccess: (payload, ctx) => {
        const campaignId = payload?.id
        if (campaignId) {
          ctx.similarCampaignId = campaignId
          console.log(`   ↳ similar campaign stored: ${campaignId}`)
        }
      },
    },
    {
      name: 'List campaigns',
      method: 'GET',
      path: '/api/campaigns?page=1&limit=5',
      expectStatus: 200,
    },
    {
      name: 'Create list',
      method: 'POST',
      path: '/api/lists',
      expectStatus: 201,
      body: (ctx) => {
        const listName = `Smoke Test List ${new Date().toISOString()}`
        ctx.listName = listName
        return {
          name: listName,
          description: 'QA automation list',
          type: 'prospects',
          privacy: 'private',
          tags: ['automation', 'smoke'],
          settings: { source: 'api-suite' },
        }
      },
      onSuccess: (payload, ctx) => {
        const listId = payload?.list?.id
        if (listId) {
          ctx.listId = listId
          console.log(`   ↳ list stored: ${listId}`)
        }
      },
    },
    {
      name: 'Fetch lists',
      method: 'GET',
      path: '/api/lists',
      expectStatus: 200,
      onSuccess: (payload, ctx) => {
        if (ctx.listName) {
          const lists = payload?.lists ?? []
          const match = lists.find((list: any) => list?.name === ctx.listName)
          console.log(`   ↳ list present: ${Boolean(match)}`)
        }
      },
    },
    {
      name: 'Start YouTube scrape',
      method: 'POST',
      path: '/api/scraping/youtube',
      expectStatus: 200,
      body: (ctx) => {
        if (!ctx.campaignId) throw new Error('campaignId missing for YouTube scrape')
        return {
          keywords: ['smoke test keyword'],
          targetResults: 100,
          campaignId: ctx.campaignId,
        }
      },
      onSuccess: (payload, ctx) => {
        const jobId = payload?.jobId
        if (jobId) {
          ctx.youtubeJobId = jobId
          console.log(`   ↳ youtube job stored: ${jobId}`)
        }
      },
    },
    {
      name: 'YouTube scrape status',
      method: 'GET',
      path: (ctx) => {
        if (!ctx.youtubeJobId) throw new Error('youtubeJobId missing for status check')
        return `/api/scraping/youtube?jobId=${ctx.youtubeJobId}`
      },
      expectStatus: 200,
    },
    {
      name: 'Start TikTok scrape',
      method: 'POST',
      path: '/api/scraping/tiktok',
      expectStatus: 200,
      body: (ctx) => {
        if (!ctx.campaignId) throw new Error('campaignId missing for TikTok scrape')
        return {
          keywords: ['automation smoke keyword'],
          targetResults: 100,
          campaignId: ctx.campaignId,
        }
      },
      onSuccess: (payload, ctx) => {
        const jobId = payload?.jobId
        if (jobId) {
          ctx.tiktokJobId = jobId
          console.log(`   ↳ tiktok job stored: ${jobId}`)
        }
      },
    },
    {
      name: 'TikTok scrape status',
      method: 'GET',
      path: (ctx) => {
        if (!ctx.tiktokJobId) throw new Error('tiktokJobId missing for status check')
        return `/api/scraping/tiktok?jobId=${ctx.tiktokJobId}`
      },
      expectStatus: 200,
    },
    {
      name: 'Start Instagram similar scrape',
      method: 'POST',
      path: '/api/scraping/instagram',
      expectStatus: 200,
      body: (ctx) => {
        if (!ctx.similarCampaignId) throw new Error('similarCampaignId missing for Instagram scrape')
        return {
          username: 'nasa',
          campaignId: ctx.similarCampaignId,
        }
      },
      onSuccess: (payload, ctx) => {
        const jobId = payload?.jobId
        if (jobId) {
          ctx.instagramJobId = jobId
          console.log(`   ↳ instagram job stored: ${jobId}`)
        }
      },
    },
    {
      name: 'Instagram similar status',
      method: 'GET',
      path: (ctx) => {
        if (!ctx.instagramJobId) throw new Error('instagramJobId missing for status check')
        return `/api/scraping/instagram?jobId=${ctx.instagramJobId}`
      },
      expectStatus: 200,
    },
  ]

  let passCount = 0

  for (const test of tests) {
    const method = test.method || 'GET'
    const path = resolvePath(test.path, context)
    const url = `${baseUrl}${path}`
    const expectStatus = test.expectStatus ?? 200
    const body = resolveBody(test.body, context)

    const requestHeaders = new Headers(headers as Record<string, string>)
    if (body) {
      requestHeaders.set('Content-Type', 'application/json')
    }

    console.log(`\n→ ${test.name} [${method} ${path}]`)
    const res = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    const rawText = await res.text()
    let payload: any = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = rawText
    }

    const summary = summarizePayload(payload)
    console.log(`   status: ${res.status}`)
    if (summary) {
      console.log('   payload:', summary)
    }

    if (res.status !== expectStatus) {
      console.error(`   ✖ Expected ${expectStatus} but received ${res.status}`)
      continue
    }

    passCount += 1

    if (test.onSuccess) {
      await test.onSuccess(payload, context)
    }
  }

  console.log(`\n${passCount}/${tests.length} checks returned expected status codes.`)
}

run().catch((err) => {
  console.error('API suite failed:', err)
  process.exit(1)
})
