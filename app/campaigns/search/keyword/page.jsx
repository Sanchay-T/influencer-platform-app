'use client';

import { structuredConsole } from '@/lib/logging/console-proxy';

import { useState, useEffect } from "react";
import DashboardLayout from "../../../components/layout/dashboard-layout";
import KeywordSearchForm from "../../../components/campaigns/keyword-search/keyword-search-form";
import KeywordReview from "../../../components/campaigns/keyword-search/keyword-review";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function KeywordSearch() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [searchData, setSearchData] = useState({
    platforms: [],
    creatorsCount: 1000,
    keywords: [],
    usernames: [],
    jobId: null,
    campaignId: null,
    selectedPlatform: null,
    targetUsernames: [],
    targetUsername: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [campaignName, setCampaignName] = useState("");

  useEffect(() => {
    let campaignResolved = false;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const campaignIdFromUrl = urlParams.get('campaignId');

      if (campaignIdFromUrl) {
        campaignResolved = true;
        setSearchData(prev => ({
          ...prev,
          campaignId: campaignIdFromUrl
        }));
      } else {
      }
    } catch (error) {
      structuredConsole.warn('[KeywordSearch] failed to parse URL params', error);
    }

    if (!campaignResolved) {
      try {
        const campaignData = sessionStorage.getItem('currentCampaign');
        if (campaignData) {
          const campaign = JSON.parse(campaignData);
          campaignResolved = true;
          setSearchData(prev => ({
            ...prev,
            campaignId: campaign.id
          }));
          setCampaignName(campaign.name ?? "");
        } else {
        }
      } catch (error) {
        structuredConsole.warn('[KeywordSearch] failed to parse campaign session storage', error);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (searchData.campaignId && !campaignName) {
      try {
        const campaignData = JSON.parse(sessionStorage.getItem('currentCampaign') ?? 'null');
        if (campaignData?.name) {
          setCampaignName(campaignData.name);
        }
      } catch (error) {
        structuredConsole.warn('[KeywordSearch] failed to reload campaign info', error);
      }
    }
  }, [searchData.campaignId, campaignName]);

  // Manejar el paso 1: Selección de plataformas y número de creadores
  const handleFormSubmit = (data) => {
    setSearchData(prev => ({
      ...prev,
      platforms: data.platforms,
      creatorsCount: data.creatorsCount,
      scraperLimit: data.scraperLimit,
      campaignId: data.campaignId || prev.campaignId,
      selectedPlatform: data.platforms?.[0] || prev.selectedPlatform
    }));
    setStep(2);
  };

  // Handle step 2: Review and submit keywords using V2 dispatch API
  const handleKeywordsSubmit = async (payload) => {
    try {
      // Get campaignId from searchData or sessionStorage
      const campaignId = searchData.campaignId || JSON.parse(sessionStorage.getItem('currentCampaign'))?.id;

      if (!campaignId) {
        structuredConsole.warn('[KeywordSearch] no campaign ID found');
        throw new Error('Campaign not found');
      }

      // Get platform (already lowercase from V2 form: 'tiktok', 'instagram', 'youtube')
      const platform = searchData.platforms?.[0] || searchData.selectedPlatform || 'tiktok';

      // Parse keywords from payload
      const submittedKeywords = Array.isArray(payload?.keywords)
        ? payload.keywords
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter((value) => value.length > 0)
        : [];

      if (submittedKeywords.length === 0) {
        throw new Error('Please enter at least one keyword');
      }

      // V2 API: Single endpoint for all platforms
      const response = await fetch('/api/v2/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          keywords: submittedKeywords,
          targetResults: searchData.creatorsCount,
          campaignId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error starting the search');
      }

      const data = await response.json();

      setSearchData(prev => ({
        ...prev,
        keywords: submittedKeywords,
        jobId: data.jobId,
        selectedPlatform: platform
      }));

      toast.success('Search started successfully');
      router.push(`/campaigns/${campaignId}?jobId=${data.jobId}`);
    } catch (error) {
      structuredConsole.warn('[KeywordSearch] keyword submission failed', error);
      toast.error(error.message || "Failed to start search");
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
            platform={searchData?.selectedPlatform || searchData.platforms?.[0]}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
