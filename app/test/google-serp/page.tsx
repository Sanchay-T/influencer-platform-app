'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Link as LinkIcon, Search } from 'lucide-react';
import Link from 'next/link';
import { ResultCard, SerpCreatorResult } from './result-card';

// breadcrumb ledger: surface -> /api/test/google-serp -> runSearchJob -> google-serp provider

interface ApiResponse {
  success: boolean;
  error?: string;
  query?: string;
  site?: string;
  maxResults?: number;
  location?: string;
  gl?: string;
  hl?: string;
  googleDomain?: string;
  creators?: SerpCreatorResult[];
  metrics?: {
    apiCalls: number;
    processedCreators: number;
    batches?: Array<{ index: number; size: number; durationMs: number }>;
    timings?: { totalDurationMs?: number };
  };
  serpMetrics?: {
    apiCalls?: number;
    serpResults?: number;
    enrichedCount?: number;
    durationMs?: number;
    errors?: string[];
    location?: string;
    googleDomain?: string;
    gl?: string;
    hl?: string;
  };
}

const QUERY_PRESETS: Array<{ label: string; query: string }> = [
  { label: 'Nutritionists', query: 'nutritionist instagram' },
  { label: 'Registered Dietitians', query: 'registered dietitian instagram' },
  { label: 'Meal Prep Coaches', query: 'meal prep coach instagram' },
  { label: 'Gut Health Experts', query: 'gut health expert instagram' },
];

