'use client'

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "react-hot-toast";
import { Loader2, Lock } from "lucide-react";
import { FeatureGate } from '@/app/components/billing/protect';

export function SimilarSearchForm({ campaignId, onSuccess }) {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("tiktok"); // tiktok, instagram, or youtube
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
        platform === 'tiktok' ? '/api/scraping/tiktok-similar' : 
        platform === 'youtube' ? '/api/scraping/youtube-similar' : 
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
          platform: platform,
          targetUsername: username
        });
      }
      
      toast.success(`${platform === 'tiktok' ? 'TikTok' : 'Instagram'} similar search started!`);
      
    } catch (error) {
      console.error('💥 [SIMILAR-SEARCH-FORM] Error during submission:', error);
      setSearchState({ status: 'idle', message: '' });
      toast.error('Error starting search. Please try again.');
    }
  };


  return (
    <Card>
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
            <div className="flex space-x-4">
              <div className="flex items-center">
                <Checkbox
                  checked={platform === "tiktok"}
                  onCheckedChange={() => setPlatform("tiktok")}
                />
                <span className="ml-2">TikTok</span>
              </div>
              <FeatureGate 
                feature="instagram_search"
                fallback={
                  <div className="flex items-center opacity-50">
                    <Checkbox
                      checked={false}
                      disabled
                    />
                    <span className="ml-2 flex items-center gap-1">
                      Instagram 
                      <Lock className="h-3 w-3" />
                      <span className="text-xs text-blue-600">(Premium)</span>
                    </span>
                  </div>
                }
              >
                <div className="flex items-center">
                  <Checkbox
                    checked={platform === "instagram"}
                    onCheckedChange={() => setPlatform("instagram")}
                  />
                  <span className="ml-2">Instagram</span>
                </div>
              </FeatureGate>
              <FeatureGate 
                feature="youtube_search"
                fallback={
                  <div className="flex items-center opacity-50">
                    <Checkbox
                      checked={false}
                      disabled
                    />
                    <span className="ml-2 flex items-center gap-1">
                      YouTube 
                      <Lock className="h-3 w-3" />
                      <span className="text-xs text-blue-600">(Premium)</span>
                    </span>
                  </div>
                }
              >
                <div className="flex items-center">
                  <Checkbox
                    checked={platform === "youtube"}
                    onCheckedChange={() => setPlatform("youtube")}
                  />
                  <span className="ml-2">YouTube</span>
                </div>
              </FeatureGate>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium">
              {platform === 'tiktok' ? 'TikTok' : platform === 'youtube' ? 'YouTube' : 'Instagram'} Username
            </label>
            <Input
              value={username}
              onChange={handleUsernameChange}
              placeholder={
                platform === 'tiktok' ? "e.g. stoolpresidente" : 
                platform === 'youtube' ? "e.g. mkbhd" : 
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
