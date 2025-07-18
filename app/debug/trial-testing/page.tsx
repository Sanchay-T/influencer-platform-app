'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Clock, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  Bug,
  Timer,
  PlayCircle
} from 'lucide-react';

export default function TrialTestingPage() {
  const [trialStatus, setTrialStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [simulateDay, setSimulateDay] = useState('3');
  const [lastAction, setLastAction] = useState('');

  const fetchTrialStatus = async () => {
    try {
      const response = await fetch('/api/debug/trial-testing');
      const data = await response.json();
      setTrialStatus(data.currentTrialStatus);
    } catch (error) {
      console.error('Error fetching trial status:', error);
    }
  };

  useEffect(() => {
    fetchTrialStatus();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchTrialStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const executeTestAction = async (action: string, testDate?: string) => {
    setIsLoading(true);
    setLastAction(action);
    
    try {
      const response = await fetch('/api/debug/trial-testing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action, 
          testDate: testDate || simulateDay 
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Test action successful:', result);
        await fetchTrialStatus(); // Refresh status
      } else {
        console.error('❌ Test action failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error executing test action:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'expired': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Trial System Testing Dashboard
          </h1>
          <p className="text-gray-600">
            Test trial timer logic without waiting 7 days
          </p>
        </div>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Current Trial Status
            </CardTitle>
            <CardDescription>
              Live trial status with real-time countdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trialStatus ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Badge className={getStatusColor(trialStatus.trialStatus)}>
                    {trialStatus.trialStatus}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>Days Remaining</Label>
                  <div className="text-2xl font-bold text-blue-600">
                    {trialStatus.daysRemaining}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Progress</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${trialStatus.progressPercentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {trialStatus.progressPercentage}%
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Trial Start</Label>
                  <div className="text-sm text-gray-600">
                    {trialStatus.trialStartDate ? formatDate(trialStatus.trialStartDate) : 'Not set'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Trial End</Label>
                  <div className="text-sm text-gray-600">
                    {trialStatus.trialEndDate ? formatDate(trialStatus.trialEndDate) : 'Not set'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Time Until Expiry</Label>
                  <div className="text-sm font-medium text-orange-600">
                    {trialStatus.timeUntilExpiry}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Loading trial status...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Testing Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Tests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Quick Tests
              </CardTitle>
              <CardDescription>
                Common testing scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => executeTestAction('set_trial_near_expiry')}
                className="w-full justify-start"
                variant="outline"
                disabled={isLoading}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Set Trial to Expire in 1 Hour
              </Button>
              
              <Button
                onClick={() => executeTestAction('set_trial_expired')}
                className="w-full justify-start"
                variant="outline"
                disabled={isLoading}
              >
                <Clock className="h-4 w-4 mr-2" />
                Set Trial as Expired
              </Button>
              
              <Button
                onClick={() => executeTestAction('reset_trial')}
                className="w-full justify-start"
                variant="outline"
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Fresh 7-Day Trial
              </Button>
            </CardContent>
          </Card>

          {/* Custom Day Simulation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Day Simulation
              </CardTitle>
              <CardDescription>
                Simulate specific trial day (0-7)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="simulateDay">Trial Day (0-7)</Label>
                <Input
                  id="simulateDay"
                  type="number"
                  min="0"
                  max="7"
                  value={simulateDay}
                  onChange={(e) => setSimulateDay(e.target.value)}
                  placeholder="Enter day (0-7)"
                />
                <div className="text-xs text-gray-500">
                  0 = Just started, 3 = Mid-trial, 6 = Almost expired, 7 = Expired
                </div>
              </div>
              
              <Button
                onClick={() => executeTestAction('simulate_day', simulateDay)}
                className="w-full"
                disabled={isLoading}
              >
                <Bug className="h-4 w-4 mr-2" />
                Simulate Day {simulateDay}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        {lastAction && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Last Test Action
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800">
                  ✅ Successfully executed: <strong>{lastAction}</strong>
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Trial status has been updated. Check the billing page to see changes.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">How to Test:</h4>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>Use the quick test buttons above to simulate different trial states</li>
                <li>Navigate to <code>/billing</code> or <code>/profile</code> to see the changes in real-time</li>
                <li>Check the trial progress, countdown, and status updates</li>
                <li>Use "Day Simulation" to test specific points in the trial lifecycle</li>
                <li>Reset the trial when you're done testing</li>
              </ol>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important:</h4>
              <p className="text-sm text-yellow-800">
                This only changes the database dates for testing. It doesn't affect actual Stripe billing cycles.
                In production, Stripe handles the real billing automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}