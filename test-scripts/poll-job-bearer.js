#!/usr/bin/env node
// Create a scraping job (optional) and poll until it completes using a real Clerk session token.
// Adds auto-refresh via --token-cmd to mint a fresh token during polling.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const dotenv = require('dotenv')

try { dotenv.config({ path: path.resolve(process.cwd(), '.env.worktree') }) } catch {}
try { dotenv.config({ path: path.resolve(process.cwd(), '.env.development') }) } catch {}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--path': args.path = next; i++; break
      case '--url': args.url = next; i++; break
      case '--site': args.site = next; i++; break
      case '--job-id': args.jobId = next; i++; break
      case '--campaign-id': args.campaignId = next; i++; break
      case '--keywords': args.keywords = next; i++; break
      case '--target-results': args.targetResults = parseInt(next, 10); i++; break
      case '--token': args.token = next; i++; break
      case '--token-cmd': args.tokenCmd = next; i++; break
      case '--interval': args.interval = parseInt(next, 10); i++; break
      case '--timeout': args.timeout = parseInt(next, 10); i++; break
      case '--help': args.help = true; break
      default: break
    }
  }
  return args
}

function printHelp() {
  console.log(`\nScrape Job Poller (Bearer)\n\nUsage:\n  node test-scripts/poll-job-bearer.js --path /api/scraping/tiktok --token <token>|--token-cmd "<cmd>" --campaign-id <id> --keywords '["iphone 17 pro"]' --target-results 100\n`)
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function createJob(baseUrl, path, token, body) {
  const url = new URL(path, baseUrl).toString()
  const headers = { 'Authorization': `Bearer ${token}`, 'Clerk-Authorization': `Bearer ${token}`, 'content-type': 'application/json' }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`Non-JSON response (${res.status}): ${text}`) }
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${JSON.stringify(json)}`)
  if (!json.jobId) throw new Error(`Create response missing jobId: ${JSON.stringify(json)}`)
  return json
}

async function getStatus(baseUrl, path, token, jobId) {
  const urlObj = new URL(path, baseUrl)
  urlObj.searchParams.set('jobId', jobId)
  const url = urlObj.toString()
  const headers = { 'Authorization': `Bearer ${token}`, 'Clerk-Authorization': `Bearer ${token}` }
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
  if (!args.token && !args.tokenCmd) { console.error('--token or --token-cmd is required'); process.exit(1) }

  const base = args.site || process.env.NEXT_PUBLIC_SITE_URL
  const baseUrl = args.url || base
  const path = args.path || '/api/scraping/tiktok'
  const intervalSec = Number.isFinite(args.interval) ? args.interval : 6
  const timeoutSec = Number.isFinite(args.timeout) ? args.timeout : 1200

  if (!baseUrl) { console.error('Provide --url or set NEXT_PUBLIC_SITE_URL'); process.exit(1) }

  const mintToken = () => {
    if (args.tokenCmd) {
      try { return execSync(args.tokenCmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch (e) {
        console.error('Failed to execute --token-cmd:', e.message); process.exit(1)
      }
    }
    return args.token
  }

  let token = mintToken()
  let jobId = args.jobId
  if (!jobId) {
    if (!args.campaignId) { console.error('--campaign-id is required when creating a job'); process.exit(1) }
    if (!args.keywords) { console.error('--keywords JSON array is required when creating a job'); process.exit(1) }
    let keywords
    try { keywords = JSON.parse(args.keywords) } catch { console.error('--keywords must be a valid JSON array'); process.exit(1) }
    if (!Array.isArray(keywords) || keywords.length === 0) { console.error('--keywords must be a non-empty JSON array'); process.exit(1) }
    const targetResults = Number.isFinite(args.targetResults) ? args.targetResults : 100
    console.log(`Creating job at ${baseUrl}${path} for ${keywords.length} keyword(s)...`)
    const createRes = await createJob(baseUrl, path, token, { keywords, targetResults, campaignId: args.campaignId })
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
      status = await getStatus(baseUrl, path, token, jobId)
    } catch (e) {
      const msg = String(e.message || '')
      if (msg.includes('Status failed: 401')) {
        token = mintToken()
        try { status = await getStatus(baseUrl, path, token, jobId) } catch (e2) {
          console.error(`Status error after refresh: ${e2.message}`)
          await sleep(intervalSec * 1000)
          continue
        }
      } else {
        console.error(`Status error: ${e.message}`)
        await sleep(intervalSec * 1000)
        continue
      }
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

main().catch((err) => { console.error('poll-job-bearer failed:', err); process.exit(1) })
