'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Play, Search, Activity as ActivityIcon, RefreshCw } from 'lucide-react'
import KeywordSearchResults from '@/app/components/campaigns/keyword-search/search-results'
import SimilarSearchResults from '@/app/components/campaigns/similar-search/search-results'
import ExportButton from '@/app/components/campaigns/export-button'
import { Campaign, ScrapingJob } from '@/app/types/campaign'
import { PlatformResult } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

interface ClientCampaignPageProps {
  campaign: Campaign | null
}

type CampaignStatus = 'no-results' | 'active' | 'completed' | 'error'

type StatusVariant = {
  badge: string
  dot: string
  label: string
}

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  completed: {
    badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
    dot: 'bg-emerald-400',
    label: 'Completed'
  },
  processing: {
    badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
    dot: 'bg-indigo-400 animate-pulse',
    label: 'Processing'
  },
  pending: {
    badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
    dot: 'bg-indigo-400 animate-pulse',
    label: 'Queued'
  },
  error: {
    badge: 'bg-red-500/15 text-red-200 border border-red-500/40',
    dot: 'bg-red-400',
    label: 'Failed'
  },
  timeout: {
    badge: 'bg-amber-500/15 text-amber-200 border border-amber-500/40',
    dot: 'bg-amber-400',
    label: 'Timed out'
  },
  default: {
    badge: 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/60',
    dot: 'bg-zinc-500',
    label: 'Unknown'
  }
}

function formatDate(value: Date | string | null | undefined, withTime = false) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: 'numeric' } : {})
  })
}

function getCreatorsCount(job?: ScrapingJob | null) {
  if (!job?.results?.length) return 0
  return job.results.reduce((total, result) => {
    const creators = Array.isArray((result as { creators?: PlatformResult }).creators)
      ? ((result as { creators?: PlatformResult }).creators as unknown[]).length
      : 0
    return total + creators
  }, 0)
}

function getRunDisplayLabel(index: number) {
  return `Run #${index}`
}

function getStatusVariant(status?: string): StatusVariant {
  if (!status) return STATUS_VARIANTS.default
  return STATUS_VARIANTS[status] ?? STATUS_VARIANTS.default
}

function isActiveJob(job?: ScrapingJob | null) {
  if (!job) return false
  return job.status === 'pending' || job.status === 'processing'
}

function buildKeywords(job?: ScrapingJob | null) {
  if (!job) return '—'
  return job.keywords?.length ? job.keywords.join(', ') : '—'
}

function getCreatorsSample(job?: ScrapingJob | null) {
  if (!job?.results?.length) return []
  const [firstResult] = job.results
  if (!firstResult?.creators) return []
  const creators = firstResult.creators as unknown[]
  return creators
    .slice(0, 3)
    .map((creator: any) => creator?.creator?.username || creator?.username)
    .filter(Boolean)
}

