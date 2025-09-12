#!/usr/bin/env node
// Poll a scraping job (e.g., TikTok) until it completes, with optional job creation.
// Examples:
//   node test-scripts/poll-job.js \
//     --path /api/scraping/tiktok \
//     --user-id test_user_123 --email dev@example.com \
//     --campaign-id 00000000-0000-0000-0000-000000000000 \
//     --keywords '["iphone 17 pro"]' --target-results 100 --interval 7 --timeout 900
//
//   node test-scripts/poll-job.js --path /api/scraping/tiktok --user-id ... --email ... --job-id <existing>

const { buildTestAuthHeaders } = require('../lib/tests/agent-auth')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--path': args.path = next; i++; break
      case '--url': args.url = next; i++; break
      case '--site': args.site = next; i++; break
      case '--method': args.method = next; i++; break
      case '--job-id': args.jobId = next; i++; break
      case '--campaign-id': args.campaignId = next; i++; break
      case '--keywords': args.keywords = next; i++; break
      case '--target-results': args.targetResults = parseInt(next, 10); i++; break
      case '--user-id': args.userId = next; i++; break
      case '--email': args.email = next; i++; break
      case '--as': args.as = next; i++; break // user|admin
      case '--interval': args.interval = parseInt(next, 10); i++; break
      case '--timeout': args.timeout = parseInt(next, 10); i++; break
      case '--help': args.help = true; break
      default: break
    }
  }
  return args
}

function printHelp() {
  console.log(`\nScrape Job Poller (with Test Auth)\n\nUsage:\n  node test-scripts/poll-job.js --path /api/scraping/tiktok --user-id test_user_123 --email you@example.com --campaign-id <id> --keywords '["iphone 17 pro"]'\n\nOptions:\n  --path <path>           Base API path (e.g. /api/scraping/tiktok)\n  --url <url>             Full URL for base path (overrides --site + --path)\n  --site <base>           Base URL (default: NEXT_PUBLIC_SITE_URL or http://localhost:3002)\n  --job-id <id>           Existing jobId to poll (skip creation)\n  --campaign-id <id>      Campaign id (required if creating a job)\n  --keywords <json>       JSON array of keywords (required if creating a job)\n  --target-results <n>    Target results (default: 100)\n  --user-id <id>          Test user id (required)\n  --email <email>         Email for claims (optional)\n  --as <user|admin>       Mark header as admin (optional)\n  --interval <sec>        Poll interval seconds (default: 6)\n  --timeout <sec>         Max time in seconds (default: 1200)\n\nEnvironment:\n  ENABLE_TEST_AUTH=true   App must accept signed test headers\n  TEST_AUTH_SECRET=...    Used to sign headers (must match server)\n  NEXT_PUBLIC_SITE_URL    Defaults to http://localhost:3002 if not set\n`)
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function createJob(baseUrl, path, headers, body) {
  const url = new URL(path, baseUrl).toString()
  headers['content-type'] = 'application/json'
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`Non-JSON response (${res.status}): ${text}`) }
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${JSON.stringify(json)}`)
  if (!json.jobId) throw new Error(`Create response missing jobId: ${JSON.stringify(json)}`)
  return json
}

async function getStatus(baseUrl, path, headers, jobId) {
  const urlObj = new URL(path, baseUrl)
  urlObj.searchParams.set('jobId', jobId)
  const url = urlObj.toString()
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`Non-JSON response (${res.status}): ${text}`) }
  if (!res.ok) throw new Error(`Status failed: ${res.status} ${JSON.stringify(json)}`)
  return json
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) return printHelp()

  if (process.env.ENABLE_TEST_AUTH !== 'true') {
    console.error('ENABLE_TEST_AUTH must be true to use this poller')
    process.exit(1)
  }
  if (!process.env.TEST_AUTH_SECRET) {
    console.error('TEST_AUTH_SECRET must be set to sign headers')
    process.exit(1)
  }

  const base = args.site || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'
  const baseUrl = args.url || base
  const path = args.path || '/api/scraping/tiktok'
  const userId = args.userId || process.env.TEST_USER_ID
  const email = args.email
  const admin = args.as === 'admin'
  const intervalSec = Number.isFinite(args.interval) ? args.interval : 6
  const timeoutSec = Number.isFinite(args.timeout) ? args.timeout : 1200

  if (!userId) {
    console.error('--user-id is required (or set TEST_USER_ID)')
    process.exit(1)
  }

  const headers = buildTestAuthHeaders({ userId, email, admin })

  let jobId = args.jobId
  if (!jobId) {
    if (!args.campaignId) {
      console.error('--campaign-id is required when creating a job')
      process.exit(1)
    }
    if (!args.keywords) {
      console.error('--keywords JSON array is required when creating a job')
      process.exit(1)
    }
    let keywords
    try { keywords = JSON.parse(args.keywords) } catch { console.error('--keywords must be a valid JSON array'); process.exit(1) }
    if (!Array.isArray(keywords) || keywords.length === 0) {
      console.error('--keywords must be a non-empty JSON array')
      process.exit(1)
    }
    const targetResults = Number.isFinite(args.targetResults) ? args.targetResults : 100
    console.log(`Creating job at ${baseUrl}${path} for ${keywords.length} keyword(s)...`)
    const createRes = await createJob(baseUrl, path, headers, { keywords, targetResults, campaignId: args.campaignId })
    jobId = createRes.jobId
    console.log(`Created jobId: ${jobId}${createRes.qstashMessageId ? ` (qstash=${createRes.qstashMessageId})` : ''}`)
  } else {
    console.log(`Polling existing jobId: ${jobId}`)
  }

  const started = Date.now()
  let lastProgress = -1
  while (true) {
    if ((Date.now() - started) / 1000 > timeoutSec) {
      console.error(`Timeout after ${timeoutSec}s waiting for job ${jobId}`)
      process.exit(1)
    }
    let status
    try {
      status = await getStatus(baseUrl, path, headers, jobId)
    } catch (e) {
      console.error(`Status error: ${e.message}`)
      await sleep(intervalSec * 1000)
      continue
    }
    const prog = typeof status.progress === 'number' ? status.progress : undefined
    const state = status.status || (status.error ? 'failed' : undefined) || 'unknown'
    if (prog !== undefined && prog !== lastProgress) {
      console.log(`[${new Date().toISOString()}] status=${state} progress=${prog}% results=${Array.isArray(status.results) ? status.results.length : 'n/a'}`)
      lastProgress = prog
    } else {
      console.log(`[${new Date().toISOString()}] status=${state} (no change)`)
    }
    if (state === 'completed') {
      console.log('Job completed')
      console.log(JSON.stringify(status, null, 2))
      process.exit(0)
    }
    if (state === 'failed' || status.error) {
      console.error('Job failed')
      console.error(JSON.stringify(status, null, 2))
      process.exit(1)
    }
    await sleep(intervalSec * 1000)
  }
}

main().catch((err) => {
  console.error('Poller failed:', err)
  process.exit(1)
})

