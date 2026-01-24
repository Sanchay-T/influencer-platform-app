#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { buildTestAuthHeaders } from '../lib/auth/testable-auth'

async function main() {
  const { db } = await import('../lib/db')
  const { users } = await import('../lib/db/schema')
  
  const [existingUser] = await db.select().from(users).limit(1)
  if (!existingUser) process.exit(1)
  
  const authHeaders = buildTestAuthHeaders({ userId: existingUser.userId })
  
  console.log('Testing invalid plan handling...')
  const response = await fetch('http://localhost:3002/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ planId: 'invalid_plan', billing: 'monthly' }),
  })
  
  const data = await response.json()
  console.log(`Status: ${response.status}`)
  console.log(`Response:`, data)
  
  if (response.status === 400 && data.error) {
    console.log('✅ Invalid plan correctly rejected')
  } else {
    console.log('❌ Invalid plan should return 400 error')
  }
  
  process.exit(0)
}

main().catch(console.error)
