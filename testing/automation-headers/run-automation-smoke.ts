#!/usr/bin/env tsx
/**
 * Breadcrumb: testing → automation-headers → verifies the automation header flow against a protected endpoint.
 *
 * Usage:
 *   AUTOMATION_TESTING_SECRET=... AUTOMATION_USER_ID=... npx tsx testing/automation-headers/run-automation-smoke.ts
 */

export {}

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    console.error(`Missing ${key} in environment.`)
    process.exit(1)
  }
  return value
}

const baseUrl = process.env.AUTOMATION_BASE_URL || 'http://127.0.0.1:3002'
const automationSecret = requireEnv('AUTOMATION_TESTING_SECRET')
const automationUserId = requireEnv('AUTOMATION_USER_ID')

async function main() {
  console.log('→ Pinging /api/usage/summary with automation headers at', baseUrl)

  const res = await fetch(`${baseUrl}/api/usage/summary`, {
    headers: {
      'X-Testing-Token': automationSecret,
      'X-Automation-User-Id': automationUserId,
    },
  })

  console.log('Status:', res.status)
  const payload = await res.json().catch(() => ({}))
  console.dir(payload, { depth: 4 })

  if (!res.ok) {
    console.error('Automation header flow failed.')
    process.exit(1)
  }

  console.log('✅ Automation headers validated. Extend the script for additional endpoints as needed.')
}

main().catch((err) => {
  console.error('Unexpected failure:', err)
  process.exit(1)
})
