#!/usr/bin/env tsx
/**
 * Full-stack validation for the major scrape workflows.
 * Requires a publicly reachable NEXT_PUBLIC_SITE_URL so QStash callbacks can complete.
 */

import { createContext } from './shared-e2e'
import { runYoutubeKeywordE2E } from './runners/youtube'
import { runTiktokKeywordE2E } from './runners/tiktok'
import { runInstagramSimilarE2E } from './runners/instagram-similar'

async function run() {
  const ctx = createContext()
  console.log('ℹ️  Full E2E scrape validation')
  console.log('ℹ️  Base URL:', ctx.baseUrl)

  const youtube = await runYoutubeKeywordE2E(ctx)
  await runTiktokKeywordE2E(ctx, { campaignId: youtube.campaignId })
  await runInstagramSimilarE2E(ctx)

  console.log('🎉 Full E2E scrape validation finished successfully')
}

run().catch((err) => {
  console.error('❌ Full E2E validation failed:', err)
  process.exit(1)
})
