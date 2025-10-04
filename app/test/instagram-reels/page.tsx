'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, ExternalLink, Play, Heart, MessageCircle, User, CheckCircle, Info, Clock, Copy, TrendingUp, Eye, Search } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface ReelResult {
  id: string;
  code: string;
  username: string;
  fullName: string;
  isVerified: boolean;
  profilePicUrl: string;
  caption: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  takenAt: string;
  videoUrl: string;
  thumbnailUrl: string;
  instagramUrl: string;
  tags: Array<{
    username: string;
    fullName: string;
    isVerified: boolean;
  }>;
}

interface ApiResponse {
  success: boolean;
  query: string;
  maxResults: number;
  totalResults: number;
  totalFetched?: number;
  duplicatesRemoved?: number;
  searchTime?: number;
  pagesFetched: number;
  results: ReelResult[];
  aiEnhancements?: {
    expandedKeywords: string[];
    keywordStrategy?: {
      primary: string[];
      semantic: string[];
      trending: string[];
      niche: string[];
    };
    keywordStats: Record<string, number>;
    searchEfficiency: string;
    batchingStats?: {
      totalBatches: number;
      averageResultsPerKeyword: number;
    };
  };
  pagination: {
    requested: number;
    delivered: number;
    totalApiCalls?: number;
    keywords?: number;
    pagesNeeded?: number;
    pagesFetched: number;
  };
  error?: string;
  details?: string;
}

