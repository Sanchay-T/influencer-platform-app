#!/usr/bin/env tsx
import { createContext } from './shared-e2e'
import { runOnboardingFlow } from './runners/onboarding'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Running onboarding E2E against', ctx.baseUrl)

  const result = await runOnboardingFlow(ctx)

  console.log('🎉 Onboarding flow completed')
  console.log('   Onboarding step:', result.subscription.onboardingStep)
  console.log('   Intended plan:', result.subscription.intendedPlan)
  console.log('   Subscription status:', result.subscription.subscriptionStatus ?? 'N/A')
  console.log('   Full name:', result.subscription.fullName)
  console.log('   Business name:', result.subscription.businessName)
}

main().catch((err) => {
  console.error('❌ onboarding-e2e failed:', err)
  process.exit(1)
})
