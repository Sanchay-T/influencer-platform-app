'use client'

import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/dashboard-layout";
import { SimilarSearchForm } from '@/app/components/campaigns/similar-search/similar-search-form';
import SimilarSearchResults from '@/app/components/campaigns/similar-search/search-results';

export default function SimilarCreatorSearch() {
  const [searchResults, setSearchResults] = useState(null);
  const [campaignId, setCampaignId] = useState(null);

  useEffect(() => {
    console.log('🔄 [SIMILAR-SEARCH-PAGE] Initializing similar creator search page');
    // Obtener campaignId del sessionStorage
    const campaign = JSON.parse(sessionStorage.getItem('currentCampaign'));
    if (campaign) {
      console.log('📋 [SIMILAR-SEARCH-PAGE] Campaign found in session storage:', campaign.id);
      setCampaignId(campaign.id);
    } else {
      console.log('❌ [SIMILAR-SEARCH-PAGE] No campaign found in session storage');
      // Try to get from URL
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCampaignId = urlParams.get('campaignId');
        if (urlCampaignId) {
          console.log('📋 [SIMILAR-SEARCH-PAGE] Campaign ID found in URL:', urlCampaignId);
          setCampaignId(urlCampaignId);
        }
      } catch (error) {
        console.error('💥 [SIMILAR-SEARCH-PAGE] Error parsing URL params:', error);
      }
    }
    console.log('✅ [SIMILAR-SEARCH-PAGE] Initialization complete');
  }, []);

  const handleSearchSuccess = (data) => {
    console.log('✅ [SIMILAR-SEARCH-PAGE] Search results received:', data);
    setSearchResults({ creators: data }); // Asegurarnos de que los datos tienen la estructura correcta
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8">
        <div className="space-y-6">
          <SimilarSearchForm 
            campaignId={campaignId}
            onSuccess={handleSearchSuccess}
          />
          {searchResults && <SimilarSearchResults searchData={searchResults} />}
        </div>
      </div>
    </DashboardLayout>
  );
} 