import { getStringProperty, toRecord } from '@/lib/utils/type-guards'
import { createContext, E2EContext, requestJson } from '../shared-e2e'

type OnboardingStatus = {
  onboardingStep: string | number | null
  intendedPlan: string | null
  subscriptionStatus: string | null
  fullName: string | null
  businessName: string | null
}

export type OnboardingFlowResult = {
  subscription: OnboardingStatus
}

function parseOnboardingStatus(value: unknown): OnboardingStatus {
  const record = toRecord(value)
  if (!record) {
    throw new Error('Onboarding status: Expected object response')
  }

  const onboardingStepRaw = record.onboardingStep
  const onboardingStep =
    typeof onboardingStepRaw === 'number' || typeof onboardingStepRaw === 'string'
      ? onboardingStepRaw
      : null

  return {
    onboardingStep,
    intendedPlan: getStringProperty(record, 'intendedPlan') ?? null,
    subscriptionStatus: getStringProperty(record, 'subscriptionStatus') ?? null,
    fullName: getStringProperty(record, 'fullName') ?? null,
    businessName: getStringProperty(record, 'businessName') ?? null,
  }
}

export async function runOnboardingFlow(
  context?: E2EContext
): Promise<OnboardingFlowResult> {
  const ctx = context || createContext()
  const subscription = await requestJson(
    ctx,
    '/api/onboarding/status',
    { label: 'Onboarding status' },
    parseOnboardingStatus
  )

  return { subscription }
}
