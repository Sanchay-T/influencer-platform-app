'use client';

import { structuredConsole } from '@/lib/logging/console-proxy';

import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/dashboard-layout";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { SimilarSearchForm } from '@/app/components/campaigns/similar-search/similar-search-form';
import { useRouter } from 'next/navigation';

export default function BrandCompetitorSearch() {
  const router = useRouter();
  const [searchData, setSearchData] = useState({
    jobId: null,
    campaignId: null,
    platform: 'instagram',
    targetUsername: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [campaignName, setCampaignName] = useState("");

  useEffect(() => {
    structuredConsole.log('🔄 [BRAND-SEARCH-PAGE] Initializing brand/competitor search page');
    const campaign = JSON.parse(sessionStorage.getItem('currentCampaign'));
    if (campaign) {
      structuredConsole.log('📋 [BRAND-SEARCH-PAGE] Campaign found in session storage:', campaign.id);
      setSearchData(prev => ({
        ...prev,
        campaignId: campaign.id
      }));
      setCampaignName(campaign.name ?? "");
    } else {
      structuredConsole.log('❌ [BRAND-SEARCH-PAGE] No campaign found in session storage');
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCampaignId = urlParams.get('campaignId');
        if (urlCampaignId) {
          structuredConsole.log('📋 [BRAND-SEARCH-PAGE] Campaign ID found in URL:', urlCampaignId);
          setSearchData(prev => ({
            ...prev,
            campaignId: urlCampaignId
          }));
        }
      } catch (error) {
        structuredConsole.error('💥 [BRAND-SEARCH-PAGE] Error parsing URL params:', error);
      }
    }
    structuredConsole.log('✅ [BRAND-SEARCH-PAGE] Initialization complete');
  }, []);

  useEffect(() => {
    if (searchData.campaignId && !campaignName) {
      try {
        const campaign = JSON.parse(sessionStorage.getItem('currentCampaign') ?? 'null');
        if (campaign?.name) {
          setCampaignName(campaign.name);
        }
      } catch (error) {
        structuredConsole.error('💥 [BRAND-SEARCH-PAGE] Error reloading campaign info:', error);
      }
    }
  }, [searchData.campaignId, campaignName]);

  const handleSearchSubmit = async (data) => {
    structuredConsole.log('✅ [BRAND-SEARCH-PAGE] Search started:', data);
    setSearchData(prev => ({
      ...prev,
      jobId: data.jobId,
      platform: data.platform,
      targetUsername: data.targetUsername
    }));
    if (data?.campaignId || searchData.campaignId) {
      const campaignId = data?.campaignId || searchData.campaignId;
      router.push(`/campaigns/${campaignId}?jobId=${data.jobId}`);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
              <p>Loading campaign...</p>
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
            { label: 'Brand / Competitor Search' },
          ]}
          backHref={searchData?.campaignId ? `/campaigns/search?campaignId=${searchData.campaignId}` : '/campaigns/search'}
          backLabel="Back to Search Options"
        />
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">Brand / Competitor Search</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Enter a brand or competitor handle to find creators who collaborate with or mention them
            </p>
          </div>
        </div>

        <SimilarSearchForm
          campaignId={searchData.campaignId}
          onSuccess={handleSearchSubmit}
          searchMode="brand"
        />
      </div>
    </DashboardLayout>
  );
}
