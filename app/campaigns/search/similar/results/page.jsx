'use client'

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/app/components/layout/dashboard-layout";
import SimilarSearchResults from "@/app/components/campaigns/similar-search/search-results";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function SearchResultsContent() {
  const [searchResults, setSearchResults] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId');

  useEffect(() => {
    // Recuperar resultados del sessionStorage
    const results = sessionStorage.getItem('searchResults');
    if (results) {
      setSearchResults({ creators: JSON.parse(results) });
    }

    // Recuperar detalles de la campaña
    const campaign = JSON.parse(sessionStorage.getItem('currentCampaign'));
    if (campaign) {
      setCampaignDetails(campaign);
    }
  }, []);

  if (!searchResults) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No Results Available</CardTitle>
            <CardDescription>
              Please return to the campaign page to start a new search
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="space-y-6">
        {campaignDetails && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{campaignDetails.name}</CardTitle>
                  <CardDescription>{campaignDetails.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}
        
        <SimilarSearchResults searchData={searchResults} />
      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
            <p className="text-sm text-gray-500">Loading results...</p>
          </div>
        </div>
      }>
        <SearchResultsContent />
      </Suspense>
    </DashboardLayout>
  );
} 