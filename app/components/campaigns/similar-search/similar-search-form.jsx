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
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";

export function SimilarSearchForm({ campaignId, onSuccess }) {
  const [username, setUsername] = useState("");
  const [searchState, setSearchState] = useState({
    status: 'idle', // idle, searching, processing
    message: ''
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
      console.log('🔄 [SIMILAR-SEARCH-FORM] Making API request to /api/scraping/instagram');
      const response = await fetch('/api/scraping/instagram', {
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
      setSearchState({ 
        status: 'processing', 
        message: 'Processing similar profiles...' 
      });

      // Start polling
      console.log('🔄 [SIMILAR-SEARCH-FORM] Starting polling for results with jobId:', data.jobId);
      pollResults(data.jobId);
      
    } catch (error) {
      console.error('💥 [SIMILAR-SEARCH-FORM] Error during submission:', error);
      setSearchState({ status: 'idle', message: '' });
      toast.error('Error starting search. Please try again.');
    }
  };

  const pollResults = async (jobId) => {
    console.log('🔄 [SIMILAR-SEARCH-FORM] Polling for results, jobId:', jobId);
    try {
      const response = await fetch(`/api/scraping/instagram?jobId=${jobId}`);
      const data = await response.json();
      console.log('📊 [SIMILAR-SEARCH-FORM] Poll response:', { 
        status: data.status, 
        progress: data.progress 
      });

      if (data.status === 'completed') {
        console.log('✅ [SIMILAR-SEARCH-FORM] Search completed');
        if (!data.creators || data.creators.length === 0) {
          console.log('❌ [SIMILAR-SEARCH-FORM] No profiles found');
          setSearchState({ status: 'idle', message: '' });
          toast.error('No similar profiles found for this username. Please try with a different username.');
          return;
        }
        
        console.log('📦 [SIMILAR-SEARCH-FORM] Storing results in session storage');
        sessionStorage.setItem('searchResults', JSON.stringify(data.creators));
        window.location.href = `/campaigns/search/similar/results?campaignId=${campaignId}`;
      } else if (data.status === 'error') {
        console.error('❌ [SIMILAR-SEARCH-FORM] Search error:', data.error);
        setSearchState({ status: 'idle', message: '' });
        let errorMessage = 'An error occurred while processing your request. Please try again.';
        
        if (data.error?.toLowerCase().includes('not found') || 
            data.error?.toLowerCase().includes('no similar profiles')) {
          errorMessage = 'No similar profiles found for this username. Please try with a different username.';
        } else if (data.error?.toLowerCase().includes('invalid profile')) {
          errorMessage = 'The profile information could not be processed. Please try with a different username.';
        }
        
        toast.error(errorMessage);
      } else {
        console.log('🔄 [SIMILAR-SEARCH-FORM] Search in progress:', data.progress || 0);
        setSearchState({ 
          status: 'processing', 
          message: `Processing similar profiles... ${data.progress || 0}%` 
        });
        if (data.status !== 'error') {
          setTimeout(() => pollResults(jobId), 5000);
        }
      }
    } catch (error) {
      console.error('💥 [SIMILAR-SEARCH-FORM] Error polling for results:', error);
      setSearchState({ status: 'idle', message: '' });
      toast.error('Error checking search status. Please try again.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Find Similar Creators on Instagram</CardTitle>
        {searchState.message && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {searchState.status === 'processing' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {searchState.message}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-medium">Instagram Username</label>
            <Input
              value={username}
              onChange={handleUsernameChange}
              placeholder="e.g. gainsbybrains"
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
