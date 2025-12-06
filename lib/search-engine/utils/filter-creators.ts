export const MIN_LIKES_THRESHOLD = Number(process.env.MIN_LIKES_THRESHOLD ?? process.env.NEXT_PUBLIC_MIN_LIKES_THRESHOLD ?? 100);
export const MIN_VIEWS_THRESHOLD = 1000;

function extractLikes(creator: any): number | null {
  const paths = [
    creator?.video?.statistics?.likes,
    creator?.video?.likes,
    creator?.statistics?.likes,
    creator?.like_count,
    creator?.likes,
  ];
  for (const val of paths) {
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
  }
  return null;
}

function extractViews(creator: any): number | null {
  const paths = [
    creator?.video?.statistics?.views,
    creator?.video?.views,
    creator?.video?.video_view_count,
    creator?.statistics?.views,
    creator?.video_view_count,
    creator?.views,
    creator?.view_count,
  ];
  for (const val of paths) {
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
  }
  return null;
}

/**
 * Filters creators by minimum likes threshold.
 *
 * IMPORTANT: Creators with null/unknown likes are KEPT by default (includeNullLikes=true)
 * to avoid filtering out Instagram creators that may not have likes data populated.
 * Only creators with known likes below the threshold are filtered out.
 *
 * Set includeNullLikes=false for stricter filtering where you want to exclude
 * creators without likes data.
 */
export function filterCreatorsByLikes<T extends Record<string, any>>(
  creators: T[],
  minLikes: number = MIN_LIKES_THRESHOLD,
  includeNullLikes: boolean = true,
): T[] {
  return creators.filter((c) => {
    const likes = extractLikes(c);
    // If likes is null/unknown, include based on flag (default: keep them)
    if (likes === null) return includeNullLikes;
    // Only filter out creators with KNOWN likes below threshold
    return likes >= minLikes;
  });
}

/**
 * Filters creators by minimum views threshold.
 * Same logic as filterCreatorsByLikes but for video views.
 */
export function filterCreatorsByViews<T extends Record<string, any>>(
  creators: T[],
  minViews: number = MIN_VIEWS_THRESHOLD,
  includeNullViews: boolean = true,
): T[] {
  return creators.filter((c) => {
    const views = extractViews(c);
    if (views === null) return includeNullViews;
    return views >= minViews;
  });
}

/** Export extractors for frontend use */
export { extractLikes, extractViews };
