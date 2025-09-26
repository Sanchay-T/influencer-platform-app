'use client'

import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "react-hot-toast";
import { Check, Loader2 } from "lucide-react";

export function SimilarSearchForm({ campaignId, onSuccess }) {
  const [username, setUsername] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("instagram"); // instagram or youtube
  const [searchState, setSearchState] = useState({
    status: 'idle', // idle, searching, processing
    message: '',
    progress: 0
  });
  const [error, setError] = useState("");

  const validateUsername = (value) => {
    console.log('🔍 [SIMILAR-SEARCH-FORM] Validating username:', value);
    if (!value.trim()) {
      setError("Username is required");
      return false;
    }
    
    if (value.includes(" ")) {
      setError("Username cannot contain spaces");
      return false;
    }

    if (value.includes("@")) {
      setError("Please enter the username without the @ symbol");
      return false;
    }

    setError("");
    console.log('✅ [SIMILAR-SEARCH-FORM] Username validation passed');
    return true;
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    validateUsername(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🔄 [SIMILAR-SEARCH-FORM] Form submission started');
    
    if (!validateUsername(username)) {
      console.log('❌ [SIMILAR-SEARCH-FORM] Username validation failed');
      return;
    }

    console.log('📋 [SIMILAR-SEARCH-FORM] Submitting search with:', { 
      username, 
      campaignId 
    });
    
    setSearchState({ status: 'searching', message: 'Starting search...' });

    try {
      // Determine API endpoint based on platform
      const apiEndpoint = 
        selectedPlatform === 'tiktok' ? '/api/scraping/tiktok-similar' : 
        selectedPlatform === 'youtube' ? '/api/scraping/youtube-similar' : 
        '/api/scraping/instagram';
      console.log(`🔄 [SIMILAR-SEARCH-FORM] Making API request to ${apiEndpoint}`);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, campaignId })
      });

      console.log('📥 [SIMILAR-SEARCH-FORM] API response status:', response.status);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ [SIMILAR-SEARCH-FORM] API error:', data.error);
        setSearchState({ status: 'idle', message: '' });
        toast.error(data.error || 'Error starting search. Please try again.');
        return;
      }
      
      console.log('✅ [SIMILAR-SEARCH-FORM] Search started successfully:', data);
      
      // Call onSuccess to move to results step (like keyword search)
      if (onSuccess) {
        onSuccess({
          jobId: data.jobId,
          platform: selectedPlatform,
          targetUsername: username,
          campaignId
        });
      }
      
      toast.success(`${selectedPlatform === 'tiktok' ? 'TikTok' : selectedPlatform === 'youtube' ? 'YouTube' : 'Instagram'} similar search started!`);
      
    } catch (error) {
      console.error('💥 [SIMILAR-SEARCH-FORM] Error during submission:', error);
      setSearchState({ status: 'idle', message: '' });
      toast.error('Error starting search. Please try again.');
    }
  };


  return (
    <div className="rounded-lg text-card-foreground shadow-sm bg-zinc-900/80 border border-zinc-700/50">
      <div className="flex flex-col space-y-1.5 p-6">
        <div className="text-2xl font-semibold leading-none tracking-tight">Find Similar Creators</div>
        {searchState.message && (
          <div className="space-y-2 pt-2">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {searchState.status === 'processing' && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {searchState.message}
            </div>
            {searchState.status === 'processing' && (
              <Progress value={searchState.progress} className="w-full h-2" />
            )}
          </div>
        )}
      </div>
      <div className="p-6 pt-0">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-medium">Platform</label>
            <div className="flex flex-wrap gap-4">
              {[
                { value: 'tiktok', label: 'TikTok', disabled: true },
                { value: 'instagram', label: 'Instagram' },
                { value: 'youtube', label: 'YouTube' },
              ].map((platform) => {
                const isActive = selectedPlatform === platform.value;
                const isDisabled = Boolean(platform.disabled);

                return (
                  <div key={platform.value} className="flex items-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isActive}
                      data-state={isActive ? 'checked' : 'unchecked'}
                      value="on"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) {
                          setSelectedPlatform(platform.value);
                        }
                      }}
                      className={`peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ${
                        isDisabled ? 'opacity-70' : ''
                      }`}
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
                    <span className="ml-2">
                      {platform.label}
                      {platform.value === 'tiktok' && (
                        <span className="ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                          Coming Soon
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium">
              {selectedPlatform === 'tiktok' ? 'TikTok' : selectedPlatform === 'youtube' ? 'YouTube' : 'Instagram'} Username
            </label>
            <Input
              value={username}
              onChange={handleUsernameChange}
              placeholder={
                selectedPlatform === 'tiktok' ? 'e.g. stoolpresidente' :
                selectedPlatform === 'youtube' ? 'e.g. mkbhd' :
                'e.g. gainsbybrains'
              }
              required
              disabled={searchState.status !== 'idle'}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
            type="submit"
            disabled={searchState.status !== 'idle' || !username.trim() || Boolean(error)}
          >
            {searchState.status === 'idle' ? 'Find Similar Creators' : 'Processing...'}
          </button>
        </form>
      </div>
    </div>
  );
}
