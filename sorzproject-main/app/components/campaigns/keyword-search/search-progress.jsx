'use client'

import { useState, useEffect, useRef } from 'react'
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function SearchProgress({ jobId, onComplete }) {
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
        const response = await fetch(`/api/scraping/tiktok?jobId=${jobId}`);
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

        // Check for recovery message from backend
        if (data.recovery) {
          setRecovery(data.recovery);
          setTimeout(() => setRecovery(null), 5000); // Clear recovery message after 5 seconds
        }

        // Use explicit progress if available, otherwise calculate from results
        let calculatedProgress = 0;
        
        if (data.status === 'completed') {
          // Si está completado, siempre mostrar 100%
          calculatedProgress = 100;
        } else if (data.progress !== undefined && data.progress > 0) {
          // Si tenemos progreso explícito del backend, usarlo
          calculatedProgress = data.progress;
        } else if (data.processedResults && data.targetResults > 0) {
          // Calcular progreso basado en resultados procesados
          calculatedProgress = Math.min((data.processedResults / data.targetResults) * 100, 99);
        } else {
          // Estimación basada en tiempo (solo si no tenemos otros datos)
          const elapsedSeconds = (new Date() - startTime) / 1000;
          const estimatedTotalSeconds = 180; // Estimated total time in seconds
          calculatedProgress = Math.min(elapsedSeconds / estimatedTotalSeconds * 100, 90);
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
            creators: data.results?.[0]?.creators || data.creators || []
          });
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        if (retryCount >= maxRetries) {
          clearInterval(pollIntervalRef.current);
          setError("Unable to connect to the server. Please check your campaign status later.");
          // Si ya tenemos un progreso alto y hay error de conexión, 
          // es probable que el job esté completado pero no podemos verificarlo
          if (displayProgress >= 95) {
            setTimeout(() => {
              setProgress(100);
              setDisplayProgress(100);
              setStatus('completed');
              onComplete({ 
                status: 'completed',
                creators: [] // Se cargarán desde el dashboard
              });
            }, 5000); // Esperar 5 segundos antes de asumir completado
          }
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

  const handleForceComplete = async () => {
    if (!jobId) return;
    
    try {
      const response = await fetch(`/api/jobs/${jobId}/complete`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setProgress(100);
        setDisplayProgress(100);
        setStatus('completed');
        setError(null);
        onComplete({ 
          status: 'completed',
          creators: []
        });
      } else {
        console.error('Failed to force complete job');
      }
    } catch (error) {
      console.error('Error forcing job completion:', error);
    }
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

        <div className="space-y-2">
          {error && retryCount >= maxRetries && displayProgress >= 80 && (
            <Button
              onClick={handleForceComplete}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              Complete Campaign (Force)
            </Button>
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
    </div>
  );
} 