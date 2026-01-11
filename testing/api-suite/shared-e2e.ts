import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { buildTestAuthHeaders } from '@/lib/auth/testable-auth'
import {
  getArrayProperty,
  getNumberProperty,
  getStringProperty,
  toRecord,
} from '@/lib/utils/type-guards'

export type E2EContext = {
  baseUrl: string
  sessionToken: string
  headers: Record<string, string>
}

export type JobStatusPayload = {
  status: string
  processedResults: number
  targetResults?: number
  results?: unknown[]
  error?: unknown
  progress?: number
  benchmark?: unknown
}

const TOKEN_PATH = resolve(__dirname, '..', 'clerk-session-token', '.session-token')

const DEFAULT_POLL_DELAY_MS = Number(process.env.E2E_POLL_DELAY_MS || 5000)
const DEFAULT_MAX_ATTEMPTS = Number(process.env.E2E_MAX_ATTEMPTS || 120)

type RequestOptions = {
  method?: string
  body?: Record<string, unknown>
  headers?: Record<string, string>
  label?: string
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  const record = toRecord(value)
  if (!record) {
    throw new Error(`${label}: Expected object response`)
  }
  return record
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = getStringProperty(record, key)
  if (!value) {
    throw new Error(`${label}: Missing ${key}`)
  }
  return value
}

function parseJobStatusPayload(value: unknown, label: string): JobStatusPayload {
  const record = requireRecord(value, label)
  const status = requireString(record, 'status', label)
  const processedResults = getNumberProperty(record, 'processedResults')
  if (processedResults === null) {
    throw new Error(`${label}: Missing processedResults`)
  }

  return {
    status,
    processedResults,
    targetResults: getNumberProperty(record, 'targetResults') ?? undefined,
    results: getArrayProperty(record, 'results') ?? undefined,
    error: record.error,
    progress: getNumberProperty(record, 'progress') ?? undefined,
    benchmark: record.benchmark,
  }
}

export function createContext(): E2EContext {
  const baseUrl =
    process.env.SESSION_BASE_URL ||
    process.env.AUTOMATION_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://127.0.0.1:3001'

  const sessionToken = readFileSync(TOKEN_PATH, 'utf8').trim()
  const automationUserId = process.env.AUTOMATION_USER_ID || 'user_33neqrnH0OrnbvECgCZF9YT4E7F'
  const automationEmail = process.env.AUTOMATION_USER_EMAIL || 'test-automation@gemz.io'
  const headers = buildTestAuthHeaders({ userId: automationUserId, email: automationEmail })

  return {
    baseUrl,
    sessionToken,
    headers,
  }
}

export function authHeaders(ctx: E2EContext, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${ctx.sessionToken}`,
    ...ctx.headers,
    ...(extra || {}),
  }
}

export async function ensureOk(res: Response, label: string) {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${label} failed (${res.status}): ${text}`)
  }
}

export async function requestJson(
  ctx: E2EContext,
  path: string,
  options?: RequestOptions
): Promise<unknown>
export async function requestJson<T>(
  ctx: E2EContext,
  path: string,
  options: RequestOptions,
  parse: (value: unknown) => T
): Promise<T>
export async function requestJson<T>(
  ctx: E2EContext,
  path: string,
  options: RequestOptions = {},
  parse?: (value: unknown) => T
): Promise<T | unknown> {
  const { method = options.body ? 'POST' : 'GET', body, headers = {}, label = `${method} ${path}` } = options
  const initHeaders: Record<string, string> = { ...authHeaders(ctx) }
  if (body) {
    initHeaders['Content-Type'] = 'application/json'
  }
  Object.assign(initHeaders, headers)

  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers: initHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })
  await ensureOk(res, label)
  const text = await res.text()
  const parsed: unknown = text ? JSON.parse(text) : undefined
  return parse ? parse(parsed) : parsed
}

export async function createCampaign(
  ctx: E2EContext,
  params: {
    searchType: 'keyword' | 'similar'
    label: string
    reuseId?: string
    description?: string
  }
): Promise<string> {
  if (params.reuseId) {
    console.log(`→ Reusing existing campaign for ${params.label}: ${params.reuseId}`)
    return params.reuseId
  }

  console.log(`→ Creating ${params.label} campaign`)
  const res = await fetch(`${ctx.baseUrl}/api/campaigns`, {
    method: 'POST',
    headers: authHeaders(ctx, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: `${params.label} ${new Date().toISOString()}`,
      description: params.description ?? 'Automated E2E campaign',
      searchType: params.searchType,
    }),
  })
  await ensureOk(res, `Create campaign (${params.label})`)
  const payload = await res.json()
  const record = requireRecord(payload, `Create campaign (${params.label})`)
  const id = requireString(record, 'id', `Create campaign (${params.label})`)
  console.log(`   ↳ campaignId: ${id}`)
  return id
}

export async function startScrape(
  ctx: E2EContext,
  params: {
    path: string
    label: string
    body: Record<string, unknown>
  }
): Promise<{ jobId: string; payload: unknown }> {
  console.log(`→ Starting ${params.label} scrape`)
  const res = await fetch(`${ctx.baseUrl}${params.path}`, {
    method: 'POST',
    headers: authHeaders(ctx, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(params.body),
  })
  await ensureOk(res, `Start ${params.label}`)
  const payload = await res.json()
  const record = requireRecord(payload, `Start ${params.label}`)
  const jobId = requireString(record, 'jobId', `Start ${params.label}`)
  console.log(`   ↳ jobId: ${jobId}`)
  const qstashMessageId = getStringProperty(record, 'qstashMessageId')
  if (qstashMessageId) {
    console.log(`   ↳ qstashMessageId: ${qstashMessageId}`)
  }
  return { jobId, payload }
}

export async function pollJob(
  ctx: E2EContext,
  params: {
    statusPath: string
    label: string
    showSample?: boolean
    maxAttempts?: number
    pollDelayMs?: number
  }
): Promise<JobStatusPayload> {
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const delay = params.pollDelayMs ?? DEFAULT_POLL_DELAY_MS

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${ctx.baseUrl}${params.statusPath}`, {
      headers: authHeaders(ctx),
    })
    await ensureOk(res, `Check ${params.label} status`)
    const payload = parseJobStatusPayload(await res.json(), `Check ${params.label} status`)
    console.log(
      `   [${params.label}] attempt ${attempt} → status=${payload.status} processed=${payload.processedResults}`
    )

    if (payload.status === 'completed') {
      const results = payload.results || []
      console.log(`✅ ${params.label} completed. Creators returned: ${results.length}`)
      if (results.length > 0 && params.showSample !== false) {
        console.log(`   Sample result: ${JSON.stringify(results[0], null, 2)}`)
      }
      if (payload.benchmark) {
        console.log(`   Benchmark: ${JSON.stringify(payload.benchmark, null, 2)}`)
      }
      return payload
    }

    if (payload.status === 'error' || payload.status === 'timeout') {
      throw new Error(`${params.label} ended with status=${payload.status}. Payload: ${JSON.stringify(payload)}`)
    }

    await sleep(delay)
  }

  throw new Error(
    `${params.label} did not finish within ${(maxAttempts * delay) / 1000} seconds. Consider increasing E2E_MAX_ATTEMPTS.`
  )
}
