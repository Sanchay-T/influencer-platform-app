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
        <Card className="w-full max-w-md border-none bg-gray-50">
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
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
      <Card className="border-none bg-gray-50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold text-gray-900">{campaign.name}</CardTitle>
              <CardDescription className="mt-1 text-gray-500">{campaign.description}</CardDescription>
            </div>
            <Badge variant="outline" className="text-gray-600 bg-white">
              {campaignState === 'active' ? 'PROCESSING' : campaign.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Search Type</p>
              <p className="text-sm text-gray-900">{campaign.searchType}</p>
            </div>
            {campaign.searchType === 'keyword' ? (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Platform</p>
                  <p className="text-sm text-gray-900">{activeJob?.platform || campaign.scrapingJobs?.[0]?.platform || 'TikTok'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Keywords</p>
                  <p className="text-sm text-gray-900">{activeJob?.keywords?.join(", ") || campaign.scrapingJobs?.[0]?.keywords?.join(", ") || "-"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Platform</p>
                  <p className="text-sm text-gray-900">{activeJob?.platform || campaign.scrapingJobs?.[0]?.platform || 'Instagram'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Target Username</p>
                  <p className="text-sm text-gray-900">@{activeJob?.targetUsername || campaign.scrapingJobs?.[0]?.targetUsername || "-"}</p>
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
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
          <p className="text-sm text-gray-500">Loading results...</p>
        </div>
      </div>
    );
  }

  if (campaignState === 'active') {
    return renderCampaignContainer(
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing search... ({progress}%)</span>
        </div>
        <div className="w-full max-w-md space-y-2">
          <Progress value={progress} className="h-1" />
        </div>
      </div>
    );
  }

  if (campaignState === 'completed') {
    const lastCompletedJob = campaign.scrapingJobs?.find(job => 
      job.status === 'completed' && job.results?.length > 0
    );

    if (campaign.searchType === 'keyword' && lastCompletedJob) {
      const searchData = {
        jobId: lastCompletedJob.id,
        campaignId: campaign.id,
        keywords: lastCompletedJob.keywords || [],
        platform: lastCompletedJob.platform || 'Tiktok'
      };

      return (
        <div className="space-y-8">
          <Card className="border-none bg-gray-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-semibold text-gray-900">{campaign.name}</CardTitle>
                  <CardDescription className="mt-1 text-gray-500">{campaign.description}</CardDescription>
                </div>
                <Badge variant="outline" className="text-gray-600 bg-white">
                  {campaign.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Search Type</p>
                  <p className="text-sm text-gray-900">{campaign.searchType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Platform</p>
                  <p className="text-sm text-gray-900">{searchData.platform}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Keywords</p>
                  <p className="text-sm text-gray-900">{searchData.keywords.join(", ")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
                <p className="text-sm text-gray-500">Loading results...</p>
              </div>
            </div>
          }>
            <KeywordSearchResults searchData={searchData} />
          </Suspense>
        </div>
      );
    }

    if (campaign.searchType === 'similar' && lastCompletedJob) {
      const searchData = {
        jobId: lastCompletedJob.id,
        platform: lastCompletedJob.platform || 'Instagram',
        targetUsername: lastCompletedJob.targetUsername,
        creators: lastCompletedJob.results?.[0]?.creators || []
      };

      return (
        <div className="space-y-8">
          <Card className="border-none bg-gray-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-semibold text-gray-900">{campaign.name}</CardTitle>
                  <CardDescription className="mt-1 text-gray-500">{campaign.description}</CardDescription>
                </div>
                <Badge variant="outline" className="text-gray-600 bg-white">
                  {campaign.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Search Type</p>
                  <p className="text-sm text-gray-900">{campaign.searchType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Platform</p>
                  <p className="text-sm text-gray-900">{searchData.platform}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Target Username</p>
                  <p className="text-sm text-gray-900">@{searchData.targetUsername}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
                <p className="text-sm text-gray-500">Loading results...</p>
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
          className="bg-gray-900 hover:bg-gray-800 text-white"
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
      <div className="text-center text-gray-500">
        No results found for this campaign
      </div>
    </div>
  );
} 