function formatNumber(value?: number) {
  if (!value) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export default function GoogleSerpTestPage() {
  const [query, setQuery] = useState('coffee roasters instagram');
  const [site, setSite] = useState('instagram.com');
  const [location, setLocation] = useState('United States');
  const [gl, setGl] = useState('us');
  const [hl, setHl] = useState('en');
  const [maxResults, setMaxResults] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SerpCreatorResult[]>([]);
  const [meta, setMeta] = useState<{
    query?: string;
    site?: string;
    location?: string;
    gl?: string;
    hl?: string;
    googleDomain?: string;
    metrics?: ApiResponse['metrics'];
    serpMetrics?: ApiResponse['serpMetrics'];
  } | null>(null);

  const topUsernames = useMemo(() => {
    return results
      .map((result) => result?.creator?.username)
      .filter((username): username is string => Boolean(username))
      .slice(0, 10);
  }, [results]);

  const sanitizedKeyword = useMemo(() => {
    if (!query) return '';
    return query
      .replace(/site:\s*\S+/gi, '')
      .replace(/"/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, [query]);

  // breadcrumb ledger: Serp handles -> /test/instagram-reels?q=<keyword>&run=1 auto-launches reel feed page
  const reelsHref = useMemo(() => {
    if (!sanitizedKeyword) return null;
    const params = new URLSearchParams({ q: sanitizedKeyword, run: '1' });
    if (maxResults) {
      params.set('limit', String(maxResults));
    }
    return `/test/instagram-reels?${params.toString()}`;
  }, [maxResults, sanitizedKeyword]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setMeta(null);

    try {
      const response = await fetch('/api/test/google-serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, site, maxResults, location, gl, hl }),
      });

      const data: ApiResponse = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Request failed');
      }

      setResults(Array.isArray(data.creators) ? data.creators : []);
      setMeta({
        query: data.query,
        site: data.site,
        location: data.location,
        gl: data.gl,
        hl: data.hl,
        googleDomain: data.googleDomain,
        metrics: data.metrics,
        serpMetrics: data.serpMetrics,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (value: string) => {
    if (!site.trim()) {
      setSite('instagram.com');
    }
    setQuery(value);
  };

  // breadcrumb ledger: top handles -> clipboard -> manual import into reels keyword presets
  const handleCopyHandles = async () => {
    if (!navigator?.clipboard || topUsernames.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(topUsernames.join(', '));
      setError(null);
    } catch (copyError: any) {
      setError(copyError?.message ?? 'Failed to copy handles to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-5xl mx-auto px-4 space-y-8">
        <div className="space-y-3 text-center">
          <Badge variant="secondary" className="text-xs tracking-wide">SerpApi ✕ ScrapeCreators prototype</Badge>
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Search className="w-6 h-6 text-primary" />
            Google Serp → Instagram Profile Discovery
          </h1>
          <p className="text-muted-foreground text-sm">
            Input a Google query and we&apos;ll scope it to Instagram profiles via SerpApi, then enrich each handle with ScrapeCreators profile data.
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Search Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {QUERY_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="bg-muted/60 text-muted-foreground hover:text-foreground"
                    onClick={() => handlePresetSelect(preset.query)}
                    disabled={loading}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Google query</span>
                  <Textarea
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    rows={2}
                    placeholder="coffee roasters in seattle"
                    className="bg-input border-border focus-visible:ring-primary"
                    disabled={loading}
                  />
                </label>
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Site scope</span>
                      <Input
                        value={site}
                        onChange={(event) => setSite(event.target.value)}
                        placeholder="instagram.com"
                        className="bg-input border-border"
                        disabled={loading}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Geo location</span>
                      <Input
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="United States"
                        className="bg-input border-border"
                        disabled={loading}
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Max profiles</span>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={maxResults}
                        onChange={(event) => setMaxResults(Number(event.target.value) || 1)}
                        className="bg-input border-border"
                        disabled={loading}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">gl (country)</span>
                      <Input
                        value={gl}
                        onChange={(event) => setGl(event.target.value)}
                        placeholder="us"
                        className="bg-input border-border"
                        disabled={loading}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">hl (language)</span>
                      <Input
                        value={hl}
                        onChange={(event) => setHl(event.target.value)}
                        placeholder="en"
                        className="bg-input border-border"
                        disabled={loading}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full md:w-auto" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching…
                  </span>
                ) : (
                  'Run Serp Search'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {meta && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Search summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="grid gap-3 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Scoped query:</span>{' '}
                  {`site:${meta.site ?? 'instagram.com'} ${meta.query ?? ''}`.trim()}
                </p>
                <p>
                  <span className="font-medium text-foreground">Geo:</span> {meta.location ?? 'United States'} · gl=
                  {meta.gl ?? 'us'} · hl={meta.hl ?? 'en'}
                </p>
                {meta.googleDomain && (
                  <p>
                    <span className="font-medium text-foreground">Google domain:</span> {meta.googleDomain}
                  </p>
                )}
              </div>

              {topUsernames.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">Top Instagram handles</p>
                    <div className="flex items-center gap-2">
                      {reelsHref && (
                        <Link
                          href={reelsHref}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Open in Reels feed
                          <LinkIcon className="w-3 h-3" />
                        </Link>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={handleCopyHandles} disabled={loading}>
                        Copy handles
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{topUsernames.join(', ')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {meta?.metrics && (
          <Card className="bg-muted/30 border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Run Metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {(() => {
                const metrics = meta.metrics;
                const serp = meta.serpMetrics;
                const apiCalls = serp?.apiCalls ?? metrics.apiCalls ?? 0;
                const serpResults = serp?.serpResults ?? metrics.batches?.[0]?.size ?? results.length;
                const enriched = serp?.enrichedCount ?? metrics.processedCreators ?? results.length;
                const latency = serp?.durationMs ?? metrics.timings?.totalDurationMs ?? 0;
                const geoSummary = `${meta.location ?? 'United States'} · gl=${meta.gl ?? 'us'} · hl=${meta.hl ?? 'en'}`;
                const errors = serp?.errors && serp.errors.length > 0 ? serp.errors.join(' • ') : 'None';

                return (
                  <>
                    <div><p className="text-xs uppercase text-muted-foreground">API calls</p><p className="text-lg font-semibold">{apiCalls}</p></div>
                    <div><p className="text-xs uppercase text-muted-foreground">Serp results</p><p className="text-lg font-semibold">{serpResults}</p></div>
                    <div><p className="text-xs uppercase text-muted-foreground">Enriched profiles</p><p className="text-lg font-semibold">{enriched}</p></div>
                    <div><p className="text-xs uppercase text-muted-foreground">Latency</p><p className="text-lg font-semibold">{latency} ms</p></div>
                    <div><p className="text-xs uppercase text-muted-foreground">Scoped query</p><p className="text-sm font-mono break-words">site:{meta.site} {meta.query}</p></div>
                    <div><p className="text-xs uppercase text-muted-foreground">Geo scope</p><p className="text-sm text-muted-foreground">{geoSummary}</p></div>
                    <div className="sm:col-span-3"><p className="text-xs uppercase text-muted-foreground">Errors</p><p className="text-sm text-muted-foreground">{errors}</p></div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((result, index) => (
              <ResultCard key={`${result.creator?.username ?? 'creator'}-${index}`} result={result} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
