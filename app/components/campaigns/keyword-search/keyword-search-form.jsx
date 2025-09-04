'use client'

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "react-hot-toast";
import { useUser } from '@clerk/nextjs';

export default function KeywordSearchForm({ onSubmit }) {
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [creatorsCount, setCreatorsCount] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [keywords] = useState(["test"]); // Esto debería ser un input del usuario
  const [campaignId, setCampaignId] = useState(null);
  const { user, isLoaded } = useUser();

  useEffect(() => {

    // Obtener el campaignId de la URL si existe
    const urlParams = new URLSearchParams(window.location.search);
    const urlCampaignId = urlParams.get('campaignId');
    if (urlCampaignId) {
      setCampaignId(urlCampaignId);
    }
  }, []);

  if (!isLoaded || !user) {
    return (
      <Card className="bg-zinc-900/80 border border-zinc-700/50">
        <CardHeader>
          <CardTitle>Configure Keyword Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200"></div>
            <span className="ml-3 text-zinc-300">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handlePlatformChange = (platform) => {
    setSelectedPlatform(platform);
  };

  const getActualScraperLimit = (uiValue) => {
    // Retornamos el valor real del slider (1000-5000)
    return uiValue;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!selectedPlatform) {
      toast.error("Please select a platform (TikTok, Instagram, or YouTube)");
      setIsLoading(false);
      return;
    }

    // Asegurarnos de que creatorsCount sea un número
    const numericCreatorsCount = Number(creatorsCount);

    // Pasar el campaignId si existe
    onSubmit({
      platforms: [selectedPlatform],
      creatorsCount: numericCreatorsCount,
      scraperLimit: numericCreatorsCount, // Usamos el valor numérico
      campaignId: campaignId
    });
    setIsLoading(false);
  };

  const getCreditsUsed = (count) => {
    return count / 100; // 1000 creators = 10 credits, 2000 = 20, etc.
  };

  return (
    <Card className="bg-zinc-900/80 border border-zinc-700/50">
      <CardHeader>
        <CardTitle>Configure Keyword Search</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-medium">Platforms</label>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <Checkbox
                  checked={selectedPlatform === "tiktok"}
                  onCheckedChange={() => handlePlatformChange("tiktok")}
                />
                <span className="ml-2">TikTok</span>
              </div>
              <div className="flex items-center">
                <Checkbox
                  checked={selectedPlatform === "instagram"}
                  onCheckedChange={() => handlePlatformChange("instagram")}
                />
                <span className="ml-2">Instagram</span>
              </div>
              <div className="flex items-center">
                <Checkbox
                  checked={selectedPlatform === "youtube"}
                  onCheckedChange={() => handlePlatformChange("youtube")}
                />
                <span className="ml-2">YouTube</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium">
              How many creators do you need?
            </label>
            <Slider
              value={[creatorsCount]}
              onValueChange={([value]) => setCreatorsCount(value)}
              min={100}
              max={1000}
              step={100}
              className="py-4"
            />
            <div className="flex justify-between text-md text-muted-foreground">
              {[100, 500, 1000].map((value) => (
                <span
                  key={value}
                  className={creatorsCount === value ? "font-black" : ""}
                >
                  {value.toLocaleString('en-US')}
                </span>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              This will use {getCreditsUsed(creatorsCount)} of your 50 credits
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
