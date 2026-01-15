'use client';

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const searchOptions = [
  {
    type: 'keyword' as const,
    title: 'Keyword-Based Search',
    description: 'Discover creators using keywords, hashtags, and phrases.'
  },
  {
    type: 'similar' as const,
    title: 'Similar Creator Search',
    description: 'Find lookalike creators based on a handle you already know.'
  },
  {
    type: 'brand' as const,
    title: 'Brand / Competitor Search',
    description: 'Find creators who collaborate with or mention specific brands.'
  }
]

export default function CampaignSearchPage() {
  return (
    <Suspense fallback={<CampaignSearchFallback />}>
      <CampaignSearchChooser />
    </Suspense>
  )
}

function CampaignSearchChooser() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignId = searchParams?.get('campaignId') ?? ''
  const [loadingType, setLoadingType] = useState<'keyword' | 'similar' | 'brand' | null>(null)

  const handlePick = (type: 'keyword' | 'similar' | 'brand') => {
    setLoadingType(type)
    const target = campaignId
      ? `/campaigns/search/${type}?campaignId=${campaignId}`
      : `/campaigns/search/${type}`
    router.push(target)
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-4xl bg-zinc-900/80 border border-zinc-700/50">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold text-zinc-100">How do you want to search?</CardTitle>
            <CardDescription className="text-sm text-zinc-400">
              Pick a method to start pulling creators into this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {searchOptions.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => handlePick(option.type)}
                  disabled={loadingType !== null}
                  className="relative h-auto min-h-[110px] rounded-lg border border-zinc-700/50 bg-zinc-900/60 p-6 text-left transition-colors hover:bg-zinc-800/60 focus:outline-none focus:ring-2 focus:ring-pink-400/30"
                >
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-zinc-100">{option.title}</h3>
                    <p className="text-sm text-zinc-400 whitespace-normal">{option.description}</p>
                  </div>
                  {loadingType === option.type && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-950/70">
                      <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

function CampaignSearchFallback() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-3xl border border-zinc-700/50 bg-zinc-900/80">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold text-zinc-100">Loading search options…</CardTitle>
            <CardDescription className="text-sm text-zinc-400">
              Preparing campaign search tools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
