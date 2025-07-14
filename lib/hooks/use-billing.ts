'use client'

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect } from 'react'

export interface BillingStatus {
  isLoaded: boolean
  currentPlan: 'free_trial' | 'basic' | 'premium' | 'enterprise'
  hasFeature: (feature: string) => boolean
  hasPlan: (plan: string) => boolean
  canAccessFeature: (feature: string) => boolean
  isTrialing: boolean
  needsUpgrade: boolean
  trialStatus?: 'active' | 'expired' | 'converted' | 'cancelled'
  daysRemaining?: number
  usageInfo?: {
    searchesUsed: number
    searchesLimit: number
    progressPercentage: number
  }
}

/**
 * Custom hook for billing and plan verification
 */
export function useBilling(): BillingStatus {
  const { isLoaded, has } = useAuth()
  const [billingStatus, setBillingStatus] = useState<BillingStatus>({
    isLoaded: false,
    currentPlan: 'free_trial',
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
        currentPlan: 'enterprise', // Full access when billing disabled
        hasFeature: () => true,
        hasPlan: () => true,
        canAccessFeature: () => true,
        isTrialing: false,
        needsUpgrade: false
      })
      return
    }

    // Determine current plan using exact Clerk plan names from your dashboard
    let currentPlan: 'free_trial' | 'basic' | 'premium' | 'enterprise' = 'free_trial'
    let isTrialing = false
    
    console.log('💳 [CLERK-BILLING] Getting billing status for user:', has ? 'authenticated' : 'not authenticated')
    
    if (has && has({ plan: 'Enterprise' })) {
      currentPlan = 'enterprise'
      console.log('💳 [CLERK-BILLING] User has Enterprise plan')
    } else if (has && has({ plan: 'Premium' })) {
      currentPlan = 'premium'
      console.log('💳 [CLERK-BILLING] User has Premium plan')
    } else if (has && has({ plan: 'Basic' })) {
      currentPlan = 'basic'
      console.log('💳 [CLERK-BILLING] User has Basic plan')
    } else if (has && has({ plan: 'Free' })) {
      currentPlan = 'free_trial'
      isTrialing = true
      console.log('💳 [CLERK-BILLING] User has Free plan (trial)')
    } else {
      // Default to free trial if no plan found
      currentPlan = 'free_trial'
      isTrialing = true
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
        'free_trial': 'Free',
        'basic': 'Basic', 
        'premium': 'Premium',
        'enterprise': 'Enterprise'
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
      
      // Fallback: Basic plan hierarchy for common features
      const planHierarchy = ['free_trial', 'basic', 'premium', 'enterprise']
      const currentPlanIndex = planHierarchy.indexOf(currentPlan)
      
      // Define minimum plan requirements for key features
      const featureMinimumPlans = {
        'csv_export': 1, // Basic and above
        'unlimited_search': 2, // Premium and above
        'api_access': 3, // Enterprise only
        'priority_support': 3 // Enterprise only
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

    setBillingStatus({
      isLoaded: true,
      currentPlan,
      hasFeature,
      hasPlan,
      canAccessFeature,
      isTrialing,
      needsUpgrade: currentPlan === 'free_trial',
      trialStatus: isTrialing ? 'active' : undefined,
      daysRemaining: isTrialing ? 7 : undefined, // This should come from actual trial data
      usageInfo: currentPlan === 'free_trial' ? {
        searchesUsed: 0, // This should come from actual usage tracking
        searchesLimit: 3,
        progressPercentage: 0
      } : undefined
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