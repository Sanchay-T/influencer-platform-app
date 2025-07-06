'use client'

import { useState, useEffect, useRef } from 'react'
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function SearchProgress({ jobId, onComplete, onIntermediateResults, platform = 'tiktok' }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [startTime] = useState(new Date());
  const [displayProgress, setDisplayProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [intermediateCreators, setIntermediateCreators] = useState([]);
  const [showIntermediateResults, setShowIntermediateResults] = useState(false);
  const maxRetries = 3;
  const pollIntervalRef = useRef(null);
  const router = useRouter();

  // Adaptive polling interval based on progress
  const getPollingInterval = (progress) => {
    if (progress < 20) return 1000;  // 1 second - users are anxious at start
    if (progress < 80) return 3000;  // 3 seconds - standard polling
    return 5000;                     // 5 seconds - less frequent when nearly done
  };

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const poll = async () => {
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
            clearTimeout(pollIntervalRef.current);
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

        // Update results tracking for enhanced feedback
        if (currentProcessedResults !== undefined && currentProcessedResults !== null) {
          setProcessedResults(currentProcessedResults);
        }
        if (currentTargetResults !== undefined && currentTargetResults !== null) {
          setTargetResults(currentTargetResults);
        }

        // Update processing speed
        const speed = calculateProcessingSpeed();
        setProcessingSpeed(speed);

        // Smoothly animate progress - never decrease, only increase
        setDisplayProgress(prev => Math.max(prev, calculatedProgress));

        // Check for intermediate results while processing
        if (currentStatus === 'processing' && data.results && data.results.length > 0) {
          const foundCreators = data.results.reduce((acc, result) => {
            return [...acc, ...(result.creators || [])];
          }, []);
          
          if (foundCreators.length > 0) {
            console.log('🎯 [SEARCH-PROGRESS] Found intermediate results:', {
              count: foundCreators.length,
              progress: calculatedProgress,
              status: currentStatus
            });
            
            setIntermediateCreators(foundCreators);
            setShowIntermediateResults(true);
            
            // Still call the callback if provided
            if (onIntermediateResults) {
              onIntermediateResults({
                creators: foundCreators,
                progress: calculatedProgress,
                status: currentStatus,
                isPartial: true
              });
            }
          }
        }

        // Check for completion
        if (currentStatus === 'completed') {
          console.log('🎉 [SEARCH-PROGRESS] Job completed! Stopping polling.');
          clearTimeout(pollIntervalRef.current);
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
        
        // Schedule next poll with adaptive interval (only if not completed)
        if (currentStatus !== 'completed') {
          const nextInterval = getPollingInterval(calculatedProgress);
          console.log('🔄 [ADAPTIVE-POLLING] Scheduling next poll:', {
            currentProgress: Math.round(calculatedProgress),
            nextInterval: nextInterval + 'ms',
            intervalType: nextInterval === 1000 ? 'fast' : nextInterval === 3000 ? 'normal' : 'slow'
          });
          
          pollIntervalRef.current = setTimeout(poll, nextInterval);
        }
        
      } catch (error) {
        console.error('Error polling job status:', error);
        if (retryCount >= maxRetries) {
          clearTimeout(pollIntervalRef.current);
          setError("Unable to connect to the server. Please check your campaign status later.");
        } else {
          setRetryCount(prev => prev + 1);
          // Retry with normal interval on error
          pollIntervalRef.current = setTimeout(poll, 3000);
        }
      }
    };
    
    // Start first poll immediately
    poll();

    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
    };
  };

  useEffect(() => {
    if (!jobId) return;
    
    startPolling();
    
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
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

  // Track results for enhanced feedback
  const [processedResults, setProcessedResults] = useState(0);
  const [targetResults, setTargetResults] = useState(1000);
  const [processingSpeed, setProcessingSpeed] = useState(0);

  // Get enhanced progress stage description with context and platform-specific details
  const getProgressStage = () => {
    if (status === 'pending') return 'Preparing search';
    if (status === 'completed') {
      return `Found ${processedResults} ${platform.toLowerCase()} creators successfully`;
    }
    if (status === 'timeout') return 'Search timed out';
    if (error) return 'Processing with delays';
    
    // Platform-specific enhanced stage descriptions
    const platformName = platform || 'TikTok';
    const speed = processingSpeed > 0 ? ` (~${processingSpeed}/min)` : '';
    
    if (processedResults > 0) {
      if (displayProgress < 25) {
        return `Found ${processedResults} ${platformName.toLowerCase()} creators, discovering more${speed}`;
      }
      if (displayProgress < 50) {
        return `Analyzing ${processedResults} ${platformName.toLowerCase()} profiles & engagement${speed}`;
      }
      if (displayProgress < 75) {
        return `Processing ${processedResults} creator profiles & extracting contact info${speed}`;
      }
      return `Finalizing ${processedResults} ${platformName.toLowerCase()} creators & preparing export${speed}`;
    } else {
      // No results yet - show platform-specific searching messages
      if (displayProgress < 25) return `Searching ${platformName.toLowerCase()} database...`;
      if (displayProgress < 50) return `Analyzing ${platformName.toLowerCase()} content...`;
      if (displayProgress < 75) return `Processing ${platformName.toLowerCase()} profiles...`;
      return 'Finalizing search results...';
    }
  };

  // Calculate processing speed (creators per minute)
  const calculateProcessingSpeed = () => {
    const elapsedSeconds = (new Date() - startTime) / 1000;
    if (elapsedSeconds > 0 && processedResults > 0) {
      const creatorsPerMinute = (processedResults / elapsedSeconds) * 60;
      return Math.round(creatorsPerMinute);
    }
    return 0;
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

        <div className="w-full space-y-3">
          {/* Main Progress Bar */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {getProgressStage()}
                </span>
              </div>
              {processedResults > 0 && (
                <span className="text-sm font-medium text-blue-800 bg-blue-100 px-2 py-1 rounded">
                  {processedResults} found so far
                </span>
              )}
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(displayProgress, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Intermediate Results Section */}
        {showIntermediateResults && intermediateCreators.length > 0 && (
          <div className="w-full mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Partial Results ({intermediateCreators.length} creators)
              </h3>
              <span className="text-sm text-gray-500">More results loading...</span>
            </div>
            
            {/* Creator List matching your design */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {intermediateCreators.slice(0, 5).map((creator, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border-l-4 border-l-blue-500">
                    {creator.creator?.avatarUrl ? (
                      <img 
                        src={creator.creator.avatarUrl} 
                        alt={creator.creator.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-600">
                        {creator.creator?.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {creator.creator?.name || 'Unknown Creator'}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {creator.video?.description || 'No description available'}
                    </p>
                    {creator.creator?.followers && (
                      <p className="text-xs text-gray-500 mt-1">
                        {creator.creator.followers.toLocaleString()} followers
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {intermediateCreators.length > 5 && (
                <div className="text-center py-3 text-sm text-gray-500 bg-gray-50 rounded-lg">
                  And {intermediateCreators.length - 5} more results...
                </div>
              )}
            </div>
          </div>
        )}

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