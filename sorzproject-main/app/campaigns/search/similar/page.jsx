'use client'

import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/dashboard-layout";
import { SimilarSearchForm } from '@/app/components/campaigns/similar-search/similar-search-form';
import SimilarSearchResults from '@/app/components/campaigns/similar-search/search-results';

export default function SimilarCreatorSearch() {
  const [searchResults, setSearchResults] = useState(null);
  const [campaignId, setCampaignId] = useState(null);

  useEffect(() => {
    // Obtener campaignId del sessionStorage
    const campaign = JSON.parse(sessionStorage.getItem('currentCampaign'));
    if (campaign) {
      setCampaignId(campaign.id);
    }
  }, []);

  const handleSearchSuccess = (data) => {
    console.log('Resultados de búsqueda recibidos:', data);
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