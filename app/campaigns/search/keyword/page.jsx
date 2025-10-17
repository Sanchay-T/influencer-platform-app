'use client'

import { useState, useEffect } from "react";
import DashboardLayout from "../../../components/layout/dashboard-layout";
import KeywordSearchForm from "../../../components/campaigns/keyword-search/keyword-search-form";
import KeywordReview from "../../../components/campaigns/keyword-search/keyword-review";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  keywordDebugLog,
  keywordDebugWarn,
  setKeywordDebugEnabled,
} from "@/lib/logging/keyword-debug";

export default function KeywordSearch() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [searchData, setSearchData] = useState({
    platforms: [],
    creatorsCount: 1000,
    keywords: [],
    jobId: null,
    campaignId: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [campaignName, setCampaignName] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('keywordDebug') === 'true' || params.get('debug') === 'keyword') {
          setKeywordDebugEnabled(true);
        }
      } catch {
        // ignore parsing errors
      }
    }
  }, []);

  useEffect(() => {
    keywordDebugLog('page', 'Initializing keyword search page');
    let campaignResolved = false;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const campaignIdFromUrl = urlParams.get('campaignId');

      if (campaignIdFromUrl) {
        keywordDebugLog('page', 'Campaign ID found in URL', campaignIdFromUrl);
        campaignResolved = true;
        setSearchData(prev => ({
          ...prev,
          campaignId: campaignIdFromUrl
        }));
      } else {
        keywordDebugLog('page', 'No campaign ID found in URL');
      }
    } catch (error) {
      keywordDebugWarn('page', 'Error parsing URL params', error);
    }

    if (!campaignResolved) {
      try {
        const campaignData = sessionStorage.getItem('currentCampaign');
        if (campaignData) {
          const campaign = JSON.parse(campaignData);
          keywordDebugLog('page', 'Campaign found in session storage', campaign.id);
          campaignResolved = true;
          setSearchData(prev => ({
            ...prev,
            campaignId: campaign.id
          }));
          setCampaignName(campaign.name ?? "");
        } else {
          keywordDebugLog('page', 'No campaign found in session storage');
        }
      } catch (error) {
        keywordDebugWarn('page', 'Error parsing session storage', error);
      }
    }

    setIsLoading(false);
    keywordDebugLog('page', 'Initialization complete');
  }, []);

  useEffect(() => {
    if (searchData.campaignId && !campaignName) {
      try {
        const campaignData = JSON.parse(sessionStorage.getItem('currentCampaign') ?? 'null');
        if (campaignData?.name) {
          setCampaignName(campaignData.name);
        }
      } catch (error) {
        keywordDebugWarn('page', 'Error reloading campaign info', error);
      }
    }
  }, [searchData.campaignId, campaignName]);

  // Manejar el paso 1: Selección de plataformas y número de creadores
  const handleFormSubmit = (data) => {
    keywordDebugLog('page', 'Form submitted', data);
    setSearchData(prev => ({
      ...prev,
      platforms: data.platforms,
      creatorsCount: data.creatorsCount,
      scraperLimit: data.scraperLimit,
      campaignId: data.campaignId || prev.campaignId
    }));
    setStep(2);
    keywordDebugLog('page', 'Moving to step 2');
  };

  // Manejar el paso 2: Revisión y envío de keywords
  const handleKeywordsSubmit = async (keywords) => {
    keywordDebugLog('page', 'Submitting keywords', keywords);
    try {
      // Obtener el campaignId de searchData o del sessionStorage
      const campaignId = searchData.campaignId || JSON.parse(sessionStorage.getItem('currentCampaign'))?.id;
      
      if (!campaignId) {
        keywordDebugWarn('page', 'No campaign ID found');
        throw new Error('Campaign not found');
      }

      keywordDebugLog('page', 'Submitting search payload', {
        campaignId,
        keywords,
        targetResults: searchData.creatorsCount,
        platforms: searchData.platforms
      });

      // Determine API endpoint based on selected platform
      // For now, we'll handle one platform at a time - prioritize the first selected platform
      let apiEndpoint = '/api/scraping/tiktok'; // Default to TikTok
      if (searchData.platforms.includes('instagram')) {
        apiEndpoint = '/api/scraping/instagram-us-reels';
      } else if (searchData.platforms.includes('youtube')) {
        apiEndpoint = '/api/scraping/youtube';
      }

      keywordDebugLog('page', 'Selected API endpoint', apiEndpoint);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: campaignId,
          keywords: keywords,
          targetResults: searchData.creatorsCount
        }),
      });

      keywordDebugLog('page', 'API response status', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        keywordDebugWarn('page', 'API error response', error);
        throw new Error(error.error || 'Error starting the scraping process');
      }

      const data = await response.json();
      keywordDebugLog('page', 'API success response', data);
      
    const nextPlatform = searchData.platforms.includes('instagram')
      ? 'instagram'
      : searchData.platforms.includes('youtube')
        ? 'youtube'
        : 'tiktok';

    setSearchData(prev => ({ 
      ...prev, 
      keywords,
      jobId: data.jobId,
      selectedPlatform: nextPlatform
    }));
    toast.success('Campaign started successfully');
    router.push(`/campaigns/${campaignId}?jobId=${data.jobId}`);
  } catch (error) {
    keywordDebugWarn('page', 'Keyword submission error', error);
    toast.error(error.message || "Failed to start campaign");
  }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="py-8">
          <div className="flex justify-center items-center min-h-[300px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200 mb-4"></div>
              <p className="text-zinc-300">Loading campaign...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            {
              label: campaignName || 'Campaign',
              href: searchData?.campaignId ? `/campaigns/${searchData.campaignId}` : '/dashboard',
              type: 'campaign',
            },
            { label: 'Keyword Search' },
          ]}
          backHref={searchData?.campaignId ? `/campaigns/search?campaignId=${searchData.campaignId}` : '/campaigns/search'}
          backLabel="Back to Search Options"
        />
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">Keyword Search</h1>
            <p className="text-sm text-zinc-400 mt-1">Discover creators using keywords across platforms</p>
          </div>
        </div>

        {step === 1 && <KeywordSearchForm onSubmit={handleFormSubmit} />}
        {step === 2 && (
          <KeywordReview 
            onSubmit={handleKeywordsSubmit}
            isLoading={isLoading}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
