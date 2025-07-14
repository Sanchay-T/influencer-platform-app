'use client';

import { useState, useEffect } from 'react';
import { Clock, Zap, AlertTriangle } from 'lucide-react';
import { useBilling } from '@/lib/hooks/use-billing';
import { useFormattedCountdown } from '@/lib/hooks/useTrialCountdown';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

export function TrialSidebarIndicator() {
  const { currentPlan, isTrialing, trialStatus, usageInfo } = useBilling();
  const [trialData, setTrialData] = useState(null);
  const countdown = useFormattedCountdown(trialData);

  // Fetch trial data for countdown
  useEffect(() => {
    if (isTrialing) {
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.trialData) {
            setTrialData(data.trialData);
          }
        })
        .catch(err => console.error('Failed to fetch trial data:', err));
    }
  }, [isTrialing]);

  // Don't show for non-trial users
  if (currentPlan !== 'free_trial' || !isTrialing) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 space-y-3">
      {/* Trial Header */}
      <div className="flex items-center gap-2">
        <div className="p-1 bg-blue-100 rounded-full">
          <Clock className="h-3 w-3 text-blue-600" />
        </div>
        <span className="text-sm font-medium text-blue-900">Free Trial</span>
        {countdown.isExpired && (
          <AlertTriangle className="h-3 w-3 text-red-500" />
        )}
      </div>

      {/* Countdown Display */}
      <div className="space-y-2">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-900">
            {countdown.formatted?.timeDisplay || 'Loading...'}
          </div>
          <p className="text-xs text-blue-700">
            {countdown.isExpired ? 'Trial Expired' : 'remaining'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress 
            value={countdown.progressPercentage || 0} 
            className="h-1.5 bg-blue-100"
          />
          <div className="flex justify-between text-xs text-blue-600">
            <span>Day 1</span>
            <span>{countdown.progressPercentage || 0}%</span>
            <span>Day 7</span>
          </div>
        </div>
      </div>

      {/* Usage Info */}
      {usageInfo && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-blue-700">Searches Used</span>
            <span className="font-medium text-blue-900">
              {usageInfo.searchesUsed}/{usageInfo.searchesLimit}
            </span>
          </div>
          <Progress 
            value={(usageInfo.searchesUsed / usageInfo.searchesLimit) * 100} 
            className="h-1.5 bg-blue-100"
          />
        </div>
      )}

      {/* Upgrade CTA */}
      <Link href="/pricing" className="block">
        <Button 
          size="sm" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
        >
          <Zap className="h-3 w-3 mr-1" />
          {countdown.isExpired ? 'Upgrade Now' : 'Upgrade Early'}
        </Button>
      </Link>

      {/* Usage threshold warning */}
      {usageInfo && usageInfo.progressPercentage >= 50 && (
        <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-medium">
              {usageInfo.progressPercentage >= 100 
                ? 'Trial limit reached!' 
                : 'You\'ve used 50%+ of your trial'}
            </span>
          </div>
          <p className="mt-1">Upgrade for unlimited access</p>
        </div>
      )}
    </div>
  );
}