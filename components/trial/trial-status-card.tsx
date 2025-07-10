'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  CheckCircle, 
  Calendar, 
  Mail, 
  CreditCard, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useFormattedCountdown, type TrialData } from '@/lib/hooks/useTrialCountdown';

interface TrialStatusCardProps {
  trialData: TrialData | null;
  className?: string;
}

export function TrialStatusCard({ trialData, className = '' }: TrialStatusCardProps) {
  const countdown = useFormattedCountdown(trialData);

  if (!trialData) {
    return null; // Don't show card if no trial data - handled by parent component
  }

  const getStatusBadge = () => {
    switch (trialData.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active Trial</Badge>;
      case 'expired':
        return <Badge variant="destructive">Trial Expired</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      case 'converted':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Subscribed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getStatusIcon = () => {
    if (countdown.isExpired) {
      return <AlertTriangle className="h-6 w-6 text-red-500" />;
    }
    if (trialData.status === 'active') {
      return <Clock className="h-6 w-6 text-blue-500" />;
    }
    return <CheckCircle className="h-6 w-6 text-green-500" />;
  };

  return (
    <Card className={`${className} border ${countdown.isExpired ? 'border-red-200' : 'border-gray-200'} shadow-sm hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getStatusIcon()}
            <span className="font-semibold">7-Day Free Trial</span>
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription className="mt-1">
          {countdown.isExpired 
            ? 'Your trial has ended. Upgrade to continue using Gemz.'
            : 'Full access to all features during your trial period.'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Countdown Display */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {countdown.formatted.timeDisplay}
          </div>
          <p className="text-sm text-gray-600">
            {countdown.formatted.statusText}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Trial Progress</span>
            <span className="font-medium">{countdown.formatted.progressText}</span>
          </div>
          <Progress 
            value={countdown.progressPercentage} 
            className="h-2"
          />
        </div>

        {/* Trial Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Started</p>
              <p className="text-gray-600">
                {trialData.startDate ? new Date(trialData.startDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Expires</p>
              <p className="text-gray-600">
                {trialData.endDate ? new Date(trialData.endDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Mock Stripe Information */}
        {(trialData.stripeCustomerId || trialData.stripeSubscriptionId) && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription Details
            </h4>
            <div className="space-y-2 text-sm">
              {trialData.stripeCustomerId && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Customer ID:</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {trialData.stripeCustomerId} <span className="text-blue-600">(MOCK)</span>
                  </code>
                </div>
              )}
              {trialData.stripeSubscriptionId && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subscription ID:</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {trialData.stripeSubscriptionId} <span className="text-blue-600">(MOCK)</span>
                  </code>
                </div>
              )}
              {trialData.subscriptionStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant="outline" className="text-xs">
                    {trialData.subscriptionStatus}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {countdown.isExpired ? (
            <Button className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Now - $49/month
            </Button>
          ) : (
            <>
              <Button variant="outline" className="w-full sm:flex-1">
                Cancel Trial
              </Button>
              <Button className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade Early
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TrialStatusCard;