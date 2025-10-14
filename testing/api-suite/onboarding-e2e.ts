#!/usr/bin/env tsx
import { createContext } from './shared-e2e'
import { runOnboardingFlow } from './runners/onboarding'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Running onboarding E2E against', ctx.baseUrl)

  const result = await runOnboardingFlow(ctx)

  console.log('🎉 Onboarding flow completed')
  console.log('   Current plan:', result.plan.currentPlan)
  console.log('   Subscription status:', result.plan.subscriptionStatus)
  console.log('   Trial status:', result.plan.trialStatus)
}

main().catch((err) => {
  console.error('❌ onboarding-e2e failed:', err)
  process.exit(1)
})