export default function ClientCampaignPage({ campaign }: ClientCampaignPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<ScrapingJob[]>(() => campaign?.scrapingJobs ?? [])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'creators' | 'activity'>('creators')
  const activeJobRef = useRef<ScrapingJob | null>(null)

  useEffect(() => {
    setJobs(campaign?.scrapingJobs ?? [])
  }, [campaign?.scrapingJobs])

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [jobs])

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return sortedJobs[0] ?? null
    return sortedJobs.find((job) => job.id === selectedJobId) ?? sortedJobs[0] ?? null
  }, [selectedJobId, sortedJobs])

  useEffect(() => {
    const urlJobId = searchParams?.get('jobId')
    if (urlJobId && sortedJobs.some((job) => job.id === urlJobId)) {
      setSelectedJobId(urlJobId)
      return
    }
    if (!selectedJobId && sortedJobs.length > 0) {
      setSelectedJobId(sortedJobs[0].id)
    }
  }, [searchParams, sortedJobs, selectedJobId])

  const creatorsCount = useMemo(() => getCreatorsCount(selectedJob), [selectedJob])

  useEffect(() => {
    if (!selectedJob) return
    if (selectedJob.status !== 'completed' && activeTab === 'creators') {
      setActiveTab('overview')
    }
    if (selectedJob.status === 'completed' && activeTab === 'overview') {
      setActiveTab('creators')
    }
  }, [activeTab, selectedJob])

  const isCampaignActive = useMemo(() => {
    return sortedJobs.some((job) => isActiveJob(job))
  }, [sortedJobs])

  const campaignStatus: CampaignStatus = useMemo(() => {
    if (!campaign) return 'error'
    if (isCampaignActive) return 'active'
    if (sortedJobs.some((job) => job.status === 'completed' && getCreatorsCount(job) > 0)) {
      return 'completed'
    }
    if (!sortedJobs.length) return 'no-results'
    return 'error'
  }, [campaign, isCampaignActive, sortedJobs])

  const activeJob = useMemo(() => {
    return sortedJobs.find((job) => isActiveJob(job)) ?? null
  }, [sortedJobs])

  useEffect(() => {
    activeJobRef.current = activeJob
  }, [activeJob])

  useEffect(() => {
    if (!activeJob) return

    const interval = setInterval(async () => {
      try {
        const current = activeJobRef.current
        if (!current) {
          clearInterval(interval)
          return
        }

        const response = await fetch(`/api/scraping/${current.platform.toLowerCase()}?jobId=${current.id}`)
        const data = await response.json()

        if (!response.ok || data.error) {
          clearInterval(interval)
          setJobs((prev) =>
            prev.map((job) =>
              job.id === current.id
                ? { ...job, status: data.status ?? job.status ?? 'error', progress: data.progress ?? job.progress }
                : job
            )
          )
          return
        }

        setJobs((prev) =>
          prev.map((job) =>
            job.id === current.id
              ? { ...job, status: data.status ?? job.status, progress: data.progress ?? job.progress }
              : job
          )
        )

        if (['completed', 'error', 'timeout'].includes(data.status)) {
          clearInterval(interval)
          setTimeout(() => router.refresh(), 1200)
        }
      } catch (error) {
        console.error('Error polling job status:', error)
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [activeJob, router])

  const handleSelectJob = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId)
      const params = new URLSearchParams(searchParams?.toString())
      params.set('jobId', jobId)
      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleStartSearch = useCallback(
    (type: 'keyword' | 'similar' | 'default') => {
      if (!campaign) return
      const nextType = type === 'default' ? campaign.searchType : type
      const searchPath = nextType === 'similar' ? 'similar' : 'keyword'
      router.push(`/campaigns/search/${searchPath}?campaignId=${campaign.id}`)
    },
    [campaign, router]
  )

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md bg-zinc-900/80 border border-zinc-800/40">
          <CardContent className="pt-6 pb-8 text-center text-zinc-400">
            Unable to find that campaign.
          </CardContent>
        </Card>
      </div>
    )
  }

  const headerStatusKey = campaignStatus === 'active'
    ? 'processing'
    : campaignStatus === 'completed'
      ? 'completed'
      : campaignStatus === 'error'
        ? campaign.status
        : 'default'

  const headerStatusVariant = getStatusVariant(headerStatusKey)
  const headerStatusLabel = campaignStatus === 'no-results'
    ? 'No runs yet'
    : headerStatusVariant.label

  const renderRunRail = () => (
    <Card className="bg-zinc-900/80 border border-zinc-800/60">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-zinc-100">Runs</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleStartSearch('default')}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            New Search
          </Button>
        </div>
        <CardDescription className="text-xs text-zinc-500">
          Track every search inside this campaign.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedJobs.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-700/60 bg-zinc-900/80 p-6 text-center text-sm text-zinc-400">
            No searches yet. Launch your first search to see results here.
          </div>
        )}
        {sortedJobs.map((job, index) => {
          const variant = getStatusVariant(job.status)
          const isSelected = selectedJob?.id === job.id
          const creatorsFound = getCreatorsCount(job)
          const runLabel = getRunDisplayLabel(sortedJobs.length - index)
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => handleSelectJob(job.id)}
              className={cn(
                'w-full rounded-lg border bg-zinc-900/70 px-4 py-3 text-left transition-all',
                'border-zinc-800/70 hover:border-pink-500/40 hover:bg-zinc-800/40',
                isSelected && 'border-pink-500/60 bg-zinc-800/60 shadow-md'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn('h-2.5 w-2.5 rounded-full', variant.dot)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{runLabel}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {formatDate(job.createdAt, true)} · {job.platform}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={variant.badge}>
                  {variant.label}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                {job.status === 'completed' && (
                  <span>{creatorsFound} creators</span>
                )}
                {job.status !== 'completed' && job.progress != null && (
                  <span className="flex items-center gap-2 text-xs text-indigo-200">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {Math.round(job.progress)}%
                  </span>
                )}
                {job.keywords?.length ? (
                  <span className="truncate">{job.keywords.slice(0, 3).join(', ')}{job.keywords.length > 3 ? '…' : ''}</span>
                ) : job.targetUsername ? (
                  <span>@{job.targetUsername}</span>
                ) : null}
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )

  const renderOverview = () => (
    <Card className="bg-zinc-900/80 border border-zinc-800/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-zinc-100">Run snapshot</CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          Key details for the selected run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', getStatusVariant(selectedJob?.status).dot)} />
              <span className="text-sm text-zinc-100">{getStatusVariant(selectedJob?.status).label}</span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Platform</p>
            <p className="mt-1 text-sm text-zinc-100">{selectedJob?.platform ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Created</p>
            <p className="mt-1 text-sm text-zinc-100">{formatDate(selectedJob?.createdAt, true)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Completed</p>
            <p className="mt-1 text-sm text-zinc-100">{formatDate(selectedJob?.completedAt, true)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Results captured</p>
            <p className="mt-1 text-sm text-zinc-100">{creatorsCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Scraper limit</p>
            <p className="mt-1 text-sm text-zinc-100">{selectedJob?.scraperLimit ?? '—'}</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {selectedJob?.keywords?.length ? 'Keywords' : 'Target' }
          </p>
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/70 p-3 text-sm text-zinc-100">
            {selectedJob?.keywords?.length ? buildKeywords(selectedJob) : selectedJob?.targetUsername ? `@${selectedJob.targetUsername}` : '—'}
          </div>
        </div>
        {creatorsCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Sample creators</p>
            <div className="flex flex-wrap gap-2">
              {getCreatorsSample(selectedJob).map((creatorHandle) => (
                <Badge key={creatorHandle} variant="outline" className="bg-zinc-800/50 text-zinc-200">
                  @{creatorHandle}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {isActiveJob(selectedJob) && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Progress</p>
            <Progress value={selectedJob?.progress ?? 0} className="h-2" />
            <p className="text-xs text-zinc-500">Updating with live results. This page will refresh when the run completes.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderActivity = () => (
    <Card className="bg-zinc-900/80 border border-zinc-800/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-zinc-100">Activity log</CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          Timeline of this run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm text-zinc-300">
          <div className="flex items-start gap-3">
            <ActivityIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
            <div>
              <p className="font-medium text-zinc-100">Run created</p>
              <p className="text-xs text-zinc-500">{formatDate(selectedJob?.createdAt, true)}</p>
            </div>
          </div>
          {selectedJob?.startedAt && (
            <div className="flex items-start gap-3">
              <ActivityIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
              <div>
                <p className="font-medium text-zinc-100">Processing started</p>
                <p className="text-xs text-zinc-500">{formatDate(selectedJob.startedAt, true)}</p>
              </div>
            </div>
          )}
          {selectedJob?.completedAt && (
            <div className="flex items-start gap-3">
              <ActivityIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
              <div>
                <p className="font-medium text-zinc-100">Completed</p>
                <p className="text-xs text-zinc-500">{formatDate(selectedJob.completedAt, true)}</p>
              </div>
            </div>
          )}
          {selectedJob?.error && (
            <div className="flex items-start gap-3">
              <ActivityIcon className="mt-0.5 h-4 w-4 text-red-400" />
              <div>
                <p className="font-medium text-zinc-100">Error reported</p>
                <p className="text-xs text-zinc-500">{selectedJob.error}</p>
              </div>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-zinc-400 hover:text-zinc-100"
          onClick={() => router.refresh()}
        >
          <RefreshCw className="h-4 w-4" /> Refresh details
        </Button>
      </CardContent>
    </Card>
  )

  const renderResults = () => {
    if (!selectedJob) {
      return (
        <Card className="bg-zinc-900/80 border border-zinc-800/60">
          <CardContent className="py-16 text-center text-sm text-zinc-400">
            Select a run to see its results.
          </CardContent>
        </Card>
      )
    }

    if (selectedJob.status !== 'completed' || getCreatorsCount(selectedJob) === 0) {
      return (
        <Card className="bg-zinc-900/80 border border-zinc-800/60">
          <CardContent className="py-16 text-center text-sm text-zinc-400 space-y-2">
            <Loader2 className="h-5 w-5 mx-auto animate-spin text-zinc-400" />
            <p>{isActiveJob(selectedJob) ? 'This run is still processing. Results will appear once completed.' : 'No creators captured for this run yet.'}</p>
          </CardContent>
        </Card>
      )
    }

    if (campaign.searchType === 'keyword') {
      const searchData = {
        jobId: selectedJob.id,
        campaignId: campaign.id,
        keywords: selectedJob.keywords ?? [],
        platform: selectedJob.platform ?? 'TikTok'
      }

      return (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
            </div>
          }
        >
          <KeywordSearchResults searchData={searchData} />
        </Suspense>
      )
    }

    const searchData = {
      jobId: selectedJob.id,
      platform: selectedJob.platform ?? 'Instagram',
      targetUsername: selectedJob.targetUsername,
      creators: selectedJob.results?.[0]?.creators ?? [],
      campaignId: campaign.id
    }

    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        }
      >
        <SimilarSearchResults searchData={searchData} />
      </Suspense>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/80 border border-zinc-800/60">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl font-semibold text-zinc-100">{campaign.name}</CardTitle>
                <Badge variant="outline" className={headerStatusVariant.badge}>
                  {headerStatusLabel}
                </Badge>
              </div>
              {campaign.description && (
                <CardDescription className="text-sm text-zinc-400">
                  {campaign.description}
                </CardDescription>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/70"
                onClick={() => handleStartSearch('keyword')}
              >
                <Search className="mr-2 h-4 w-4" /> Keyword search
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/70"
                onClick={() => handleStartSearch('similar')}
              >
                <Search className="mr-2 h-4 w-4" /> Similar search
              </Button>
              <ExportButton
                campaignId={campaign.id}
                jobId={selectedJob?.id}
                variant="outline"
                className="border-zinc-700/60 text-zinc-100"
                disabled={!selectedJob || getCreatorsCount(selectedJob) === 0}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Search type</p>
              <p className="mt-1 text-sm text-zinc-100 capitalize">{campaign.searchType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Total runs</p>
              <p className="mt-1 text-sm text-zinc-100">{sortedJobs.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Created</p>
              <p className="mt-1 text-sm text-zinc-100">{formatDate(campaign.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Last updated</p>
              <p className="mt-1 text-sm text-zinc-100">{formatDate(campaign.updatedAt, true)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,300px),1fr]">
        {renderRunRail()}
        <div className="space-y-4 min-w-0">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <TabsList className="bg-zinc-900/80 border border-zinc-800/60 flex-wrap gap-1">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="creators"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
                disabled={!selectedJob || selectedJob.status !== 'completed' || getCreatorsCount(selectedJob) === 0}
              >
                Creators
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
              >
                Activity
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">{renderOverview()}</TabsContent>
            <TabsContent value="creators" className="space-y-4 min-w-0">
              {renderResults()}
            </TabsContent>
            <TabsContent value="activity">{renderActivity()}</TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
