'use client'

import { useState, useEffect, useRef } from 'react'
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function SearchProgress({ jobId, onComplete, platform = 'tiktok' }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [recovery, setRecovery] = useState(null);
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
        // Enhanced polling with platform-aware endpoint and logging
        console.log('\n🔄 [SEARCH-PROGRESS] Starting poll:', {
          jobId: jobId,
          pollNumber: pollIntervalRef.current ? 'ongoing' : 'first',
          timestamp: new Date().toISOString()
        });
        
        // Determine the correct API endpoint based on platform
        let apiEndpoint;
        const normalizedPlatform = platform?.toLowerCase?.() || String(platform).toLowerCase();
        
        if (normalizedPlatform === 'instagram') {
          apiEndpoint = `/api/scraping/instagram-hashtag?jobId=${jobId}`;
        } else if (normalizedPlatform === 'youtube') {
          apiEndpoint = `/api/scraping/youtube?jobId=${jobId}`;
        } else {
          apiEndpoint = `/api/scraping/tiktok?jobId=${jobId}`;
        }
        
        console.log('🎯 [SEARCH-PROGRESS] Using endpoint:', {
          platform: platform,
          platformType: typeof platform,
          normalizedPlatform: normalizedPlatform,
          apiEndpoint: apiEndpoint
        });
        
        const response = await fetch(apiEndpoint);
        
        // Check for 404 errors and log them
        if (!response.ok) {
          console.error(`❌ [SEARCH-PROGRESS] API error: ${response.status} ${response.statusText}`, {
            url: apiEndpoint,
            jobId: jobId,
            platform: platform,
            status: response.status
          });
          
          // If it's a 404, throw an error to trigger retry
          if (response.status === 404) {
            throw new Error(`API endpoint not found: ${apiEndpoint}`);
          }
        }
        
        const data = await response.json();
        
        console.log('📡 [SEARCH-PROGRESS] Poll response:', {
          status: response.status,
          jobStatus: data.job?.status || data.status,
          progress: data.job?.progress || data.progress,
          processedResults: data.job?.processedResults || data.processedResults,
          error: data.job?.error || data.error,
          fullData: data
        });

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

        // Check for recovery message from backend
        if (data.recovery) {
          setRecovery(data.recovery);
          setTimeout(() => setRecovery(null), 5000); // Clear recovery message after 5 seconds
        }

        // Enhanced progress calculation with detailed logging
        let calculatedProgress = 0;
        
        // Handle both old format (data.progress) and new format (data.job.progress)
        const jobData = data.job || data;
        const currentStatus = jobData.status;
        const currentProgress = jobData.progress;
        const currentProcessedResults = jobData.processedResults;
        const currentTargetResults = jobData.targetResults;
        
        console.log('📈 [SEARCH-PROGRESS] Job data extraction:', {
          hasJobProperty: !!data.job,
          status: currentStatus,
          progress: currentProgress,
          processedResults: currentProcessedResults,
          targetResults: currentTargetResults
        });
        
        // First, check if we have explicit progress from the API
        if (currentProgress !== undefined && currentProgress !== null) {
          calculatedProgress = parseFloat(currentProgress);
          console.log('📈 [SEARCH-PROGRESS] Using explicit progress:', calculatedProgress);
        } 
        // Otherwise, calculate from processed results
        else if (currentProcessedResults && currentTargetResults) {
          calculatedProgress = (currentProcessedResults / currentTargetResults) * 100;
          console.log('📈 [SEARCH-PROGRESS] Calculated from results:', {
            processedResults: currentProcessedResults,
            targetResults: currentTargetResults,
            calculated: calculatedProgress
          });
        }
        // Fallback to time-based estimate
        else {
          const elapsedSeconds = (new Date() - startTime) / 1000;
          const estimatedTotalSeconds = 180; // Estimated total time in seconds
          calculatedProgress = Math.min(elapsedSeconds / estimatedTotalSeconds * 100, 99);
          console.log('📈 [SEARCH-PROGRESS] Time-based estimate:', {
            elapsedSeconds: elapsedSeconds,
            calculatedProgress: calculatedProgress
          });
        }
        
        // IMPORTANT: Check if Instagram job is stuck at 99%
        if (normalizedPlatform === 'instagram' && calculatedProgress >= 99 && currentStatus !== 'completed') {
          console.warn('⚠️ [SEARCH-PROGRESS] Instagram job stuck at 99%!', {
            jobId: jobId,
            status: currentStatus,
            progress: calculatedProgress,
            rawProgress: currentProgress,
            processedResults: currentProcessedResults,
            targetResults: currentTargetResults,
            fullData: data
          });
        }
        
        setProgress(calculatedProgress);
        setStatus(currentStatus);

        // Smoothly animate progress - never decrease, only increase
        setDisplayProgress(prev => Math.max(prev, calculatedProgress));

        // Check for completion
        if (currentStatus === 'completed') {
          console.log('🎉 [SEARCH-PROGRESS] Job completed! Stopping polling.');
          clearInterval(pollIntervalRef.current);
          // Ensure we set progress to 100 when completed
          setProgress(100);
          setDisplayProgress(100);
          onComplete({ 
            status: 'completed',
            creators: data.results?.[0]?.creators || data.creators || []
          });
        }
        
        // Also check if Apify status shows completed but job status hasn't updated
        if (data.apifyStatus && data.apifyStatus.status === 'SUCCEEDED' && currentStatus !== 'completed') {
          console.warn('⚠️ [SEARCH-PROGRESS] Apify succeeded but job not marked complete! Apify finished at:', data.apifyStatus.finishedAt);
          // The GET endpoint should handle this, but log it for debugging
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
    if (!jobId) return;
    
    startPolling();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, onComplete, startTime]);

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

  // Get progress stage description
  const getProgressStage = () => {
    if (status === 'pending') return 'Preparing search';
    if (status === 'completed') return 'All done';
    if (status === 'timeout') return 'Search timed out';
    if (error) return 'Processing with delays';
    
    if (displayProgress < 25) return 'Finding creators';
    if (displayProgress < 50) return 'Analyzing profiles';
    if (displayProgress < 75) return 'Processing data';
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
              : recovery
              ? 'Resuming campaign'
              : 'Processing your campaign'}
          </h2>
          
          <p className="text-sm text-gray-500 max-w-xs">
            {error && retryCount >= maxRetries
              ? "We're having trouble reaching our servers. Click the refresh icon to try again."
              : error 
              ? "We're experiencing some delays, but your campaign is still processing."
              : recovery
              ? "We detected an interruption and automatically resumed your campaign."
              : status === 'completed'
              ? "Your campaign has been successfully processed."
              : status === 'timeout'
              ? "Your campaign exceeded the maximum allowed processing time. Please start a new search with more specific criteria."
              : `We're working on your campaign. Estimated time remaining: ${getEstimatedTimeLeft()}.`}
          </p>
          
          {recovery && (
            <div className="mt-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-700">
              Campaign processing resumed automatically
            </div>
          )}
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