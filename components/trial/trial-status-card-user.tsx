'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  CheckCircle, 
  Calendar, 
  AlertTriangle
} from 'lucide-react';
import { useFormattedCountdown, type TrialData } from '@/lib/hooks/useTrialCountdown';

interface TrialStatusCardUserProps {
  trialData: TrialData | null;
  className?: string;
}

export function TrialStatusCardUser({ trialData, className = '' }: TrialStatusCardUserProps) {
  const countdown = useFormattedCountdown(trialData);

  if (!trialData) {
    return null;
  }

  const getStatusBadge = () => {
    switch (trialData.status) {
      case 'active':
        return <Badge variant="secondary" className="bg-zinc-800 text-pink-400 border border-zinc-700/50">Active Trial</Badge>;
      case 'expired':
        return <Badge variant="destructive">Trial Expired</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border border-zinc-700/50">Cancelled</Badge>;
      case 'converted':
        return <Badge variant="secondary" className="bg-zinc-800 text-pink-400 border border-zinc-700/50">Subscribed</Badge>;
      default:
        return <Badge variant="outline" className="text-zinc-300 border-zinc-700/50">Pending</Badge>;
    }
  };

  const getStatusIcon = () => {
    if (countdown.isExpired) {
      return <AlertTriangle className="h-6 w-6 text-red-500" />;
    }
    if (trialData.status === 'active') {
      return <Clock className="h-6 w-6 text-pink-400" />;
    }
    return <CheckCircle className="h-6 w-6 text-pink-400" />;
  };

  return (
    <Card className={`${className} bg-zinc-900/80 border border-zinc-700/50`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
            {getStatusIcon()}
            <span className="font-semibold">7-Day Free Trial</span>
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription className="mt-1 text-zinc-400">
          {countdown.isExpired 
            ? 'Your trial has ended. Upgrade to continue using Gemz.'
            : 'Full access to all features during your trial period.'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Countdown Display */}
        <div className="text-center">
          <div className="text-3xl font-bold text-zinc-100 mb-2">
            {countdown.formatted.timeDisplay}
          </div>
          <p className="text-sm text-zinc-400">
            {countdown.formatted.statusText}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Trial Progress</span>
            <span className="font-medium text-zinc-200">{countdown.formatted.progressText}</span>
          </div>
          <Progress 
            value={countdown.progressPercentage} 
            className="h-2"
          />
        </div>

        {/* Trial Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-zinc-100">Started</p>
              <p className="text-zinc-400">
                {trialData.startDate ? new Date(trialData.startDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-zinc-100">Expires</p>
              <p className="text-zinc-400">
                {trialData.endDate ? new Date(trialData.endDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

export default TrialStatusCardUser;
