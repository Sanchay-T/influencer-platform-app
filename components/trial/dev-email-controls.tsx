'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Send, 
  Clock, 
  TestTube,
  Rocket,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface DevEmailControlsProps {
  userId: string;
  userEmail?: string;
  fullName?: string;
  businessName?: string;
}

export function DevEmailControls({ userId, userEmail, fullName, businessName }: DevEmailControlsProps) {
  const [selectedEmailType, setSelectedEmailType] = useState<string>('trial_day2');
  const [customDelay, setCustomDelay] = useState<string>('1m');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Array<{
    type: string;
    status: 'success' | 'error';
    message: string;
    timestamp: string;
  }>>([]);

  const emailTypes = [
    { value: 'welcome', label: 'Welcome Email', defaultDelay: '10m' },
    { value: 'trial_day2', label: 'Trial Day 2 Reminder', defaultDelay: '2m' },
    { value: 'trial_day5', label: 'Trial Day 5 Reminder', defaultDelay: '5m' },
    { value: 'trial_expiry', label: 'Trial Expiry Notice', defaultDelay: '7m' },
    { value: 'abandonment', label: 'Trial Abandonment', defaultDelay: '2h' },
  ];

  const presetDelays = [
    { value: '30s', label: '30 seconds' },
    { value: '1m', label: '1 minute' },
    { value: '2m', label: '2 minutes' },
    { value: '5m', label: '5 minutes' },
    { value: '10m', label: '10 minutes' },
    { value: '30m', label: '30 minutes' },
    { value: '1h', label: '1 hour' },
    { value: '2h', label: '2 hours' },
    { value: '1d', label: '1 day' },
    { value: '2d', label: '2 days' },
    { value: '5d', label: '5 days' },
  ];

  const handleScheduleEmail = async () => {
    setIsLoading(true);
    
    try {
      console.log('🚀 [DEV-EMAIL] Scheduling test email:', {
        userId,
        emailType: selectedEmailType,
        delay: customDelay,
        userEmail
      });

      const response = await fetch('/api/dev/schedule-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          emailType: selectedEmailType,
          delay: customDelay,
          userEmail,
          templateProps: {
            fullName: fullName || 'Test User',
            businessName: businessName || 'Test Business',
            dashboardUrl: `${window.location.origin}/campaigns`
          }
        })
      });

      const data = await response.json();
      
      const result = {
        type: selectedEmailType,
        status: response.ok ? 'success' as const : 'error' as const,
        message: response.ok 
          ? `Email scheduled successfully! Message ID: ${data.messageId}` 
          : data.error || 'Failed to schedule email',
        timestamp: new Date().toLocaleTimeString()
      };

      setResults(prev => [result, ...prev].slice(0, 5)); // Keep last 5 results

      if (response.ok) {
        console.log('✅ [DEV-EMAIL] Email scheduled successfully:', data);
      } else {
        console.error('❌ [DEV-EMAIL] Failed to schedule:', data);
      }

    } catch (error) {
      console.error('❌ [DEV-EMAIL] Error scheduling email:', error);
      
      setResults(prev => [{
        type: selectedEmailType,
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 5));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendImmediately = async () => {
    await handleScheduleEmail();
  };

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <TestTube className="h-5 w-5" />
          Dev Mode: Email Testing Controls
        </CardTitle>
        <CardDescription className="text-purple-600">
          Manually trigger and test trial emails with custom delays
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Email Configuration */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="email-type" className="text-purple-800">Email Type</Label>
            <Select value={selectedEmailType} onValueChange={setSelectedEmailType}>
              <SelectTrigger id="email-type" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {emailTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="delay" className="text-purple-800">Delay Before Sending</Label>
            <div className="flex gap-2">
              <Select value={customDelay} onValueChange={setCustomDelay}>
                <SelectTrigger className="bg-white flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetDelays.map((delay) => (
                    <SelectItem key={delay.value} value={delay.value}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {delay.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                id="delay"
                value={customDelay}
                onChange={(e) => setCustomDelay(e.target.value)}
                placeholder="Custom (e.g., 45s, 3m)"
                className="bg-white w-32"
              />
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Format: 30s, 5m, 2h, 1d (seconds, minutes, hours, days)
            </p>
          </div>

          {/* User Info Display */}
          <div className="bg-white rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">User ID:</span>
              <code className="text-xs bg-purple-100 px-2 py-1 rounded">{userId}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-mono text-xs">{userEmail || 'Not available'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span>{fullName || 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={handleScheduleEmail}
            disabled={isLoading || !userEmail}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Scheduling...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Schedule with Delay
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleSendImmediately}
            disabled={isLoading || !userEmail}
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-100"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Send Now (30s)
          </Button>
        </div>

        {!userEmail && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Email address not available</p>
                <p className="text-xs mt-1">Make sure the user profile has an email address set.</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Log */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-purple-800">Recent Results:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {results.map((result, index) => (
                <div 
                  key={index} 
                  className={`text-xs p-2 rounded-lg flex items-start gap-2 ${
                    result.status === 'success' 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {result.status === 'success' ? (
                    <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{result.type} - {result.timestamp}</div>
                    <div className="break-all">{result.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-purple-100 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-purple-900 flex items-center gap-2">
            <Send className="h-4 w-4" />
            How to Test Email Flow:
          </h4>
          <ol className="text-xs text-purple-800 space-y-1 list-decimal list-inside">
            <li>Select an email type (e.g., "Trial Day 2 Reminder")</li>
            <li>Choose a short delay for testing (e.g., "1 minute")</li>
            <li>Click "Schedule with Delay" to queue the email</li>
            <li>Check your inbox after the delay period</li>
            <li>Verify email content and countdown calculations</li>
          </ol>
          <p className="text-xs text-purple-700 italic mt-2">
            💡 Tip: Use short delays (30s-2m) for quick testing. Emails are sent via Resend + QStash.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default DevEmailControls;