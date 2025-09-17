"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw } from 'lucide-react';
import { AddToListButton } from '@/components/lists/add-to-list-button';

const SearchResults = () => {
  const [searchData, setSearchData] = useState({
    jobId: '',
    scraperLimit: '',
    keywords: ''
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    return results.map((result, index) => {
      const creator = result;
      const platform = creator.platform || creator.source || 'tiktok';
      const externalId = creator.id || creator.externalId || creator.uniqueId || `creator-${index}`;
      const handle = creator.username || creator.uniqueId || creator.handle || `creator-${index}`;
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
        raw: creator,
      };
    });
  }, [results]);

  const handleRefresh = () => {
    setSearchData({ jobId: '', scraperLimit: '', keywords: '' });
    setResults([]);
    setLoading(true);
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

  if (creators.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-10 text-center text-sm text-zinc-400">
        No creators found yet. Run a new search to populate this view.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {creators.map((creator) => (
        <Card key={creator.id} className="bg-zinc-900/80 border border-zinc-700/50">
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-12 w-12">
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt={creator.handle} className="h-full w-full object-cover" />
              ) : (
                <AvatarFallback className="bg-zinc-800 text-zinc-200">
                  {creator.handle.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base text-zinc-100">{creator.handle}</CardTitle>
              {creator.displayName && <p className="text-sm text-zinc-400">{creator.displayName}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <Badge className="bg-zinc-800/70 border border-zinc-700/60">{creator.platform.toUpperCase()}</Badge>
                {creator.followers ? <span>{formatFollowers(creator.followers)} followers</span> : null}
                {creator.engagementRate ? <span>{creator.engagementRate}% ER</span> : null}
              </div>
            </div>
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
            />
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            {creator.bio || 'No bio available'}
          </CardContent>
        </Card>
      ))}
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