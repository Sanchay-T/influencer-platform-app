// [SearchProgressHelpers] Shared utilities for the keyword search progress UI

export const MAX_AUTH_RETRIES = 6
export const MAX_GENERAL_RETRIES = 4

// [ResultShape] Normalises API payloads so downstream consumers always see an array of creators
export function flattenCreators(results: any) {
  if (!results) return [] as any[]
  const items = Array.isArray(results) ? results : [results]
  const creators: any[] = []
  for (const item of items) {
    if (!item) continue
    const list = Array.isArray(item.creators) ? item.creators : []
    creators.push(...list)
  }
  return creators
}

// [EndpointDerivation] Mirrors scraping API routing rules used throughout keyword search flows
export function buildEndpoint(platformNormalized: string, hasTargetUsername: boolean, jobId: string | undefined | null) {
  if (!jobId) return null
  const normalized = (platformNormalized || '').toLowerCase()
  if (hasTargetUsername) {
    if (normalized === 'instagram') return `/api/scraping/instagram?jobId=${jobId}`
    if (normalized === 'youtube') return `/api/scraping/youtube-similar?jobId=${jobId}`
    // TikTok Similar removed - not supported
    return null
  }
  switch (normalized) {
    case 'instagram':
      return `/api/scraping/instagram-reels?jobId=${jobId}`
    case 'instagram-1.0':
    case 'instagram_1.0':
    case 'instagram_us_reels':
      return `/api/scraping/instagram-us-reels?jobId=${jobId}`
    case 'enhanced-instagram':
      return `/api/scraping/instagram-enhanced?jobId=${jobId}`
    case 'google-serp':
    case 'google_serp':
      return `/api/scraping/google-serp?jobId=${jobId}`
    case 'youtube':
      return `/api/scraping/youtube?jobId=${jobId}`
    default:
      return `/api/scraping/tiktok?jobId=${jobId}`
  }
}

export function clampProgress(value: any) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(100, Math.max(0, numeric))
}

// [StageMessaging] Keeps UX copy in one place so SearchResults can rely on consistent messaging
export function computeStage({
  status,
  displayProgress,
  processedResults,
  targetResults,
  platformNormalized,
  hasTargetUsername,
  primaryKeyword
}: {
  status: string
  displayProgress: number
  processedResults: number
  targetResults: number
  platformNormalized: string
  hasTargetUsername: boolean
  primaryKeyword?: string | null
}) {
  if (status === 'pending') return 'Preparing search'
  if (status === 'timeout') return 'Search timed out'
  if (status === 'error') return 'Encountered temporary errors'
  if (status === 'completed') {
    if (targetResults) {
      const matched = processedResults === targetResults
      return matched
        ? `Delivered ${processedResults}/${targetResults} creators`
        : `Finalised ${processedResults} of ${targetResults} requested`
    }
    return `Delivered ${processedResults} creators`
  }

  const percent = Math.round(displayProgress)
  const keyword = primaryKeyword || 'your query'

  if (hasTargetUsername) {
    if (percent < 35) return `Finding creators similar to ${keyword}`
    if (percent < 70) return 'Analysing profile graph'
    return 'Finalising similar creator list'
  }

  switch (platformNormalized) {
    case 'enhanced-instagram':
      if (percent < 20) return 'Generating strategic Instagram keyword clusters'
      if (percent < 55) return 'Processing Instagram reels and bios'
      if (percent < 85) return 'Extracting contact details'
      return 'Deduplicating Instagram creators'
    case 'google-serp':
    case 'google_serp':
      if (percent < 25) return `Running Google SERP discovery for ${keyword}`
      if (percent < 65) return 'Enriching Instagram profiles from ScrapeCreators'
      return 'Packaging Google SERP creator list'
    case 'instagram':
      if (percent < 20) return `Searching Instagram reels for ${keyword}`
      if (percent < 60) return 'Enhancing creator profiles'
      return 'Compiling Instagram results'
    case 'instagram-1.0':
    case 'instagram_1.0':
    case 'instagram_us_reels':
      if (percent < 20) return `Expanding US-focused Instagram keywords for ${keyword}`
      if (percent < 50) return 'Harvesting and vetting US creator handles'
      if (percent < 80) return 'Screening profiles for US indicators'
      return 'Scoring Instagram reels for relevance'
    case 'youtube':
      if (percent < 30) return `Scanning YouTube for ${keyword}`
      if (percent < 70) return 'Collecting channel analytics'
      return 'Packaging YouTube creator insights'
    default:
      if (percent < 15) return `Searching TikTok for ${keyword}`
      if (percent < 55) return 'Fetching TikTok creator profiles'
      if (percent < 85) return 'Extracting emails and engagement data'
      return 'Preparing TikTok export'
  }
}
