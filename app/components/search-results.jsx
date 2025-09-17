"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddToListButton } from '@/components/lists/add-to-list-button';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCcw, LayoutList, LayoutGrid, Table2, MailCheck, ExternalLink } from 'lucide-react';

const VIEW_MODES = ['table', 'list', 'gallery'];
const VIEW_MODE_META = {
  table: { label: 'Table', Icon: Table2 },
  list: { label: 'List', Icon: LayoutList },
  gallery: { label: 'Gallery', Icon: LayoutGrid },
};

const dedupeCreators = (creators = []) => {
  const seen = new Set();
  const unique = [];

  for (const creator of creators) {
    if (!creator) continue;

    const keyCandidates = [
      creator.id,
      creator.externalId,
      creator.uniqueId,
      creator.username,
      creator.profileUrl,
      creator.url,
      creator.handle,
    ];

    const key = keyCandidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    const normalizedKey = key ? key.trim().toLowerCase() : JSON.stringify(keyCandidates);

    if (seen.has(normalizedKey)) continue;

    seen.add(normalizedKey);
    unique.push(creator);
  }

  return unique;
};

const extractEmails = (creator) => {
  if (!creator) return [];

  const collected = new Set();
  const candidateLists = [creator.emails, creator.contactEmails, creator.creator?.emails];

  for (const maybeList of candidateLists) {
    if (Array.isArray(maybeList)) {
      for (const email of maybeList) {
        if (typeof email === 'string' && email.trim().length > 0) {
          collected.add(email.trim());
        }
      }
    }
  }

  const fallbackCandidates = [
    creator.email,
    creator.contactEmail,
    creator.creator?.email,
    creator.businessEmail,
  ];

  for (const email of fallbackCandidates) {
    if (typeof email === 'string' && email.trim().length > 0) {
      collected.add(email.trim());
    }
  }

  return Array.from(collected);
};

const resolveMediaPreview = (creator) => {
  if (!creator) return null;

  const video = creator.video || creator.latestVideo || creator.content;
  const sources = [
    video?.cover,
    video?.coverUrl,
    video?.thumbnail,
    video?.thumbnailUrl,
    video?.thumbnail_url,
    video?.image,
    creator?.thumbnailUrl,
    creator?.thumbnail,
    creator?.avatarUrl,
  ];

  for (const source of sources) {
    if (typeof source === 'string' && source.trim().length > 0) {
      return source;
    }
  }

  return null;
};

const hasContactEmail = (creator) => Array.isArray(creator?.emails) && creator.emails.length > 0;

