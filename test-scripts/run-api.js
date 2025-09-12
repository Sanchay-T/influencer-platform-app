#!/usr/bin/env node
// Simple CLI to call API routes with a signed test auth header
// Usage examples:
//   node test-scripts/run-api.js --path /api/profile --method GET --user-id test_user_123 --email dev@example.com
//   node test-scripts/run-api.js --path /api/campaigns --method POST --body '{"name":"My Campaign"}' --user-id test_user_123
//   node test-scripts/run-api.js --seed-user dev+seed@example.com --as admin

const { buildTestAuthHeaders } = require('../lib/tests/agent-auth')
const fs = require('fs')
const path = require('path')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--path': args.path = next; i++; break
      case '--url': args.url = next; i++; break
      case '--method': args.method = next; i++; break
      case '--body': args.body = next; i++; break
      case '--body-file': args.bodyFile = next; i++; break
      case '--user-id': args.userId = next; i++; break
      case '--email': args.email = next; i++; break
      case '--as': args.as = next; i++; break // 'user' | 'admin'
      case '--site': args.site = next; i++; break
      case '--seed-user': args.seedEmail = next; i++; break
      case '--qstash-job': args.qstashJobId = next; i++; break
      case '--help': args.help = true; break
      default: break
    }
  }
  return args
}

function printHelp() {
  console.log(`\nAPI Runner (with Test Auth)\n\nUsage:\n  node test-scripts/run-api.js --path /api/profile --method GET --user-id test_user_123 --email you@example.com\n\nOptions:\n  --path <path>           API path (e.g. /api/profile)\n  --url <url>             Full URL (overrides --site + --path)\n  --site <base>           Base URL (default: NEXT_PUBLIC_SITE_URL or http://localhost:3002)\n  --method <verb>         HTTP method (default: GET)\n  --body <json>           JSON string body\n  --body-file <file>      Read body from JSON file\n  --user-id <id>          Test user ID (required for most calls)\n  --email <email>         Email for claims (optional, recommended)\n  --as <user|admin>       Mark header as admin (optional)\n  --seed-user <email>     Seed a test DB user via admin endpoint (requires --as admin)\n  --qstash-job <id>       Simulate calling QStash processor with the given job id\n\nEnvironment:\n  ENABLE_TEST_AUTH=true   Required for the app to accept test headers\n  TEST_AUTH_SECRET=...    Required to sign headers\n  NEXT_PUBLIC_SITE_URL    Defaults to http://localhost:3002 if not set\n`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) return printHelp()

  const enable = process.env.ENABLE_TEST_AUTH === 'true'
  if (!enable) {
    console.error('ENABLE_TEST_AUTH must be true to use this runner')
    process.exit(1)
  }
  if (!process.env.TEST_AUTH_SECRET) {
    console.error('TEST_AUTH_SECRET must be set to sign headers')
    process.exit(1)
  }

  const site = args.site || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'

  // Seed user if requested
  if (args.seedEmail) {
    if (args.as !== 'admin') {
      console.error('--seed-user requires --as admin (admin header)')
      process.exit(1)
    }
    const seedUrl = new URL('/api/admin/create-test-user', site).toString()
    const seedHeaders = buildTestAuthHeaders({
      userId: args.userId || `test_admin_${Date.now()}`,
      email: args.email || 'admin@test.local',
      admin: true,
    })
    seedHeaders['content-type'] = 'application/json'
    const res = await fetch(seedUrl, { method: 'POST', headers: seedHeaders, body: JSON.stringify({ email: args.seedEmail }) })
    const txt = await res.text()
    console.log(`Seed status: ${res.status}`)
    try { console.log(JSON.stringify(JSON.parse(txt), null, 2)) } catch { console.log(txt) }
  }

  // QStash simulation if requested
  if (args.qstashJobId) {
    const qUrl = new URL('/api/qstash/process-scraping', site).toString()
    const headers = { 'content-type': 'application/json' }
    // QStash handler skips signature in dev/localhost
    const res = await fetch(qUrl, { method: 'POST', headers, body: JSON.stringify({ jobId: args.qstashJobId }) })
    const txt = await res.text()
    console.log(`QStash call status: ${res.status}`)
    try { console.log(JSON.stringify(JSON.parse(txt), null, 2)) } catch { console.log(txt) }
  }

  if (!args.path && !args.url) {
    console.error('Provide --path or --url')
    return printHelp()
  }

  const url = args.url || new URL(args.path, site).toString()
  const method = (args.method || 'GET').toUpperCase()

  const userId = args.userId || process.env.TEST_USER_ID || `test_user_${Date.now()}`
  const email = args.email || 'user@test.local'
  const admin = args.as === 'admin'

  const headers = buildTestAuthHeaders({ userId, email, admin })
  let body
  if (args.bodyFile) {
    const filePath = path.resolve(process.cwd(), args.bodyFile)
    body = fs.readFileSync(filePath, 'utf8')
  } else if (args.body) {
    body = args.body
  }
  if (body) headers['content-type'] = 'application/json'

  const res = await fetch(url, { method, headers, body })
  const text = await res.text()
  console.log(`\n${method} ${url}`)
  console.log(`Status: ${res.status}`)
  const reqId = res.headers.get('x-request-id')
  if (reqId) console.log(`x-request-id: ${reqId}`)
  try {
    const json = JSON.parse(text)
    console.log(JSON.stringify(json, null, 2))
  } catch {
    console.log(text)
  }
}

main().catch((err) => {
  console.error('Runner failed:', err)
  process.exit(1)
})

