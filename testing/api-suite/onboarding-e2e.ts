#!/usr/bin/env tsx
import { createContext } from './shared-e2e'
import { runOnboardingFlow } from './runners/onboarding'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Running onboarding E2E against', ctx.baseUrl)

  const result = await runOnboardingFlow(ctx)

  console.log('🎉 Onboarding flow completed')
  console.log('   Current plan:', result.subscription?.planKey ?? result.plan.currentPlan)
  console.log('   Subscription status:', result.subscription?.status ?? result.plan.subscriptionStatus)
  console.log('   Trial status:', result.subscription?.trialStatus ?? result.plan.trialStatus)
}

main().catch((err) => {
  console.error('❌ onboarding-e2e failed:', err)
  process.exit(1)
})
