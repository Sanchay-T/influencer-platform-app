#!/usr/bin/env node
// Call any API route using a real Clerk session token (Authorization: Bearer).
// Reads base URL from NEXT_PUBLIC_SITE_URL by default.
//
// Usage:
//   node test-scripts/run-api-bearer.js --path /api/campaigns --method POST --token <session_token> --body '{"name":"Agent","searchType":"tiktok"}'
//   node test-scripts/run-api-bearer.js --url https://.../api/billing/status --token <session_token>

const fs = require('fs')
const path = require('path')
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
      case '--method': args.method = next; i++; break
      case '--body': args.body = next; i++; break
      case '--body-file': args.bodyFile = next; i++; break
      case '--token': args.token = next; i++; break
      case '--cookie': args.cookie = next; i++; break
      case '--help': args.help = true; break
      default: break
    }
  }
  return args
}

function printHelp() {
  console.log(`\nAPI Runner (Authorization: Bearer)\n\nUsage:\n  node test-scripts/run-api-bearer.js --path /api/campaigns --method POST --token <session_token> --body '{"name":"Agent","searchType":"tiktok"}'\n\nOptions:\n  --path <path>     API path (e.g. /api/profile)\n  --url <url>       Full URL (overrides --site + --path)\n  --site <base>     Base URL (default: NEXT_PUBLIC_SITE_URL)\n  --method <verb>   HTTP method (default: GET)\n  --body <json>     JSON string body\n  --body-file <f>   Read body from JSON file\n  --token <token>   Clerk session token (required)\n\nEnvironment:\n  NEXT_PUBLIC_SITE_URL  Set to your ngrok URL (preferred)\n`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) return printHelp()
  if (!args.token && !args.cookie) { console.error('--token or --cookie is required'); process.exit(1) }

  const site = args.site || process.env.NEXT_PUBLIC_SITE_URL
  if (!site && !args.url) { console.error('Provide --url or set NEXT_PUBLIC_SITE_URL'); process.exit(1) }
  const url = args.url || new URL(args.path || '/', site).toString()
  const method = (args.method || 'GET').toUpperCase()

  let body
  if (args.bodyFile) {
    const filePath = path.resolve(process.cwd(), args.bodyFile)
    body = fs.readFileSync(filePath, 'utf8')
  } else if (args.body) {
    body = args.body
  }

  const headers = {}
  if (args.cookie) {
    headers['Cookie'] = args.cookie
  } else if (args.token) {
    headers['Authorization'] = `Bearer ${args.token}`
  }
  if (body) headers['content-type'] = 'application/json'

  const res = await fetch(url, { method, headers, body })
  const text = await res.text()
  console.log(`${method} ${url}`)
  console.log(`Status: ${res.status}`)
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)) } catch { console.log(text) }
}

main().catch((err) => { console.error('run-api-bearer failed:', err); process.exit(1) })
