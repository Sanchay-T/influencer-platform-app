'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Zap, 
  AlertTriangle, 
  Crown, 
  Star, 
  CheckCircle, 
  Settings,
  TrendingUp,
  Calendar,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useBillingCached } from '@/lib/hooks/use-billing-cached';
import { usePerformanceMonitor } from '@/lib/utils/performance-monitor';
import EnhancedTrialSidebarSkeleton from './enhanced-trial-sidebar-skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

// Subscription Badge Component for Paid Users
function SubscriptionBadge({ currentPlan }: { currentPlan: string }) {
  const getPlanDetails = () => {
    switch (currentPlan) {
      case 'basic':
        return {
          name: 'Glow Up',
          icon: Star,
          textColor: 'text-zinc-100',
          iconColor: 'text-pink-400'
        };
      case 'premium':
        return {
          name: 'Viral Surge',
          icon: Zap,
          textColor: 'text-zinc-100',
          iconColor: 'text-pink-400'
        };
      case 'enterprise':
        return {
          name: 'Fame Flex',
          icon: Crown,
          textColor: 'text-zinc-100',
          iconColor: 'text-pink-400'
        };
      default:
        return {
          name: 'Glow Up',
          icon: Star,
          textColor: 'text-zinc-100',
          iconColor: 'text-pink-400'
        };
    }
  };

  const planDetails = getPlanDetails();
  const IconComponent = planDetails.icon;

  return (
    <div className={`relative bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 space-y-4`}>
      
      {/* Header with Plan Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 bg-zinc-800 rounded-lg`}>
            <IconComponent className={`h-4 w-4 ${planDetails.iconColor}`} />
          </div>
          <div>
            <span className={`text-sm font-semibold ${planDetails.textColor}`}>
              {planDetails.name}
            </span>
            <Badge variant="secondary" className="ml-2 text-xs bg-pink-600/20 text-pink-400 border border-pink-600/30">
              Active
            </Badge>
          </div>
        </div>
        <CheckCircle className="h-4 w-4 text-pink-400" />
      </div>

      {/* Status Display */}
      <div className="text-center py-2">
        <div className={`text-xl font-bold ${planDetails.textColor} mb-1`}>
          Premium Access
        </div>
        <p className={`text-xs ${planDetails.textColor} opacity-75`}>
          Unlimited features • Full access
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className={`${planDetails.textColor} opacity-75`}>
          <TrendingUp className="h-3 w-3 inline mr-1" />
          Unlimited searches
        </div>
        <div className={`${planDetails.textColor} opacity-75`}>
          <Sparkles className="h-3 w-3 inline mr-1" />
          Premium features
        </div>
      </div>

      {/* Action Button */}
      <Link href="/billing" className="block">
        <Button 
          size="sm" 
          variant="outline"
          className={`w-full text-xs border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-100`}
        >
          <Settings className="h-3 w-3 mr-1" />
          Manage Subscription
        </Button>
      </Link>
    </div>
  );
}

// DEMO MODE: Set to true to always show the component for testing
const DEMO_MODE = false;

