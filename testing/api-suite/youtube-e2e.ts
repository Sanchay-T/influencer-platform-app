#!/usr/bin/env tsx
/**
 * Full end-to-end YouTube keyword scrape validation.
 * 1. Creates a campaign.
 * 2. Starts the YouTube keyword job.
 * 3. Polls status until the job completes (requires QStash callbacks to hit this environment).
 */

import { createContext } from './shared-e2e'
import { runYoutubeKeywordE2E } from './runners/youtube'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Using base URL:', ctx.baseUrl)
  await runYoutubeKeywordE2E(ctx)
  console.log('🎉 YouTube keyword scrape end-to-end validation finished')
}

main().catch((err) => {
  console.error('❌ youtube-e2e failed:', err)
  process.exit(1)
})
