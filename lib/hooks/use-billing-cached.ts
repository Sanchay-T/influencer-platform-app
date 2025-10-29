'use client';

import { structuredConsole } from '@/lib/logging/console-proxy';

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { BillingStatus } from './use-billing'
import { perfMonitor } from '@/lib/utils/performance-monitor'

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

  // Load cached data immediately on mount with performance tracking
  useEffect(() => {
    if (!userId) return

    const cacheTimer = perfMonitor.startTimer('billing.cache.load', { userId })

    try {
      const cached = localStorage.getItem(BILLING_CACHE_KEY)
      if (cached) {
        const parsedCache: CachedBillingData = JSON.parse(cached)
        
        // Check if cache is valid and for same user
        const isValidCache = 
          parsedCache.userId === userId &&
          Date.now() - parsedCache.timestamp < CACHE_DURATION
        
        if (isValidCache) {
          const cacheAge = Date.now() - parsedCache.timestamp
          perfMonitor.endTimer(cacheTimer, { 
            cached: true, 
            cacheAge: `${(cacheAge / 1000).toFixed(1)}s`,
            dataSource: 'localStorage'
          })
          
          structuredConsole.log('✅ [BILLING-CACHE] Using cached billing data', {
            cacheAge: `${(cacheAge / 1000).toFixed(1)}s`,
            remainingTime: `${((CACHE_DURATION - cacheAge) / 1000).toFixed(1)}s`
          })
          
          setBillingStatus({
            ...parsedCache.data,
            isLoaded: true
          })
          setIsLoading(false)
        } else {
          perfMonitor.endTimer(cacheTimer, { 
            cached: false, 
            reason: 'cache_expired_or_different_user',
            dataSource: 'none'
          })
          structuredConsole.log('⚠️ [BILLING-CACHE] Cache invalid or expired')
        }
      } else {
        perfMonitor.endTimer(cacheTimer, { 
          cached: false, 
          reason: 'no_cache_found',
          dataSource: 'none'
        })
        structuredConsole.log('ℹ️ [BILLING-CACHE] No cache found')
      }
    } catch (error) {
      perfMonitor.endTimer(cacheTimer, { 
        cached: false, 
        error: error.message,
        dataSource: 'error'
      })
      structuredConsole.error('❌ [BILLING-CACHE] Error loading cache:', error)
    }
  }, [userId])

  useEffect(() => {
    if (!isLoaded || !userId) return

    // Fetch fresh data (in background if we have cache) with performance tracking
    const fetchBillingStatus = async () => {
      const apiTimer = perfMonitor.startTimer('billing.api.fetch', { 
        userId,
        hasExistingData: billingStatus.isLoaded
      })
      
      try {
        structuredConsole.log('🔄 [BILLING-CACHE] Fetching fresh billing data')
        
        const fetchStartTime = performance.now()
        const response = await fetch('/api/billing/status')
        const fetchEndTime = performance.now()
        
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`)
        }
        
        const parseStartTime = performance.now()
        const data = await response.json()
        const parseEndTime = performance.now()
        
        perfMonitor.endTimer(apiTimer, {
          networkTime: `${(fetchEndTime - fetchStartTime).toFixed(2)}ms`,
          parseTime: `${(parseEndTime - parseStartTime).toFixed(2)}ms`,
          dataSource: 'api',
          cached: false,
          backgroundUpdate: billingStatus.isLoaded
        })
        
        structuredConsole.log('✅ [BILLING-CACHE] Fresh billing data received', {
          networkTime: `${(fetchEndTime - fetchStartTime).toFixed(2)}ms`,
          parseTime: `${(parseEndTime - parseStartTime).toFixed(2)}ms`,
          backgroundUpdate: billingStatus.isLoaded
        })
        
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

        // Cache the fresh data with performance tracking
        const cacheData: CachedBillingData = {
          data: newBillingStatus,
          timestamp: Date.now(),
          userId
        }
        
        const cacheWriteTimer = perfMonitor.startTimer('billing.cache.write', { 
          dataSize: JSON.stringify(cacheData).length 
        })
        
        try {
          localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify(cacheData))
          perfMonitor.endTimer(cacheWriteTimer, { 
            success: true,
            operation: 'localStorage.setItem'
          })
          structuredConsole.log('💾 [BILLING-CACHE] Data cached successfully')
        } catch (error) {
          perfMonitor.endTimer(cacheWriteTimer, { 
            success: false,
            error: error.message,
            operation: 'localStorage.setItem'
          })
          structuredConsole.error('❌ [BILLING-CACHE] Error saving cache:', error)
        }

      } catch (error) {
        perfMonitor.endTimer(apiTimer, {
          error: error.message,
          dataSource: 'api',
          cached: false
        })
        structuredConsole.error('❌ [BILLING-CACHE] Error fetching billing status:', error)
        setIsLoading(false)
      }
    }

    fetchBillingStatus()
  }, [isLoaded, userId, billingStatus.isLoaded])

  return {
    ...billingStatus,
    isLoading
  }
}

// Clear cache on logout or user change
export function clearBillingCache() {
  try {
    localStorage.removeItem(BILLING_CACHE_KEY)
    structuredConsole.log('🗑️ [BILLING-CACHE] Cache cleared')
  } catch (error) {
    structuredConsole.error('❌ [BILLING-CACHE] Error clearing cache:', error)
  }
}