export function EnhancedTrialSidebarIndicator() {
  const { startTimer, endTimer } = usePerformanceMonitor();
  
  // Use cached billing hook data with performance monitoring
  const { 
    currentPlan, isTrialing, trialStatus, usageInfo, isPaidUser, hasActiveSubscription, 
    daysRemaining, hoursRemaining, minutesRemaining, trialProgressPercentage, 
    trialStartDate, trialEndDate, isLoading 
  } = useBillingCached();

  // Performance tracking - component mount
  const mountTimer = useMemo(() => 
    startTimer('EnhancedTrialSidebar', 'component_mount'), 
  []);

  // Mock data for demo mode - create once to avoid recreating on every render
  const mockTrialData = useMemo(() => {
    if (!DEMO_MODE) return null;
    
    const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const endDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days from now
    
    return {
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysRemaining: 4,
      hoursRemaining: 0,
      minutesRemaining: 0,
      progressPercentage: 43,
      timeUntilExpiry: '4d 0h 0m',
      isExpired: false
    };
  }, []); // DEMO_MODE is now a constant, no need in deps
  
  // Create countdown data from billing hook
  const countdownData = useMemo(() => {
    if (DEMO_MODE) return mockTrialData;
    
    if (!isTrialing || daysRemaining === undefined || daysRemaining === null) {
      return {
        daysRemaining: 0,
        hoursRemaining: 0,
        minutesRemaining: 0,
        progressPercentage: 0,
        timeUntilExpiry: 'No trial',
        isExpired: true
      };
    }

    // Handle expired trial
    if (daysRemaining <= 0) {
      return {
        daysRemaining: 0,
        hoursRemaining: 0,
        minutesRemaining: 0,
        progressPercentage: 100,
        timeUntilExpiry: 'Expired',
        isExpired: true
      };
    }

    // Use server-calculated precise values - no more client-side approximation
    const days = daysRemaining || 0;
    const hours = hoursRemaining || 0;
    const minutes = minutesRemaining || 0;
    const progressPercentage = trialProgressPercentage || 0;
    
    // Format time display - show most relevant units (match profile page format)
    let timeUntilExpiry = '';
    if (days > 0) {
      timeUntilExpiry = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      timeUntilExpiry = `${hours}h ${minutes}m`;
    } else {
      timeUntilExpiry = `${minutes}m`;
    }
    
    // Handle edge cases
    if (!timeUntilExpiry || timeUntilExpiry === '0m') {
      timeUntilExpiry = 'Expires soon';
    }
    
    return {
      daysRemaining: days,
      hoursRemaining: hours,
      minutesRemaining: minutes,
      progressPercentage: Math.round(progressPercentage),
      timeUntilExpiry: timeUntilExpiry.trim() || '0m',
      isExpired: daysRemaining <= 0
    };
  }, [daysRemaining, hoursRemaining, minutesRemaining, isTrialing, trialProgressPercentage]);

  // Complete mount timing once data is available
  useEffect(() => {
    if (!isLoading && mountTimer) {
      endTimer(mountTimer);
    }
  }, [isLoading, mountTimer, endTimer]);

  const countdown = {
    ...countdownData,
    formatted: {
      timeDisplay: countdownData.timeUntilExpiry,
      progressText: `${countdownData.progressPercentage}% complete`,
      statusText: countdownData.isExpired ? 'Trial Expired' : 
                  countdownData.daysRemaining === 0 ? 'Expires Today' :
                  `${countdownData.daysRemaining} days remaining`,
      progressWidth: `${countdownData.progressPercentage}%`
    }
  };

  // Show skeleton while loading (moved after all hooks)
  if (isLoading) {
    return <EnhancedTrialSidebarSkeleton />;
  }

  // If user has active paid subscription, show subscription badge
  if (isPaidUser && hasActiveSubscription && currentPlan !== 'free_trial') {
    return <SubscriptionBadge currentPlan={currentPlan} />;
  }

  // Don't show for non-trial users (commenting out for testing)
  // if (currentPlan !== 'free_trial' || !isTrialing) {
  //   return null;
  // }

  // Mock usage info for demo mode
  const mockUsageInfo = DEMO_MODE ? {
    searchesUsed: 7,
    searchesLimit: 10,
    progressPercentage: 70
  } : null;
  
  // Fix usage info structure - convert from billing hook format to display format
  // For trial users, show trial usage; for paid users, show plan usage
  const displayUsageInfo = DEMO_MODE ? mockUsageInfo : 
    (usageInfo && (usageInfo.campaignsLimit > 0 || isTrialing) ? {
      searchesUsed: usageInfo.campaignsUsed || 0,
      searchesLimit: isTrialing ? 10 : (usageInfo.campaignsLimit || 0), // Default trial limit of 10
      progressPercentage: usageInfo.progressPercentage || 0
    } : null);

  // Determine urgency level for styling - use server-calculated progress
  const isUrgent = countdown.daysRemaining <= 1 && !countdown.isExpired;
  const isExpired = countdown.isExpired;
  const progressPercentage = countdown.progressPercentage || 0;

  // Debug logging (after all variables are declared)
  console.log('🎯 [ENHANCED-TRIAL-SIDEBAR] Component state:', {
    currentPlan,
    isTrialing,
    isPaidUser,
    hasActiveSubscription,
    daysRemaining,
    hoursRemaining,
    minutesRemaining,
    trialProgressPercentage,
    trialStartDate,
    trialEndDate,
    usageInfo,
    displayUsageInfo,
    countdown,
    progressPercentage
  });

  // Dynamic styling based on trial status
  const getTrialStyling = () => {
    if (isExpired) {
      return {
        container: 'bg-zinc-900/80 border border-zinc-700/50',
        text: 'text-zinc-100',
        accent: 'text-pink-400',
        progressBg: 'bg-zinc-800',
        progressFill: 'bg-pink-500'
      };
    }
    if (isUrgent) {
      return {
        container: 'bg-zinc-900/80 border border-zinc-700/50',
        text: 'text-zinc-100',
        accent: 'text-pink-400',
        progressBg: 'bg-zinc-800',
        progressFill: 'bg-pink-500'
      };
    }
    return {
      container: 'bg-zinc-900/80 border border-zinc-700/50',
      text: 'text-zinc-100',
      accent: 'text-pink-400',
      progressBg: 'bg-zinc-800',
      progressFill: 'bg-pink-500'
    };
  };

  const styling = getTrialStyling();

  return (
    <div className={`relative ${styling.container} rounded-xl p-4 space-y-4`}>
      
      {/* Header with Trial Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${styling.progressBg}`}>
            {isExpired ? (
              <AlertTriangle className={`h-4 w-4 ${styling.accent}`} />
            ) : (
              <Clock className={`h-4 w-4 ${styling.accent}`} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${styling.text}`}>
              7-Day Trial
            </span>
            {isExpired && (
              <Badge variant="secondary" className="text-xs bg-pink-600/20 text-pink-400 border border-pink-600/30">
                Expired
              </Badge>
            )}
            {isUrgent && !isExpired && (
              <Badge variant="secondary" className="text-xs bg-pink-600/20 text-pink-400 border border-pink-600/30">
                Urgent
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="text-center py-2">
        <div className={`text-2xl font-bold ${styling.text} mb-1`}>
          {countdown.formatted?.timeDisplay || 'Loading...'}
        </div>
        <p className={`text-xs ${styling.text} opacity-75`}>
          {isExpired ? (
            <span className="flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Trial has ended
            </span>
          ) : isUrgent ? (
            <span className="flex items-center justify-center gap-1 animate-pulse">
              <Clock className="h-3 w-3" />
              Expires soon!
            </span>
          ) : (
            countdown.formatted?.statusText || 'remaining in trial'
          )}
        </p>
      </div>

      {/* Enhanced Progress Bar with Timeline */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className={`${styling.text} opacity-75`}>Trial Progress</span>
            <span className={`font-medium ${styling.text}`}>
              {Math.round(progressPercentage || 0)}% complete
            </span>
          </div>
          <div className="relative">
            <Progress 
              value={Math.min(100, Math.max(0, progressPercentage || 0))} 
              className={`h-2 ${styling.progressBg}`}
            />
            {/* Progress milestones */}
            <div className="absolute top-0 left-0 w-full h-2 flex justify-between items-center pointer-events-none">
              {[0, 25, 50, 75, 100].map((milestone, index) => (
                <div 
                  key={milestone}
                  className={`w-1 h-3 rounded-full ${
                    (progressPercentage || 0) >= milestone 
                      ? styling.progressFill.replace('bg-', 'bg-opacity-80 bg-')
                      : 'bg-gray-300'
                  } transition-colors duration-300`}
                  style={{ marginLeft: index === 0 ? '0' : '-2px', marginRight: index === 4 ? '0' : '-2px' }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between text-xs opacity-60">
            <span className={styling.text}>Day 1</span>
            <span className={styling.text}>Day 7</span>
          </div>
        </div>

        {/* Timeline Dates */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className={`${styling.text} opacity-75`}>
            <Calendar className="h-3 w-3 inline mr-1" />
            Started: {trialStartDate ? new Date(trialStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
          </div>
          <div className={`${styling.text} opacity-75`}>
            <Calendar className="h-3 w-3 inline mr-1" />
            Expires: {trialEndDate ? new Date(trialEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Usage Info with Enhanced Display */}
      {displayUsageInfo && (
        <div className="space-y-2 p-3 bg-white bg-opacity-50 rounded-lg backdrop-blur-sm">
          <div className="flex justify-between items-center text-xs">
            <span className={`${styling.text} opacity-75`}>Searches Used</span>
            <span className={`font-medium ${styling.text}`}>
              {displayUsageInfo.searchesUsed}/{displayUsageInfo.searchesLimit}
            </span>
          </div>
          <Progress 
            value={(displayUsageInfo.searchesUsed / displayUsageInfo.searchesLimit) * 100} 
            className={`h-1.5 ${styling.progressBg}`}
          />
          {displayUsageInfo.progressPercentage >= 80 && (
            <p className={`text-xs ${styling.accent} flex items-center gap-1`}>
              <AlertTriangle className="h-3 w-3" />
              {displayUsageInfo.progressPercentage >= 100 ? 'Limit reached' : 'Nearing limit'}
            </p>
          )}
        </div>
      )}

      {/* Enhanced Upgrade CTA */}
      <div className="space-y-2">
        <Link href="/pricing" className="block">
            <Button 
              size="sm" 
              className={`w-full text-xs font-semibold transition-all duration-300 bg-pink-600 hover:bg-pink-500 text-white shadow-md hover:shadow-lg`}
            >
              <Zap className="h-3 w-3 mr-1" />
            {isExpired ? 'Upgrade Now' : isUrgent ? 'Upgrade Soon' : 'Upgrade Early'}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
        </Link>

        {/* Additional CTA for expired users */}
        {isExpired && (
          <Link href="/billing" className="block">
            <Button 
              size="sm" 
              variant="outline"
              className="w-full text-xs border-pink-600/30 text-pink-400 hover:bg-pink-600/10"
            >
              View Billing Details
            </Button>
          </Link>
        )}
      </div>

      {/* Usage threshold warning */}
      {displayUsageInfo && displayUsageInfo.progressPercentage >= 50 && (
        <div className={`text-xs p-2 rounded-lg border transition-all duration-300 text-pink-400 bg-pink-900/30 border-pink-800`}>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">
              {displayUsageInfo.progressPercentage >= 100 
                ? 'Trial limit reached!' 
                : `${displayUsageInfo.progressPercentage}% of trial used`}
            </span>
          </div>
          <p className="opacity-90">
            {displayUsageInfo.progressPercentage >= 100
              ? 'Upgrade now for unlimited access'
              : 'Consider upgrading for unlimited searches'}
          </p>
        </div>
      )}

      {/* Special offers or incentives */}
      {progressPercentage >= 70 && !isExpired && (
        <div className="text-xs p-2 rounded-lg border border-zinc-700/50 bg-zinc-800/60">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span className="font-medium text-zinc-100">Early Bird Special</span>
          </div>
          <p className="text-zinc-300 opacity-90">Upgrade now and save 20% on your first month!</p>
        </div>
      )}
    </div>
  );
}

export default EnhancedTrialSidebarIndicator;
