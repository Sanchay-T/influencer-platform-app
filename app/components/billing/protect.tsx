'use client'

import { Protect as ClerkProtect } from '@clerk/nextjs'
import { useFeatureAccess, usePlanAccess, useBilling } from '@/lib/hooks/use-billing'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Zap, Crown } from 'lucide-react'
import Link from 'next/link'

interface ProtectProps {
  children: React.ReactNode
  feature?: string
  plan?: string
  fallback?: React.ReactNode
  showUpgradePrompt?: boolean
}

/**
 * Enhanced Protect component that works with Clerk billing
 */
export function Protect({ 
  children, 
  feature, 
  plan, 
  fallback, 
  showUpgradePrompt = true 
}: ProtectProps) {
  // Use feature access if feature is specified
  if (feature) {
    const { hasAccess, isLoaded, currentPlan } = useFeatureAccess(feature)
    
    if (!isLoaded) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )
    }

    if (!hasAccess) {
      if (fallback) {
        return <>{fallback}</>
      }
      
      if (showUpgradePrompt) {
        return <UpgradePrompt feature={feature} currentPlan={currentPlan} />
      }
      
      return null
    }

    return <>{children}</>
  }

  // Use plan access if plan is specified
  if (plan) {
    const { hasAccess, isLoaded } = usePlanAccess(plan)
    
    if (!isLoaded) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )
    }

    if (!hasAccess) {
      if (fallback) {
        return <>{fallback}</>
      }
      
      if (showUpgradePrompt) {
        return <UpgradePrompt plan={plan} />
      }
      
      return null
    }

    return <>{children}</>
  }

  // Fall back to Clerk's built-in Protect component for other use cases
  return (
    <ClerkProtect fallback={fallback}>
      {children}
    </ClerkProtect>
  )
}

/**
 * Upgrade prompt component
 */
function UpgradePrompt({ 
  feature, 
  plan, 
  currentPlan 
}: { 
  feature?: string
  plan?: string 
  currentPlan?: string
}) {
  const getPromptContent = () => {
    if (feature) {
      const featureDetails = {
        'instagram_search': {
          title: 'Instagram Search',
          description: 'Search Instagram creators and influencers',
          icon: <Zap className="h-5 w-5" />,
          requiredPlan: 'Premium'
        },
        'youtube_search': {
          title: 'YouTube Search', 
          description: 'Search YouTube creators and channels',
          icon: <Zap className="h-5 w-5" />,
          requiredPlan: 'Premium'
        },
        'csv_export': {
          title: 'CSV Export',
          description: 'Export search results to CSV files',
          icon: <Zap className="h-5 w-5" />,
          requiredPlan: 'Premium'
        },
        'api_access': {
          title: 'API Access',
          description: 'Programmatic access to our platform',
          icon: <Crown className="h-5 w-5" />,
          requiredPlan: 'Enterprise'
        }
      }
      
      const details = featureDetails[feature as keyof typeof featureDetails]
      if (details) {
        return {
          title: `${details.title} - ${details.requiredPlan} Feature`,
          description: details.description,
          icon: details.icon,
          requiredPlan: details.requiredPlan
        }
      }
    }

    if (plan) {
      return {
        title: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Required`,
        description: `This feature requires a ${plan} subscription`,
        icon: plan === 'enterprise' ? <Crown className="h-5 w-5" /> : <Zap className="h-5 w-5" />,
        requiredPlan: plan.charAt(0).toUpperCase() + plan.slice(1)
      }
    }

    return {
      title: 'Premium Feature',
      description: 'This feature requires a paid subscription',
      icon: <Lock className="h-5 w-5" />,
      requiredPlan: 'Premium'
    }
  }

  const content = getPromptContent()

  return (
    <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          {content.icon}
        </div>
        <CardTitle className="text-lg">{content.title}</CardTitle>
        <CardDescription>
          {content.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="text-sm text-gray-600">
          Current plan: <span className="font-medium capitalize">{currentPlan || 'Free'}</span>
        </div>
        <div className="flex gap-2 justify-center">
          <Link href="/pricing">
            <Button>
              Upgrade to {content.requiredPlan}
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline">
              View Plans
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Inline feature gate component for smaller UI elements
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback 
}: { 
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { hasAccess, isLoaded } = useFeatureAccess(feature)
  
  if (!isLoaded) return null
  
  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null
  }
  
  return <>{children}</>
}

/**
 * Plan badge component to show current plan
 */
export function PlanBadge({ className }: { className?: string }) {
  const { currentPlan, isLoaded } = useBilling()
  
  if (!isLoaded) return null
  
  const badgeStyles = {
    free: 'bg-gray-100 text-gray-800',
    premium: 'bg-blue-100 text-blue-800',
    enterprise: 'bg-purple-100 text-purple-800'
  } as const
  
  const planStyle = badgeStyles[currentPlan] || badgeStyles.free
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planStyle} ${className || ''}`}>
      {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
    </span>
  )
}