const SearchResults = () => {
  const [searchData, setSearchData] = useState({
    jobId: '',
    scraperLimit: '',
    keywords: ''
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [showEmailOnly, setShowEmailOnly] = useState(false);

  useEffect(() => {
    console.log('=== INICIO DE BÚSQUEDA ===');
    console.log('Datos iniciales:', {
      jobId: searchData.jobId,
      scraperLimit: searchData.scraperLimit,
      keywords: searchData.keywords
    });

    if (!searchData.jobId) {
      console.log('No hay jobId, iniciando búsqueda...');
      startSearch();
      return;
    }

    console.log('Iniciando polling con jobId:', searchData.jobId);
    pollResults();
  }, [searchData.jobId]);

  const pollResults = async () => {
    try {
      console.log('=== POLLING API ===');
      console.log('Consultando jobId:', searchData.jobId);
      
      const response = await fetch(`/api/scraping/tiktok?jobId=${searchData.jobId}`);
      const data = await response.json();
      
      console.log('Respuesta de API:', {
        status: data.status,
        totalRequested: data.totalRequested,
        totalReceived: data.totalReceived,
        resultsLength: data.results?.length
      });

      if (data.status === 'completed') {
        console.log('Búsqueda completada:', {
          totalRequested: data.totalRequested,
          totalReceived: data.totalReceived,
          resultsLength: data.results?.length
        });
        const allCreators = data.results?.reduce((acc, result) => {
          return [...acc, ...(result.creators || [])];
        }, []) || [];
        setResults(allCreators);
        setLoading(false);
      } else if (data.status === 'error') {
        console.error('Error en la búsqueda:', data.error);
        setError(data.error);
        setLoading(false);
      } else {
        console.log('Búsqueda en progreso:', data.status);
        setTimeout(pollResults, 30000);
      }
    } catch (error) {
      console.error('Error en polling:', error);
      setError('Error al obtener resultados');
      setLoading(false);
    }
  };

  const startSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/scraping/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: searchData.keywords,
          limit: Number(searchData.scraperLimit) || 50,
        }),
      });
      const data = await response.json();
      if (data.jobId) {
        setSearchData((prev) => ({ ...prev, jobId: data.jobId }));
      } else if (data.results) {
        setResults(data.results);
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error starting search', err);
      setError('Unable to start search');
      setLoading(false);
    }
  };

  const creators = useMemo(() => {
    const deduped = dedupeCreators(results);

    return deduped.map((result, index) => {
      const creator = result;
      const platform = creator.platform || creator.source || 'tiktok';
      const externalId = creator.id || creator.externalId || creator.uniqueId || `creator-${index}`;
      const handle = creator.username || creator.uniqueId || creator.handle || `creator-${index}`;
      const emails = extractEmails(creator);
      const mediaPreview = resolveMediaPreview(creator);

      return {
        id: `${platform}-${externalId}`,
        externalId,
        platform,
        handle,
        displayName: creator.displayName || creator.nickname || null,
        avatarUrl: creator.avatarUrl || creator.avatar || creator.thumbnailUrl || null,
        followers: creator.followers || creator.followersCount || creator.stats?.followerCount || null,
        engagementRate: creator.engagementRate || creator.stats?.engagementRate || null,
        category: creator.category || creator.niche || null,
        url: creator.profileUrl || creator.url || creator.link,
        bio: creator.bio || creator.signature || creator.description || '',
        emails,
        preview: mediaPreview,
        raw: creator,
      };
    });
  }, [results]);

  const filteredCreators = useMemo(() => {
    if (!showEmailOnly) return creators;
    return creators.filter((creator) => hasContactEmail(creator));
  }, [creators, showEmailOnly]);

  const totalResults = filteredCreators.length;

  const handleRefresh = () => {
    setSearchData({ jobId: '', scraperLimit: '', keywords: '' });
    setResults([]);
    setLoading(true);
    setShowEmailOnly(false);
    setViewMode('table');
    startSearch();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-3 text-sm">Fetching creators…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
        <p>{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  const subtitle = showEmailOnly
    ? `${totalResults} creator${totalResults === 1 ? '' : 's'} with contact emails (of ${creators.length} total)`
    : `${totalResults} creator${totalResults === 1 ? '' : 's'} found`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Search results</h2>
          <p className="text-sm text-zinc-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-1">
            {VIEW_MODES.map((mode) => {
              const meta = VIEW_MODE_META[mode];
              const Icon = meta?.Icon ?? Table2;
              const isActive = viewMode === mode;
              return (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'ghost'}
                  className={cn('gap-2', !isActive && 'text-zinc-400 hover:text-zinc-100')}
                  onClick={() => setViewMode(mode)}
                  aria-pressed={isActive}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{meta?.label ?? mode}</span>
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            variant={showEmailOnly ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setShowEmailOnly((prev) => !prev)}
            aria-pressed={showEmailOnly}
          >
            <MailCheck className="h-4 w-4" />
            Email only
          </Button>
          <Separator orientation="vertical" className="hidden h-6 md:block" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-zinc-300 hover:text-pink-300"
            onClick={handleRefresh}
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {totalResults === 0 ? (
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-10 text-center text-sm text-zinc-400">
          {showEmailOnly ? (
            <>
              <p>No creators include a visible contact email.</p>
              <p className="mt-2 text-xs text-zinc-500">Try disabling the email filter or rerun your search.</p>
            </>
          ) : (
            <p>No creators found yet. Run a new search to populate this view.</p>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'table' && (
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
              <Table className="min-w-full divide-y divide-zinc-800">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Creator
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Followers
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Email
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Bio
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Link
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Save
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreators.map((creator) => {
                    const emails = creator.emails || [];
                    const snapshot = {
                      platform: creator.platform,
                      externalId: creator.externalId,
                      handle: creator.handle,
                      displayName: creator.displayName,
                      avatarUrl: creator.avatarUrl,
                      url: creator.url,
                      followers: creator.followers,
                      engagementRate: creator.engagementRate,
                      category: creator.category,
                      metadata: creator.raw,
                    };

                    return (
                      <TableRow key={creator.id} className="border-b border-zinc-800/60">
                        <TableCell className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              {creator.avatarUrl ? (
                                <AvatarImage src={creator.avatarUrl} alt={creator.handle} />
                              ) : null}
                              <AvatarFallback className="bg-zinc-800 text-zinc-200">
                                {creator.handle.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-zinc-100">
                                {creator.displayName || creator.handle}
                              </p>
                              <p className="truncate text-xs text-zinc-500">@{creator.handle}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-[10px] uppercase text-zinc-300">
                                  {creator.platform.toUpperCase()}
                                </Badge>
                                {creator.engagementRate ? (
                                  <span className="text-[10px] text-zinc-500">{creator.engagementRate}% ER</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-zinc-200">
                          {creator.followers != null ? formatFollowers(creator.followers) : '—'}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm">
                          {emails.length ? (
                            <div className="space-y-1">
                              {emails.map((email) => (
                                <a
                                  key={email}
                                  href={`mailto:${email}`}
                                  className="block truncate text-pink-400 hover:text-pink-300 hover:underline"
                                >
                                  {email}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-500">No email</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-zinc-300">
                          <span className="line-clamp-3">{creator.bio || 'No bio available'}</span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm">
                          {creator.url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-pink-300 hover:text-pink-200"
                              asChild
                            >
                              <a href={creator.url} target="_blank" rel="noopener noreferrer">
                                Profile <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right">
                          <AddToListButton
                            creator={snapshot}
                            buttonLabel="Save"
                            variant="ghost"
                            size="sm"
                            className="text-zinc-300 hover:text-emerald-300"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-4">
              {filteredCreators.map((creator) => (
                <Card key={creator.id} className="border border-zinc-700/50 bg-zinc-900/70">
                  <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        {creator.avatarUrl ? (
                          <AvatarImage src={creator.avatarUrl} alt={creator.handle} />
                        ) : null}
                        <AvatarFallback className="bg-zinc-800 text-zinc-200">
                          {creator.handle.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="truncate text-base text-zinc-100">
                          {creator.displayName || creator.handle}
                        </CardTitle>
                        <p className="text-sm text-zinc-400">@{creator.handle}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                          <Badge className="bg-zinc-800/70 border border-zinc-700/60">
                            {creator.platform.toUpperCase()}
                          </Badge>
                          {creator.followers != null && (
                            <span>{formatFollowers(creator.followers)} followers</span>
                          )}
                          {creator.engagementRate && <span>{creator.engagementRate}% ER</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-pink-300 hover:text-pink-200"
                        asChild
                      >
                        <a href={creator.url ?? '#'} target="_blank" rel="noopener noreferrer">
                          View profile <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                      <AddToListButton
                        creator={{
                          platform: creator.platform,
                          externalId: creator.externalId,
                          handle: creator.handle,
                          displayName: creator.displayName,
                          avatarUrl: creator.avatarUrl,
                          url: creator.url,
                          followers: creator.followers,
                          engagementRate: creator.engagementRate,
                          category: creator.category,
                          metadata: creator.raw,
                        }}
                        buttonLabel="Save to list"
                        size="sm"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-zinc-300">
                    <p>{creator.bio || 'No bio available'}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                      {creator.emails?.length ? (
                        creator.emails.map((email) => (
                          <a
                            key={email}
                            href={`mailto:${email}`}
                            className="text-pink-400 hover:text-pink-300 hover:underline"
                          >
                            {email}
                          </a>
                        ))
                      ) : (
                        <span className="text-zinc-500">No email</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {viewMode === 'gallery' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCreators.map((creator) => {
                const preview = creator.preview || creator.avatarUrl;

                return (
                  <Card key={creator.id} className="overflow-hidden border border-zinc-800 bg-zinc-900/70">
                    <div className="relative aspect-video w-full overflow-hidden bg-zinc-800/60">
                      {preview ? (
                        <img
                          src={preview}
                          alt={creator.displayName || creator.handle}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                          No preview available
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-4 text-sm text-zinc-300">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-zinc-100">
                            {creator.displayName || creator.handle}
                          </p>
                          <p className="text-xs text-zinc-500">@{creator.handle}</p>
                        </div>
                        <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-xs text-zinc-300">
                          {creator.platform.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="line-clamp-3 text-xs text-zinc-400">
                        {creator.bio || 'No bio available'}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                        {creator.followers != null && (
                          <span>{formatFollowers(creator.followers)} followers</span>
                        )}
                        {creator.engagementRate && <span>{creator.engagementRate}% ER</span>}
                      </div>
                      <div className="space-y-1 text-xs text-zinc-400">
                        {creator.emails?.length ? (
                          creator.emails.slice(0, 2).map((email) => (
                            <a
                              key={email}
                              href={`mailto:${email}`}
                              className="block truncate text-pink-400 hover:text-pink-300 hover:underline"
                            >
                              {email}
                            </a>
                          ))
                        ) : (
                          <span className="text-zinc-500">No email</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <Button variant="ghost" size="sm" className="gap-1 text-zinc-300 hover:text-pink-300" asChild>
                          <a href={creator.url ?? '#'} target="_blank" rel="noopener noreferrer">
                            Profile <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                        <AddToListButton
                          creator={{
                            platform: creator.platform,
                            externalId: creator.externalId,
                            handle: creator.handle,
                            displayName: creator.displayName,
                            avatarUrl: creator.avatarUrl,
                            url: creator.url,
                            followers: creator.followers,
                            engagementRate: creator.engagementRate,
                            category: creator.category,
                            metadata: creator.raw,
                          }}
                          buttonLabel="Save"
                          size="sm"
                          variant="secondary"
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResults;

function formatFollowers(value) {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}