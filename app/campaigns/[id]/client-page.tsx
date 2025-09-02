'use client'

import { useState, useEffect, useRef } from 'react'
import KeywordSearchResults from '@/app/components/campaigns/keyword-search/search-results'
import SimilarSearchResults from '@/app/components/campaigns/similar-search/search-results'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Campaign, ScrapingJob, ScrapingResult } from '@/app/types/campaign'
import { PlatformResult } from '@/lib/db/schema'
import { Suspense } from 'react'

// Definir los posibles estados de una campaña
type CampaignState = 'initialLoading' | 'active' | 'completed' | 'draft' | 'error';

export default function ClientCampaignPage({ campaign }: { campaign: Campaign | null }) {
  const [isSearching, setIsSearching] = useState(false);
  const [campaignState, setCampaignState] = useState<CampaignState>('initialLoading');
  const [activeJob, setActiveJob] = useState<ScrapingJob | null>(null);
  const [progress, setProgress] = useState(0);
  const activeJobRef = useRef<ScrapingJob | null>(null);

  // Efecto para determinar el estado inicial de la campaña
  useEffect(() => {
    if (!campaign) {
      setCampaignState('error');
      return;
    }

    const hasActiveJob = campaign.scrapingJobs?.some(job => 
      job.status === 'pending' || job.status === 'processing'
    );

    const hasCompletedJob = campaign.scrapingJobs?.some(job => 
      job.status === 'completed' && job.results?.length > 0
    );

    if (hasActiveJob) {
      setCampaignState('active');
    } else if (hasCompletedJob) {
      setCampaignState('completed');
    } else if (campaign.status === 'draft') {
      setCampaignState('draft');
    } else {
      setCampaignState('error');
    }
  }, [campaign]);

  // Efecto para manejar el polling solo cuando hay un trabajo activo
  useEffect(() => {
    if (campaignState !== 'active' || !campaign) return;

    const initialActiveJob = campaign.scrapingJobs?.find(job => 
      job.status === 'pending' || job.status === 'processing'
    );
    
    if (!initialActiveJob) return;
    
    setActiveJob(initialActiveJob);
    activeJobRef.current = initialActiveJob;
    setProgress(initialActiveJob.progress || 0);

    const pollInterval = setInterval(async () => {
      try {
        const currentJob = activeJobRef.current;
        if (!currentJob) {
          clearInterval(pollInterval);
          return;
        }
          
        const response = await fetch(`/api/scraping/${currentJob.platform.toLowerCase()}?jobId=${currentJob.id}`);
        const data = await response.json();

        if (data.error) {
          console.error('Error polling job status:', data.error);
          clearInterval(pollInterval);
          setCampaignState('error');
          return;
        }

        const updatedJob = {
          ...currentJob,
          status: data.status,
          progress: data.progress || 0
        };
          
        setActiveJob(updatedJob);
        activeJobRef.current = updatedJob;
        setProgress(data.progress || 0);

        if (['completed', 'error', 'timeout'].includes(data.status)) {
          clearInterval(pollInterval);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        clearInterval(pollInterval);
        setCampaignState('error');
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [campaign, campaignState]);

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="w-full max-w-md bg-zinc-900/80 border border-zinc-700/50">
          <CardContent className="pt-6">
            <div className="text-center text-zinc-400">
              Campaign not found
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Función para renderizar el contenedor base de la campaña
  const renderCampaignContainer = (children: React.ReactNode) => (
    <div className="space-y-8">
      <Card className="bg-zinc-900/80 border border-zinc-700/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold text-zinc-100">{campaign.name}</CardTitle>
              <CardDescription className="mt-1 text-zinc-400">{campaign.description}</CardDescription>
            </div>
            <Badge variant="outline" className="text-zinc-300 bg-zinc-800 border border-zinc-700/50">
              {campaignState === 'active' ? 'PROCESSING' : campaign.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-400">Search Type</p>
              <p className="text-sm text-zinc-100">{campaign.searchType}</p>
            </div>
            {campaign.searchType === 'keyword' ? (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Platform</p>
                  <p className="text-sm text-zinc-100">{activeJob?.platform || campaign.scrapingJobs?.[0]?.platform || 'TikTok'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Keywords</p>
                  <p className="text-sm text-zinc-100">{activeJob?.keywords?.join(", ") || campaign.scrapingJobs?.[0]?.keywords?.join(", ") || "-"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Platform</p>
                  <p className="text-sm text-zinc-100">{activeJob?.platform || campaign.scrapingJobs?.[0]?.platform || 'Instagram'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Target Username</p>
                  <p className="text-sm text-zinc-100">@{activeJob?.targetUsername || campaign.scrapingJobs?.[0]?.targetUsername || "-"}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      {children}
    </div>
  );

  // Renderizar según el estado
  if (campaignState === 'initialLoading') {
    return renderCampaignContainer(
      <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
          <p className="text-sm text-zinc-400">Loading results...</p>
      </div>
      </div>
    );
  }

  if (campaignState === 'active') {
    return renderCampaignContainer(
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          <span>Processing search... ({progress}%)</span>
        </div>
        <div className="w-full max-w-md space-y-2">
          <Progress value={progress} className="h-1" />
        </div>
      </div>
    );
  }

  if (campaignState === 'completed') {
    const completedJobs = campaign.scrapingJobs?.filter(job => 
      job.status === 'completed' && job.results?.length > 0
    ) || [];

    console.log('🔍 [CLIENT-DEBUG] Found completed jobs:', completedJobs.length);
    completedJobs.forEach((job, index) => {
      console.log(`✅ [CLIENT-JOB-${index + 1}] Job ${job.id}:`, {
        platform: job.platform,
        createdAt: job.createdAt,
        resultsCount: job.results?.length || 0
      });
    });

    if (campaign.searchType === 'keyword' && completedJobs.length > 0) {
      // For now, use the most recent completed job to maintain existing flow
      const mostRecentJob = completedJobs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      const searchData = {
        jobId: mostRecentJob.id,
        campaignId: campaign.id,
        keywords: mostRecentJob.keywords || [],
        platform: mostRecentJob.platform || 'Tiktok'
      };

      return (
        <div className="space-y-8">
          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-semibold text-zinc-100">{campaign.name}</CardTitle>
                  <CardDescription className="mt-1 text-zinc-400">{campaign.description}</CardDescription>
                </div>
                <Badge variant="outline" className="text-zinc-300 bg-zinc-800 border border-zinc-700/50">
                  {campaign.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Search Type</p>
                  <p className="text-sm text-zinc-100">{campaign.searchType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Platform</p>
                  <p className="text-sm text-zinc-100">{searchData.platform}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Keywords</p>
                  <p className="text-sm text-zinc-100">{searchData.keywords.join(", ")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Completed Runs Section */}
          {completedJobs.length > 1 && (
            <Card className="bg-zinc-900/80 border border-zinc-700/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium text-zinc-100">All Runs ({completedJobs.length})</CardTitle>
                <CardDescription>All completed search runs for this campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedJobs.map((job, index) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm font-medium text-zinc-100">
                          Run #{completedJobs.length - index}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {new Date(job.createdAt).toLocaleDateString()} at {new Date(job.createdAt).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {job.platform}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {job.results?.[0]?.creators?.length || 0} results
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {job.id === mostRecentJob.id && (
                          <Badge variant="outline" className="text-xs">Currently Showing</Badge>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            window.location.href = `/campaigns/${campaign.id}?jobId=${job.id}`;
                          }}
                        >
                          View Results
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                <p className="text-sm text-zinc-400">Loading results...</p>
              </div>
            </div>
          }>
            <KeywordSearchResults searchData={searchData} />
          </Suspense>
        </div>
      );
    }

    if (campaign.searchType === 'similar' && completedJobs.length > 0) {
      // For now, use the most recent completed job to maintain existing flow
      const mostRecentJob = completedJobs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      const searchData = {
        jobId: mostRecentJob.id,
        platform: mostRecentJob.platform || 'Instagram',
        targetUsername: mostRecentJob.targetUsername,
        creators: mostRecentJob.results?.[0]?.creators || []
      };

      return (
        <div className="space-y-8">
          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-semibold text-zinc-100">{campaign.name}</CardTitle>
                  <CardDescription className="mt-1 text-zinc-400">{campaign.description}</CardDescription>
                </div>
                <Badge variant="outline" className="text-zinc-300 bg-zinc-800 border border-zinc-700/50">
                  {campaign.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Search Type</p>
                  <p className="text-sm text-zinc-100">{campaign.searchType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Platform</p>
                  <p className="text-sm text-zinc-100">{searchData.platform}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">Target Username</p>
                  <p className="text-sm text-zinc-100">@{searchData.targetUsername}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Completed Runs Section */}
          {completedJobs.length > 1 && (
            <Card className="bg-zinc-900/80 border border-zinc-700/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium text-zinc-100">All Runs ({completedJobs.length})</CardTitle>
                <CardDescription>All completed search runs for this campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedJobs.map((job, index) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm font-medium text-zinc-100">
                          Run #{completedJobs.length - index}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {new Date(job.createdAt).toLocaleDateString()} at {new Date(job.createdAt).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {job.platform}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {job.results?.[0]?.creators?.length || 0} results
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {job.id === mostRecentJob.id && (
                          <Badge variant="outline" className="text-xs">Currently Showing</Badge>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            window.location.href = `/campaigns/${campaign.id}?jobId=${job.id}`;
                          }}
                        >
                          View Results
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                <p className="text-sm text-zinc-400">Loading results...</p>
              </div>
            </div>
          }>
            <SimilarSearchResults searchData={searchData} />
          </Suspense>
        </div>
      );
    }
  }

  // Estado draft
  if (campaignState === 'draft') {
    return renderCampaignContainer(
      <div className="flex justify-center py-8">
        <Button 
          onClick={() => {
            setIsSearching(true);
            window.location.href = `/campaigns/search/keyword?campaignId=${campaign.id}`;
          }}
          disabled={isSearching}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Search className="mr-2 h-4 w-4" />
          {isSearching ? 'Starting search...' : 'Start Search'}
        </Button>
      </div>
    );
  }

  // Estado error o sin resultados
  return renderCampaignContainer(
    <div className="flex items-center justify-center py-8">
      <div className="text-center text-zinc-400">
        No results found for this campaign
      </div>
    </div>
  );
}
