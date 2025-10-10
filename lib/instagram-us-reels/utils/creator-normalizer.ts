import type { ProfileSummary, ScoredReel } from '@/lib/instagram-us-reels/types';
import type { NormalizedCreator } from '@/lib/search-engine/types';

export const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const DEFAULT_PER_CREATOR_LIMIT = Math.max(
  1,
  Number(process.env.US_REELS_REELS_PER_CREATOR ?? 3) || 3,
);

export interface CreatorAggregate {
  id: string;
  owner: ProfileSummary;
  reels: ScoredReel[];
}

export function perCreatorLimit(): number {
  return DEFAULT_PER_CREATOR_LIMIT;
}

export function firstString(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

export function collectEmails(candidateSources: Array<unknown>): string[] {
  const emails = new Set<string>();

  for (const source of candidateSources) {
    if (!source) continue;
    if (typeof source === 'string') {
      const matches = source.match(EMAIL_REGEX);
      if (matches) {
        matches.forEach((match) => emails.add(match.toLowerCase()));
      }
    }
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (typeof entry === 'string') {
          const matches = entry.match(EMAIL_REGEX);
          if (matches) {
            matches.forEach((match) => emails.add(match.toLowerCase()));
          }
        }
      });
    }
  }

  return Array.from(emails);
}

export function aggregateReels(reels: ScoredReel[]): CreatorAggregate[] {
  const grouped = new Map<string, CreatorAggregate>();
  const limit = perCreatorLimit();

  for (const reel of reels) {
    const owner = reel.owner;
    const keyCandidate = owner.userId || owner.handle;
    if (!keyCandidate) continue;
    const key = String(keyCandidate);
    if (!key) continue;

    const existing = grouped.get(key);
    if (existing) {
      if (existing.reels.length < limit) {
        existing.reels.push(reel);
      }
      continue;
    }

    grouped.set(key, {
      id: key,
      owner,
      reels: [reel],
    });
  }

  return Array.from(grouped.values());
}

export function normalizeAggregate(entry: CreatorAggregate, keyword: string): NormalizedCreator {
  const { owner, reels, id } = entry;
  const rawOwner = owner.raw || {};
  const matchedReels = [...reels].sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
  );
  const topReel = matchedReels[0];
  if (!topReel) {
    throw new Error('normalizeAggregate received entry with no reels');
  }

  const avatarUrl =
    firstString([
      rawOwner.profile_pic_url_hd,
      rawOwner.profile_pic_url,
      rawOwner.profile_picture_url,
    ]) ?? null;

  const profileUrl = owner.handle
    ? `https://www.instagram.com/${owner.handle}/`
    : typeof rawOwner.profile_url === 'string'
      ? rawOwner.profile_url
      : null;

  const primaryEmailCandidates = [
    rawOwner.business_email,
    rawOwner.public_email,
    rawOwner.publicEmail,
    rawOwner.email,
  ];

  const linkEmails = Array.isArray(rawOwner.bio_links)
    ? rawOwner.bio_links.map((link: any) => link?.url ?? link?.lynx_url)
    : [];

  const biography = typeof rawOwner.biography === 'string' ? rawOwner.biography : undefined;
  const emails = collectEmails([...primaryEmailCandidates, biography ?? '', ...linkEmails]);

  const matchedTerms = Array.isArray((topReel as any).matchedTerms)
    ? (topReel as any).matchedTerms
    : [];

  const collectSnippet = (reel: ScoredReel) => {
    const text = `${reel.caption ?? ''}\n${reel.transcript ?? ''}`.toLowerCase();
    for (const term of matchedTerms) {
      const index = text.indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 60);
        const end = Math.min(text.length, index + term.length + 60);
        return text.slice(start, end).trim();
      }
    }
    return null;
  };

  const additionalReels = matchedReels.slice(1).map((reel) => ({
    id: reel.id,
    shortcode: reel.shortcode,
    url: reel.url,
    relevanceScore: reel.relevanceScore,
    usConfidence: reel.usConfidence,
    caption: reel.caption,
    viewCount: reel.viewCount,
    takenAt: reel.takenAt,
    matchedTerms: Array.isArray((reel as any).matchedTerms) ? (reel as any).matchedTerms : [],
    transcript: reel.transcript ?? null,
    thumbnail: reel.thumbnail ?? null,
    snippet: collectSnippet(reel),
  }));

  return {
    id,
    platform: 'instagram_us_reels',
    runner: 'instagram_us_reels',
    sourcePlatform: 'instagram',
    keyword,
    handle: owner.handle,
    profileUrl,
    profile_url: profileUrl,
    creator: {
      platform: 'instagram',
      name: owner.fullName || owner.handle,
      username: owner.handle,
      uniqueId: owner.userId,
      followers: owner.followerCount,
      followerCount: owner.followerCount,
      verified: Boolean((owner.raw as any)?.is_verified),
      avatarUrl,
      profilePicUrl: avatarUrl,
      profile_pic_url: avatarUrl,
      profile_url: profileUrl,
      bio: biography ?? null,
      emails,
      countryConfidence: owner.countryConfidence,
      locationHints: owner.locationHints,
      isLikelyUS: owner.isLikelyUS,
    },
    stats: {
      followerCount: owner.followerCount,
      usConfidence: topReel.usConfidence,
      relevanceScore: topReel.relevanceScore,
    },
    locationHints: owner.locationHints,
    video: {
      id: topReel.id,
      shortcode: topReel.shortcode,
      url: topReel.url,
      description: topReel.caption ?? '',
      caption: topReel.caption ?? '',
      takenAt: topReel.takenAt,
      statistics: {
        views: topReel.viewCount ?? null,
        likes: topReel.likeCount ?? null,
      },
      transcript: topReel.transcript ?? null,
      thumbnail: topReel.thumbnail ?? null,
      matchedTerms,
    },
    metadata: {
      pipeline: 'instagram_us_reels',
      keyword,
      relevanceScore: topReel.relevanceScore,
      usConfidence: topReel.usConfidence,
      locationHints: owner.locationHints,
      matchedTerms,
      transcript: topReel.transcript ?? null,
      snippet: collectSnippet(topReel),
      topReels: [
        {
          id: topReel.id,
          shortcode: topReel.shortcode,
          url: topReel.url,
          relevanceScore: topReel.relevanceScore,
          usConfidence: topReel.usConfidence,
          caption: topReel.caption,
          viewCount: topReel.viewCount,
          takenAt: topReel.takenAt,
          thumbnail: topReel.thumbnail ?? null,
          matchedTerms,
        },
        ...additionalReels,
      ],
    },
  };
}
