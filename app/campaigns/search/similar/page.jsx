'use client'

import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/dashboard-layout";
import { SimilarSearchForm } from '@/app/components/campaigns/similar-search/similar-search-form';
import SimilarSearchResults from '@/app/components/campaigns/similar-search/search-results';

export default function SimilarCreatorSearch() {
  const [step, setStep] = useState(1);
  const [searchData, setSearchData] = useState({
    jobId: null,
    campaignId: null,
    platform: 'tiktok',
    targetUsername: ''
  });
  const [isLoading, setIsLoading] = useState(false); // Start with false - no need to wait

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

  const handleSearchSubmit = async (data) => {
    console.log('✅ [SIMILAR-SEARCH-PAGE] Search started:', data);
    setSearchData(prev => ({
      ...prev,
      jobId: data.jobId,
      platform: data.platform,
      targetUsername: data.targetUsername
    }));
    setStep(2); // Move to results step
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
      <div className="max-w-6xl mx-auto py-8">
        {step === 1 && (
          <SimilarSearchForm 
            campaignId={searchData.campaignId}
            onSuccess={handleSearchSubmit}
          />
        )}
        {step === 2 && (
          <SimilarSearchResults searchData={searchData} />
        )}
      </div>
    </DashboardLayout>
  );
} 