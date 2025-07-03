'use client'

import { useState, useEffect } from "react";
import DashboardLayout from "../../../components/layout/dashboard-layout";
import KeywordSearchForm from "../../../components/campaigns/keyword-search/keyword-search-form";
import KeywordReview from "../../../components/campaigns/keyword-search/keyword-review";
import SearchResults from "../../../components/campaigns/keyword-search/search-results";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    console.log('🔄 [KEYWORD-SEARCH-PAGE] Initializing keyword search page');
    
    const initializeFromUrl = () => {
      try {
        // Extraer el campaignId de la URL si existe
        const urlParams = new URLSearchParams(window.location.search);
        const campaignId = urlParams.get('campaignId');
        
        if (campaignId) {
          console.log('📋 [KEYWORD-SEARCH-PAGE] Campaign ID found in URL:', campaignId);
          setSearchData(prev => ({
            ...prev,
            campaignId
          }));
        } else {
          console.log('❌ [KEYWORD-SEARCH-PAGE] No campaign ID found in URL');
        }
      } catch (error) {
        console.error('💥 [KEYWORD-SEARCH-PAGE] Error parsing URL params:', error);
      }
    };

    const initializeFromSession = () => {
      try {
        // Intenta obtener datos de la campaña de sessionStorage
        const campaignData = sessionStorage.getItem('currentCampaign');
        if (campaignData) {
          const campaign = JSON.parse(campaignData);
          console.log('📋 [KEYWORD-SEARCH-PAGE] Campaign found in session storage:', campaign.id);
          setSearchData(prev => ({
            ...prev,
            campaignId: campaign.id
          }));
        } else {
          console.log('❌ [KEYWORD-SEARCH-PAGE] No campaign found in session storage');
        }
      } catch (error) {
        console.error('💥 [KEYWORD-SEARCH-PAGE] Error parsing session storage:', error);
      }
    };

    // Inicializar de URL o sessionStorage
    initializeFromUrl();
    if (!searchData.campaignId) {
      initializeFromSession();
    }

    // Finalizar carga
    setIsLoading(false);
    console.log('✅ [KEYWORD-SEARCH-PAGE] Initialization complete');
  }, []);

  // Manejar el paso 1: Selección de plataformas y número de creadores
  const handleFormSubmit = (data) => {
    console.log('📝 [KEYWORD-SEARCH-PAGE] Form submitted with:', data);
    setSearchData(prev => ({
      ...prev,
      platforms: data.platforms,
      creatorsCount: data.creatorsCount,
      scraperLimit: data.scraperLimit,
      campaignId: data.campaignId || prev.campaignId
    }));
    setStep(2);
    console.log('🔄 [KEYWORD-SEARCH-PAGE] Moving to step 2 (keyword review)');
  };

  // Manejar el paso 2: Revisión y envío de keywords
  const handleKeywordsSubmit = async (keywords) => {
    console.log('🔍 [KEYWORD-SEARCH-PAGE] Starting keyword submission process');
    try {
      // Obtener el campaignId de searchData o del sessionStorage
      const campaignId = searchData.campaignId || JSON.parse(sessionStorage.getItem('currentCampaign'))?.id;
      
      if (!campaignId) {
        console.error('❌ [KEYWORD-SEARCH-PAGE] No campaign ID found');
        throw new Error('Campaign not found');
      }

      console.log('📤 [KEYWORD-SEARCH-PAGE] Submitting search with:', {
        campaignId,
        keywords,
        targetResults: searchData.creatorsCount,
        platforms: searchData.platforms
      });

      // Determine API endpoint based on selected platform
      // For now, we'll handle one platform at a time - prioritize the first selected platform
      let apiEndpoint = '/api/scraping/tiktok'; // Default to TikTok
      if (searchData.platforms.includes('instagram')) {
        apiEndpoint = '/api/scraping/instagram-hashtag';
      } else if (searchData.platforms.includes('youtube')) {
        apiEndpoint = '/api/scraping/youtube';
      }

      console.log('🌐 [KEYWORD-SEARCH-PAGE] Using API endpoint:', apiEndpoint);

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

      console.log('📥 [KEYWORD-SEARCH-PAGE] API response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ [KEYWORD-SEARCH-PAGE] API error:', error);
        throw new Error(error.error || 'Error starting the scraping process');
      }

      const data = await response.json();
      console.log('✅ [KEYWORD-SEARCH-PAGE] API response data:', data);
      
      setSearchData(prev => ({ 
        ...prev, 
        keywords,
        jobId: data.jobId,
        selectedPlatform: searchData.platforms.includes('instagram') ? 'Instagram' : 
                         searchData.platforms.includes('youtube') ? 'YouTube' : 'TikTok'
      }));
      setStep(3);
      console.log('🔄 [KEYWORD-SEARCH-PAGE] Moving to step 3 (results)');
      toast.success('Campaign started successfully');
    } catch (error) {
      console.error('💥 [KEYWORD-SEARCH-PAGE] Error:', error);
      toast.error(error.message || "Failed to start campaign");
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
      <div className="max-w-4xl mx-auto py-8">
        {step === 1 && <KeywordSearchForm onSubmit={handleFormSubmit} />}
        {step === 2 && (
          <KeywordReview 
            onSubmit={handleKeywordsSubmit}
            isLoading={isLoading}
          />
        )}
        {step === 3 && (
          <SearchResults 
            searchData={searchData}
          />
        )}
      </div>
    </DashboardLayout>
  );
} 