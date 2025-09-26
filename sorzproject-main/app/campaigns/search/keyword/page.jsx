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
    const checkExistingJob = async () => {
      try {
        // Obtener el campaignId de la URL o del sessionStorage
        const urlParams = new URLSearchParams(window.location.search);
        const urlCampaignId = urlParams.get('campaignId');
        const campaignId = urlCampaignId || JSON.parse(sessionStorage.getItem('currentCampaign'))?.id;

        if (!campaignId) {
          setIsLoading(false);
          return;
        }

        // Verificar si hay un job activo para esta campaña
        const response = await fetch(`/api/campaigns/${campaignId}`);
        const campaign = await response.json();

        if (!response.ok) {
          throw new Error(campaign.error || 'Error al obtener la campaña');
        }

        // Buscar el último job completado
        const lastCompletedJob = campaign.scrapingJobs?.find(job => 
          job.status === 'completed' && job.results?.length > 0
        );

        if (lastCompletedJob) {
          // Si hay un job completado, ir directamente a los resultados
          setSearchData({
            platforms: [lastCompletedJob.platform],
            creatorsCount: lastCompletedJob.scraperLimit || 1000,
            keywords: lastCompletedJob.keywords || [],
            jobId: lastCompletedJob.id,
            campaignId: campaignId
          });
          setStep(3);
        } else {
          // Si no hay job completado, verificar si hay uno en proceso
          const activeJob = campaign.scrapingJobs?.find(job => 
            job.status === 'pending' || job.status === 'processing'
          );

          if (activeJob) {
            // Si hay un job activo, ir a los resultados para mostrar el progreso
            setSearchData({
              platforms: [activeJob.platform],
              creatorsCount: activeJob.scraperLimit || 1000,
              keywords: activeJob.keywords || [],
              jobId: activeJob.id,
              campaignId: campaignId
            });
            setStep(3);
          } else {
            // Si no hay jobs, mostrar el formulario de configuración
            setSearchData(prev => ({ ...prev, campaignId }));
            setStep(1);
          }
        }
      } catch (error) {
        console.error('Error checking existing job:', error);
        toast.error(error.message || "Error al verificar el estado de la campaña");
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingJob();
  }, []);

  const handleFormSubmit = (formData) => {
    console.log('Form submitted with:', formData);
    setSearchData(prev => ({
      ...prev,
      platforms: formData.platforms,
      creatorsCount: formData.creatorsCount
    }));
    setStep(2);
  };

  const handleKeywordsSubmit = async (keywords) => {
    try {
      // Obtener el campaignId de searchData o del sessionStorage
      const campaignId = searchData.campaignId || JSON.parse(sessionStorage.getItem('currentCampaign'))?.id;
      
      if (!campaignId) {
        throw new Error('Campaign not found');
      }

      console.log('Submitting search with:', {
        campaignId,
        keywords,
        targetResults: searchData.creatorsCount
      });

      const response = await fetch('/api/scraping/tiktok', {
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error starting the scraping process');
      }

      const data = await response.json();
      setSearchData(prev => ({ 
        ...prev, 
        keywords,
        jobId: data.jobId 
      }));
      setStep(3);
      toast.success('Campaign started successfully');
    } catch (error) {
      console.error('Error:', error);
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