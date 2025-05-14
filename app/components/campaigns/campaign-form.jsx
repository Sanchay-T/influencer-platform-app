'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";

export default function CampaignForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loadingType, setLoadingType] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    searchType: ""
  });
  
  useEffect(() => {
    // Move initial render log here to prevent hydration errors
    console.log('🖥️ [CLIENT] Campaign form component rendered');
    console.log('🖥️ [CLIENT] Campaign form component mounted');
    
    return () => {
      console.log('🖥️ [CLIENT] Campaign form component unmounted');
    };
  }, []);
  
  useEffect(() => {
    console.log('🖥️ [CLIENT] Campaign form step changed:', step);
  }, [step]);

  const handleSubmitBasicInfo = (e) => {
    e.preventDefault();
    console.log('📝 [CLIENT] Campaign basic info submitted', { 
      name: formData.name, 
      description: formData.description?.substring(0, 20) + (formData.description?.length > 20 ? '...' : '') 
    });
    setStep(2);
  };

  const handleSearchTypeSelection = async (type) => {
    console.log('🎯 [CLIENT] Campaign search type selected:', type);
    setLoadingType(type);
    try {
      console.log('🔄 [CLIENT] Creating campaign via API...');
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          searchType: type,
        }),
      });

      const campaign = await response.json();
      console.log('📥 [CLIENT] API response received:', campaign);

      if (!response.ok) {
        console.error('❌ [CLIENT] Campaign creation API error:', campaign.error || 'Unknown error');
        throw new Error(campaign.error || 'Error al crear la campaña');
      }

      console.log('✅ [CLIENT] Campaign created successfully', { id: campaign.id, name: campaign.name });
      
      // Asegurarnos de que guardamos el ID correctamente
      console.log('🔄 [CLIENT] Saving campaign data to sessionStorage');
      sessionStorage.setItem('currentCampaign', JSON.stringify({
        id: campaign.id,
        name: campaign.name,
        searchType: type
      }));
      
      const route = type === 'similar' ? '/campaigns/search/similar' : '/campaigns/search/keyword';
      console.log('🔄 [CLIENT] Redirecting to search page:', route);
      router.push(route);
    } catch (error) {
      console.error('❌ [CLIENT] Error creating campaign:', error);
      toast.error(error.message);
      setLoadingType(null);
    }
  };

  if (step === 1) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Create a Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitBasicInfo} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign Name</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => {
                  console.log('✏️ [CLIENT] Campaign name changed:', e.target.value);
                  setFormData({ ...formData, name: e.target.value });
                }}
                placeholder="E.g.: Summer Campaign 2024"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign Description</label>
              <Textarea
                required
                value={formData.description}
                onChange={(e) => {
                  console.log('✏️ [CLIENT] Campaign description changed');
                  setFormData({ ...formData, description: e.target.value });
                }}
                placeholder="Describe your campaign..."
                rows={4}
              />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Select Search Method</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Button
            variant="outline"
            className="h-auto min-h-[100px] p-6 text-left hover:bg-accent block w-full relative"
            onClick={() => handleSearchTypeSelection("keyword")}
            disabled={loadingType !== null}
          >
            <div className="space-y-2">
              <h3 className="font-semibold text-base">Keyword-Based Search</h3>
              <p className="text-sm text-muted-foreground whitespace-normal">
                Find influencers using keywords, hashtags, and phrases
              </p>
            </div>
            {loadingType === "keyword" && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </Button>

          <Button
            variant="outline"
            className="h-auto min-h-[100px] p-6 text-left hover:bg-accent block w-full relative"
            onClick={() => handleSearchTypeSelection("similar")}
            disabled={loadingType !== null}
          >
            <div className="space-y-2">
              <h3 className="font-semibold text-base">Similar Creator Search</h3>
              <p className="text-sm text-muted-foreground whitespace-normal">
                Discover creators similar to an existing one
              </p>
            </div>
            {loadingType === "similar" && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 