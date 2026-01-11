#!/usr/bin/env tsx
/**
 * Breadcrumb: testing → clerk-session-token → mints a Clerk session token and validates an API call.
 *
 * Usage:
 *   CLERK_AUTOMATION_SERVICE_TOKEN=sk_test_... npx tsx testing/clerk-session-token/mint-session-token.ts
 */

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const REQUIRED_VARS = ['CLERK_AUTOMATION_SERVICE_TOKEN']

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in environment.`)
    process.exit(1)
  }
}

const serviceToken = process.env.CLERK_AUTOMATION_SERVICE_TOKEN!
const userId = process.env.CLERK_SESSION_USER_ID || 'user_33neqrnH0OrnbvECgCZF9YT4E7F'
const baseUrl = process.env.CLERK_SESSION_BASE_URL || 'http://127.0.0.1:3002'
const apiBase = serviceToken.startsWith('sk_live') ? 'https://api.clerk.com' : 'https://api.clerk.dev'
const outputFile = resolve(__dirname, '.session-token')

async function main() {
  console.log(`→ Creating session for ${userId} via ${apiBase}`)

  const sessionRes = await fetch(`${apiBase}/v1/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  })

  const sessionPayload = await sessionRes.json().catch(() => ({}))
  if (!sessionRes.ok) {
    console.error('Failed to create session:', sessionPayload)
    process.exit(1)
  }

  const sessionId = sessionPayload.id
  console.log('Session ID:', sessionId)

  const tokenRes = await fetch(`${apiBase}/v1/sessions/${sessionId}/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      'Content-Type': 'application/json',
    },
  })

  const tokenPayload = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok) {
    console.error('Failed to mint session token:', tokenPayload)
    process.exit(1)
  }

  const token = tokenPayload.token || tokenPayload.jwt
  if (!token) {
    console.error('Token response did not include a token field:', tokenPayload)
    process.exit(1)
  }

  await writeFile(outputFile, token)
  console.log(`Session token written to ${outputFile}`)
  console.log(`Token preview: ${token.slice(0, 6)}…${token.slice(-6)} (length ${token.length})`)

  console.log('→ Verifying /api/usage/summary with Authorization header at', baseUrl)
  const res = await fetch(`${baseUrl}/api/usage/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  console.log('Status:', res.status)
  const payload = await res.json().catch(() => ({}))
  console.dir(payload, { depth: 4 })

  if (!res.ok) {
    console.error('Verification failed. Ensure middleware accepts bearer tokens and dev server is running.')
    process.exit(1)
  }

  console.log('✅ Session token validated. Reuse the token file while it remains valid.')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
