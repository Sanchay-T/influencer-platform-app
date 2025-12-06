#!/usr/bin/env tsx
import { createContext } from './shared-e2e'
import { runInstagramSimilarE2E } from './runners/instagram-similar'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Using base URL:', ctx.baseUrl)
  await runInstagramSimilarE2E(ctx)
  console.log('🎉 Instagram similar scrape end-to-end validation finished')
}

main().catch((err) => {
  console.error('❌ instagram-similar-e2e failed:', err)
  process.exit(1)
})
