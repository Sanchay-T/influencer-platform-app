#!/usr/bin/env tsx
/**
 * Quick test for checkout API with test auth
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { buildTestAuthHeaders } from '../lib/auth/testable-auth'

const BASE_URL = 'http://localhost:3002'

async function main() {
  // First, we need to find an existing user ID from the database
  const { db } = await import('../lib/db')
  const { users } = await import('../lib/db/schema')
  
  const [existingUser] = await db.select().from(users).limit(1)
  
  if (!existingUser) {
    console.error('No users in database to test with')
    process.exit(1)
  }
  
  console.log(`Testing with user: ${existingUser.userId} (${existingUser.email})`)
  
  const authHeaders = buildTestAuthHeaders({
    userId: existingUser.userId,
    email: existingUser.email || undefined,
  })
  
  console.log('Auth headers:', authHeaders)
  
  // Test checkout API for each new plan
  const plans = ['growth', 'scale', 'pro']
  
  for (const plan of plans) {
    console.log(`\n--- Testing ${plan} plan checkout ---`)
    const response = await fetch(`${BASE_URL}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ planId: plan, billing: 'monthly' }),
    })
    
    const data = await response.json()
    
    if (response.ok && data.url) {
      console.log(`✅ ${plan}: Checkout URL generated`)
      console.log(`   URL prefix: ${data.url.substring(0, 60)}...`)
      console.log(`   Session ID: ${data.sessionId}`)
    } else {
      console.log(`❌ ${plan}: Failed - ${JSON.stringify(data)}`)
    }
  }
  
  process.exit(0)
}

main().catch(console.error)
