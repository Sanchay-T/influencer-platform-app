'use client'

import { useState, useEffect, useRef } from 'react'
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function SimilarSearchProgress({ searchData, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [startTime] = useState(new Date());
  const [displayProgress, setDisplayProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const pollIntervalRef = useRef(null);
  const router = useRouter();

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        // Determine API endpoint based on platform
        const apiEndpoint = searchData.platform === 'tiktok' ? 
          '/api/scraping/tiktok-similar' : 
          '/api/scraping/instagram';
        
        const response = await fetch(`${apiEndpoint}?jobId=${searchData.jobId}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          if (retryCount >= maxRetries) {
            clearInterval(pollIntervalRef.current);
          } else {
            setRetryCount(prev => prev + 1);
          }
          return;
        }

        // Reset retry count on successful response
        setRetryCount(0);

        // Use explicit progress if available
        let calculatedProgress = data.progress !== undefined 
          ? parseFloat(data.progress) 
          : 0;
        
        // If progress is still 0, use time-based estimate
        if (calculatedProgress <= 0) {
          const elapsedSeconds = (new Date() - startTime) / 1000;
          const estimatedTotalSeconds = 60; // Estimated total time for similar search
          calculatedProgress = Math.min(elapsedSeconds / estimatedTotalSeconds * 100, 99);
        }
        
        setProgress(calculatedProgress);
        setStatus(data.status);

        // Smoothly animate progress - never decrease, only increase
        setDisplayProgress(prev => Math.max(prev, calculatedProgress));

        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          // Ensure we set progress to 100 when completed
          setProgress(100);
          setDisplayProgress(100);
          onComplete({ 
            status: 'completed',
            creators: data.creators || []
          });
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        if (retryCount >= maxRetries) {
          clearInterval(pollIntervalRef.current);
          setError("Unable to connect to the server. Please check your campaign status later.");
        } else {
          setRetryCount(prev => prev + 1);
        }
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  };

  useEffect(() => {
    if (!searchData?.jobId) return;
    
    startPolling();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [searchData?.jobId, onComplete, startTime]);

  const handleRetry = () => {
    setError(null);
    setRetryCount(0);
    startPolling();
  };

  const handleBackToDashboard = () => {
    router.push('/');
  };

  // Calculate estimated time remaining
  const getEstimatedTimeLeft = () => {
    if (displayProgress >= 100 || displayProgress <= 0) return '';
    
    const elapsedSeconds = (new Date() - startTime) / 1000;
    const estimatedTotalSeconds = (elapsedSeconds / displayProgress) * 100;
    const remainingSeconds = estimatedTotalSeconds - elapsedSeconds;
    
    if (remainingSeconds < 60) return 'less than a minute';
    if (remainingSeconds < 120) return 'about a minute';
    return `about ${Math.round(remainingSeconds / 60)} minutes`;
  };

  // Get progress stage description for similar search
  const getProgressStage = () => {
    if (status === 'pending') return 'Preparing search';
    if (status === 'completed') return 'All done';
    if (status === 'timeout') return 'Search timed out';
    if (error) return 'Processing with delays';
    
    const platform = searchData.platform === 'tiktok' ? 'TikTok' : 'Instagram';
    
    if (displayProgress < 25) return `Getting ${platform} profile`;
    if (displayProgress < 50) return 'Extracting keywords';
    if (displayProgress < 75) return 'Finding similar creators';
    return 'Finalizing results';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="space-y-8 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          {status === 'completed' ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : status === 'timeout' ? (
            <AlertCircle className="h-6 w-6 text-amber-500" />
          ) : error && retryCount >= maxRetries ? (
            <button 
              onClick={handleRetry}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
            >
              <RefreshCcw className="h-5 w-5" />
            </button>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-gray-900" />
          )}
          
          <h2 className="text-xl font-medium text-gray-900 mt-2">
            {status === 'completed' 
              ? 'Campaign completed' 
              : status === 'timeout'
              ? 'Campaign timed out'
              : error && retryCount >= maxRetries
              ? 'Connection issue'
              : error
              ? 'Processing with delays'
              : 'Processing your campaign'}
          </h2>
          
          <p className="text-sm text-gray-500 max-w-xs">
            {error && retryCount >= maxRetries
              ? "We're having trouble reaching our servers. Click the refresh icon to try again."
              : error 
              ? "We're experiencing some delays, but your campaign is still processing."
              : status === 'completed'
              ? "Your campaign has been successfully processed."
              : status === 'timeout'
              ? "Your campaign exceeded the maximum allowed processing time. Please start a new search with more specific criteria."
              : `We're working on your campaign. Estimated time remaining: ${getEstimatedTimeLeft()}.`}
          </p>
        </div>

        <div className="w-full space-y-2">
          <Progress 
            value={displayProgress} 
            className="h-1.5 w-full bg-gray-100" 
          />
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>{Math.round(displayProgress)}% completed</span>
            <span>{getProgressStage()}</span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleBackToDashboard}
          className="w-full"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}