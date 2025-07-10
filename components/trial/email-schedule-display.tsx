'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  CheckCircle, 
  Clock, 
  Calendar, 
  AlertCircle,
  Send
} from 'lucide-react';

interface EmailScheduleItem {
  type: string;
  status: 'sent' | 'scheduled' | 'failed' | 'cancelled';
  timestamp?: string;
  scheduledFor?: string;
  messageId?: string;
}

interface EmailScheduleDisplayProps {
  emailScheduleStatus: Record<string, any>;
  className?: string;
}

export function EmailScheduleDisplay({ emailScheduleStatus, className = '' }: EmailScheduleDisplayProps) {
  // Parse email schedule status
  const getEmailSchedules = (): EmailScheduleItem[] => {
    if (!emailScheduleStatus || typeof emailScheduleStatus !== 'object' || Object.keys(emailScheduleStatus).length === 0) {
      return [];
    }

    const schedules: EmailScheduleItem[] = [];
    
    // Process each email type
    Object.entries(emailScheduleStatus).forEach(([emailType, data]: [string, any]) => {
      if (data && typeof data === 'object') {
        schedules.push({
          type: emailType,
          status: data.status || 'scheduled',
          timestamp: data.timestamp,
          scheduledFor: data.scheduledFor,
          messageId: data.messageId
        });
      }
    });

    return schedules;
  };

  const emailSchedules = getEmailSchedules();

  const getEmailTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'welcome': 'Welcome Email',
      'abandonment': 'Trial Abandonment',
      'trial_day2': 'Day 2 Reminder',
      'trial_day5': 'Day 5 Reminder',
      'trial_expiry': 'Trial Expiry Notice'
    };
    return labels[type] || type;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Mail className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-100 text-green-800">Sent</Badge>;
      case 'scheduled':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'Not set';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  if (emailSchedules.length === 0) {
    return null; // Don't show card if no email data - handled by parent component
  }

  return (
    <Card className={`${className} border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Send className="h-5 w-5 text-blue-600" />
          <span className="font-semibold">Email Schedule</span>
        </CardTitle>
        <CardDescription className="mt-1">
          Trial email sequence status and timing
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {emailSchedules.map((schedule, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(schedule.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {getEmailTypeLabel(schedule.type)}
                  </h4>
                  {getStatusBadge(schedule.status)}
                </div>
                
                <div className="space-y-1 text-sm text-gray-600">
                  {schedule.status === 'sent' && schedule.timestamp && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span>Sent: {formatTimestamp(schedule.timestamp)}</span>
                    </div>
                  )}
                  
                  {schedule.status === 'scheduled' && schedule.scheduledFor && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-blue-500" />
                      <span>Scheduled for: {formatTimestamp(schedule.scheduledFor)}</span>
                    </div>
                  )}
                  
                  {schedule.messageId && (
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <code className="text-xs bg-white px-2 py-1 rounded border break-all">
                        {schedule.messageId}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {emailSchedules.filter(s => s.status === 'sent').length}
              </div>
              <div className="text-xs text-gray-500">Sent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {emailSchedules.filter(s => s.status === 'scheduled').length}
              </div>
              <div className="text-xs text-gray-500">Scheduled</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {emailSchedules.filter(s => s.status === 'failed').length}
              </div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmailScheduleDisplay;