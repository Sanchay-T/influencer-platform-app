#!/usr/bin/env tsx
/**
 * Breadcrumb: testing → session-exchange → mints Clerk cookies and validates a protected endpoint.
 *
 * Usage (requires dev server running):
 *   SESSION_EXCHANGE_KEY=... CLERK_SECRET_KEY=... npx tsx testing/session-exchange/run-session-exchange.ts
 */

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const REQUIRED_VARS: ReadonlyArray<'SESSION_EXCHANGE_KEY' | 'CLERK_SECRET_KEY'> = [
  'SESSION_EXCHANGE_KEY',
  'CLERK_SECRET_KEY',
]

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in environment.`)
    process.exit(1)
  }
}

const baseUrl = process.env.SESSION_EXCHANGE_BASE_URL || 'http://127.0.0.1:3002'
const email = process.env.SESSION_EXCHANGE_EMAIL || 'agent+dev@example.com'
const outputFile = resolve(__dirname, '.session-cookie')

async function main() {
  console.log('→ Requesting session exchange from', baseUrl)

  const exchangeRes = await fetch(`${baseUrl}/api/internal/session-exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-exchange-key': process.env.SESSION_EXCHANGE_KEY!,
    },
    body: JSON.stringify({ email }),
  })

  const exchangeBody = await exchangeRes.json().catch(() => ({}))
  const safeExchange = {
    ...exchangeBody,
    cookies: exchangeBody?.cookies ? '[redacted]' : exchangeBody?.cookies,
  }
  console.log('Exchange status:', exchangeRes.status)
  console.dir(safeExchange, { depth: 4 })

  if (!exchangeRes.ok) {
    console.error('Session exchange failed. See output above.')
    process.exit(1)
  }

  type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] }
  const headerObj: HeadersWithSetCookie = exchangeRes.headers
  const setCookie = headerObj.getSetCookie ? headerObj.getSetCookie() : []

  if (!setCookie.length) {
    console.error('Exchange succeeded but no Set-Cookie headers were returned.')
    process.exit(1)
  }

  await writeFile(outputFile, setCookie.join('\n'))
  console.log(`Cookies written to ${outputFile}`)

  // Compose cookie header for validation request.
  const cookieHeader = setCookie.map((cookie) => cookie.split(';')[0]).join('; ')

  console.log('→ Verifying /api/usage/summary with exchanged cookies')
  const checkRes = await fetch(`${baseUrl}/api/usage/summary`, {
    headers: {
      Cookie: cookieHeader,
    },
  })

  console.log('Usage summary status:', checkRes.status)
  const checkBody = await checkRes.json().catch(() => ({}))
  console.dir(checkBody, { depth: 4 })

  if (checkRes.status === 401) {
    console.error('Usage summary returned 401. Double-check dev server port and middleware config.')
    process.exit(1)
  }

  console.log('✅ Session exchange verified. Reuse the cookie file for other API calls.')
}

main().catch((err) => {
  console.error('Unexpected failure:', err)
  process.exit(1)
})
