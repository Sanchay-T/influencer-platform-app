'use client'

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { BillingStatus } from './use-billing'

// Cache key for localStorage
const BILLING_CACHE_KEY = 'gemz_billing_cache'
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

interface CachedBillingData {
  data: BillingStatus
  timestamp: number
  userId: string
}

/**
 * Enhanced billing hook with localStorage caching
 * Shows cached data immediately, updates in background
 */
export function useBillingCached(): BillingStatus & { isLoading: boolean } {
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
  const [isLoading, setIsLoading] = useState(true)

  // Load cached data immediately on mount
  useEffect(() => {
    if (!userId) return

    try {
      const cached = localStorage.getItem(BILLING_CACHE_KEY)
      if (cached) {
        const parsedCache: CachedBillingData = JSON.parse(cached)
        
        // Check if cache is valid and for same user
        const isValidCache = 
          parsedCache.userId === userId &&
          Date.now() - parsedCache.timestamp < CACHE_DURATION
        
        if (isValidCache) {
          console.log('✅ [BILLING-CACHE] Using cached billing data')
          setBillingStatus({
            ...parsedCache.data,
            isLoaded: true
          })
          setIsLoading(false)
        }
      }
    } catch (error) {
      console.error('❌ [BILLING-CACHE] Error loading cache:', error)
    }
  }, [userId])

  useEffect(() => {
    if (!isLoaded || !userId) return

    // Fetch fresh data (in background if we have cache)
    const fetchBillingStatus = async () => {
      try {
        console.log('🔄 [BILLING-CACHE] Fetching fresh billing data')
        
        const response = await fetch('/api/billing/status')
        if (!response.ok) {
          throw new Error('Failed to fetch billing status')
        }
        
        const data = await response.json()
        console.log('✅ [BILLING-CACHE] Fresh billing data received')
        
        // Create feature checking functions
        const hasFeature = (feature: string): boolean => {
          const planHierarchy = ['free', 'glow_up', 'viral_surge', 'fame_flex']
          const currentPlanIndex = planHierarchy.indexOf(data.currentPlan)
          
          const featureMinimumPlans = {
            'csv_export': 1,
            'bio_extraction': 1, 
            'unlimited_search': 1,
            'advanced_analytics': 2,
            'api_access': 3,
            'priority_support': 3
          }
          
          const requiredPlanIndex = featureMinimumPlans[feature as keyof typeof featureMinimumPlans]
          return requiredPlanIndex !== undefined ? currentPlanIndex >= requiredPlanIndex : true
        }

        const hasPlan = (plan: string): boolean => {
          const planHierarchy = ['free', 'glow_up', 'viral_surge', 'fame_flex']
          const currentPlanIndex = planHierarchy.indexOf(data.currentPlan)
          const requiredPlanIndex = planHierarchy.indexOf(plan)
          return currentPlanIndex >= requiredPlanIndex
        }

        const newBillingStatus = {
          isLoaded: true,
          currentPlan: data.currentPlan,
          hasFeature,
          hasPlan,
          canAccessFeature: hasFeature,
          isTrialing: data.isTrialing,
          hasActiveSubscription: data.hasActiveSubscription,
          isPaidUser: data.hasActiveSubscription && data.currentPlan !== 'free',
          needsUpgrade: !data.hasActiveSubscription,
          trialStatus: data.trialStatus,
          daysRemaining: data.daysRemaining,
          hoursRemaining: data.hoursRemaining,
          minutesRemaining: data.minutesRemaining,
          trialProgressPercentage: data.trialProgressPercentage,
          trialStartDate: data.trialStartDate,
          trialEndDate: data.trialEndDate,
          planFeatures: {
            campaigns: data.usageInfo?.campaignsLimit || 0,
            creators: data.usageInfo?.creatorsLimit || 0,
            features: [],
            price: 0
          },
          usageInfo: data.usageInfo
        }

        setBillingStatus(newBillingStatus)
        setIsLoading(false)

        // Cache the fresh data
        const cacheData: CachedBillingData = {
          data: newBillingStatus,
          timestamp: Date.now(),
          userId
        }
        
        try {
          localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify(cacheData))
          console.log('💾 [BILLING-CACHE] Data cached successfully')
        } catch (error) {
          console.error('❌ [BILLING-CACHE] Error saving cache:', error)
        }

      } catch (error) {
        console.error('❌ [BILLING-CACHE] Error fetching billing status:', error)
        setIsLoading(false)
      }
    }

    fetchBillingStatus()
  }, [isLoaded, userId])

  return {
    ...billingStatus,
    isLoading
  }
}

// Clear cache on logout or user change
export function clearBillingCache() {
  try {
    localStorage.removeItem(BILLING_CACHE_KEY)
    console.log('🗑️ [BILLING-CACHE] Cache cleared')
  } catch (error) {
    console.error('❌ [BILLING-CACHE] Error clearing cache:', error)
  }
}