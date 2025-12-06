import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries'
import { startTrial } from '@/lib/trial/trial-service'
import { scheduleTrialEmails } from '@/lib/email/trial-email-triggers'
import { getUserEmailFromClerk } from '@/lib/email/email-service'
import { createCategoryLogger, LogCategory } from '@/lib/logging'

const onboardingLogger = createCategoryLogger(LogCategory.ONBOARDING)

export interface FinalizeOnboardingOptions {
  requestId?: string
  clerkEmailHint?: string | null
  triggerEmails?: boolean
  skipIfCompleted?: boolean
}

export interface FinalizeOnboardingResult {
  userId: string
  requestId: string
  alreadyCompleted: boolean
  userEmail: string | null
  trial?: Awaited<ReturnType<typeof startTrial>>
  emails?: Awaited<ReturnType<typeof scheduleTrialEmails>> | null
  profileStep?: string
}

export async function finalizeOnboarding(
  userId: string,
  options: FinalizeOnboardingOptions = {}
): Promise<FinalizeOnboardingResult> {
  const requestId = options.requestId || `finalize_onboarding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const skipIfCompleted = options.skipIfCompleted ?? true

  onboardingLogger.info('Finalize onboarding invoked', {
    requestId,
    metadata: {
      userId,
      skipIfCompleted,
      hasEmailHint: typeof options.clerkEmailHint === 'string'
    }
  })

  const userProfile = await getUserProfile(userId)

  if (!userProfile) {
    const error = new Error(`User profile not found for ${userId}`)
    onboardingLogger.error('Finalize onboarding failed - profile missing', error, {
      requestId,
      metadata: { userId }
    })
    throw error
  }

  if (skipIfCompleted && userProfile.onboardingStep === 'completed') {
    onboardingLogger.info('Finalize onboarding skipped - already completed', {
      requestId,
      metadata: { userId }
    })
    return {
      userId,
      requestId,
      alreadyCompleted: true,
      userEmail: userProfile.email || null,
      trial: undefined,
      emails: null
    }
  }

  let userEmail = options.clerkEmailHint || userProfile.email || null

  if (!userEmail) {
    onboardingLogger.info('Resolving user email via Clerk', {
      requestId,
      metadata: { userId }
    })
    userEmail = await getUserEmailFromClerk(userId)
  }

  onboardingLogger.info('Starting trial for onboarding completion', {
    requestId,
    metadata: {
      userId,
      hasStripeCustomer: !!userProfile.stripeCustomerId,
      hasStripeSubscription: !!userProfile.stripeSubscriptionId
    }
  })

  const trialData = await startTrial(userId, {
    customerId: userProfile.stripeCustomerId || undefined,
    subscriptionId: userProfile.stripeSubscriptionId || undefined
  })

  const profileAfterTrial = await getUserProfile(userId)
  const intendedPlan = (profileAfterTrial as any)?.intendedPlan as string | null | undefined
  const selectedPlan = typeof intendedPlan === 'string' && intendedPlan.trim().length > 0
    ? intendedPlan.trim()
    : (typeof profileAfterTrial?.currentPlan === 'string' && profileAfterTrial?.currentPlan.trim().length > 0
        ? profileAfterTrial.currentPlan.trim()
        : null)

  if (!selectedPlan) {
    onboardingLogger.warn('No plan selection detected while finalizing onboarding', {
      requestId,
      metadata: {
        userId,
        currentPlan: profileAfterTrial?.currentPlan,
        intendedPlan,
      }
    })
  } else {
    onboardingLogger.info('Applying selected plan during onboarding finalization', {
      requestId,
      metadata: {
        userId,
        selectedPlan,
        previousPlan: profileAfterTrial?.currentPlan
      }
    })
  }

  const planUpdates: Record<string, unknown> = {
    onboardingStep: 'completed'
  }

  if (selectedPlan) {
    planUpdates.currentPlan = selectedPlan
    planUpdates.intendedPlan = selectedPlan
  }

  await updateUserProfile(userId, planUpdates)

  const updatedProfile = await getUserProfile(userId)

  onboardingLogger.info('Onboarding step updated to completed', {
    requestId,
    metadata: { userId, step: updatedProfile?.onboardingStep }
  })

  let emailResult: Awaited<ReturnType<typeof scheduleTrialEmails>> | null = null
  if (options.triggerEmails !== false) {
    if (userEmail) {
      emailResult = await scheduleTrialEmails(userId, {
        fullName: userProfile.fullName || 'User',
        businessName: userProfile.businessName || 'Your Business'
      })
    } else {
      onboardingLogger.warn('Skipping trial email scheduling - no email available', {
        requestId,
        metadata: { userId }
      })
    }
  }

  onboardingLogger.info('Finalize onboarding completed', {
    requestId,
    metadata: {
      userId,
      trialStatus: trialData.trialStatus,
      emailScheduled: !!emailResult?.success
    }
  })

  return {
    userId,
    requestId,
    alreadyCompleted: false,
    userEmail,
    trial: trialData,
    emails: emailResult,
    profileStep: updatedProfile?.onboardingStep
  }
}
