/**
 * SINGLE SOURCE OF TRUTH - Trial Status Calculator
 * Used by: API endpoints, React components, email templates, admin panel
 * 
 * Enterprise Pattern: Centralized business logic with consistent calculations
 * Used by companies like: Netflix, Stripe, Airbnb, Spotify
 */

export interface TrialTimeDisplay {
  // Raw computed values
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  
  // Derived values (calculated once, used everywhere)
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  progressPercentage: number;
  
  // UI-ready display strings (consistent across all components)
  timeRemainingShort: string;    // "< 1 day", "3 days", "Expired"
  timeRemainingLong: string;     // "Less than 1 day remaining", "3 days remaining"
  progressDescription: string;   // "Day 6 of 7", "86% complete"
  urgencyLevel: 'low' | 'medium' | 'high' | 'expired';
  
  // Metadata
  isExpired: boolean;
  isAlmostExpired: boolean;     // < 24 hours
  isNearExpiry: boolean;        // < 48 hours
}

/**
 * MASTER CALCULATION FUNCTION
 * This is the ONLY place where trial time logic exists
 */
export function calculateTrialStatus(
  trialStartDate: Date | string | null, 
  trialEndDate: Date | string | null,
  referenceTime?: Date
): TrialTimeDisplay {
  const now = referenceTime || new Date();
  
  // Handle missing data
  if (!trialStartDate || !trialEndDate) {
    return createEmptyTrialStatus();
  }
  
  const startDate = new Date(trialStartDate);
  const endDate = new Date(trialEndDate);
  
  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return createEmptyTrialStatus();
  }
  
  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = now.getTime() - startDate.getTime();
  const remainingMs = endDate.getTime() - now.getTime();
  
  // Time calculations (precise)
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));
  
  // Progress calculation (0-100)
  const progressPercentage = totalMs > 0 
    ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)))
    : 0;
    
  // State flags
  const isExpired = remainingMs <= 0;
  const isAlmostExpired = remainingMs > 0 && remainingMs < (24 * 60 * 60 * 1000); // < 24h
  const isNearExpiry = remainingMs > 0 && remainingMs < (48 * 60 * 60 * 1000); // < 48h
  
  // Urgency level (for UI styling)
  let urgencyLevel: 'low' | 'medium' | 'high' | 'expired' = 'low';
  if (isExpired) urgencyLevel = 'expired';
  else if (isAlmostExpired) urgencyLevel = 'high';
  else if (isNearExpiry) urgencyLevel = 'medium';
  
  // UI-ready display strings (SINGLE SOURCE OF TRUTH for all displays)
  let timeRemainingShort: string;
  let timeRemainingLong: string;
  
  if (isExpired) {
    timeRemainingShort = 'Expired';
    timeRemainingLong = 'Trial has expired';
  } else if (isAlmostExpired) {
    timeRemainingShort = '< 1 day';
    timeRemainingLong = 'Less than 1 day remaining';
  } else {
    timeRemainingShort = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
    timeRemainingLong = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
  }
  
  // Progress description
  const dayElapsed = Math.min(7, Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24))));
  const progressDescription = isExpired 
    ? 'Trial completed' 
    : `Day ${dayElapsed} of 7-day trial`;
  
  return {
    // Raw values
    totalMs,
    elapsedMs,
    remainingMs,
    
    // Time components
    daysRemaining,
    hoursRemaining,
    minutesRemaining,
    progressPercentage,
    
    // Display strings (used by ALL components)
    timeRemainingShort,
    timeRemainingLong,
    progressDescription,
    urgencyLevel,
    
    // Flags
    isExpired,
    isAlmostExpired,
    isNearExpiry
  };
}

function createEmptyTrialStatus(): TrialTimeDisplay {
  return {
    totalMs: 0,
    elapsedMs: 0,
    remainingMs: 0,
    daysRemaining: 0,
    hoursRemaining: 0,
    minutesRemaining: 0,
    progressPercentage: 0,
    timeRemainingShort: 'No trial',
    timeRemainingLong: 'No active trial',
    progressDescription: 'No trial active',
    urgencyLevel: 'low',
    isExpired: true,
    isAlmostExpired: false,
    isNearExpiry: false
  };
}

/**
 * HELPER: Get CSS classes for urgency styling
 * Consistent styling across all components
 */
export function getTrialUrgencyClasses(urgencyLevel: TrialTimeDisplay['urgencyLevel']): {
  container: string;
  text: string;
  progress: string;
} {
  switch (urgencyLevel) {
    case 'expired':
      return {
        container: 'border-red-500/50 bg-red-500/10',
        text: 'text-red-400',
        progress: 'bg-red-500'
      };
    case 'high':
      return {
        container: 'border-orange-500/50 bg-orange-500/10',
        text: 'text-orange-400',
        progress: 'bg-orange-500'
      };
    case 'medium':
      return {
        container: 'border-yellow-500/50 bg-yellow-500/10',
        text: 'text-yellow-400',
        progress: 'bg-yellow-500'
      };
    default:
      return {
        container: 'border-zinc-700/50 bg-zinc-800/60',
        text: 'text-zinc-300',
        progress: 'bg-chart-1'
      };
  }
}

/**
 * ENTERPRISE PATTERN: Reactive recalculation
 * Call this when you need fresh calculations (e.g., every minute)
 */
export function createTrialStatusWatcher(
  trialStartDate: Date | string | null,
  trialEndDate: Date | string | null,
  onUpdate: (status: TrialTimeDisplay) => void,
  intervalMs: number = 60000 // 1 minute
): () => void {
  const updateStatus = () => {
    const status = calculateTrialStatus(trialStartDate, trialEndDate);
    onUpdate(status);
  };
  
  // Initial calculation
  updateStatus();
  
  // Set up interval
  const interval = setInterval(updateStatus, intervalMs);
  
  // Return cleanup function
  return () => clearInterval(interval);
}