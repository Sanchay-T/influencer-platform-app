'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  CreditCard,
  Calendar,
  Shield,
  Star,
  Zap,
  Crown
} from 'lucide-react';

interface SubscriptionStatusCardProps {
  currentPlan: 'free' | 'glow_up' | 'viral_surge' | 'fame_flex';
  subscriptionStatus: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';
  isTrialing: boolean;
  hasActiveSubscription: boolean;
  daysRemaining?: number;
  progressPercentage?: number;
  nextBillingDate?: string;
  trialEndDate?: string;
  className?: string;
}

export default function SubscriptionStatusCard({
  currentPlan,
  subscriptionStatus,
  isTrialing,
  hasActiveSubscription,
  daysRemaining = 0,
  progressPercentage = 0,
  nextBillingDate,
  trialEndDate,
  className = ''
}: SubscriptionStatusCardProps) {
  
  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'free': return Shield;
      case 'glow_up': return Star;
      case 'viral_surge': return Zap;
      case 'fame_flex': return Crown;
      default: return Shield;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'text-gray-600 bg-gray-100';
      case 'glow_up': return 'text-blue-600 bg-blue-100';
      case 'viral_surge': return 'text-purple-600 bg-purple-100';
      case 'fame_flex': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatPlanName = (plan: string) => {
    const planNames = {
      'free': 'Free Trial',
      'glow_up': 'Glow Up',
      'viral_surge': 'Viral Surge',
      'fame_flex': 'Fame Flex'
    };
    return planNames[plan as keyof typeof planNames] || plan.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusInfo = () => {
    if (isTrialing) {
      const isExpiringSoon = daysRemaining <= 2;
      return {
        icon: isExpiringSoon ? AlertTriangle : Clock,
        color: isExpiringSoon ? 'text-amber-600' : 'text-blue-600',
        bgColor: isExpiringSoon ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200',
        badge: { text: 'Trial Active', variant: 'secondary' as const, className: 'bg-blue-100 text-blue-700' },
        title: isExpiringSoon ? 'Trial Expiring Soon' : 'Trial Active',
        message: `${daysRemaining} days remaining in your free trial`,
        showProgress: true
      };
    }

    switch (subscriptionStatus) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          badge: { text: 'Active', variant: 'default' as const, className: 'bg-green-100 text-green-700' },
          title: 'Subscription Active',
          message: nextBillingDate ? `Next billing date: ${formatDate(nextBillingDate)}` : 'Your subscription is active',
          showProgress: false
        };
      case 'past_due':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          badge: { text: 'Past Due', variant: 'destructive' as const, className: '' },
          title: 'Payment Past Due',
          message: 'Please update your payment method to continue service',
          showProgress: false
        };
      case 'canceled':
        return {
          icon: XCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          badge: { text: 'Canceled', variant: 'outline' as const, className: 'bg-gray-100 text-gray-700' },
          title: 'Subscription Canceled',
          message: 'Your subscription has been canceled',
          showProgress: false
        };
      default:
        return {
          icon: Shield,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          badge: { text: 'Inactive', variant: 'outline' as const, className: '' },
          title: 'No Active Subscription',
          message: 'Start your subscription to access all features',
          showProgress: false
        };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const IconComponent = getPlanIcon(currentPlan);
  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <Card className={`border-zinc-200 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${getPlanColor(currentPlan)}`}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{formatPlanName(currentPlan)}</CardTitle>
              <p className="text-sm text-zinc-600">Current plan</p>
            </div>
          </div>
          <Badge 
            variant={statusInfo.badge.variant} 
            className={statusInfo.badge.className}
          >
            {statusInfo.badge.text}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Information */}
        <div className={`rounded-lg p-4 border ${statusInfo.bgColor}`}>
          <div className="flex items-start gap-3">
            <StatusIcon className={`h-5 w-5 ${statusInfo.color} mt-0.5`} />
            <div className="flex-1">
              <h3 className={`font-medium ${statusInfo.color.replace('text-', 'text-')} mb-1`}>
                {statusInfo.title}
              </h3>
              <p className="text-sm text-zinc-600">
                {statusInfo.message}
              </p>
            </div>
          </div>
        </div>

        {/* Trial Progress */}
        {statusInfo.showProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">Trial Progress</span>
              <span className="font-medium text-zinc-900">
                {progressPercentage}% complete
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Day 1</span>
              <span className="font-medium">
                {daysRemaining} days remaining
              </span>
              <span>Day 7</span>
            </div>
          </div>
        )}

        {/* Action Items */}
        {subscriptionStatus === 'past_due' && (
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <CreditCard className="h-4 w-4" />
              <span>Action Required: Update payment method</span>
            </div>
          </div>
        )}

        {isTrialing && daysRemaining <= 2 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <Clock className="h-4 w-4" />
              <span>Trial expires soon - subscription will activate</span>
            </div>
          </div>
        )}

        {hasActiveSubscription && nextBillingDate && (
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Calendar className="h-4 w-4" />
              <span>Next billing: {formatDate(nextBillingDate)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}