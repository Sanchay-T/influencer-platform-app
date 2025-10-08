'use client'

import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { toast } from "react-hot-toast";
import { useUser } from '@clerk/nextjs';
import { Check } from "lucide-react";

export default function KeywordSearchForm({ onSubmit }) {
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [creatorsCount, setCreatorsCount] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [keywords] = useState(["test"]); // Esto debería ser un input del usuario
  const [campaignId, setCampaignId] = useState(null);
  const { user, isLoaded } = useUser();

  const isGoogleSerp = selectedPlatform === 'google-serp';

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
      <div className="rounded-lg text-card-foreground shadow-sm bg-zinc-900/80 border border-zinc-700/50">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="text-2xl font-semibold leading-none tracking-tight">Configure Keyword Search</div>
        </div>
        <div className="p-6 pt-0">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200"></div>
            <span className="ml-3 text-zinc-300">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (isGoogleSerp) {
      if (creatorsCount !== 20) {
        setCreatorsCount(20);
      }
    } else if (creatorsCount < 100) {
      setCreatorsCount(100);
    }
  }, [isGoogleSerp, creatorsCount]);

  const getActualScraperLimit = (uiValue) => {
    // Retornamos el valor real del slider (1000-5000)
    return uiValue;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!selectedPlatform) {
      toast.error("Please select a platform (TikTok, Instagram, Enhanced Instagram, or YouTube)");
      setIsLoading(false);
      return;
    }

    // Asegurarnos de que creatorsCount sea un número
    const numericCreatorsCount = Number(isGoogleSerp ? 20 : creatorsCount);

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
    if (isGoogleSerp) {
      return Math.max(count / 100, 0.2).toFixed(2);
    }
    return count / 100; // 1000 creators = 10 credits, 2000 = 20, etc.
  };

  const platformOptions = [
    { value: "tiktok", label: "TikTok" },
    { value: "instagram", label: "Instagram" },
    { value: "enhanced-instagram", label: "Enhanced Instagram (AI-Powered)", badge: "New" },
    { value: "youtube", label: "YouTube" },
    { value: "google-serp", label: "Google SERP ✕ Instagram", badge: "Beta" },
  ];

  return (
    <div className="rounded-lg text-card-foreground shadow-sm bg-zinc-900/80 border border-zinc-700/50">
      <div className="flex flex-col space-y-1.5 p-6">
        <div className="text-2xl font-semibold leading-none tracking-tight">Configure Keyword Search</div>
      </div>
      <div className="p-6 pt-0">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-medium">Platform</label>
            <div className="flex flex-wrap gap-4">
              {platformOptions.map((platform) => {
                const isActive = selectedPlatform === platform.value;

                return (
                  <div key={platform.value} className="flex items-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isActive}
                      data-state={isActive ? 'checked' : 'unchecked'}
                      value="on"
                      onClick={() => setSelectedPlatform(platform.value)}
                      className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    >
                      {isActive && (
                        <span data-state="checked" className="flex items-center justify-center text-current pointer-events-none">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                    <input
                      aria-hidden="true"
                      tabIndex={-1}
                      type="checkbox"
                      className="sr-only"
                      checked={isActive}
                      readOnly
                    />
                    <span className="ml-2 flex items-center gap-2">
                      {platform.label}
                      {platform.badge && (
                        <span className="ml-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
                          {platform.badge}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {isGoogleSerp ? (
            <div className="space-y-2 rounded-md border border-dashed border-amber-400/60 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-medium">Google SERP preview mode</p>
              <p>We&apos;ll pull up to <strong>20 Instagram profiles</strong> per run to keep latency low while we validate the new search path.</p>
              <p className="text-amber-200/80">This consumes about {getCreditsUsed(20)} credits.</p>
            </div>
          ) : (
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
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            {isLoading ? 'Processing...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
