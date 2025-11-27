export const MIN_LIKES_THRESHOLD = Number(process.env.MIN_LIKES_THRESHOLD ?? process.env.NEXT_PUBLIC_MIN_LIKES_THRESHOLD ?? 100);

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

export function filterCreatorsByLikes<T extends Record<string, any>>(
  creators: T[],
  minLikes: number = MIN_LIKES_THRESHOLD,
): T[] {
  return creators.filter((c) => {
    const likes = extractLikes(c);
    return likes !== null && likes >= minLikes;
  });
}
