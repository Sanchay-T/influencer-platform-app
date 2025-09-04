'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useBilling } from '@/lib/hooks/use-billing'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AccessGuardOverlay({ initialBlocked = false }: { initialBlocked?: boolean }) {
  const { isLoaded, isTrialing, trialStatus, hasActiveSubscription } = useBilling()
  const pathname = usePathname()
  const [blocked, setBlocked] = useState<boolean>(initialBlocked)

  const isAllowedRoute = useMemo(() => ['/billing', '/pricing'].some(p => pathname?.startsWith(p)), [pathname])

  useEffect(() => {
    // Optimistic block on non-allowed routes until billing status loads
    if (!isLoaded && !isAllowedRoute) {
      setBlocked(true)
      try {
        console.log('[Overlay] Optimistic block (loading)', { pathname, isAllowedRoute })
      } catch {}
      return
    }
    if (!isLoaded) return
    const isTrialExpired = isTrialing && trialStatus === 'expired'
    const hasAccess = hasActiveSubscription || (isTrialing && !isTrialExpired)
    const nextBlocked = !hasAccess && !isAllowedRoute
    setBlocked(nextBlocked)
    try {
      console.log('[Overlay] Resolve block state', { pathname, isTrialExpired, hasActiveSubscription, isTrialing, trialStatus, isAllowedRoute, blocked: nextBlocked })
    } catch {}
  }, [isLoaded, isAllowedRoute, isTrialing, trialStatus, hasActiveSubscription])

  if (!blocked) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="bg-zinc-900/90 border border-zinc-700/50 rounded-xl p-6 max-w-md w-full mx-4 text-center text-zinc-200 shadow-xl">
          <h3 className="text-lg font-semibold mb-2">Your access is paused</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Your trial has ended or payment is required. Please upgrade your plan to continue using Gemz.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/billing?upgrade=1">
              <Button className="bg-pink-600 hover:bg-pink-500 text-white">Upgrade Now</Button>
            </Link>
            <Link href="/billing">
              <Button variant="outline">View Billing</Button>
            </Link>
          </div>
      </div>
    </div>
  )
}
