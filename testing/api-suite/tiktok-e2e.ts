#!/usr/bin/env tsx
import { createContext } from './shared-e2e'
import { runTiktokKeywordE2E } from './runners/tiktok'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Using base URL:', ctx.baseUrl)
  await runTiktokKeywordE2E(ctx)
  console.log('🎉 TikTok keyword scrape end-to-end validation finished')
}

main().catch((err) => {
  console.error('❌ tiktok-e2e failed:', err)
  process.exit(1)
})
