'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, PlusCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

export default function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  const tabs = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Campaigns', href: '/' },
    // Removed "Influencers" tab to avoid clutter in navbar
  ]

  // Gate: whether user can create more campaigns (single source: billing/status)
  const [canCreateCampaign, setCanCreateCampaign] = useState(true)
  const [loadingGate, setLoadingGate] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        setLoadingGate(true)
        const res = await fetch('/api/billing/status')
        if (!res.ok) return
        const data = await res.json()
        const used = Number(data?.usageInfo?.campaignsUsed ?? 0)
        const limit = data?.usageInfo?.campaignsLimit
        const unlimited = limit === -1 || limit === null || typeof limit === 'undefined'
        setCanCreateCampaign(unlimited || used < Number(limit))
      } catch (_) {
        // fail-open
        setCanCreateCampaign(true)
      } finally {
        setLoadingGate(false)
      }
    }
    run()
  }, [])

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
      <div className="px-6 md:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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
                className="w-72 h-9 pl-10 bg-zinc-800/60 border-zinc-700/50 focus:border-pink-400/60 focus:ring-2 focus:ring-pink-500/20 placeholder:text-zinc-500 transition-all"
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
