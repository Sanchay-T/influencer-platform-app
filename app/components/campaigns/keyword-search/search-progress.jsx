'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import IntermediateList from './search-progress-intermediate-list'
import {
  MAX_AUTH_RETRIES,
  MAX_GENERAL_RETRIES,
  buildEndpoint,
  clampProgress,
  computeStage,
  flattenCreators
} from './search-progress-helpers'

// [ComponentUsage] Rendered by `search-results.jsx` to drive progress UI and intermediate result hydration
export default function SearchProgress({
  jobId,
  onComplete,
  onIntermediateResults,
  platform = 'tiktok',
  searchData,
  onMeta,
  onProgress
}) {
  const router = useRouter()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const authReady = authLoaded && isSignedIn

  const platformOverride = searchData?.selectedPlatform || searchData?.platform || platform
  const platformNormalized = useMemo(
    () => (platformOverride || 'tiktok').toString().toLowerCase(),
    [platformOverride]
  )
  const hasTargetUsername = Boolean(searchData?.targetUsername)
  const primaryKeyword = Array.isArray(searchData?.keywords) ? searchData.keywords[0] : searchData?.targetUsername
  const campaignId = searchData?.campaignId

  const [status, setStatus] = useState('processing')
  const [progress, setProgress] = useState(0)
  const [displayProgress, setDisplayProgress] = useState(0)
  const [error, setError] = useState(null)
  const [recovery, setRecovery] = useState(null)
  const [processedResults, setProcessedResults] = useState(0)
  const [targetResults, setTargetResults] = useState(0)
  const [processingSpeed, setProcessingSpeed] = useState(0)
  const [showIntermediateResults, setShowIntermediateResults] = useState(false)
  const [intermediateCreators, setIntermediateCreators] = useState([])

  const pollTimeoutRef = useRef(null)
  const startTimeRef = useRef(Date.now())
  const lastCreatorCountRef = useRef(0)
  const authRetryRef = useRef(0)
  const generalRetryRef = useRef(0)
  const lastLogRef = useRef({
    status: '',
    progress: 0,
    creatorCount: 0,
  })

  const clearPollTimeout = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  const loadCampaignSnapshot = useCallback(async () => {
    if (!campaignId || !jobId) return
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { credentials: 'include' })
      if (!res.ok) return
      const snapshot = await res.json()
      const jobs = Array.isArray(snapshot?.scrapingJobs) ? snapshot.scrapingJobs : []
      const job = jobs.find((entry) => entry?.id === jobId)
      if (!job) return

      const creators = flattenCreators(job.results)
      if (creators.length && typeof onIntermediateResults === 'function') {
        onIntermediateResults({
          creators,
          progress: clampProgress(job.progress),
          status: job.status,
          isPartial: true
        })
      }
      if (typeof onProgress === 'function') {
        onProgress({
          processedResults: job.processedResults ?? creators.length,
          targetResults: job.targetResults ?? null,
          progress: clampProgress(job.progress),
          status: job.status || 'processing'
        })
      }
    } catch (snapshotError) {
      console.warn('[SEARCH-PROGRESS] Snapshot fallback failed', snapshotError)
    }
  }, [campaignId, jobId, onIntermediateResults, onProgress])

  const poll = useCallback(async () => {
    if (!jobId) return

    const endpoint = buildEndpoint(platformNormalized, hasTargetUsername, jobId)
    if (!endpoint) return

    if (platformNormalized.startsWith('instagram')) {
      console.log('[INSTAGRAM-US][POLL] init', {
        jobId,
        endpoint,
        platform: platformNormalized,
        timestamp: new Date().toISOString(),
      })
    }

    const schedule = (delayMs) => {
      clearPollTimeout()
      pollTimeoutRef.current = setTimeout(() => {
        poll()
      }, delayMs)
    }

    if (!authReady) {
      schedule(750)
      return
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null
      try {
        const response = await fetch(endpoint, {
          credentials: 'include',
          signal: controller?.signal
        })
        if (timeoutId) clearTimeout(timeoutId)

        if (response.status === 401) {
          authRetryRef.current += 1
          if (authRetryRef.current >= MAX_AUTH_RETRIES) {
            setError('We lost your session. Please refresh the page and sign in again.')
            clearPollTimeout()
            return
          }
          await loadCampaignSnapshot()
          if (platformNormalized.startsWith('instagram')) {
            console.warn('[INSTAGRAM-US][POLL] auth retry', {
              jobId,
              attempt: authRetryRef.current,
              timestamp: new Date().toISOString(),
            })
          }
          schedule(authReady ? 2000 : 750)
          return
        }

        if (response.status === 404) {
          setError('This run is no longer available.')
          clearPollTimeout()
          setStatus('error')
          if (platformNormalized.startsWith('instagram')) {
            console.error('[INSTAGRAM-US][POLL] job not found', { jobId })
          }
          return
        }

        if (!response.ok) {
          generalRetryRef.current += 1
          setError(`Temporary issue fetching progress (${response.status})`)
          if (generalRetryRef.current >= MAX_GENERAL_RETRIES) {
            clearPollTimeout()
            return
          }
          if (platformNormalized.startsWith('instagram')) {
            console.warn('[INSTAGRAM-US][POLL] temporary error', {
              jobId,
              status: response.status,
              attempt: generalRetryRef.current,
            })
          }
          schedule(2500)
          return
        }

        const data = await response.json()
        authRetryRef.current = 0
        generalRetryRef.current = 0
        setError(null)

        if (typeof onMeta === 'function' && data?.metadata) {
          onMeta(data.metadata)
        }

        const jobStatus = data?.status ?? data?.job?.status ?? 'processing'
        const jobProgress = clampProgress(data?.progress ?? data?.job?.progress)
        const jobProcessed = data?.processedResults ?? data?.job?.processedResults ?? 0
        const jobTarget = data?.targetResults ?? data?.job?.targetResults ?? 0

        setStatus(jobStatus)
        setProgress(jobProgress)
        setDisplayProgress((prev) => Math.max(prev, jobProgress))
        setProcessedResults(jobProcessed)
        setTargetResults(jobTarget)
        setRecovery(data?.recovery ?? null)

        const elapsedSeconds = Math.max(1, (Date.now() - startTimeRef.current) / 1000)
        if (jobProcessed > 0) {
          setProcessingSpeed(Math.round((jobProcessed / elapsedSeconds) * 60))
        }

        if (typeof onProgress === 'function') {
          onProgress({
            processedResults: jobProcessed,
            targetResults: jobTarget,
            progress: jobProgress,
            status: jobStatus
          })
        }

        if (platformNormalized.startsWith('instagram')) {
          const roundedProgress = Math.round(jobProgress)
          if (
            jobStatus !== lastLogRef.current.status ||
            roundedProgress !== Math.round(lastLogRef.current.progress) ||
            lastLogRef.current.creatorCount === 0
          ) {
            console.log('[INSTAGRAM-US][POLL] update', {
              jobId,
              status: jobStatus,
              progress: roundedProgress,
              processedResults: jobProcessed,
              targetResults: jobTarget,
              timestamp: new Date().toISOString(),
            })
            lastLogRef.current = {
              status: jobStatus,
              progress: jobProgress,
              creatorCount: lastCreatorCountRef.current,
            }
          }
        }

        const creators = flattenCreators(data?.results ?? data?.job?.results)
        if (creators.length) {
          if (creators.length !== lastCreatorCountRef.current) {
            setShowIntermediateResults(true)
            setIntermediateCreators(creators)
            lastCreatorCountRef.current = creators.length
            lastLogRef.current.creatorCount = creators.length
            if (platformNormalized.startsWith('instagram')) {
              console.log('[INSTAGRAM-US][POLL] creators received', {
                jobId,
                creatorCount: creators.length,
                processedResults: jobProcessed,
              })
            }
          }
          if (typeof onIntermediateResults === 'function') {
            onIntermediateResults({
              creators,
              progress: jobProgress,
              status: jobStatus,
              isPartial: jobStatus !== 'completed'
            })
          }
        }

        if (jobStatus === 'completed') {
          if (platformNormalized.startsWith('instagram')) {
            console.log('[INSTAGRAM-US][POLL] completed', {
              jobId,
              finalCount: jobProcessed || creators.length,
              timestamp: new Date().toISOString(),
            })
          }
          clearPollTimeout()
          setDisplayProgress(100)
          setProgress(100)
          setShowIntermediateResults(false)
          if (typeof onComplete === 'function') {
            onComplete({
              status: 'completed',
              creators,
              partialCompletion: Boolean(data?.partialCompletion),
              finalCount: jobProcessed || creators.length,
              errorRecovered: Boolean(data?.errorRecovered)
            })
          }
          return
        }

        const nextInterval = jobProgress < 70 ? 1500 : jobProgress < 95 ? 2000 : 3000
        schedule(nextInterval)
      } catch (fetchError) {
        if (timeoutId) clearTimeout(timeoutId)
        if (fetchError?.name === 'AbortError') {
          schedule(2000)
          return
        }
        generalRetryRef.current += 1
        setError('Network error while polling progress')
        if (generalRetryRef.current >= MAX_GENERAL_RETRIES) {
          clearPollTimeout()
          return
        }
        schedule(2500)
      }
    } catch (controllerError) {
      console.error('[SEARCH-PROGRESS] Unexpected polling error', controllerError)
      schedule(3000)
    }
  }, [
    authReady,
    clearPollTimeout,
    hasTargetUsername,
    jobId,
    loadCampaignSnapshot,
    onComplete,
    onIntermediateResults,
    onMeta,
    onProgress,
    platformNormalized
  ])

  useEffect(() => {
    startTimeRef.current = Date.now()
    lastCreatorCountRef.current = 0
    authRetryRef.current = 0
    generalRetryRef.current = 0
    lastLogRef.current = {
      status: '',
      progress: 0,
      creatorCount: 0,
    }

    setStatus('processing')
    setProgress(0)
    setDisplayProgress(0)
    setProcessedResults(0)
    setTargetResults(0)
    setProcessingSpeed(0)
    setRecovery(null)
    setError(null)
    setShowIntermediateResults(false)
    setIntermediateCreators([])

    if (jobId) {
      poll()
    }

    return () => clearPollTimeout()
  }, [jobId, poll, clearPollTimeout])

  const handleRetry = () => {
    setError(null)
    generalRetryRef.current = 0
    authRetryRef.current = 0
    poll()
  }

  const handleBackToDashboard = () => {
    router.push('/')
  }

  const estimatedTime = useMemo(() => {
    if (displayProgress <= 0 || displayProgress >= 100) return ''
    const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000
    if (elapsedSeconds <= 0) return ''
    const totalEstimate = (elapsedSeconds / displayProgress) * 100
    const remaining = Math.max(0, totalEstimate - elapsedSeconds)
    if (remaining < 60) return 'Less than a minute remaining'
    const minutes = Math.round(remaining / 60)
    return `About ${minutes} minute${minutes === 1 ? '' : 's'} remaining`
  }, [displayProgress])

  const progressStage = useMemo(
    () =>
      computeStage({
        status,
        displayProgress,
        processedResults,
        targetResults,
        platformNormalized,
        hasTargetUsername,
        primaryKeyword
      }),
    [
      displayProgress,
      hasTargetUsername,
      platformNormalized,
      primaryKeyword,
      processedResults,
      status,
      targetResults
    ]
  )

  const statusTitle = status === 'completed'
    ? 'Campaign completed'
    : status === 'timeout'
      ? 'Campaign timed out'
      : error
        ? 'Connection issue'
        : 'Processing search'

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="space-y-8 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          {status === 'completed' ? (
            <CheckCircle2 className="h-6 w-6 text-primary" />
          ) : status === 'timeout' ? (
            <AlertCircle className="h-6 w-6 text-amber-500" />
          ) : error ? (
            <RefreshCcw className="h-6 w-6 text-zinc-200" />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          )}

          <h2 className="text-xl font-medium text-zinc-100 mt-2">{statusTitle}</h2>

          {error ? (
            <p className="text-sm text-zinc-400">
              {error}
            </p>
          ) : recovery ? (
            <p className="text-sm text-zinc-400">{recovery}</p>
          ) : estimatedTime ? (
            <p className="text-sm text-zinc-400">{estimatedTime}</p>
          ) : null}
        </div>

        <div className="w-full space-y-3">
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-300" />
                <span className="text-sm font-medium text-zinc-100">{progressStage}</span>
              </div>
              {processedResults > 0 && (
                <span className="text-sm font-medium text-zinc-200 bg-zinc-800/60 border border-zinc-700/50 px-2 py-1 rounded">
                  {targetResults ? `${processedResults}/${targetResults}` : `${processedResults}`} creators
                </span>
              )}
            </div>

            <Progress value={displayProgress} className="h-2" />

            <div className="mt-3 flex justify-between text-xs text-zinc-400">
              <span>{Math.round(displayProgress)}%</span>
              {processingSpeed > 0 && <span>{processingSpeed} creators/min</span>}
            </div>
          </div>
        </div>

        {showIntermediateResults && intermediateCreators.length > 0 && (
          <IntermediateList creators={intermediateCreators} status={status} />
        )}

        {error ? (
          <Button variant="ghost" className="w-full" onClick={handleRetry}>
            Retry polling
          </Button>
        ) : null}

        <Button variant="outline" onClick={handleBackToDashboard} className="w-full">
          Return to Dashboard
        </Button>
      </div>
    </div>
  )
}
