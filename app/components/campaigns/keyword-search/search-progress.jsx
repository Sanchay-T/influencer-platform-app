'use client'

import { useState, useEffect, useRef } from 'react'
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function SearchProgress({ jobId, onComplete, onIntermediateResults, platform = 'tiktok', searchData }) {
  // Debug logging for props
  console.log('🚀 [SEARCH-PROGRESS] Component initialized with props:', {
    jobId: jobId,
    platform: platform,
    searchData: searchData,
    searchDataType: typeof searchData,
    hasTargetUsername: searchData?.targetUsername,
    hasKeywords: searchData?.keywords
  });
  
  // Instagram similar search detection (case-insensitive)
  const platformNormalized = (searchData?.platform || platform || '').toLowerCase();
  const isInstagramSimilar = searchData?.targetUsername && platformNormalized === 'instagram';
  console.log('🔍 [SEARCH-PROGRESS] Search type detection:', {
    isInstagramSimilar,
    platform: searchData?.platform || platform,
    platformNormalized,
    hasTargetUsername: !!searchData?.targetUsername
  });

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [startTime] = useState(new Date());
  const [displayProgress, setDisplayProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [intermediateCreators, setIntermediateCreators] = useState([]);
  const [showIntermediateResults, setShowIntermediateResults] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force re-render trigger
  const maxRetries = 3;
  const pollIntervalRef = useRef(null);
  const router = useRouter();
  
  // 🚨 VALIDATION LOG: Track component state initialization
  console.log('🔍 [STATE-VALIDATION] SearchProgress state initialized:', {
    jobId,
    initialIntermediateCreators: intermediateCreators.length,
    initialRenderKey: renderKey,
    isInstagramSimilar,
    timestamp: new Date().toISOString()
  });

  // Standard polling intervals for all platforms
  const getPollingInterval = (progress) => {
    if (progress < 70) return 1500;  // 1.5 seconds - faster for live updates
    if (progress < 95) return 2000;  // 2 seconds - still frequent
    return 3000;                     // 3 seconds - when nearly done
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
        
        // Determine the correct API endpoint based on platform and search type
        let apiEndpoint;
        const normalizedPlatform = platform?.toLowerCase?.() || String(platform).toLowerCase();
        const isSimilarSearch = searchData?.targetUsername; // Similar search has targetUsername, keyword search has keywords
        
        console.log('🔍 [ENDPOINT-DETECTION] API endpoint selection:', {
          platform: platform,
          normalizedPlatform: normalizedPlatform,
          searchData: searchData,
          targetUsername: searchData?.targetUsername,
          keywords: searchData?.keywords,
          isSimilarSearch: isSimilarSearch
        });
        
        if (isSimilarSearch) {
          // Similar search endpoints
          if (normalizedPlatform === 'instagram') {
            apiEndpoint = `/api/scraping/instagram?jobId=${jobId}`;
          } else if (normalizedPlatform === 'youtube') {
            apiEndpoint = `/api/scraping/youtube-similar?jobId=${jobId}`;
          } else {
            apiEndpoint = `/api/scraping/tiktok-similar?jobId=${jobId}`;
          }
        } else {
          // Keyword search endpoints (existing logic)
          if (normalizedPlatform === 'instagram') {
            apiEndpoint = `/api/scraping/instagram-reels?jobId=${jobId}`;
          } else if (normalizedPlatform === 'youtube') {
            apiEndpoint = `/api/scraping/youtube?jobId=${jobId}`;
          } else {
            apiEndpoint = `/api/scraping/tiktok?jobId=${jobId}`;
          }
        }
        
        console.log('🎯 [SEARCH-PROGRESS] Using endpoint:', {
          platform: platform,
          platformType: typeof platform,
          normalizedPlatform: normalizedPlatform,
          searchType: isSimilarSearch ? 'similar' : 'keyword',
          targetUsername: searchData?.targetUsername,
          apiEndpoint: apiEndpoint
        });
        
        // Try fetch with browser-compatible timeout
        let response;
        try {
          // Check if AbortSignal.timeout is supported (newer browsers only)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          response = await fetch(apiEndpoint, {
            headers: {
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
        } catch (fetchError) {
          // If fetch fails with timeout/network error, try simple fetch as fallback
          console.log('⚠️ [FETCH-FALLBACK] First fetch failed, trying simple fallback...', fetchError.message);
          response = await fetch(apiEndpoint, {
            headers: {
              'Content-Type': 'application/json'
            }
            // No timeout for fallback
          });
        }
        
        // Check for API errors and log them
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
          
          // If it's a 401, it's likely a temporary auth issue - continue polling
          if (response.status === 401) {
            console.warn('⚠️ [SEARCH-PROGRESS] 401 Unauthorized - continuing to poll (may be temporary)');
            // Don't throw error, just continue polling
            return;
          }
        }
        
        const data = await response.json();
        
        console.log('📡 [SEARCH-PROGRESS] Poll response:', {
          status: response.status,
          jobStatus: data.job?.status || data.status,
          progress: data.job?.progress || data.progress,
          processedResults: data.job?.processedResults || data.processedResults,
          error: data.job?.error || data.error,
          resultsLength: data.results?.length || 0,
          firstResultCreatorsCount: data.results?.[0]?.creators?.length || 0
        });
        
        // 🚨 COMPREHENSIVE POLLING DEBUG: Log exact data structure received
        console.log('🚨 [POLLING-DEBUG] Complete API response analysis:', {
          responseType: typeof data,
          responseKeys: Object.keys(data),
          hasResults: !!data.results,
          resultsArray: data.results,
          resultsType: typeof data.results,
          resultsLength: data.results?.length || 0,
          firstResult: data.results?.[0],
          firstResultType: typeof data.results?.[0],
          firstResultKeys: data.results?.[0] ? Object.keys(data.results[0]) : 'no keys',
          hasCreatorsInFirstResult: !!data.results?.[0]?.creators,
          creatorsCount: data.results?.[0]?.creators?.length || 0,
          platform: normalizedPlatform,
          isSimilarSearch: isSimilarSearch
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
          // 🚨 VISIBLE DEBUG: Log to console and show alert for debugging
          const debugInfo = {
            resultsType: typeof data.results,
            resultsLength: data.results.length,
            firstResult: data.results[0],
            firstResultType: typeof data.results[0],
            firstResultKeys: data.results[0] ? Object.keys(data.results[0]) : 'no keys',
            searchType: searchData?.targetUsername ? 'similar' : 'keyword'
          };
          
          console.log('🔍 [INTERMEDIATE-DEBUG] Raw results data:', debugInfo);
          
          // 🚨 SUPER VISIBLE: Also log to console in a way that's easy to see
          console.warn('🚨 INTERMEDIATE RESULTS DEBUG:', debugInfo);
          
          const foundCreators = data.results.reduce((acc, result) => {
            return [...acc, ...(result.creators || [])];
          }, []);
          
          // 🚨 CRITICAL DEBUG: Log detailed creator extraction
          console.log('🚨 [CREATOR-EXTRACTION] Detailed analysis:', {
            totalResultObjects: data.results.length,
            creatorsInEachResult: data.results.map((r, idx) => ({
              resultIndex: idx,
              hasCreators: !!r.creators,
              creatorsCount: r.creators?.length || 0,
              firstCreatorName: r.creators?.[0]?.creator?.name || 'no name'
            })),
            foundCreatorsTotal: foundCreators.length,
            foundCreatorsFirst5: foundCreators.slice(0, 5).map(c => c.creator?.name),
            extractionMethod: 'reduce accumulation'
          });
          
          console.log('🔍 [INTERMEDIATE-DEBUG] Extracted creators:', {
            foundCount: foundCreators.length,
            firstCreator: foundCreators[0],
            searchType: searchData?.targetUsername ? 'similar' : 'keyword'
          });
          
          if (foundCreators.length > 0) {
            console.log('🎯 [SEARCH-PROGRESS] Found intermediate results:', {
              count: foundCreators.length,
              progress: calculatedProgress,
              status: currentStatus
            });
            
            // 🚨 VALIDATION LOG: Deep analysis of data source and freshness
            console.log('🚨 [DATA-FRESHNESS-VALIDATION] Analyzing found creators before state update:', {
              jobId,
              dataSource: 'API polling response',
              foundCreatorsCount: foundCreators.length,
              foundCreatorNames: foundCreators.slice(0, 5).map(c => c.creator?.name),
              currentIntermediateCount: intermediateCreators.length,
              isDataFresh: foundCreators.length !== intermediateCreators.length,
              apiResponseTimestamp: new Date().toISOString(),
              potentialStaleDataIssue: foundCreators.length === 80 && intermediateCreators.length === 80
            });
            
            // 🔄 LIVE UPDATES: Only add NEW creators, don't replace entire list
            setIntermediateCreators(prevCreators => {
              // 🔍 DETAILED DEBUGGING: Log exactly what we're comparing
              console.log('🔍 [LIVE-UPDATE-DEBUG] Comparing creators:', {
                previousCount: prevCreators.length,
                newCount: foundCreators.length,
                prevFirstCreator: prevCreators[0]?.creator?.name || 'none',
                newFirstCreator: foundCreators[0]?.creator?.name || 'none',
                prevLastCreator: prevCreators[prevCreators.length - 1]?.creator?.name || 'none',
                newLastCreator: foundCreators[foundCreators.length - 1]?.creator?.name || 'none',
                prevCreators: prevCreators.slice(0, 5).map(c => c.creator?.name),
                newCreators: foundCreators.slice(0, 5).map(c => c.creator?.name)
              });
              
              // 🚨 CRITICAL: Compare the actual creator arrays content, not just length
              const prevNames = prevCreators.map(c => c.creator?.name).join(',');
              const newNames = foundCreators.map(c => c.creator?.name).join(',');
              const contentChanged = prevNames !== newNames;
              
              console.log('🚨 [CONTENT-COMPARISON] Creator content analysis:', {
                lengthChanged: foundCreators.length !== prevCreators.length,
                contentChanged: contentChanged,
                prevNamesString: prevNames.substring(0, 100) + '...',
                newNamesString: newNames.substring(0, 100) + '...'
              });
              
              // Check if we have new creators to add OR content changed
              if (foundCreators.length > prevCreators.length || contentChanged) {
                console.log('📈 [LIVE-UPDATE] Updating creators:', {
                  previousCount: prevCreators.length,
                  newCount: foundCreators.length,
                  newCreatorsAdded: foundCreators.length - prevCreators.length,
                  contentChanged: contentChanged,
                  progress: calculatedProgress
                });
                
                // 🎯 SUPER VISIBLE: Alert for debugging live updates
                console.warn('🚨 CREATORS UPDATE DETECTED!', {
                  reason: foundCreators.length > prevCreators.length ? 'length increase' : 'content change',
                  from: prevCreators.length,
                  to: foundCreators.length
                });
                
                // 🔄 FORCE RE-RENDER: Trigger React to re-render the cards
                setRenderKey(prev => prev + 1);
                console.log('🔄 [FORCE-RENDER] Triggered re-render with key:', renderKey + 1);
                
                return foundCreators; // Update with new list
              }
              
              // Even if no new creators, log the current state
              console.log('📊 [LIVE-UPDATE] No changes detected - Current count:', prevCreators.length, 'API count:', foundCreators.length);
              return prevCreators; // Keep existing if no new creators
            });
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
          // 🛡️ ENHANCED COMPLETION: Handle different completion types
          const isPartialCompletion = data.partialCompletion || data.gracefulCompletion || data.errorRecovered;
          const finalCount = data.finalCount || data.exactCountDelivered || currentProcessedResults;
          
          if (isPartialCompletion) {
            console.log('⚠️ [PARTIAL-COMPLETION] Job completed with partial results due to API issues:', {
              finalCount: finalCount,
              targetRequested: data.targetRequested || currentTargetResults,
              completionType: data.partialCompletion ? 'partial' : data.gracefulCompletion ? 'graceful' : 'error_recovered',
              message: data.message
            });
          } else {
            console.log('🎉 [SEARCH-PROGRESS] Job completed successfully! Stopping polling.');
          }
          
          clearTimeout(pollIntervalRef.current);
          setProgress(100);
          setDisplayProgress(100);
          onComplete({ 
            status: 'completed',
            creators: data.results?.[0]?.creators || data.creators || [],
            partialCompletion: isPartialCompletion,
            finalCount: finalCount,
            errorRecovered: data.errorRecovered
          });
        }
        
        // Also check if Apify status shows completed but job status hasn't updated
        if (data.apifyStatus && data.apifyStatus.status === 'SUCCEEDED' && currentStatus !== 'completed') {
          console.warn('⚠️ [SEARCH-PROGRESS] Apify succeeded but job not marked complete! Apify finished at:', data.apifyStatus.finishedAt);
          // The GET endpoint should handle this, but log it for debugging
        }
        
        // Schedule next poll with adaptive interval
        let shouldContinuePolling = currentStatus !== 'completed';
        
        if (shouldContinuePolling) {
          const nextInterval = getPollingInterval(calculatedProgress);
          
          console.log('🔄 [ADAPTIVE-POLLING] Scheduling next poll:', {
            currentProgress: Math.round(calculatedProgress),
            nextInterval: nextInterval + 'ms',
            intervalType: nextInterval === 1500 ? 'fast' : nextInterval === 2000 ? 'medium' : 'slow'
          });
          
          pollIntervalRef.current = setTimeout(poll, nextInterval);
        } else {
          console.log('⏹️ [POLLING] Stopping polling - job complete');
          clearTimeout(pollIntervalRef.current);
        }
        
      } catch (error) {
        console.error('❌ [POLL-ERROR] Error polling job status:', error);
        
        // Enhanced error handling for different error types
        let errorMessage = error.message;
        let shouldRetry = true;
        
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = 'Request timeout - server may be processing';
          console.log('⏱️ [POLL-TIMEOUT] Request timed out, will retry...');
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error - checking connection';
          console.log('🌐 [NETWORK-ERROR] Network connectivity issue, will retry...');
        } else if (error.message.includes('NetworkError')) {
          errorMessage = 'Server temporarily unavailable';
          console.log('🚫 [SERVER-ERROR] Server connection failed, will retry...');
        }
        
        // 🚨 VALIDATION LOG: Check if component shows stale data during connection errors
        console.log('🚨 [ERROR-STATE-CHECK] Component state during polling error:', {
          errorType: error.name,
          errorMessage: errorMessage,
          originalError: error.message,
          currentIntermediateCreators: intermediateCreators.length,
          currentRenderKey: renderKey,
          showingStaleData: intermediateCreators.length > 0,
          staleDataNames: intermediateCreators.slice(0, 3).map(c => c.creator?.name),
          jobId: jobId,
          retryCount: retryCount,
          willRetry: retryCount < maxRetries
        });
        
        if (retryCount >= maxRetries) {
          clearTimeout(pollIntervalRef.current);
          setError(`Connection failed after ${maxRetries} retries: ${errorMessage}`);
        } else {
          setRetryCount(prev => prev + 1);
          // Exponential backoff for retries
          const retryDelay = Math.min(3000 * Math.pow(2, retryCount), 15000); // Max 15 seconds
          console.log(`🔄 [RETRY] Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          pollIntervalRef.current = setTimeout(poll, retryDelay);
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
    
    // 🚨 VALIDATION LOG: Component lifecycle and state reset
    console.log('🚨 [LIFECYCLE-VALIDATION] Component mounting/jobId change:', {
      newJobId: jobId,
      currentIntermediateCreators: intermediateCreators.length,
      currentRenderKey: renderKey,
      shouldResetState: true,
      staleCreatorNames: intermediateCreators.slice(0, 3).map(c => c.creator?.name),
      timestamp: new Date().toISOString()
    });
    
    // Check if we have stale data that should be cleared
    if (intermediateCreators.length > 0) {
      console.log('🧹 [STATE-CLEANUP] WARNING: Found stale intermediate creators from previous job, should clear them');
      console.log('🧹 [STALE-DATA]:', {
        staleCount: intermediateCreators.length,
        staleNames: intermediateCreators.slice(0, 5).map(c => c.creator?.name),
        oldRenderKey: renderKey
      });
      // Reset stale state
      setIntermediateCreators([]);
      setRenderKey(0);
    }
    
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
      // 🎯 EXACT COUNT COMPLETION: Show exact delivery status
      const targetText = targetResults > 0 ? ` (target: ${targetResults})` : '';
      const exactMatch = targetResults > 0 && processedResults === targetResults;
      const statusText = exactMatch ? 'delivered exactly' : 'found';
      return `Successfully ${statusText} ${processedResults} ${platform.toLowerCase()} creators${targetText}`;
    }
    if (status === 'timeout') return 'Search timed out';
    if (status === 'rate_limited') return 'API rate limited, retrying...';
    if (status === 'server_error_retry') return 'API experiencing issues, retrying...';
    if (error) return 'Processing with delays';
    
    // Platform-specific enhanced stage descriptions
    const platformName = platform || 'TikTok';
    const speed = processingSpeed > 0 ? ` (~${processingSpeed}/min)` : '';
    
    // Defensive check for searchData with detailed logging
    let isSimilarSearch = false;
    let targetUser = '';
    try {
      isSimilarSearch = searchData && typeof searchData === 'object' && searchData.targetUsername;
      targetUser = searchData?.targetUsername || '';
      console.log('🔍 [PROGRESS-STAGE] Search type detection:', {
        searchData: searchData,
        searchDataType: typeof searchData,
        targetUsername: searchData?.targetUsername,
        isSimilarSearch: isSimilarSearch,
        platform: platformName
      });
    } catch (e) {
      console.error('❌ [PROGRESS-STAGE] Error accessing searchData:', e);
      isSimilarSearch = false;
    }
    
    const searchTypeText = isSimilarSearch ? 'similar' : 'keyword';
    
    // Special handling for Instagram reels bio/email enhancement progress
    const isInstagramReels = platformName.toLowerCase() === 'instagram' && !isSimilarSearch;
    const isTikTokKeyword = platformName.toLowerCase() === 'tiktok' && !isSimilarSearch;
    
    if (processedResults > 0) {
      if (isInstagramReels) {
        // 🎯 EXACT COUNT MESSAGING: Show progress toward target for Instagram reels
        const targetText = targetResults > 0 ? ` (${processedResults}/${targetResults})` : '';
        return `Enhancing Instagram creator profiles${targetText} - ${Math.round(displayProgress)}%`;
      } else if (isTikTokKeyword) {
        // Enhanced messages for TikTok keyword search to show immediate activity
        if (displayProgress < 15) {
          return `Searching TikTok for "${searchData?.keywords?.[0] || 'creators'}"...`;
        }
        // 🎯 EXACT COUNT MESSAGING: Show progress toward target for TikTok
        const targetText = targetResults > 0 ? `/${targetResults}` : '';
        if (displayProgress < 30) {
          return `Found ${processedResults}${targetText} creators, fetching profile bios...`;
        }
        if (displayProgress < 60) {
          return `Extracting emails from ${processedResults}${targetText} TikTok profiles...`;
        }
        if (displayProgress < 90) {
          return `Caching images for ${processedResults}${targetText} creators...`;
        }
        return `Finalizing ${processedResults}${targetText} TikTok creator profiles`;
      } else {
        // 🎯 EXACT COUNT MESSAGING: Standard messages for other platforms with target info
        const targetText = targetResults > 0 ? `/${targetResults}` : '';
        if (displayProgress < 25) {
          return `Found ${processedResults}${targetText} ${searchTypeText} ${platformName.toLowerCase()} creators, discovering more${speed}`;
        }
        if (displayProgress < 50) {
          return `Analyzing ${processedResults}${targetText} ${platformName.toLowerCase()} profiles & engagement${speed}`;
        }
        if (displayProgress < 75) {
          return `Processing ${processedResults}${targetText} creator profiles & extracting contact info${speed}`;
        }
        return `Finalizing ${processedResults}${targetText} ${platformName.toLowerCase()} creators & preparing export${speed}`;
      }
    } else {
      // No results yet - show search-type-specific messages
      if (isSimilarSearch && targetUser) {
        if (displayProgress < 25) return `Finding creators similar to @${targetUser}...`;
        if (displayProgress < 50) return `Analyzing ${platformName.toLowerCase()} creator relationships...`;
        if (displayProgress < 75) return `Processing similar ${platformName.toLowerCase()} profiles...`;
        return 'Finalizing similar creator results...';
      } else if (isInstagramReels) {
        // Instagram reels specific messages
        if (displayProgress < 10) return `Searching Instagram reels for your keywords...`;
        if (displayProgress < 25) return `Found Instagram reels, getting creator profiles...`;
        return `Enhancing creator profiles with bio & email data...`;
      } else if (isTikTokKeyword) {
        // TikTok keyword specific messages to show immediate activity
        const keyword = searchData?.keywords?.[0] || 'creators';
        if (displayProgress < 5) return `Initializing TikTok search for "${keyword}"...`;
        if (displayProgress < 10) return `Connecting to TikTok API...`;
        if (displayProgress < 15) return `Searching TikTok videos for "${keyword}"...`;
        if (displayProgress < 25) return `Processing TikTok search results...`;
        if (displayProgress < 50) return `Fetching creator profiles from TikTok...`;
        if (displayProgress < 75) return `Extracting bio & contact information...`;
        return 'Preparing final results...';
      } else {
        // Keyword search messages (existing)
        if (displayProgress < 25) return `Searching ${platformName.toLowerCase()} database...`;
        if (displayProgress < 50) return `Analyzing ${platformName.toLowerCase()} content...`;
        if (displayProgress < 75) return `Processing ${platformName.toLowerCase()} profiles...`;
        return 'Finalizing search results...';
      }
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
                  {(() => {
                    const platformName = platform || 'TikTok';
                    const isInstagramReels = platformName.toLowerCase() === 'instagram' && !searchData?.targetUsername;
                    
                    if (isInstagramReels) {
                      // 🎯 EXACT COUNT DISPLAY: Show progress toward target for Instagram
                      return targetResults > 0 
                        ? `${processedResults}/${targetResults} creators` 
                        : `${processedResults} profiles enhanced`;
                    } else {
                      // 🎯 EXACT COUNT DISPLAY: Show progress toward target for other platforms
                      return targetResults > 0 
                        ? `${processedResults}/${targetResults} creators` 
                        : `${processedResults} found so far`;
                    }
                  })()}
                </span>
              )}
            </div>
            <div className="w-full bg-blue-100 rounded-lg h-6 relative overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 rounded-lg transition-all duration-500 relative shadow-sm" 
                style={{ width: `${Math.min(displayProgress, 100)}%` }}
              >
                {/* 📊 INTEGRATED PERCENTAGE: Show percentage inside the progress bar */}
                {displayProgress > 12 && (
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-semibold text-white drop-shadow">
                    {Math.round(displayProgress)}%
                  </span>
                )}
              </div>
              {/* Show percentage outside when progress bar is too small */}
              {displayProgress <= 12 && (
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm font-semibold text-gray-700">
                  {Math.round(displayProgress)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Intermediate Results Section */}
        {showIntermediateResults && intermediateCreators.length > 0 && (
          <div className="w-full mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Latest Results (<span className="text-blue-600 font-semibold">{intermediateCreators.length}</span> creators found)
              </h3>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                {status === 'processing' ? 'More results loading...' : 'Loading complete'}
              </span>
            </div>
            
            {/* Creator List with LIVE UPDATES and smooth animations */}
            <div key={renderKey} className="space-y-3 max-h-96 overflow-y-auto scroll-smooth">
              {/* 🔍 TARGETED DEBUG: Log what cards are being rendered */}
              {console.log('🎨 [CARD-RENDER] Rendering creator cards:', {
                renderKey: renderKey,
                totalCreators: intermediateCreators.length,
                cardsToShow: Math.min(5, intermediateCreators.length),
                showingMode: 'latest 5 creators',
                firstCreatorName: intermediateCreators[0]?.creator?.name,
                lastCreatorName: intermediateCreators[intermediateCreators.length - 1]?.creator?.name,
                latestCreatorNames: intermediateCreators.slice(-5).map(c => c.creator?.name),
                allCreatorNames: intermediateCreators.map(c => c.creator?.name),
                timestamp: new Date().toISOString()
              })}
              
              {intermediateCreators.slice(-5).map((creator, index) => {
                // Calculate the actual index in the full array
                const actualIndex = intermediateCreators.length - 5 + index;
                
                // 🖼️ IMAGE PROXY: Use same logic as final table for proper image loading
                const avatarUrl = creator.creator?.avatarUrl || creator.creator?.profilePicUrl || '';
                const proxiedImageUrl = avatarUrl ? `/api/proxy/image?url=${encodeURIComponent(avatarUrl)}` : '';
                
                // 🔍 TARGETED DEBUG: Log each card being rendered
                console.log(`🎭 [CARD-${index}] Rendering card:`, {
                  index: index,
                  actualIndex: actualIndex,
                  name: creator.creator?.name,
                  username: creator.creator?.uniqueId,
                  avatarUrl: avatarUrl,
                  hasProxy: !!proxiedImageUrl
                });
                
                return (
                <div 
                  key={`progress-creator-${creator.creator?.uniqueId || actualIndex}-${creator.creator?.name || 'unknown'}-${actualIndex}`}
                  className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    borderLeft: index < 5 ? '3px solid #3B82F6' : '3px solid transparent' // Highlight first 5 as "new"
                  }}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {proxiedImageUrl ? (
                      <img 
                        src={proxiedImageUrl}
                        alt={creator.creator?.name || 'Creator'}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span 
                      className="text-sm font-medium text-gray-600"
                      style={{ display: proxiedImageUrl ? 'none' : 'flex' }}
                    >
                      {creator.creator?.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {creator.creator?.name || 'Unknown Creator'}
                      {/* 🔍 VISUAL DEBUG: Show render timestamp */}
                      <span className="ml-2 text-xs text-blue-500">
                        #{index + 1} ({new Date().getSeconds()}s)
                      </span>
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
                );
              })}
              
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