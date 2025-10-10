'use client'

import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/dashboard-layout";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { SimilarSearchForm } from '@/app/components/campaigns/similar-search/similar-search-form';
import { useRouter } from 'next/navigation';

export default function SimilarCreatorSearch() {
  const router = useRouter();
  const [searchData, setSearchData] = useState({
    jobId: null,
    campaignId: null,
    platform: 'tiktok',
    targetUsername: ''
  });
  const [isLoading, setIsLoading] = useState(false); // Start with false - no need to wait
  const [campaignName, setCampaignName] = useState("");

  useEffect(() => {
    console.log('🔄 [SIMILAR-SEARCH-PAGE] Initializing similar creator search page');
    // Obtener campaignId del sessionStorage
    const campaign = JSON.parse(sessionStorage.getItem('currentCampaign'));
    if (campaign) {
      console.log('📋 [SIMILAR-SEARCH-PAGE] Campaign found in session storage:', campaign.id);
      setSearchData(prev => ({
        ...prev,
        campaignId: campaign.id
      }));
      setCampaignName(campaign.name ?? "");
    } else {
      console.log('❌ [SIMILAR-SEARCH-PAGE] No campaign found in session storage');
      // Try to get from URL
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCampaignId = urlParams.get('campaignId');
        if (urlCampaignId) {
          console.log('📋 [SIMILAR-SEARCH-PAGE] Campaign ID found in URL:', urlCampaignId);
          setSearchData(prev => ({
            ...prev,
            campaignId: urlCampaignId
          }));
        }
      } catch (error) {
        console.error('💥 [SIMILAR-SEARCH-PAGE] Error parsing URL params:', error);
      }
    }
    console.log('✅ [SIMILAR-SEARCH-PAGE] Initialization complete');
  }, []);

  useEffect(() => {
    if (searchData.campaignId && !campaignName) {
      try {
        const campaign = JSON.parse(sessionStorage.getItem('currentCampaign') ?? 'null');
        if (campaign?.name) {
          setCampaignName(campaign.name);
        }
      } catch (error) {
        console.error('💥 [SIMILAR-SEARCH-PAGE] Error reloading campaign info:', error);
      }
    }
  }, [searchData.campaignId, campaignName]);

  const handleSearchSubmit = async (data) => {
    console.log('✅ [SIMILAR-SEARCH-PAGE] Search started:', data);
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
            { label: 'Similar Creator Search' },
          ]}
          backHref={searchData?.campaignId ? `/campaigns/search?campaignId=${searchData.campaignId}` : '/campaigns/search'}
          backLabel="Back to Search Options"
        />
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">Find Influencers</h1>
            <p className="text-sm text-zinc-400 mt-1">Search similar creators by username across platforms</p>
          </div>
        </div>

        <SimilarSearchForm
          campaignId={searchData.campaignId}
          onSuccess={handleSearchSubmit}
        />
      </div>
    </DashboardLayout>
  );
}
