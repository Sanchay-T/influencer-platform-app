'use client'

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";

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
    <Card className="bg-zinc-900/80 border border-zinc-700/50">
      <CardHeader>
        <CardTitle>Find Similar Creators</CardTitle>
        {searchState.message && (
          <div className="space-y-2">
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
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-medium">Platform</label>
            <div className="space-y-3">
              {[
                {
                  value: 'tiktok',
                  title: 'TikTok',
                  description: 'Discover lookalike creators on TikTok',
                  disabled: true,
                  badge: 'Coming Soon',
                },
                {
                  value: 'instagram',
                  title: 'Instagram',
                  description: 'Find Instagram creators similar to a known handle',
                },
                {
                  value: 'youtube',
                  title: 'YouTube',
                  description: 'Identify YouTube channels with matching audiences',
                },
              ].map((platform) => {
                const isActive = selectedPlatform === platform.value;
                const isDisabled = Boolean(platform.disabled);
                return (
                  <button
                    key={platform.value}
                    type="button"
                    onClick={() => {
                      if (!isDisabled) {
                        setSelectedPlatform(platform.value);
                      }
                    }}
                    disabled={isDisabled}
                    className={`w-full rounded-lg border p-4 text-left transition-all ${
                      isActive
                        ? 'border-primary bg-primary/10'
                        : 'border-zinc-700 hover:border-zinc-600'
                    } ${isDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                          isActive ? 'border-primary bg-primary' : 'border-zinc-400'
                        }`}
                      >
                        {isActive && <span className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-100">{platform.title}</span>
                          {platform.badge && (
                            <Badge variant="outline" className="uppercase tracking-wide text-xs">
                              {platform.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">{platform.description}</p>
                      </div>
                    </div>
                  </button>
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
                selectedPlatform === 'tiktok' ? "e.g. stoolpresidente" : 
                selectedPlatform === 'youtube' ? "e.g. mkbhd" : 
                "e.g. gainsbybrains"
              }
              required
              disabled={searchState.status !== 'idle'}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={searchState.status !== 'idle' || !username.trim() || error}
          >
            {searchState.status === 'idle' ? 'Find Similar Creators' : 'Processing...'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
