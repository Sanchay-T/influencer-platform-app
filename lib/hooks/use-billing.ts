'use client'

import { useAuth } from '@clerk/nextjs'
import { loggedApiCall, logTiming } from '@/lib/utils/frontend-logger'
import { useState, useEffect } from 'react'

const BILLING_DEBUG = false
const debugLog = (...args: unknown[]) => {
  if (BILLING_DEBUG) debugLog(...args)
}
const debugWarn = (...args: unknown[]) => {
  if (BILLING_DEBUG) debugWarn(...args)
}

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
  hoursRemaining?: number
  minutesRemaining?: number
  trialProgressPercentage?: number
  trialStartDate?: string
  trialEndDate?: string
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
  // Simple in-memory cache to avoid duplicate fetches and speed up gating
  // Shared across all hook instances in the same tab
  // 5s TTL keeps UI fresh but prevents bursty refetches
  const CACHE_TTL_MS = 5000
  // @ts-ignore module-level singleton
  if (!(globalThis as any).__BILLING_CACHE__) {
    ;(globalThis as any).__BILLING_CACHE__ = { data: null as any, ts: 0, inflight: null as Promise<any> | null }
  }
  const cacheRef = (globalThis as any).__BILLING_CACHE__
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

    // Fetch billing status from our API (with simple cache + inflight guard)
    const fetchBillingStatus = async (skipCache = false) => {
      try {
        // 1) Try persisted snapshot first for instant UX (no spinner on refresh)
        try {
          const persisted = localStorage.getItem('gemz_entitlements_v1')
          if (persisted) {
            const parsed = JSON.parse(persisted)
            // TTL 60s to keep UI snappy during navigation/refreshes
            if (parsed && parsed.ts && Date.now() - parsed.ts < 60_000) {
              setFromData(parsed.data)
            }
          }
        } catch {}

        const now = Date.now()
        if (!skipCache && cacheRef.data && now - cacheRef.ts < CACHE_TTL_MS) {
          setFromData(cacheRef.data)
          return
        }
        if (cacheRef.inflight) {
          const data = await cacheRef.inflight
          setFromData(data)
          return
        }
        const opStart = Date.now()
        debugLog('💳 [STRIPE-BILLING] Fetching billing status for user:', userId)

        cacheRef.inflight = loggedApiCall('/api/billing/status', {}, { action: 'fetch_billing_status', userId: userId || 'unknown' }).then(async (res: any) => {
          if (!res.ok) throw new Error(`Failed to fetch billing status (status ${res.status})`)
          const reqId = (res.headers && res.headers.get && res.headers.get('x-request-id')) || 'none'
          const serverDuration = (res.headers && res.headers.get && res.headers.get('x-duration-ms')) || 'n/a'
          const data = res.data ?? (await res.json())
          debugLog('💳 [STRIPE-BILLING] Correlation IDs:', { requestId: reqId, serverDurationMs: serverDuration })
          logTiming('fetch_billing_status_total', opStart, { userId: userId || 'unknown', requestId: reqId || undefined })
          cacheRef.data = data
          cacheRef.ts = Date.now()
          cacheRef.inflight = null
          // persist snapshot for fast subsequent loads
          try {
            localStorage.setItem('gemz_entitlements_v1', JSON.stringify({ ts: Date.now(), data }))
          } catch {}
          return data
        }).catch((e: any) => {
          cacheRef.inflight = null
          throw e
        })

        const data = await cacheRef.inflight
        debugLog('💳 [STRIPE-BILLING] Received billing data:', data)
        
        setFromData(data)

      } catch (error) {
        console.error('❌ [STRIPE-BILLING] Error fetching billing status:', error)
        setOnError()
      }
    }

    const setFromData = (data: any) => {
        
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
          debugLog(`💳 [STRIPE-BILLING] Plan check "${plan}": ${hasAccess}`)
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
            debugLog(`💳 [STRIPE-BILLING] Feature "${feature}" requires plan index ${requiredPlanIndex}, user has ${currentPlanIndex}:`, hasAccess)
            return hasAccess
          }
          
          // Default: allow access for unknown features
          debugLog(`💳 [STRIPE-BILLING] Unknown feature "${feature}", allowing access`)
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

        // Use database limits if available, otherwise fall back to static plan features
        const currentPlanFeatures = planFeatures[currentPlan as keyof typeof planFeatures]
        const actualCampaignsLimit = data.usageInfo?.campaignsLimit || currentPlanFeatures.campaigns
        const actualCreatorsLimit = data.usageInfo?.creatorsLimit || currentPlanFeatures.creators

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
          hoursRemaining: data.hoursRemaining,
          minutesRemaining: data.minutesRemaining,
          trialProgressPercentage: data.trialProgressPercentage,
          trialStartDate: data.trialStartDate,
          trialEndDate: data.trialEndDate,
          planFeatures: currentPlanFeatures,
          usageInfo: {
            campaignsUsed: data.usageInfo?.campaignsUsed || 0,
            campaignsLimit: actualCampaignsLimit,
            creatorsUsed: data.usageInfo?.creatorsUsed || 0,
            creatorsLimit: actualCreatorsLimit,
            progressPercentage: data.usageInfo?.progressPercentage || 0
          }
        })
    }

    const setOnError = () => {
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
          trialProgressPercentage: 0,
          hoursRemaining: 0,
          minutesRemaining: 0,
          trialStartDate: undefined,
          trialEndDate: undefined,
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

    fetchBillingStatus()
    
    // Listen for focus events to refresh billing status
    const handleFocus = () => {
      debugLog('💳 [BILLING-REFRESH] Window focused, refreshing billing status');
      fetchBillingStatus(true); // Skip cache on focus
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoaded, userId, cacheRef])

  // Add function to force refresh billing data (useful after upgrades)
  const refreshBillingData = () => {
    debugLog('🔄 [BILLING-REFRESH] Force refreshing billing data');
    
    // Clear caches
    try {
      localStorage.removeItem('gemz_entitlements_v1');
      if ((globalThis as any).__BILLING_CACHE__) {
        (globalThis as any).__BILLING_CACHE__.data = null;
        (globalThis as any).__BILLING_CACHE__.ts = 0;
        (globalThis as any).__BILLING_CACHE__.inflight = null;
      }
    } catch (e) {}
    
    // Trigger a fresh fetch
    fetchBillingStatus(true);
  };

  return {
    ...billingStatus,
    refreshBillingData
  };
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
