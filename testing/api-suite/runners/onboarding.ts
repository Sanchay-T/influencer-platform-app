import { createContext, E2EContext, requestJson } from '../shared-e2e'
import type { PlanKey } from '@/lib/services/billing-service'

export interface OnboardingOptions {
  fullName?: string
  businessName?: string
  brandDescription?: string
  planId?: Exclude<PlanKey, 'free'>
  billingCycle?: 'monthly' | 'yearly'
  skipPlanUpgrade?: boolean
  email?: string
}

export interface OnboardingResult {
  profile: any
  subscription: any
  plan: {
    currentPlan: string
    subscriptionStatus: string
    trialStatus: string
  }
}

export async function runOnboardingFlow(
  context?: E2EContext,
  options: OnboardingOptions = {}
): Promise<OnboardingResult> {
  const ctx = context || createContext()
  const {
    fullName = 'Automation Tester',
    businessName = 'Automation QA Labs',
    brandDescription = 'We test every surface of the product to ensure delight.',
    planId = 'fame_flex',
    billingCycle = 'monthly',
    skipPlanUpgrade = false,
    email = process.env.AUTOMATION_USER_EMAIL || 'automation+onboarding@example.com',
  } = options

  console.log('→ Resetting user state for onboarding flow')
  await requestJson(ctx, '/api/debug/complete-reset', { method: 'POST', label: 'Reset user' })

  console.log('→ Ensuring profile email exists')
  let emailForSetup = email
  try {
    emailForSetup = extractEmailFromToken(ctx.sessionToken)
  } catch {
    console.warn('⚠️  Unable to extract email from session token, falling back to provided email.')
  }

  await requestJson(ctx, '/api/debug/automation/ensure-email', {
    method: 'POST',
    body: { email: emailForSetup },
    label: 'Ensure email',
  })

  console.log('→ Onboarding step 1 (basic info)')
  await requestJson(ctx, '/api/onboarding/step-1', {
    method: 'PATCH',
    body: { fullName, businessName },
    label: 'Onboarding step 1',
  })

  console.log('→ Onboarding step 2 (brand description)')
  await requestJson(ctx, '/api/onboarding/step-2', {
    method: 'PATCH',
    body: { brandDescription },
    label: 'Onboarding step 2',
  })

  console.log('→ Saving intended plan selection')
  await requestJson(ctx, '/api/onboarding/save-plan', {
    method: 'POST',
    body: { selectedPlan: planId },
    label: 'Save plan selection',
  })

  console.log('→ Completing onboarding flow')
  await requestJson(ctx, '/api/onboarding/complete', {
    method: 'PATCH',
    body: { completed: true },
    label: 'Onboarding complete',
  })

  if (!skipPlanUpgrade) {
    console.log('→ Activating plan via automation upgrade endpoint')
    await requestJson(ctx, '/api/debug/automation/upgrade-plan', {
      method: 'POST',
      body: { plan: planId },
      label: 'Automation plan upgrade',
    })
  } else {
    console.log('→ Skipping plan activation step')
  }

  console.log('→ Fetching profile snapshot')
  const profile = await requestJson(ctx, '/api/profile', { label: 'Fetch profile' })

  console.log('→ Fetching subscription status')
  const subscription = await requestJson(ctx, '/api/subscription/status', {
    label: 'Fetch subscription status',
  })

  return {
    profile,
    subscription,
    plan: {
      currentPlan: profile?.plan?.currentPlan ?? profile?.currentPlan,
      subscriptionStatus: profile?.plan?.subscriptionStatus ?? profile?.subscriptionStatus,
      trialStatus: profile?.plan?.trialStatus ?? profile?.trialStatus,
    },
  }
}

function extractEmailFromToken(token: string): string {
  const parts = token.split('.')
  if (parts.length < 2) {
    throw new Error('Invalid session token format')
  }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  const email =
    payload?.email ||
    payload?.email_address ||
    payload?.primary_email_address ||
    payload?.primary_email ||
    payload?.user?.email ||
    null

  if (!email || typeof email !== 'string') {
    throw new Error('Email claim not found in session token payload')
  }
  return email.toLowerCase()
}
