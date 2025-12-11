// [SearchProgressHelpers] Shared utilities for the keyword search progress UI

export const MAX_AUTH_RETRIES = 6
export const MAX_GENERAL_RETRIES = 4

// [ResultShape] Normalises API payloads so downstream consumers always see an array of creators
export function flattenCreators(results: any) {
  if (!results) return [] as any[]
  const items = Array.isArray(results) ? results : [results]
  const creators: any[] = []
  // Breadcrumb: dedupe across multi-handle batches so progress metrics avoid double counting creators.
  const seen = new Set<string>()

  const resolveCreatorKey = (creator: any): string | null => {
    if (!creator || typeof creator !== 'object') return null
    const candidateList: Array<unknown> = [
      (creator as any).username,
      (creator as any).handle,
      (creator as any).id,
      (creator as any).profileId,
      (creator as any).externalId,
      (creator.creator as any)?.username,
      (creator.creator as any)?.uniqueId,
      (creator.creator as any)?.handle,
      (creator.metadata as any)?.username,
      (creator.metadata as any)?.handle,
    ]

    for (const candidate of candidateList) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim().toLowerCase()
      }
    }

    return null
  }

  for (const item of items) {
    if (!item) continue
    const list = Array.isArray(item.creators) ? item.creators : []
    for (const creator of list) {
      if (!creator) continue
      const key = resolveCreatorKey(creator)
      if (key) {
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
      }
      creators.push(creator)
    }
  }
  return creators
}

// [EndpointDerivation] Mirrors scraping API routing rules used throughout keyword search flows
export function buildEndpoint(platformNormalized: string, hasTargetUsername: boolean, jobId: string | undefined | null) {
  if (!jobId) return null
  const normalized = (platformNormalized || '').toLowerCase()

  // Handle v2 similar discovery platforms (Influencers Club Discovery API)
  if (normalized.startsWith('similar_discovery_')) {
    return `/api/scraping/similar-discovery?jobId=${jobId}`
  }

  if (hasTargetUsername) {
    // All similar searches now route to v2 similar-discovery endpoint (Influencers Club Discovery API)
    if (normalized === 'instagram') return `/api/scraping/similar-discovery?jobId=${jobId}`
    if (normalized === 'youtube') return `/api/scraping/similar-discovery?jobId=${jobId}`
    if (normalized === 'tiktok') return `/api/scraping/similar-discovery?jobId=${jobId}`
    return null
  }
  switch (normalized) {
    case 'instagram':
    case 'instagram-1.0':
    case 'instagram_1.0':
    case 'instagram_us_reels':
      return `/api/scraping/instagram-us-reels?jobId=${jobId}`
    case 'instagram_scrapecreators':
      return `/api/scraping/instagram-scrapecreators?jobId=${jobId}`
    case 'instagram-2.0':
    case 'instagram_2.0':
    case 'instagram-v2':
    case 'instagram_v2':
      return `/api/scraping/instagram-v2?jobId=${jobId}`
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

  // Handle similar_discovery platforms (v2)
  if (platformNormalized.startsWith('similar_discovery_')) {
    const targetPlatform = platformNormalized.replace('similar_discovery_', '')
    const platformLabel = targetPlatform === 'tiktok' ? 'TikTok' : targetPlatform === 'youtube' ? 'YouTube' : 'Instagram'
    if (percent < 30) return `Searching ${platformLabel} creator network`
    if (percent < 60) return 'Analysing engagement patterns'
    if (percent < 85) return 'Scoring profile relevance'
    return `Packaging ${platformLabel} similar creators`
  }

  switch (platformNormalized) {
    case 'instagram_scrapecreators':
      if (percent < 25) return `Running ScrapeCreators reels search for ${keyword}`
      if (percent < 65) return 'Filtering posts with 100+ likes'
      return 'Packaging Instagram reels table'
    case 'google-serp':
    case 'google_serp':
      if (percent < 25) return `Running Google SERP discovery for ${keyword}`
      if (percent < 65) return 'Enriching Instagram profiles from ScrapeCreators'
      return 'Packaging Google SERP creator list'
    case 'instagram':
    case 'instagram-1.0':
    case 'instagram_1.0':
    case 'instagram_us_reels':
      if (percent < 20) return `Expanding US-focused Instagram keywords for ${keyword}`
      if (percent < 50) return 'Harvesting and vetting US creator handles'
      if (percent < 80) return 'Screening profiles for US indicators'
      return 'Scoring Instagram reels for relevance'
    case 'instagram-2.0':
    case 'instagram_2.0':
    case 'instagram-v2':
    case 'instagram_v2':
      if (percent < 20) return `Running Influencers Club discovery for ${keyword}`
      if (percent < 55) return 'Scoring reels with transcript and caption matches'
      if (percent < 85) return 'Expanding to US creator reels'
      return 'Finalising Instagram 2.0 feed'
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
