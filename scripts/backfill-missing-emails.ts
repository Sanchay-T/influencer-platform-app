#!/usr/bin/env npx tsx
/**
 * Backfill missing user emails from Clerk and enforce the onboarding invariant.
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-emails.ts
 */

import 'dotenv/config'
import { clerkBackendClient } from '@/lib/auth/backend-auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, isNull } from 'drizzle-orm'

async function main() {
  console.log('🔍 [BACKFILL-EMAILS] Searching for users without stored email addresses')
  const missing = await db
    .select({ id: users.id, userId: users.userId })
    .from(users)
    .where(isNull(users.email))

  if (missing.length === 0) {
    console.log('✅ [BACKFILL-EMAILS] No missing emails found. Nothing to do.')
    return
  }

  console.log(`📋 [BACKFILL-EMAILS] Found ${missing.length} user(s) missing emails. Fetching from Clerk...`)

  const unresolved: string[] = []
  for (const row of missing) {
    try {
      const clerkUser = await clerkBackendClient.users.getUser(row.userId)
      const primary = clerkUser?.emailAddresses?.find((email) => email.id === clerkUser.primaryEmailAddressId)
      const email = primary?.emailAddress?.trim().toLowerCase()

      if (!email) {
        console.warn(`⚠️  [BACKFILL-EMAILS] Clerk returned no primary email for ${row.userId}. Skipping.`)
        unresolved.push(row.userId)
        continue
      }

      await db.update(users).set({ email }).where(eq(users.id, row.id))
      console.log(`✅ [BACKFILL-EMAILS] Updated ${row.userId} → ${email}`)
    } catch (err) {
      console.error(`❌ [BACKFILL-EMAILS] Failed to update ${row.userId}:`, err)
      unresolved.push(row.userId)
    }
  }

  if (unresolved.length) {
    console.log('\n⚠️  [BACKFILL-EMAILS] The following user IDs still lack email addresses:')
    unresolved.forEach((id) => console.log(`   - ${id}`))
    console.log('   Add an email to these Clerk accounts and rerun if needed.')
  } else {
    console.log('\n🎉 [BACKFILL-EMAILS] All users now have stored email addresses.')
  }
}

main().catch((err) => {
  console.error('backfill-missing-emails failed:', err)
  process.exit(1)
})
