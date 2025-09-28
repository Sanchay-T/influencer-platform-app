import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { buildTestAuthHeaders } from '../../../lib/auth/testable-auth'

loadEnv({ path: path.join(process.cwd(), '.env.development') })
loadEnv({ path: path.join(process.cwd(), '.env.local') })

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const JOB_ID = process.argv[2] || process.env.JOB_ID
const TEST_USER = process.env.TEST_SEARCH_USER_ID || 'user_2zrF0Aod9GyXO5b3R74PC3EPpeC'

if (!JOB_ID) {
  console.error('Usage: JOB_ID=... npx tsx test-scripts/search/keyword/tiktok-job-inspector.ts [jobId]')
  process.exit(1)
}

const headers = {
  ...buildTestAuthHeaders({ userId: TEST_USER }),
  'content-type': 'application/json'
}

function formatDuration(ms: number | null | undefined) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${ms.toFixed(0)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`
}

(async () => {
  const res = await fetch(`${BASE_URL}/api/scraping/tiktok?jobId=${JOB_ID}`, { headers })
  if (!res.ok) {
    console.error('Request failed', res.status, await res.text())
    process.exit(1)
  }
  const payload = await res.json()
  const timings = payload?.benchmark?.timings ?? {}
  const batches = Array.isArray(payload?.benchmark?.batches) ? payload.benchmark.batches : []
  const jobCreatedAt = payload?.job?.createdAt ? new Date(payload.job.createdAt) : null
  const startedAt = timings?.startedAt ? new Date(timings.startedAt) : null
  const finishedAt = timings?.finishedAt ? new Date(timings.finishedAt) : null
  const queueLatencyMs = jobCreatedAt && startedAt ? startedAt.getTime() - jobCreatedAt.getTime() : null
  const processingMs = typeof timings?.totalDurationMs === 'number'
    ? timings.totalDurationMs
    : startedAt && finishedAt
      ? finishedAt.getTime() - startedAt.getTime()
      : null

  const totalMs = queueLatencyMs !== null && processingMs !== null
    ? queueLatencyMs + processingMs
    : processingMs

  console.log('\n🔍 TikTok Search Diagnostics')
  console.table([{
    jobId: JOB_ID,
    engine: payload?.engine ?? 'legacy',
    status: payload?.status,
    processedCreators: payload?.benchmark?.processedCreators ?? payload?.processedResults ?? '—',
    apiCalls: payload?.benchmark?.apiCalls ?? batches.length ?? '—',
    queueWait: formatDuration(queueLatencyMs),
    processing: formatDuration(processingMs),
    total: formatDuration(totalMs),
    startedAt: timings?.startedAt ?? '—',
    finishedAt: timings?.finishedAt ?? '—'
  }])

  if (batches.length) {
    console.log('\n📦 Batch timings')
    console.table(batches.map((batch: any, index: number) => ({
      batch: batch.index ?? index + 1,
      size: batch.size ?? '—',
      duration: formatDuration(batch.durationMs ?? null)
    })))
  }

  console.log('\nRaw benchmark payload:')
  console.dir(payload?.benchmark, { depth: null })
})().catch((error) => {
  console.error('Inspector failed', error)
  process.exit(1)
})
