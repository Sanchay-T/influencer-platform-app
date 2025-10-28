import { structuredConsole } from '@/lib/logging/console-proxy';
import type { ProfileSummary, ReelMedia } from '../types';
import {
  getInstagramPost,
  getInstagramUserReelsSimple,
  type InstagramReelsParams,
} from '../clients/scrapecreators';

export interface ReelFetchOptions {
  amountPerProfile?: number;
  fetchDetails?: boolean;
  profilesLimit?: number;
  concurrency?: number;
}

let reelsFetcher = getInstagramUserReelsSimple;
let postFetcher = getInstagramPost;

export function setReelFetchers(
  fetcher: typeof getInstagramUserReelsSimple,
  postDetailFetcher: typeof getInstagramPost = getInstagramPost,
): void {
  reelsFetcher = fetcher;
  postFetcher = postDetailFetcher;
}

export async function fetchReelsForProfiles(
  profiles: ProfileSummary[],
  options: ReelFetchOptions = {},
): Promise<ReelMedia[]> {
  const amount = options.amountPerProfile ?? Number(process.env.US_REELS_AMOUNT ?? 10);
  const profilesLimit = options.profilesLimit ?? profiles.length;
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const fetchDetails = options.fetchDetails ?? true;

  const queue = profiles.slice(0, profilesLimit);
  const iterator = queue[Symbol.iterator]();

  const collected: ReelMedia[] = [];

  async function worker() {
    for (;;) {
      const next = iterator.next();
      if (next.done) break;
      const profile = next.value;
      try {
        const reels = await fetchReelsForProfile(profile, { amount, fetchDetails });
        collected.push(...reels);
      } catch (error) {
        structuredConsole.warn('[reel-fetch] failed', {
          handle: profile.handle,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return collected;
}

async function fetchReelsForProfile(
  profile: ProfileSummary,
  options: { amount: number; fetchDetails: boolean },
): Promise<ReelMedia[]> {
  const params: InstagramReelsParams = profile.userId
    ? { userId: profile.userId, amount: options.amount, trim: true }
    : { handle: profile.handle, amount: options.amount, trim: true };

const payload = await reelsFetcher(params);
const items = Array.isArray(payload) ? payload : payload?.items ?? [];

const reels: ReelMedia[] = items
  .map((entry: any) => normalizeSimpleReel(entry?.media ?? entry, profile))
  .filter((reel): reel is ReelMedia => Boolean(reel));

  if (options.fetchDetails) {
    await enrichWithPostDetails(reels);
  }

  return reels;
}

function normalizeSimpleReel(media: any, owner: ProfileSummary): ReelMedia | null {
  if (!media) return null;
  const id: string = media.pk ?? media.id ?? media.code;
  if (!id) return null;

  const shortcode: string =
    media.code ?? media.shortcode ?? media.id?.split('_')?.[0] ?? '';
  if (!shortcode) return null;

  const reelUrl = media.url ?? `https://www.instagram.com/reel/${shortcode}`;

  const captionText = extractCaption(media?.caption);

  return {
    id: String(id),
    shortcode,
    url: reelUrl,
    caption: captionText,
    takenAt: Number(media.taken_at ?? Date.now()),
    viewCount: media.play_count ?? media.view_count ?? media.ig_play_count,
    likeCount: media.like_count ?? undefined,
    owner,
  };
}

async function enrichWithPostDetails(reels: ReelMedia[]): Promise<void> {
  await Promise.all(
    reels.map(async (reel) => {
      try {
        const detail = await postFetcher(reel.url);
        const data = detail?.data?.xdt_shortcode_media ?? detail?.data ?? detail;

  if (!data) return;

  const captionNode = extractCaption(data.caption) ?? data.edge_media_to_caption?.edges?.[0]?.node?.text;
        reel.caption =
          captionNode ??
          data.caption?.text ??
          reel.caption ??
          (Array.isArray(data.caption?.edges) ? data.caption.edges[0]?.node?.text : undefined);

        reel.viewCount =
          data.video_view_count ??
          data.video_play_count ??
          reel.viewCount;
        reel.likeCount = data.edge_media_preview_like?.count ?? data.like_count ?? reel.likeCount;
        reel.url = data.video_url ?? reel.url;
      } catch (error) {
        structuredConsole.warn('[reel-fetch] post detail fetch failed', {
          shortcode: reel.shortcode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}

function extractCaption(caption: any): string | undefined {
  if (!caption) return undefined;
  if (typeof caption === 'string') return caption;
  if (typeof caption?.text === 'string') return caption.text;
  if (Array.isArray(caption)) {
    for (const entry of caption) {
      const text = extractCaption(entry);
      if (text) return text;
    }
  }
  return undefined;
}
