#!/usr/bin/env tsx
import { createContext } from './shared-e2e'
import { runCampaignWorkflow } from './runners/campaigns'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Running campaign workflow against', ctx.baseUrl)

  const result = await runCampaignWorkflow(ctx)

  console.log('🎉 Campaign workflow completed')
  console.log('   Campaign ID:', result.campaignId)
  console.log('   Total campaigns returned:', result.listResponse?.pagination?.total ?? 'unknown')
  console.log('   Entitlement:', JSON.stringify(result.entitlement, null, 2))
}

main().catch((err) => {
  console.error('❌ campaigns-e2e failed:', err)
  process.exit(1)
})
