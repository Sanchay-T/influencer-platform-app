#!/usr/bin/env node
// Mint a real Clerk session token for a user (no route changes required).
// - Can create the user first with --create
// - Outputs JSON: { email, userId, sessionId, token }
//
// Usage examples:
//   node test-scripts/mint-clerk-session.js --email agent+dev@example.com --password 'StrongPass_1234' --create
//   node test-scripts/mint-clerk-session.js --email agent+dev@example.com --password 'StrongPass_1234'

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

// Load env from .env.worktree first, then .env.development
try { dotenv.config({ path: path.resolve(process.cwd(), '.env.worktree') }) } catch {}
try { dotenv.config({ path: path.resolve(process.cwd(), '.env.development') }) } catch {}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--email': args.email = next; i++; break
      case '--password': args.password = next; i++; break
      case '--create': args.create = true; break
      case '--help': args.help = true; break
      default: break
    }
  }
  return args
}

function printHelp() {
  console.log(`\nMint a real Clerk session token (no mocks)\n\nUsage:\n  node test-scripts/mint-clerk-session.js --email you@example.com --password 'StrongPass_1234' [--create]\n\nEnv required:\n  CLERK_SECRET_KEY=...\n`)
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`Non-JSON response (${res.status}): ${text}`) }
  if (!res.ok) {
    const detail = json?.errors || json?.error || json
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${JSON.stringify(detail)}`)
  }
  return json
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) return printHelp()

  const apiKey = process.env.CLERK_SECRET_KEY
  if (!apiKey) {
    console.error('CLERK_SECRET_KEY must be set in env')
    process.exit(1)
  }
  const email = args.email
  const password = args.password
  if (!email || !password) {
    console.error('--email and --password are required')
    process.exit(1)
  }

  const base = 'https://api.clerk.com/v1'
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }

  // 1) Create user if requested and not found
  if (args.create) {
    // Find existing user by email
    const listUrl = `${base}/users?email_address=${encodeURIComponent(email)}`
    const list = await fetchJSON(listUrl, { headers })
    const found = Array.isArray(list) && list.find(u => (u.email_addresses||[]).some(e => e.email_address === email))
    if (!found) {
      await fetchJSON(`${base}/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email_address: [email], password })
      })
    }
  }

  // 2) Begin password sign-in
  const signInInit = await fetchJSON(`${base}/sign_ins`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ identifier: email })
  })
  const signInId = signInInit?.id
  if (!signInId) throw new Error('No sign_in id from Clerk')

  // 3) Attempt first factor (password)
  const attempt = await fetchJSON(`${base}/sign_ins/${signInId}/attempt_first_factor`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ strategy: 'password', password })
  })
  const status = attempt?.status
  if (status !== 'complete') throw new Error(`Sign-in not complete. Status: ${status}`)
  const sessionId = attempt?.created_session_id
  const userId = attempt?.user_id || attempt?.user?.id
  if (!sessionId) throw new Error('No sessionId returned from Clerk')

  // 4) Issue a session token
  const tokenRes = await fetchJSON(`${base}/sessions/${sessionId}/tokens`, {
    method: 'POST',
    headers
  })
  // Handle possible shapes: {jwt}, {token}, {session_token}
  const token = tokenRes?.jwt || tokenRes?.token || tokenRes?.session_token
  if (!token) throw new Error('No token returned from Clerk')

  const out = { email, userId, sessionId, token }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error('mint-clerk-session failed:', err)
  process.exit(1)
})

