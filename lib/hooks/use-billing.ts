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
 * Custom hook for Stripe-only billing and plan verification
 */
export function useBilling(): BillingStatus {
  const { isLoaded, userId } = useAuth()
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
    if (!isLoaded || !userId) return

    // Fetch billing status from our API
    const fetchBillingStatus = async () => {
      try {
        console.log('💳 [STRIPE-BILLING] Fetching billing status for user:', userId)
        
        const response = await fetch('/api/billing/status')
        if (!response.ok) {
          throw new Error('Failed to fetch billing status')
        }
        
        const data = await response.json()
        console.log('💳 [STRIPE-BILLING] Received billing data:', data)
        
        const currentPlan = data.currentPlan || 'free'
        const isTrialing = data.isTrialing || false
        const hasActiveSubscription = data.hasActiveSubscription || false
        const isPaidUser = hasActiveSubscription && currentPlan !== 'free'
        
        // Create feature checking functions based on plan hierarchy
        const hasFeature = (feature: string): boolean => {
          return canAccessFeature(feature)
        }

        const hasPlan = (plan: string): boolean => {
          const planHierarchy = ['free', 'glow_up', 'viral_surge', 'fame_flex']
          const currentPlanIndex = planHierarchy.indexOf(currentPlan)
          const requiredPlanIndex = planHierarchy.indexOf(plan)
          
          if (currentPlanIndex === -1 || requiredPlanIndex === -1) {
            return plan === 'free' // Default to free access only
          }
          
          const hasAccess = currentPlanIndex >= requiredPlanIndex
          console.log(`💳 [STRIPE-BILLING] Plan check "${plan}": ${hasAccess}`)
          return hasAccess
        }

        const canAccessFeature = (feature: string): boolean => {
          const planHierarchy = ['free', 'glow_up', 'viral_surge', 'fame_flex']
          const currentPlanIndex = planHierarchy.indexOf(currentPlan)
          
          // Define minimum plan requirements for key features
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
            console.log(`💳 [STRIPE-BILLING] Feature "${feature}" requires plan index ${requiredPlanIndex}, user has ${currentPlanIndex}:`, hasAccess)
            return hasAccess
          }
          
          // Default: allow access for unknown features
          console.log(`💳 [STRIPE-BILLING] Unknown feature "${feature}", allowing access`)
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

        const currentPlanFeatures = planFeatures[currentPlan as keyof typeof planFeatures]

        setBillingStatus({
          isLoaded: true,
          currentPlan,
          hasFeature,
          hasPlan,
          canAccessFeature,
          isTrialing,
          hasActiveSubscription,
          isPaidUser,
          needsUpgrade: !isPaidUser,
          trialStatus: data.trialStatus,
          daysRemaining: data.daysRemaining,
          planFeatures: currentPlanFeatures,
          usageInfo: {
            campaignsUsed: data.usageInfo?.campaignsUsed || 0,
            campaignsLimit: currentPlanFeatures.campaigns,
            creatorsUsed: data.usageInfo?.creatorsUsed || 0,
            creatorsLimit: currentPlanFeatures.creators,
            progressPercentage: data.usageInfo?.progressPercentage || 0
          }
        })

      } catch (error) {
        console.error('❌ [STRIPE-BILLING] Error fetching billing status:', error)
        
        // Default to free plan on error
        setBillingStatus({
          isLoaded: true,
          currentPlan: 'free',
          hasFeature: () => false,
          hasPlan: (plan) => plan === 'free',
          canAccessFeature: () => false,
          isTrialing: false,
          needsUpgrade: true,
          hasActiveSubscription: false,
          isPaidUser: false,
          planFeatures: {
            campaigns: 0,
            creators: 0,
            features: ['trial_access'],
            price: 0
          },
          usageInfo: {
            campaignsUsed: 0,
            campaignsLimit: 0,
            creatorsUsed: 0,
            creatorsLimit: 0,
            progressPercentage: 0
          }
        })
      }
    }

    fetchBillingStatus()
  }, [isLoaded, userId])

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