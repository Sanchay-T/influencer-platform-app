import { PlatformResult } from '@/lib/db/schema'

export interface ScrapingResult {
  id: string
  createdAt: Date
  jobId: string | null
  creators: PlatformResult
}

export interface ScrapingJob {
  id: string
  userId: string
  runId: string | null
  status: string
  keywords: string[] | null
  targetUsername: string | null
  searchParams: unknown
  platform: string
  region: string
  startedAt: Date | null
  completedAt: Date | null
  error: string | null
  timeoutAt: Date | null
  campaignId: string | null
  createdAt: Date
  results: ScrapingResult[]
  scraperLimit: number | null
  progress?: number
  // Added for sidebar creator counts
  processedResults?: number | null
  targetResults?: number | null
}

export interface Campaign {
  id: string
  userId: string
  name: string
  description: string | null
  searchType: string
  status: string
  createdAt: Date
  updatedAt: Date
  scrapingJobs: ScrapingJob[]
}
