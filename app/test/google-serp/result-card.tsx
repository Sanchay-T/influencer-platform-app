'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle2, Users, Globe, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface SerpCreatorResult {
  platform: string;
  creator: {
    username: string;
    name?: string;
    fullName?: string;
    followers?: number;
    following?: number;
    posts?: number;
    bio?: string;
    emails?: string[];
    profilePicUrl?: string;
    website?: string;
    verified?: boolean;
    category?: string;
  };
  source?: { serp?: { link?: string; position?: number; snippet?: string; title?: string; sourceType?: string }; fetchedAt?: string };
}

const formatNumber = (value?: number) => {
  if (!value) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

export function ResultCard({ result, index }: { result: SerpCreatorResult; index: number }) {
  const creator = result.creator ?? {};
  const serp = result.source?.serp ?? {};

  return (
    <Card className="border-border">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {creator.fullName || creator.name || creator.username}
            {creator.verified && <CheckCircle2 className="w-4 h-4 text-primary" />}
          </CardTitle>
          <Badge variant="outline" className="text-xs uppercase">#{index + 1}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>@{creator.username}</span>
          <span>•</span>
          <span>{formatNumber(creator.followers)} followers</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {creator.bio && <p className="text-muted-foreground leading-relaxed">{creator.bio}</p>}

        <div className="grid grid-cols-3 gap-3 bg-muted/40 rounded-md p-3 text-xs">
          <div>
            <p className="uppercase text-muted-foreground">Followers</p>
            <p className="font-semibold">{formatNumber(creator.followers)}</p>
          </div>
          <div>
            <p className="uppercase text-muted-foreground">Following</p>
            <p className="font-semibold">{formatNumber(creator.following)}</p>
          </div>
          <div>
            <p className="uppercase text-muted-foreground">Posts</p>
            <p className="font-semibold">{formatNumber(creator.posts)}</p>
          </div>
        </div>

        {creator.emails?.length ? (
          <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Emails</p>
            <p className="font-mono text-xs break-all">{creator.emails.join(', ')}</p>
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Serp snippet</p>
          <p className="text-muted-foreground">{serp.snippet || 'No snippet returned'}</p>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Globe className="w-3 h-3" />
            {creator.website ? (
              <Link href={creator.website} target="_blank" rel="noreferrer" className="underline">
                {creator.website.replace(/^https?:\/\//, '')}
              </Link>
            ) : (
              'No website'
            )}
          </span>
          {serp.link && (
            <Link href={serp.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary">
              View profile
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
