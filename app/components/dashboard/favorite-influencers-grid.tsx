'use client';

// Dashboard > FavoriteInfluencersGrid => consumed by app/dashboard/page.jsx

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { formatFollowerCount } from '@/lib/dashboard/formatters';
import { cn } from '@/lib/utils';
import { Instagram, Youtube, Music2, User, Star } from 'lucide-react';
import type { KeyboardEvent } from 'react';

export type FavoriteInfluencer = {
  id: string;
  displayName: string;
  handle?: string | null;
  category?: string | null;
  platform: string;
  followers?: number | null;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  listName?: string | null;
  pinned?: boolean;
};

type FavoriteInfluencersGridProps = {
  influencers: FavoriteInfluencer[];
  emptyMessage?: string;
};

const platformLookup: Record<string, { label: string; accent: string; icon: React.ComponentType<{ className?: string }>; }> = {
  instagram: {
    label: 'Instagram',
    accent: 'text-pink-300',
    icon: Instagram,
  },
  youtube: {
    label: 'YouTube',
    accent: 'text-red-400',
    icon: Youtube,
  },
  tiktok: {
    label: 'TikTok',
    accent: 'text-cyan-300',
    icon: Music2,
  },
};

function PlatformBadge({ platform }: { platform: string }) {
  const normalized = platform?.toLowerCase() ?? '';
  const config = platformLookup[normalized] ?? {
    label: platform || 'Unknown',
    accent: 'text-zinc-400',
    icon: User,
  };
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium text-zinc-400 min-w-0', config.accent)}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{config.label}</span>
    </span>
  );
}

function FavoriteInfluencerCard({ influencer }: { influencer: FavoriteInfluencer }) {
  const followerDisplay = formatFollowerCount(influencer.followers ?? undefined);
  const normalizedPlatform = influencer.platform?.toLowerCase() ?? '';
  const isPinned = Boolean(influencer.pinned);
  const profileUrl = resolveProfileUrl(influencer);
  const canNavigate = Boolean(profileUrl);

  const handleOpenProfile = () => {
    if (!profileUrl) return;
    window.open(profileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!profileUrl) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenProfile();
    }
  };

  return (
    <Card
      className={cn(
        'relative flex flex-col gap-2 rounded-2xl border border-zinc-700/40 bg-zinc-900/70 p-4 transition hover:border-zinc-600/60 hover:bg-zinc-900/90',
        canNavigate && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60'
      )}
      role={canNavigate ? 'button' : undefined}
      tabIndex={canNavigate ? 0 : undefined}
      onClick={canNavigate ? handleOpenProfile : undefined}
      onKeyDown={canNavigate ? handleKeyDown : undefined}
    >
      {isPinned && (
        <Star className="absolute right-3 top-3 h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
      )}
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 flex-shrink-0">
          {influencer.avatarUrl ? (
            <AvatarImage
              src={influencer.avatarUrl}
              alt={influencer.displayName}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : null}
          <AvatarFallback className="bg-zinc-800 text-sm text-zinc-300">
            {(influencer.displayName || influencer.handle || 'NA').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{influencer.displayName}</p>
            {influencer.handle ? (
              <span className="text-xs text-zinc-500 truncate">@{influencer.handle}</span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500 truncate">{influencer.category ?? 'General'}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-400 gap-2">
        <PlatformBadge platform={influencer.platform} />
        <span className="font-semibold text-zinc-200 flex-shrink-0">{followerDisplay}</span>
      </div>
      {influencer.listName ? (
        <p className="text-[11px] text-zinc-500 truncate">Saved in {influencer.listName}</p>
      ) : null}
      {canNavigate ? (
        <p className="text-[11px] text-pink-300">Open profile {"->"}</p>
      ) : (
        <p className="text-[11px] text-zinc-500">Profile link unavailable</p>
      )}
    </Card>
  );
}

export function FavoriteInfluencersGrid({ influencers, emptyMessage = 'No favorite creators saved yet. Star a list to pin its creators here.' }: FavoriteInfluencersGridProps) {
  if (!influencers.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {influencers.map((influencer) => (
        <FavoriteInfluencerCard key={influencer.id} influencer={influencer} />
      ))}
    </div>
  );
}

function resolveProfileUrl(influencer: FavoriteInfluencer): string | null {
  if (typeof influencer.profileUrl === 'string' && influencer.profileUrl.trim().length > 0) {
    return influencer.profileUrl.trim();
  }

  const normalizedHandle = influencer.handle?.replace(/^@/, '').trim();
  if (!normalizedHandle) {
    return null;
  }

  const platform = influencer.platform?.toLowerCase();
  switch (platform) {
    case 'tiktok':
      return `https://www.tiktok.com/@${normalizedHandle}`;
    case 'instagram':
      return `https://www.instagram.com/${normalizedHandle}`;
    case 'youtube':
      return `https://www.youtube.com/@${normalizedHandle}`;
    default:
      return null;
  }
}
