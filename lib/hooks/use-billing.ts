'use client'

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect } from 'react'

export interface BillingStatus {
  isLoaded: boolean
  currentPlan: 'free' | 'glow_up' | 'viral_surge' | 'fame_flex'
  hasFeature: (feature: string) => boolean
  hasPlan: (plan: string) => boolean
  canAccessFeature: (feature: string) => boolean
  isTrialing: boolean
  needsUpgrade: boolean
  trialStatus?: 'active' | 'expired' | 'converted' | 'cancelled'
  daysRemaining?: number
  hasActiveSubscription?: boolean
  isPaidUser?: boolean
  usageInfo?: {
    campaignsUsed: number
    campaignsLimit: number
    creatorsUsed: number
    creatorsLimit: number
    progressPercentage: number
  }
  planFeatures?: {
    campaigns: number
    creators: number
    features: string[]
    price: number
  }
}

/**
 * Custom hook for billing and plan verification
 */
export function useBilling(): BillingStatus {
  const { isLoaded, has } = useAuth()
  const [billingStatus, setBillingStatus] = useState<BillingStatus>({
    isLoaded: false,
    currentPlan: 'free',
    hasFeature: () => false,
    hasPlan: () => false,
    canAccessFeature: () => false,
    isTrialing: false,
    needsUpgrade: false
  })

  useEffect(() => {
    if (!isLoaded) return

    // Check if billing is enabled
    const billingEnabled = process.env.NEXT_PUBLIC_CLERK_BILLING_ENABLED === 'true'
    
    if (!billingEnabled) {
      // If billing is disabled, allow access to all features
      setBillingStatus({
        isLoaded: true,
        currentPlan: 'fame_flex', // Full access when billing disabled
        hasFeature: () => true,
        hasPlan: () => true,
        canAccessFeature: () => true,
        isTrialing: false,
        needsUpgrade: false
      })
      return
    }

    // Determine current plan using exact Clerk plan names from your dashboard
    let currentPlan: 'free' | 'glow_up' | 'viral_surge' | 'fame_flex' = 'free'
    let isTrialing = false
    let hasActiveSubscription = false
    let isPaidUser = false
    
    console.log('💳 [CLERK-BILLING] Getting billing status for user:', has ? 'authenticated' : 'not authenticated')
    
    // Check for your actual Clerk plans
    if (has && has({ plan: 'Fame Flex' })) {
      currentPlan = 'fame_flex'
      hasActiveSubscription = true
      isPaidUser = true
      console.log('💳 [CLERK-BILLING] User has Fame Flex plan ($499/month)')
    } else if (has && has({ plan: 'Viral Surge' })) {
      currentPlan = 'viral_surge'
      hasActiveSubscription = true
      isPaidUser = true
      console.log('💳 [CLERK-BILLING] User has Viral Surge plan ($249/month)')
    } else if (has && has({ plan: 'Glow Up' })) {
      currentPlan = 'glow_up'
      hasActiveSubscription = true
      isPaidUser = true
      console.log('💳 [CLERK-BILLING] User has Glow Up plan ($99/month)')
    } else if (has && has({ plan: 'Premium' })) {
      // Handle the unwanted Premium plan - treat as glow_up
      currentPlan = 'glow_up'
      hasActiveSubscription = true
      isPaidUser = true
      console.log('💳 [CLERK-BILLING] User has Premium plan ($10/month) - treating as Glow Up')
    } else if (has && has({ plan: 'Free' })) {
      currentPlan = 'free'
      isTrialing = true
      hasActiveSubscription = false
      isPaidUser = false
      console.log('💳 [CLERK-BILLING] User has Free plan (trial)')
    } else {
      // Default to free trial if no plan found
      currentPlan = 'free'
      isTrialing = true
      hasActiveSubscription = false
      isPaidUser = false
      console.log('💳 [CLERK-BILLING] No plan found, defaulting to free trial')
    }

    // Create feature checking functions that use Clerk's real data
    const hasFeature = (feature: string): boolean => {
      if (!has) return false
      const result = has({ feature })
      console.log(`💳 [CLERK-BILLING] Checking feature "${feature}":`, result)
      return result
    }

    const hasPlan = (plan: string): boolean => {
      if (!has) return false
      // Convert our internal plan names to Clerk plan names
      const clerkPlanNames = {
        'free': 'Free',
        'glow_up': 'Glow Up',
        'viral_surge': 'Viral Surge', 
        'fame_flex': 'Fame Flex'
      }
      const clerkPlanName = clerkPlanNames[plan as keyof typeof clerkPlanNames] || plan
      const result = has({ plan: clerkPlanName })
      console.log(`💳 [CLERK-BILLING] Checking plan "${plan}" (Clerk: "${clerkPlanName}"):`, result)
      return result
    }

    const canAccessFeature = (feature: string): boolean => {
      if (!has) return false
      
      // First try to check if Clerk has this feature directly
      const directFeatureAccess = has({ feature })
      if (directFeatureAccess) {
        console.log(`💳 [CLERK-BILLING] Direct feature access for "${feature}":`, true)
        return true
      }
      
      // Fallback: Plan hierarchy for your actual plans
      const planHierarchy = ['free', 'glow_up', 'viral_surge', 'fame_flex']
      const currentPlanIndex = planHierarchy.indexOf(currentPlan)
      
      // Define minimum plan requirements for key features based on your pricing
      const featureMinimumPlans = {
        'csv_export': 1, // Glow Up and above
        'bio_extraction': 1, // Glow Up and above
        'unlimited_search': 1, // Glow Up and above
        'advanced_analytics': 2, // Viral Surge and above
        'api_access': 3, // Fame Flex only
        'priority_support': 3 // Fame Flex only
      }
      
      const requiredPlanIndex = featureMinimumPlans[feature as keyof typeof featureMinimumPlans]
      if (requiredPlanIndex !== undefined) {
        const hasAccess = currentPlanIndex >= requiredPlanIndex
        console.log(`💳 [CLERK-BILLING] Feature "${feature}" requires plan index ${requiredPlanIndex}, user has ${currentPlanIndex}:`, hasAccess)
        return hasAccess
      }
      
      // Default: allow access for unknown features
      console.log(`💳 [CLERK-BILLING] Unknown feature "${feature}", allowing access`)
      return true
    }

    // Define plan features based on your actual pricing structure
    const planFeatures = {
      'free': {
        campaigns: 0,
        creators: 0,
        features: ['trial_access'],
        price: 0
      },
      'glow_up': {
        campaigns: 3,
        creators: 1000,
        features: ['unlimited_search', 'csv_export', 'bio_extraction'],
        price: 99
      },
      'viral_surge': {
        campaigns: 10,
        creators: 10000,
        features: ['unlimited_search', 'csv_export', 'bio_extraction', 'advanced_analytics'],
        price: 249
      },
      'fame_flex': {
        campaigns: -1, // unlimited
        creators: -1,  // unlimited
        features: ['unlimited_search', 'csv_export', 'bio_extraction', 'advanced_analytics', 'api_access', 'priority_support'],
        price: 499
      }
    }

    const currentPlanFeatures = planFeatures[currentPlan]

    setBillingStatus({
      isLoaded: true,
      currentPlan,
      hasFeature,
      hasPlan,
      canAccessFeature,
      isTrialing,
      hasActiveSubscription,
      isPaidUser,
      needsUpgrade: !isPaidUser, // Only need upgrade if not a paid user
      trialStatus: isPaidUser ? 'converted' : (isTrialing ? 'active' : undefined),
      daysRemaining: isPaidUser ? 0 : (isTrialing ? 7 : undefined), // No countdown for paid users
      planFeatures: currentPlanFeatures,
      usageInfo: {
        campaignsUsed: 0, // This should come from actual usage tracking
        campaignsLimit: currentPlanFeatures.campaigns,
        creatorsUsed: 0, // This should come from actual usage tracking
        creatorsLimit: currentPlanFeatures.creators,
        progressPercentage: 0
      }
    })

  }, [isLoaded, has])

  return billingStatus
}

/**
 * Hook for checking specific plan access
 */
export function usePlanAccess(requiredPlan: string) {
  const { hasPlan, isLoaded } = useBilling()
  
  return {
    hasAccess: hasPlan(requiredPlan),
    isLoaded,
    needsUpgrade: !hasPlan(requiredPlan)
  }
}

/**
 * Hook for checking specific feature access
 */
export function useFeatureAccess(requiredFeature: string) {
  const { canAccessFeature, isLoaded, currentPlan } = useBilling()
  
  return {
    hasAccess: canAccessFeature(requiredFeature),
    isLoaded,
    currentPlan,
    needsUpgrade: !canAccessFeature(requiredFeature)
  }
}