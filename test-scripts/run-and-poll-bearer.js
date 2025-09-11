#!/usr/bin/env node
// Start a scraping job and poll until completion using a Bearer token minted via a command.
// Usage:
//   node test-scripts/run-and-poll-bearer.js \
//     --start /api/scraping/tiktok \
//     --site http://localhost:3002 \
//     --start-body '{"keywords":["iphone 17 pro"],"targetResults":100,"campaignId":"<id>"}' \
//     --out logs/tiktok_keyword_iphone17pro.json \
//     --token-cmd "node test-scripts/mint-dev-token.js"

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--start': args.startPath = next; i++; break
      case '--status': args.statusPath = next; i++; break
      case '--site': args.site = next; i++; break
      case '--start-body': args.startBody = next; i++; break
      case '--out': args.out = next; i++; break
      case '--token-cmd': args.tokenCmd = next; i++; break
      case '--interval': args.interval = parseInt(next, 10); i++; break
      case '--timeout': args.timeout = parseInt(next, 10); i++; break
      default: break
    }
  }
  return args
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function mintToken(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch (e) {
    throw new Error('Failed to execute token-cmd: ' + e.message)
  }
}

async function postJSON(url, token, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Clerk-Authorization': `Bearer ${token}` }, body: JSON.stringify(body) })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch { throw new Error(`POST non-JSON (${res.status}): ${text}`) }
  if (!res.ok) throw new Error(`POST failed ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function getJSON(url, token) {
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Clerk-Authorization': `Bearer ${token}` } })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch { throw new Error(`GET non-JSON (${res.status}): ${text}`) }
  if (!res.ok) throw new Error(`GET failed ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function main() {
  const args = parseArgs(process.argv)
  const site = args.site || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'
  const startUrl = new URL(args.startPath, site).toString()
  const statusPath = args.statusPath || args.startPath
  const interval = Number.isFinite(args.interval) ? args.interval : 6
  const timeout = Number.isFinite(args.timeout) ? args.timeout : 1800
  if (!args.startBody) throw new Error('--start-body is required')
  if (!args.out) throw new Error('--out is required')
  if (!args.tokenCmd) throw new Error('--token-cmd is required')

  const startBody = JSON.parse(args.startBody)
  let token = mintToken(args.tokenCmd)

  // Start job
  const startRes = await postJSON(startUrl, token, startBody)
  const jobId = startRes.jobId
  if (!jobId) throw new Error('Start response missing jobId')
  console.log('Started jobId:', jobId)

  // Poll
  const started = Date.now()
  let lastProgress
  while (true) {
    if ((Date.now() - started) / 1000 > timeout) throw new Error('Timeout waiting for completion')
    const statusUrlObj = new URL(statusPath, site)
    statusUrlObj.searchParams.set('jobId', jobId)
    try {
      const status = await getJSON(statusUrlObj.toString(), token)
      const prog = status.progress
      if (prog !== lastProgress) {
        console.log(`[${new Date().toISOString()}] status=${status.status} progress=${prog}% results=${Array.isArray(status.results) ? status.results.length : 'n/a'}`)
        lastProgress = prog
      }
      if (status.status === 'completed') {
        const outPath = path.resolve(process.cwd(), args.out)
        fs.mkdirSync(path.dirname(outPath), { recursive: true })
        fs.writeFileSync(outPath, JSON.stringify(status, null, 2))
        console.log('Saved:', outPath)
        break
      }
      if (status.status === 'failed' || status.error) {
        throw new Error('Job failed: ' + JSON.stringify(status))
      }
    } catch (e) {
      if (String(e.message).includes('GET failed 401')) {
        token = mintToken(args.tokenCmd)
        continue
      }
      console.error('Poll error:', e.message)
    }
    await sleep(interval * 1000)
  }
}

main().catch((e) => { console.error('run-and-poll-bearer failed:', e); process.exit(1) })

