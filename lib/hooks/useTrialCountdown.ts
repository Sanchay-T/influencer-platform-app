import { useState, useEffect, useCallback } from 'react';

export interface TrialCountdownData {
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining?: number;
  progressPercentage: number;
  timeUntilExpiry: string;
  isExpired: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface TrialData {
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  progressPercentage: number;
  timeUntilExpiry: string;
  isExpired: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
}

/**
 * Custom hook for real-time trial countdown
 * Updates every minute and handles trial expiration
 */
export function useTrialCountdown(initialTrialData?: TrialData | null) {
  const [countdownData, setCountdownData] = useState<TrialCountdownData>({
    daysRemaining: 0,
    hoursRemaining: 0,
    minutesRemaining: 0,
    progressPercentage: 0,
    timeUntilExpiry: 'Loading...',
    isExpired: false,
    isLoading: true,
    error: null
  });

  const [trialData, setTrialData] = useState<TrialData | null>(initialTrialData || null);

  // Calculate countdown from trial end date
  const calculateCountdown = useCallback((endDateString: string): TrialCountdownData => {
    try {
      const now = new Date();
      const endDate = new Date(endDateString);
      
      // Calculate time difference in milliseconds
      const timeDiff = endDate.getTime() - now.getTime();
      
      if (timeDiff <= 0) {
        return {
          daysRemaining: 0,
          hoursRemaining: 0,
          minutesRemaining: 0,
          secondsRemaining: 0,
          progressPercentage: 100,
          timeUntilExpiry: 'Expired',
          isExpired: true,
          isLoading: false,
          error: null
        };
      }

      // Convert to days, hours, minutes, seconds
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      // Calculate progress (7-day trial)
      const totalTrialDays = 7;
      const daysElapsed = totalTrialDays - days;
      const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / totalTrialDays) * 100));

      // Format time until expiry
      let timeUntilExpiry = '';
      if (days > 0) {
        timeUntilExpiry += `${days}d `;
      }
      if (hours > 0 || days > 0) {
        timeUntilExpiry += `${hours}h `;
      }
      timeUntilExpiry += `${minutes}m`;

      return {
        daysRemaining: days,
        hoursRemaining: hours,
        minutesRemaining: minutes,
        secondsRemaining: seconds,
        progressPercentage: Math.round(progressPercentage),
        timeUntilExpiry: timeUntilExpiry.trim(),
        isExpired: false,
        isLoading: false,
        error: null
      };
    } catch (error) {
      console.error('❌ [TRIAL-COUNTDOWN] Error calculating countdown:', error);
      return {
        daysRemaining: 0,
        hoursRemaining: 0,
        minutesRemaining: 0,
        progressPercentage: 0,
        timeUntilExpiry: 'Error',
        isExpired: false,
        isLoading: false,
        error: 'Failed to calculate countdown'
      };
    }
  }, []);

  // Fetch fresh trial data from API
  const refreshTrialData = useCallback(async () => {
    try {
      console.log('🔄 [TRIAL-COUNTDOWN] Refreshing trial data from API');
      
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }

      const profileData = await response.json();
      
      if (profileData.trialData) {
        console.log('✅ [TRIAL-COUNTDOWN] Trial data refreshed:', {
          status: profileData.trialData.status,
          endDate: profileData.trialData.endDate,
          daysRemaining: profileData.trialData.daysRemaining
        });
        
        setTrialData(profileData.trialData);
        
        // Calculate fresh countdown
        if (profileData.trialData.endDate) {
          const newCountdown = calculateCountdown(profileData.trialData.endDate);
          setCountdownData(newCountdown);
        }
      } else {
        console.log('ℹ️ [TRIAL-COUNTDOWN] No trial data found');
        setCountdownData(prev => ({
          ...prev,
          isLoading: false,
          error: 'No trial data available'
        }));
      }
    } catch (error) {
      console.error('❌ [TRIAL-COUNTDOWN] Error refreshing trial data:', error);
      setCountdownData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to refresh trial data'
      }));
    }
  }, [calculateCountdown]);

  // Update countdown based on current trial data
  const updateCountdown = useCallback(() => {
    if (trialData && trialData.endDate && !trialData.isExpired) {
      const newCountdown = calculateCountdown(trialData.endDate);
      setCountdownData(newCountdown);
      
      // If countdown shows expired but trial data doesn't, refresh from server
      if (newCountdown.isExpired && trialData.status === 'active') {
        console.log('⚠️ [TRIAL-COUNTDOWN] Countdown expired, refreshing server data');
        refreshTrialData();
      }
    }
  }, [trialData, calculateCountdown, refreshTrialData]);

  // Initialize countdown on mount or when trial data changes
  useEffect(() => {
    if (trialData && trialData.endDate) {
      updateCountdown();
    } else if (!initialTrialData) {
      // No initial data provided, fetch from API
      refreshTrialData();
    }
  }, [trialData, updateCountdown, refreshTrialData, initialTrialData]);

  // Set up interval for real-time updates (every 60 seconds)
  useEffect(() => {
    console.log('⏰ [TRIAL-COUNTDOWN] Setting up 60-second countdown interval');
    
    const interval = setInterval(() => {
      console.log('🔄 [TRIAL-COUNTDOWN] Updating countdown (60-second interval)');
      updateCountdown();
    }, 60 * 1000); // Update every 60 seconds

    // Cleanup interval on unmount
    return () => {
      console.log('🧹 [TRIAL-COUNTDOWN] Cleaning up countdown interval');
      clearInterval(interval);
    };
  }, [updateCountdown]);

  // Provide manual refresh function
  const refresh = useCallback(() => {
    console.log('🔄 [TRIAL-COUNTDOWN] Manual refresh triggered');
    refreshTrialData();
  }, [refreshTrialData]);

  return {
    ...countdownData,
    trialData,
    refresh
  };
}

/**
 * Hook for simple countdown formatting
 */
export function useFormattedCountdown(trialData?: TrialData | null) {
  const countdown = useTrialCountdown(trialData);

  const formatted = {
    timeDisplay: countdown.timeUntilExpiry,
    progressText: `${countdown.progressPercentage}% complete`,
    statusText: countdown.isExpired ? 'Trial Expired' : 
                countdown.daysRemaining === 0 ? 'Expires Today' :
                `${countdown.daysRemaining} days remaining`,
    progressWidth: `${countdown.progressPercentage}%`
  };

  return {
    ...countdown,
    formatted
  };
}