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
import { useBilling } from '@/lib/hooks/use-billing';
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
          color: 'from-blue-50 to-blue-100',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-900',
          iconColor: 'text-blue-600',
          glowColor: 'shadow-blue-100'
        };
      case 'premium':
        return {
          name: 'Viral Surge',
          icon: Zap,
          color: 'from-purple-50 to-purple-100',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-900',
          iconColor: 'text-purple-600',
          glowColor: 'shadow-purple-100'
        };
      case 'enterprise':
        return {
          name: 'Fame Flex',
          icon: Crown,
          color: 'from-amber-50 to-amber-100',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-900',
          iconColor: 'text-amber-600',
          glowColor: 'shadow-amber-100'
        };
      default:
        return {
          name: 'Glow Up',
          icon: Star,
          color: 'from-blue-50 to-blue-100',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-900',
          iconColor: 'text-blue-600',
          glowColor: 'shadow-blue-100'
        };
    }
  };

  const planDetails = getPlanDetails();
  const IconComponent = planDetails.icon;

  return (
    <div className={`relative bg-gradient-to-r ${planDetails.color} border ${planDetails.borderColor} rounded-xl p-4 space-y-4 shadow-sm ${planDetails.glowColor} transition-all duration-300 hover:shadow-md`}>
      {/* Premium Glow Effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl opacity-0 group-hover:opacity-20 blur-sm transition-opacity duration-300"></div>
      
      {/* Header with Plan Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 bg-white bg-opacity-60 rounded-lg backdrop-blur-sm`}>
            <IconComponent className={`h-4 w-4 ${planDetails.iconColor}`} />
          </div>
          <div>
            <span className={`text-sm font-semibold ${planDetails.textColor}`}>
              {planDetails.name}
            </span>
            <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700 border-green-200">
              Active
            </Badge>
          </div>
        </div>
        <CheckCircle className="h-4 w-4 text-green-500" />
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
          className={`w-full text-xs border-white/50 hover:bg-white/20 ${planDetails.textColor} border-opacity-30 transition-colors`}
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
  // Use billing hook data directly - consistent with subscription management
  // This ensures both sidebar and subscription management show identical countdown
  const { currentPlan, isTrialing, trialStatus, usageInfo, isPaidUser, hasActiveSubscription, daysRemaining, hoursRemaining, minutesRemaining, trialProgressPercentage, trialStartDate, trialEndDate } = useBilling();
  
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
        background: 'from-red-50 to-red-100',
        border: 'border-red-200',
        text: 'text-red-900',
        accent: 'text-red-600',
        progressBg: 'bg-red-100',
        progressFill: 'bg-red-500',
        glow: 'shadow-red-100'
      };
    }
    if (isUrgent) {
      return {
        background: 'from-amber-50 to-orange-100',
        border: 'border-orange-200',
        text: 'text-orange-900',
        accent: 'text-orange-600',
        progressBg: 'bg-orange-100',
        progressFill: 'bg-orange-500',
        glow: 'shadow-orange-100'
      };
    }
    return {
      background: 'from-blue-50 to-indigo-100',
      border: 'border-blue-200',
      text: 'text-blue-900',
      accent: 'text-blue-600',
      progressBg: 'bg-blue-100',
      progressFill: 'bg-blue-500',
      glow: 'shadow-blue-100'
    };
  };

  const styling = getTrialStyling();

  return (
    <div className={`relative bg-gradient-to-br ${styling.background} border ${styling.border} rounded-xl p-4 space-y-4 shadow-sm ${styling.glow} transition-all duration-300 hover:shadow-md`}>
      {/* Animated border for urgent states */}
      {(isUrgent || isExpired) && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 rounded-xl opacity-20 animate-pulse"></div>
      )}
      
      {/* Header with Trial Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${styling.progressBg} backdrop-blur-sm`}>
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
              <Badge variant="destructive" className="text-xs">
                Expired
              </Badge>
            )}
            {isUrgent && !isExpired && (
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200 animate-pulse">
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
            className={`w-full text-xs font-semibold transition-all duration-300 ${
              isExpired 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl' 
                : isUrgent
                ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
            }`}
          >
            <Zap className="h-3 w-3 mr-1" />
            {isExpired ? 'Upgrade Now' : isUrgent ? 'Upgrade Before Expiry' : 'Upgrade Early'}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>

        {/* Additional CTA for expired users */}
        {isExpired && (
          <Link href="/billing" className="block">
            <Button 
              size="sm" 
              variant="outline"
              className="w-full text-xs border-red-200 text-red-600 hover:bg-red-50"
            >
              View Billing Details
            </Button>
          </Link>
        )}
      </div>

      {/* Usage threshold warning */}
      {displayUsageInfo && displayUsageInfo.progressPercentage >= 50 && (
        <div className={`text-xs p-2 rounded-lg border transition-all duration-300 ${
          displayUsageInfo.progressPercentage >= 100 
            ? 'text-red-700 bg-red-50 border-red-200'
            : 'text-orange-700 bg-orange-50 border-orange-200'
        }`}>
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
        <div className="text-xs p-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="h-3 w-3 text-purple-600" />
            <span className="font-medium text-purple-900">
              Early Bird Special
            </span>
          </div>
          <p className="text-purple-700 opacity-90">
            Upgrade now and save 20% on your first month!
          </p>
        </div>
      )}
    </div>
  );
}

export default EnhancedTrialSidebarIndicator;