export default function InstagramReelsTestPage() {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(12);
  const [results, setResults] = useState<ReelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [paginationInfo, setPaginationInfo] = useState<any>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [aiEnhancements, setAiEnhancements] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    setError('');
    setResults([]);
    setSearchTime(null);
    setDuplicatesRemoved(0);
    setAiEnhancements(null);

    try {
      const response = await fetch('/api/test/instagram-reels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim(), maxResults }),
      });

      const data: ApiResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch data');
      }

      // The API now handles deduplication, so use the data directly
      setResults(data.results);
      setSearchQuery(data.query);
      setTotalResults(data.totalResults);
      setDuplicatesRemoved(data.duplicatesRemoved || 0);
      setPaginationInfo(data.pagination);
      setSearchTime(data.searchTime || Date.now() - startTime);
      setAiEnhancements(data.aiEnhancements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="logo-icon bg-gradient-to-r from-primary to-accent">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              AI-Enhanced Instagram Reels Search
            </h1>
            <Badge variant="secondary" className="ml-3">
              <TrendingUp className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-muted-foreground">
            AI-enhanced search using strategic keyword expansion and parallel processing for maximum discovery
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Search className="w-5 h-5 text-primary" />
              Search Instagram Reels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-4">
                <Input
                  type="text"
                  placeholder="Enter search query (e.g., nike sneakers, fashion, travel)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
                  disabled={loading}
                />
                <Select value={maxResults.toString()} onValueChange={(value) => setMaxResults(parseInt(value))}>
                  <SelectTrigger className="w-32 bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="12">12 results</SelectItem>
                    <SelectItem value="24">24 results</SelectItem>
                    <SelectItem value="36">36 results</SelectItem>
                    <SelectItem value="48">48 results</SelectItem>
                    <SelectItem value="60">60 results</SelectItem>
                    <SelectItem value="72">72 results (6 calls)</SelectItem>
                    <SelectItem value="84">84 results (7 calls)</SelectItem>
                    <SelectItem value="96">96 results (8 calls)</SelectItem>
                    <SelectItem value="120">120 results (10 calls)</SelectItem>
                    <SelectItem value="240">240 results (20 calls)</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
                <Info className="w-4 h-4 text-primary" />
                <span>
                  Instagram returns 12 results per API call. Selecting more will make multiple calls for better analysis.
                  {maxResults > 12 && (
                    <Badge variant="secondary" className="ml-2">
                      {Math.ceil(maxResults / 12)} API calls needed
                    </Badge>
                  )}
                </span>
              </div>
            </form>
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced AI Enhancement Display */}
        {aiEnhancements && (
          <Card className="mb-6 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <TrendingUp className="w-5 h-5 text-primary" />
                Advanced AI Search Strategy
                <Badge variant="secondary" className="ml-2">
                  <Eye className="w-3 h-3 mr-1" />
                  Enhanced
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Multi-Layered Keyword Strategy */}
                {aiEnhancements.keywordStrategy && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">Multi-Layered AI Strategy:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        {/* Primary Keywords */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">PRIMARY</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {aiEnhancements.keywordStrategy.primary.map((keyword: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs border-blue-300 dark:border-blue-700">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Core variations</p>
                        </div>

                        {/* Semantic Keywords */}
                        <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-xs font-semibold text-green-700 dark:text-green-300">SEMANTIC</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {aiEnhancements.keywordStrategy.semantic.map((keyword: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs border-green-300 dark:border-green-700">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Related concepts</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Trending Keywords */}
                        <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">TRENDING</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {aiEnhancements.keywordStrategy.trending.map((keyword: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs border-orange-300 dark:border-orange-700">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Current hot terms</p>
                        </div>

                        {/* Niche Keywords */}
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">NICHE</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {aiEnhancements.keywordStrategy.niche.map((keyword: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs border-purple-300 dark:border-purple-700">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Specialized discoveries</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Keyword Performance Stats */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">Performance Analytics:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(aiEnhancements.keywordStats).map(([keyword, count]: [string, any]) => (
                      <div key={keyword} className="bg-muted/30 p-3 rounded-lg border border-border">
                        <div className="text-xs text-muted-foreground mb-1 truncate">"{keyword}"</div>
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-bold text-foreground">{count}</div>
                          <span className="text-xs text-muted-foreground">unique reels</span>
                        </div>
                        {count === 0 && (
                          <Badge variant="destructive" className="text-xs mt-1">Failed</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enhanced Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm font-semibold">Efficiency: {aiEnhancements.searchEfficiency}</span>
                    </div>
                  </div>
                  
                  {aiEnhancements.batchingStats && (
                    <>
                      <div className="bg-accent/10 border border-accent/20 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-accent-foreground">
                          <Eye className="w-4 h-4" />
                          <span className="text-sm font-semibold">{aiEnhancements.batchingStats.totalBatches} Batches</span>
                        </div>
                      </div>
                      <div className="bg-muted/50 border border-border p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-semibold">{aiEnhancements.batchingStats.averageResultsPerKeyword} avg/keyword</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {searchQuery && (
          <Card className="mb-6 bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-card-foreground">
                  Search Results for "{searchQuery}"
                </h2>
                {searchTime && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {searchTime < 1000 ? `${searchTime}ms` : `${(searchTime / 1000).toFixed(1)}s`}
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-muted/30 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Eye className="w-4 h-4 text-primary" />
                    Total Results
                  </div>
                  <div className="text-2xl font-bold text-foreground">{totalResults}</div>
                </div>
                
                {paginationInfo && (
                  <div className="bg-muted/30 p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      API Calls
                    </div>
                    <div className="text-2xl font-bold text-foreground">{paginationInfo.pagesFetched}</div>
                  </div>
                )}
                
                {duplicatesRemoved > 0 && (
                  <div className="bg-muted/30 p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Copy className="w-4 h-4 text-destructive" />
                      Duplicates Removed
                    </div>
                    <div className="text-2xl font-bold text-destructive">{duplicatesRemoved}</div>
                  </div>
                )}
                
                {searchTime && (
                  <div className="bg-muted/30 p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="w-4 h-4 text-primary" />
                      Search Time
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {searchTime < 1000 ? `${searchTime}ms` : `${(searchTime / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                )}
              </div>

              {paginationInfo && paginationInfo.requested !== paginationInfo.delivered && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border">
                  <Info className="w-4 h-4 text-primary" />
                  <span>
                    Requested {paginationInfo.requested} results, but got {paginationInfo.delivered} 
                    {duplicatesRemoved > 0 && ` (${duplicatesRemoved} duplicates removed)`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Grid */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {results.map((reel) => (
              <Card key={reel.id} className="overflow-hidden bg-card border-border transition-all duration-200 hover:bg-card/80 hover:border-primary/50 table-row">{/* Using existing table-row class */}
                <div className="relative">
                  {/* Thumbnail */}
                  <div className="aspect-[9/16] bg-muted relative">
                    {reel.thumbnailUrl ? (
                      <Image
                        src={reel.thumbnailUrl}
                        alt="Reel thumbnail"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-reel.jpg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Play className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-background/80 text-foreground backdrop-blur-sm">
                        Reel
                      </Badge>
                    </div>
                  </div>
                </div>

                <CardContent className="p-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-10 h-10">
                      {reel.profilePicUrl ? (
                        <Image
                          src={reel.profilePicUrl}
                          alt={`${reel.username} profile`}
                          fill
                          className="rounded-full object-cover border border-border"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-avatar.jpg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-muted flex items-center justify-center border border-border">
                          <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-sm truncate text-card-foreground">@{reel.username}</p>
                        {reel.isVerified && (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{reel.fullName}</p>
                    </div>
                  </div>

                  {/* Caption */}
                  <p className="text-sm text-card-foreground mb-3 line-clamp-3">
                    {reel.caption.length > 100 
                      ? reel.caption.substring(0, 100) + '...'
                      : reel.caption
                    }
                  </p>

                  {/* Engagement Metrics */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded">
                      <Play className="w-3 h-3 text-primary" />
                      <span>{formatNumber(reel.playCount)}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded">
                      <Heart className="w-3 h-3 text-primary" />
                      <span>{formatNumber(reel.likeCount)}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded">
                      <MessageCircle className="w-3 h-3 text-primary" />
                      <span>{formatNumber(reel.commentCount)}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {reel.tags.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-1">Tagged Users:</p>
                      <div className="flex flex-wrap gap-1">
                        {reel.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs border-border search-pill">
                            @{tag.username}
                            {tag.isVerified && <CheckCircle className="w-2 h-2 ml-1 text-primary" />}
                          </Badge>
                        ))}
                        {reel.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs border-border search-pill">
                            +{reel.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <p className="text-xs text-muted-foreground mb-3">
                    {formatDate(reel.takenAt)}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link 
                      href={reel.instagramUrl} 
                      target="_blank"
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full border-border hover:bg-muted">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View on IG
                      </Button>
                    </Link>
                    {reel.videoUrl && (
                      <Link 
                        href={reel.videoUrl} 
                        target="_blank"
                        className="flex-1"
                      >
                        <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
                          <Play className="w-3 h-3 mr-1" />
                          Play Video
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && searchQuery && (
          <Card className="bg-card border-border">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">No results found</h3>
              <p className="text-muted-foreground">No Instagram Reels found for "{searchQuery}". Try a different search term.</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="bg-card border-border">
            <CardContent className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold text-card-foreground mb-2">AI-Enhanced Search in Progress</h3>
              <p className="text-muted-foreground">
                AI is generating strategic keywords and executing parallel searches for maximum coverage...
              </p>
              {maxResults > 12 && (
                <Progress 
                  value={33} 
                  className="w-64 mx-auto mt-4"
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}