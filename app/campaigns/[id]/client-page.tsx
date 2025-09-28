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
import { dedupeCreators } from '@/app/components/campaigns/utils/dedupe-creators'

// Cache for expensive deduplication operations
const dedupeCache = new Map<string, any[]>()

const SHOW_DIAGNOSTICS = process.env.NEXT_PUBLIC_SHOW_SEARCH_DIAGNOSTICS === 'true'

type SearchDiagnostics = {
  engine: string
  queueLatencyMs: number | null
  processingMs: number | null
  totalMs: number | null
  apiCalls: number | null
  processedCreators: number | null
  batches: Array<{ index?: number; size?: number; durationMs?: number }>
  startedAt?: string | null
  finishedAt?: string | null
  lastUpdated: string
}

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

function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${ms.toFixed(0)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`
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
  const [activeTab, setActiveTab] = useState<'creators' | 'activity'>('creators')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [renderKey, setRenderKey] = useState(0)
  const activeJobRef = useRef<ScrapingJob | null>(null)
  const prevRunLogRef = useRef<{ id: string | null; status?: string } | null>(null)
  const prevTabRef = useRef<'creators' | 'activity' | null>(null)
  const transitionStartTimeRef = useRef<number | null>(null)
  const [diagnostics, setDiagnostics] = useState<Record<string, SearchDiagnostics>>({})

  const logEvent = useCallback((event: string, detail: Record<string, unknown>) => {
    const timestamp = new Date().toISOString()
    const perfNow = performance.now().toFixed(2)
    console.log(`🏃 [RUN-SWITCH][${timestamp}][${perfNow}ms] ${event}`, {
      ...detail,
      transitionDuration: transitionStartTimeRef.current ?
        (performance.now() - transitionStartTimeRef.current).toFixed(2) + 'ms' : null
    })
  }, [])

  const logUXEvent = useCallback((event: string, detail: Record<string, unknown>) => {
    console.log(`[RUN-UX][${new Date().toISOString()}] ${event}`, detail)
  }, [])

  useEffect(() => {
    setJobs(campaign?.scrapingJobs ?? [])
  }, [campaign?.scrapingJobs])

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [jobs])

  const selectedJob = useMemo(() => {
    let job: ScrapingJob | null = null
    if (!selectedJobId) {
      job = sortedJobs[0] ?? null
      // Fallback to first job
    } else {
      job = sortedJobs.find((j) => j.id === selectedJobId) ?? sortedJobs[0] ?? null
      // Found job by ID
    }

    // Job selection completed

    return job
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

  const selectedDiagnostics = useMemo(() => {
    if (!SHOW_DIAGNOSTICS || !selectedJob) return undefined
    return diagnostics[selectedJob.id]
  }, [diagnostics, selectedJob])

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
    if (!selectedJob) return
    const prev = prevRunLogRef.current
    if (!prev || prev.id !== selectedJob.id || prev.status !== selectedJob.status) {
      logUXEvent('run-selected', {
        jobId: selectedJob.id,
        status: selectedJob.status,
        progress: selectedJob.progress ?? null,
        createdAt: selectedJob.createdAt,
        completedAt: selectedJob.completedAt,
        resultsCount: selectedJob.results?.[0]?.creators?.length ?? 0
      })
      prevRunLogRef.current = { id: selectedJob.id, status: selectedJob.status }
    }
  }, [logUXEvent, selectedJob])

  useEffect(() => {
    if (!selectedJob) return
    if (prevTabRef.current !== activeTab || (prevRunLogRef.current?.id && prevRunLogRef.current.id !== selectedJob.id)) {
      logUXEvent('tab-changed', { tab: activeTab, jobId: selectedJob.id })
      prevTabRef.current = activeTab
    }
  }, [activeTab, logUXEvent, selectedJob])

  useEffect(() => {
    if (!activeJob) return

    const interval = setInterval(async () => {
      try {
        const current = activeJobRef.current
        if (!current) {
          clearInterval(interval)
          return
        }

        const response = await fetch(`/api/scraping/${current.platform.toLowerCase()}?jobId=${current.id}`, { credentials: 'include' })
        const data = await response.json()

        if (SHOW_DIAGNOSTICS && data) {
          const timings = data?.benchmark?.timings ?? {}
          const batches = Array.isArray(data?.benchmark?.batches) ? data.benchmark.batches : []
          const startedAt = timings?.startedAt ? new Date(timings.startedAt) : null
          const finishedAt = timings?.finishedAt ? new Date(timings.finishedAt) : null
          const jobCreatedAt = current.createdAt ? new Date(current.createdAt) : null
          const queueLatencyMs = jobCreatedAt && startedAt ? startedAt.getTime() - jobCreatedAt.getTime() : null
          const processingMs = typeof timings?.totalDurationMs === 'number'
            ? timings.totalDurationMs
            : startedAt && finishedAt
              ? finishedAt.getTime() - startedAt.getTime()
              : null
          const totalMs = queueLatencyMs !== null && processingMs !== null
            ? queueLatencyMs + processingMs
            : processingMs

          setDiagnostics((prev) => ({
            ...prev,
            [current.id]: {
              engine: data.engine ?? 'legacy',
              queueLatencyMs,
              processingMs,
              totalMs,
              apiCalls: data?.benchmark?.apiCalls ?? (Array.isArray(batches) ? batches.length : null),
              processedCreators: data?.benchmark?.processedCreators ?? null,
              batches,
              startedAt: timings?.startedAt ?? null,
              finishedAt: timings?.finishedAt ?? null,
              lastUpdated: new Date().toISOString()
            }
          }))
        }

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
              ? {
                  ...job,
                  status: data.status ?? job.status,
                  progress: data.progress ?? job.progress,
                  results: Array.isArray(data.results) && data.results.length > 0 ? data.results : job.results
                }
              : job
          )
        )

        if (['completed', 'error', 'timeout'].includes(data.status)) {
          clearInterval(interval)
        }
      } catch (error) {
        console.error('Error polling job status:', error)
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [activeJob])

  const handleSelectJob = useCallback(
    (jobId: string) => {
      const transitionStart = performance.now()
      transitionStartTimeRef.current = transitionStart

      const job = sortedJobs.find((j) => j.id === jobId)
      const previousJob = selectedJob

      logEvent('run-click:initiated', {
        clickedJobId: jobId,
        previousJobId: previousJob?.id || null,
        clickedJobStatus: job?.status,
        clickedJobCreators: job?.results?.[0]?.creators?.length ?? 0,
        previousJobCreators: previousJob?.results?.[0]?.creators?.length ?? 0,
        isSameJob: jobId === previousJob?.id
      })

      // Set transition state immediately for visual feedback
      setIsTransitioning(true)

      // Transition started

      // Update selected job ID and force fresh render
      setSelectedJobId(jobId)
      setRenderKey(prev => prev + 1)

      // Job ID updated

      // Update URL
      const params = new URLSearchParams(searchParams?.toString())
      params.set('jobId', jobId)
      const query = params.toString()
      if (typeof window !== 'undefined') {
        const nextUrl = `${pathname}${query ? `?${query}` : ''}`
        window.history.replaceState(null, '', nextUrl)
        // URL updated
      }

      // Clear transition state immediately
      setIsTransitioning(false)
      const duration = (performance.now() - transitionStart).toFixed(2)
      logEvent('run-click:transition-completed', {
        jobId,
        totalTransitionTime: duration + 'ms',
        FIXED: 'INSTANT_TRANSITION_APPLIED'
      })
      transitionStartTimeRef.current = null

      logUXEvent('run-click', {
        jobId,
        status: job?.status,
        progress: job?.progress ?? null,
        creators: job?.results?.[0]?.creators?.length ?? 0
      })
    },
    [logEvent, logUXEvent, pathname, searchParams, sortedJobs, selectedJob]
  )

  const handleStartSearch = useCallback(
    (type?: 'keyword' | 'similar') => {
      if (!campaign) return
      if (!type) {
        router.push(`/campaigns/search?campaignId=${campaign.id}`)
        return
      }
      router.push(`/campaigns/search/${type}?campaignId=${campaign.id}`)
    },
    [campaign, router]
  )

  const rawCreators = useMemo(() => {
    if (!selectedJob?.results || selectedJob.results.length === 0) {
      return []
    }

    return selectedJob.results.flatMap(result =>
      Array.isArray(result?.creators) ? result.creators : []
    )
  }, [selectedJob])

  const processedCreators = useMemo(() => {
    if (!selectedJob || rawCreators.length === 0) {
      return []
    }

    const cacheKey = `${selectedJob.id}-${rawCreators.length}`

    if (dedupeCache.has(cacheKey)) {
      return dedupeCache.get(cacheKey)!
    }

    const platformHint = selectedJob.platform?.toLowerCase() || 'tiktok'
    const result = dedupeCreators(rawCreators, { platformHint })

    dedupeCache.set(cacheKey, result)

    if (dedupeCache.size > 50) {
      const firstKey = dedupeCache.keys().next().value
      dedupeCache.delete(firstKey)
    }

    return result
  }, [rawCreators, selectedJob])

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
            onClick={() => handleStartSearch()}
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
                  <span
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      ['failed', 'error', 'timeout'].includes(job.status ?? '') ? 'text-rose-300' : 'text-indigo-200'
                    )}
                  >
                    <Loader2
                      className={cn(
                        'h-3 w-3',
                        !['failed', 'error', 'timeout'].includes(job.status ?? '') && 'animate-spin'
                      )}
                    />
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

  const renderRunSummary = () => (
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
        {SHOW_DIAGNOSTICS && selectedDiagnostics && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-indigo-300">Diagnostics (dev)</p>
            <div className="space-y-1 rounded-md border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs text-indigo-100">
              <div className="flex justify-between">
                <span>Engine</span>
                <span className="font-mono text-indigo-200">{selectedDiagnostics.engine}</span>
              </div>
              <div className="flex justify-between">
                <span>Queue wait</span>
                <span>{formatDuration(selectedDiagnostics.queueLatencyMs)}</span>
              </div>
              <div className="flex justify-between">
                <span>Processing</span>
                <span>{formatDuration(selectedDiagnostics.processingMs)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total runtime</span>
                <span>{formatDuration(selectedDiagnostics.totalMs)}</span>
              </div>
              <div className="flex justify-between">
                <span>API calls</span>
                <span>{selectedDiagnostics.apiCalls ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Creators processed</span>
                <span>{selectedDiagnostics.processedCreators ?? '—'}</span>
              </div>
              {selectedDiagnostics.startedAt && (
                <div className="flex justify-between">
                  <span>First fetch</span>
                  <span>{formatDate(selectedDiagnostics.startedAt, true)}</span>
                </div>
              )}
              {selectedDiagnostics.finishedAt && (
                <div className="flex justify-between">
                  <span>Last fetch</span>
                  <span>{formatDate(selectedDiagnostics.finishedAt, true)}</span>
                </div>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-indigo-300/80">Batch breakdown</summary>
                <ul className="mt-1 space-y-1">
                  {selectedDiagnostics.batches.map((batch, index) => (
                    <li key={`${selectedJob?.id}-batch-${index}`} className="flex justify-between font-mono">
                      <span>#{batch.index ?? index + 1} · {batch.size ?? '—'} creators</span>
                      <span>{formatDuration(batch.durationMs ?? null)}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <p className="text-end text-[10px] text-indigo-300/70">
                updated {formatDate(selectedDiagnostics.lastUpdated, true)}
              </p>
            </div>
          </div>
        )}
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

  const renderActivityLog = () => (
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
    // Rendering results for selected job

    if (!selectedJob) {
      // No selected job available
      return (
        <Card className="bg-zinc-900/80 border border-zinc-800/60">
          <CardContent className="py-16 text-center text-sm text-zinc-400">
            Select a run to see its results.
          </CardContent>
        </Card>
      )
    }

    if (['failed', 'error', 'timeout'].includes(selectedJob.status ?? '')) {
      return (
        <Card className="bg-zinc-900/80 border border-rose-500/40">
          <CardContent className="py-8 px-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-rose-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Run did not complete successfully</span>
              </div>
              <p className="text-sm text-zinc-400">
                {selectedJob.error || 'The scraping service reported a failure before any results were returned.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700/60 text-zinc-200 hover:bg-zinc-800/60"
                  onClick={() => router.refresh()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry fetch
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-pink-600/80 text-white hover:bg-pink-500"
                  onClick={() => handleStartSearch('default')}
                >
                  Start new search
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (campaign.searchType === 'keyword') {
      const searchData = {
        jobId: selectedJob.id,
        campaignId: campaign.id,
        keywords: selectedJob.keywords ?? [],
        platform: selectedJob.platform ?? 'tiktok',
        selectedPlatform: selectedJob.platform ?? 'tiktok',
        status: selectedJob.status,
        initialCreators: processedCreators
      }

      // Keyword search data prepared

      return (
        <div key={`keyword-${selectedJob.id}-${renderKey}`}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
              </div>
            }
          >
            <KeywordSearchResults
              key={`keyword-results-${selectedJob.id}-${renderKey}`}
              searchData={searchData}
            />
          </Suspense>
        </div>
      )
    }

    const searchData = {
      jobId: selectedJob.id,
      platform: selectedJob.platform ?? 'instagram',
      selectedPlatform: selectedJob.platform ?? 'instagram',
      targetUsername: selectedJob.targetUsername,
      creators: processedCreators,
      campaignId: campaign.id,
      status: selectedJob.status
    }

    // Similar search data prepared

    return (
      <div key={`similar-${selectedJob.id}-${renderKey}`}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
            </div>
          }
        >
          <SimilarSearchResults
            key={`similar-results-${selectedJob.id}-${renderKey}`}
            searchData={searchData}
          />
        </Suspense>
      </div>
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
                value="creators"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
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
          </Tabs>

          {activeTab === 'creators' ? (
            <div className="space-y-4 min-w-0 relative">
              {renderResults()}
            </div>
          ) : (
            <div className="space-y-4">
              {renderRunSummary()}
              {renderActivityLog()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
