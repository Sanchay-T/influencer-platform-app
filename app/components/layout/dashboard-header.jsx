'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, PlusCircle, Menu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useBilling } from '@/lib/hooks/use-billing'

export default function DashboardHeader({ onToggleSidebar, isSidebarOpen }) {
  const pathname = usePathname()
  const router = useRouter()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  const tabs = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Campaigns', href: '/' },
    // Removed "Influencers" tab to avoid clutter in navbar
  ]

  // Gate: whether user can create more campaigns (use billing hook to avoid duplicate fetch)
  const { isLoaded: billingLoaded, usageInfo } = useBilling()
  const [canCreateCampaign, setCanCreateCampaign] = useState(true)
  const [loadingGate, setLoadingGate] = useState(true)

  useEffect(() => {
    if (!billingLoaded) return
    const used = Number(usageInfo?.campaignsUsed ?? 0)
    const limit = usageInfo?.campaignsLimit
    const unlimited = limit === -1 || limit === null || typeof limit === 'undefined'
    setCanCreateCampaign(unlimited || used < Number(limit))
    setLoadingGate(false)
  }, [billingLoaded, usageInfo])

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Navigate to existing similar search page; no backend change
      router.push('/campaigns/search/similar')
    }
  }

  // Focus search when pressing '/'; ignore if typing in an input/textarea/select
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== '/') return
      const el = e.target
      const tag = el && el.tagName ? el.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (el && el.isContentEditable)) {
        return
      }
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="sticky top-0 z-50 border-b border-zinc-700/50 bg-zinc-900/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/70">
      <div className="px-4 sm:px-6 md:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Global sidebar toggle */}
            <button
              type="button"
              aria-label="Toggle sidebar"
              aria-pressed={isSidebarOpen}
              onClick={onToggleSidebar}
              className={cn(
                'mr-1 inline-flex items-center justify-center rounded-md p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-pink-500/30 lg:hidden',
                isSidebarOpen && 'bg-zinc-800/60 text-zinc-100'
              )}
            >
              <Menu className="h-5 w-5" />
            </button>
            {tabs.map((t) => {
              const isActive = pathname === t.href
              return (
                <Link
                  key={t.name}
                  href={t.href}
                  className={cn(
                    'text-sm font-medium px-3 pb-2 transition-colors border-b-2',
                    isActive
                      ? 'text-zinc-100 border-pink-400'
                      : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:border-pink-400/50'
                  )}
                >
                  {t.name}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                ref={inputRef}
                placeholder="Search or press /"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                className="h-9 pl-10 bg-zinc-800/60 border-zinc-700/50 focus:border-pink-400/60 focus:ring-2 focus:ring-pink-500/20 placeholder:text-zinc-500 transition-all w-44 sm:w-60 md:w-72 max-w-[60vw]"
              />
            </div>
            {/* Single global CTA with plan gating */}
            {canCreateCampaign ? (
              <Link href="/campaigns/new">
                <Button size="sm" className="bg-pink-600 hover:bg-pink-500 text-white" disabled={loadingGate}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            ) : (
              <Link href="/billing">
                <Button size="sm" className="bg-pink-600 hover:bg-pink-500 text-white">
                  Upgrade
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
