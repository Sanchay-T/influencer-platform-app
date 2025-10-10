#!/usr/bin/env node
// Calls the dev-only session exchange endpoint to set a real Clerk __session cookie for the agent user.
// Prints the Cookie header value to use for subsequent API calls.

const dotenv = require('dotenv')
const path = require('path')

try { dotenv.config({ path: path.resolve(process.cwd(), '.env.worktree') }) } catch {}
try { dotenv.config({ path: path.resolve(process.cwd(), '.env.development') }) } catch {}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--user-id': args.userId = next; i++; break
      case '--user-email': args.email = next; i++; break
      case '--site': args.site = next; i++; break
      case '--help': args.help = true; break
      default: break
    }
  }
  return args
}

function printHelp() {
  console.log(`\nSession Exchange (dev-only)\n\nUsage:\n  node test-scripts/session-exchange.js --user-email agent+dev@example.com\n\nEnv required:\n  SESSION_EXCHANGE_KEY=<random>\n  CLERK_SECRET_KEY=...\n  NEXT_PUBLIC_SITE_URL=https://<ngrok>.ngrok-free.app\n`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) return printHelp()
  const site = args.site || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'
  const key = process.env.SESSION_EXCHANGE_KEY
  if (!key) { console.error('SESSION_EXCHANGE_KEY is required'); process.exit(1) }
  const url = new URL('/api/internal/session-exchange', site).toString()

  const body = {}
  if (args.userId) body.userId = args.userId
  if (args.email) body.email = args.email

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-exchange-key': key,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  console.log(`Status: ${res.status}`)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) console.log(`Set-Cookie: ${setCookie}`)
  if (json?.cookie) console.log(`\nUse this Cookie header:\nCookie: ${json.cookie}\n`)
  console.log(JSON.stringify(json, null, 2))
}

main().catch((err) => { console.error('session-exchange failed:', err); process.exit(1) })

