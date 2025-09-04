'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TestPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState('test_glow_up_user');
  const [selectedPlan, setSelectedPlan] = useState<'glow_up' | 'viral_surge' | 'fame_flex'>('glow_up');
  const [testLoading, setTestLoading] = useState(false);
  const [userStatus, setUserStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error:', err);
        setLoading(false);
      });
  }, []);

  // Test functions
  const createTestUsers = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/test/subscription?action=create-users');
      const data = await res.json();
      setTestResults(data);
      alert(data.success ? data.message : data.error);
    } catch (error) {
      alert('Error creating test users');
    }
    setTestLoading(false);
  };

  const runComprehensiveTest = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/test/subscription?action=run-suite');
      const data = await res.json();
      setTestResults(data);
    } catch (error) {
      alert('Error running test suite');
    }
    setTestLoading(false);
  };

  const testCampaignLimits = async (count: number = 5) => {
    setTestLoading(true);
    try {
      const res = await fetch(`/api/test/subscription?action=create-campaigns&userId=${selectedUser}&count=${count}`);
      const data = await res.json();
      setTestResults(data);
      await refreshUserStatus();
    } catch (error) {
      alert('Error testing campaign limits');
    }
    setTestLoading(false);
  };

  const testCreatorLimits = async (count: number = 1000) => {
    setTestLoading(true);
    try {
      const res = await fetch(`/api/test/subscription?action=use-creators&userId=${selectedUser}&count=${count}`);
      const data = await res.json();
      setTestResults(data);
      await refreshUserStatus();
    } catch (error) {
      alert('Error testing creator limits');
    }
    setTestLoading(false);
  };

  const switchPlan = async () => {
    setTestLoading(true);
    try {
      const res = await fetch(`/api/test/subscription?action=switch-plan&userId=${selectedUser}&plan=${selectedPlan}`);
      const data = await res.json();
      alert(data.success ? data.message : data.error);
      await refreshUserStatus();
    } catch (error) {
      alert('Error switching plan');
    }
    setTestLoading(false);
  };

  const resetUsage = async () => {
    setTestLoading(true);
    try {
      const res = await fetch(`/api/test/subscription?action=reset-usage&userId=${selectedUser}`);
      const data = await res.json();
      alert(data.success ? data.message : data.error);
      await refreshUserStatus();
    } catch (error) {
      alert('Error resetting usage');
    }
    setTestLoading(false);
  };

  const refreshUserStatus = async () => {
    try {
      const res = await fetch(`/api/test/subscription?action=get-status&userId=${selectedUser}`);
      const data = await res.json();
      if (data.success) {
        setUserStatus(data.status);
      }
    } catch (error) {
      console.error('Error refreshing user status:', error);
    }
  };

  const cleanupTestData = async () => {
    if (confirm('Are you sure you want to cleanup test data?')) {
      setTestLoading(true);
      try {
        const res = await fetch('/api/test/subscription?action=cleanup');
        const data = await res.json();
        alert(data.success ? data.message : data.error);
      } catch (error) {
        alert('Error cleaning up test data');
      }
      setTestLoading(false);
    }
  };

  // Load user status when user changes
  useEffect(() => {
    if (selectedUser) {
      refreshUserStatus();
    }
  }, [selectedUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Testing database connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-center mb-8">
            🎉 Subscription System Test Page
          </h1>
          
          {status?.success ? (
            <div className="space-y-6">
              {/* Database Status */}
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-green-800 mb-2">
                  ✅ Database Connection
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Environment:</span> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-mono ${
                      status.database.environment === 'LOCAL' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {status.database.environment}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Connection:</span> 
                    <span className="ml-2 text-xs font-mono text-gray-600">
                      {status.database.connection}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Plans:</span> {status.database.plans}
                  </div>
                  <div>
                    <span className="font-medium">Users:</span> {status.database.users}
                  </div>
                </div>
              </div>

              {/* Subscription Plans */}
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-blue-800 mb-4">
                  📋 Subscription Plans
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {status.subscriptionPlans?.map((plan: any) => (
                    <div key={plan.planKey} className="bg-white rounded-lg p-4 border">
                      <h3 className="font-bold text-lg mb-2">{plan.displayName}</h3>
                      <div className="text-sm space-y-1">
                        <div>💰 <span className="font-medium">${(plan.monthlyPrice / 100)}/mo</span></div>
                        <div>📊 <span className="font-medium">
                          {plan.campaignsLimit === -1 ? 'Unlimited' : plan.campaignsLimit} campaigns
                        </span></div>
                        <div>👥 <span className="font-medium">
                          {plan.creatorsLimit === -1 ? 'Unlimited' : plan.creatorsLimit.toLocaleString()} creators
                        </span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Testing Section */}
              <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-yellow-800 mb-6 text-center">
                  🧪 Subscription Plan Testing Suite
                </h2>
                
                {/* Test Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* User Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Test User Selection</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select test user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="test_glow_up_user">Glow Up User</SelectItem>
                          <SelectItem value="test_viral_surge_user">Viral Surge User</SelectItem>
                          <SelectItem value="test_fame_flex_user">Fame Flex User</SelectItem>
                          <SelectItem value="test_glow_up_limit">Glow Up (At Limit)</SelectItem>
                          <SelectItem value="test_viral_surge_limit">Viral Surge (At Limit)</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="flex gap-2">
                        <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="glow_up">Glow Up Plan</SelectItem>
                            <SelectItem value="viral_surge">Viral Surge Plan</SelectItem>
                            <SelectItem value="fame_flex">Fame Flex Plan</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={switchPlan} disabled={testLoading} size="sm">
                          Switch Plan
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Current Status */}
                  {userStatus && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Current Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Plan:</span>
                            <Badge variant={userStatus.user.currentPlan === 'fame_flex' ? 'default' : 'secondary'}>
                              {userStatus.user.currentPlan}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Campaigns:</span>
                            <span className={userStatus.usage?.campaignsUsed >= (userStatus.limits?.campaignsLimit || 0) && userStatus.limits?.campaignsLimit !== -1 ? 'text-red-600 font-bold' : ''}>
                              {userStatus.usage?.campaignsUsed || 0} / {userStatus.limits?.campaignsLimit === -1 ? '∞' : userStatus.limits?.campaignsLimit || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Creators:</span>
                            <span className={userStatus.usage?.creatorsUsed >= (userStatus.limits?.creatorsLimit || 0) && userStatus.limits?.creatorsLimit !== -1 ? 'text-red-600 font-bold' : ''}>
                              {userStatus.usage?.creatorsUsed || 0} / {userStatus.limits?.creatorsLimit === -1 ? '∞' : (userStatus.limits?.creatorsLimit || 0).toLocaleString()}
                            </span>
                          </div>
                          {userStatus.upgradeSuggestion?.shouldUpgrade && (
                            <Alert>
                              <AlertDescription>
                                💡 Suggested: {userStatus.upgradeSuggestion.suggestedPlan || 'Upgrade recommended'}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Test Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Button onClick={createTestUsers} disabled={testLoading} variant="outline">
                    Create Test Users
                  </Button>
                  <Button onClick={() => testCampaignLimits(5)} disabled={testLoading} className="bg-blue-600 hover:bg-blue-700">
                    Test Campaigns (5x)
                  </Button>
                  <Button onClick={() => testCreatorLimits(1000)} disabled={testLoading} className="bg-green-600 hover:bg-green-700">
                    Test Creators (1000)
                  </Button>
                  <Button onClick={() => testCreatorLimits(500)} disabled={testLoading} className="bg-green-500 hover:bg-green-600">
                    Test Creators (500)
                  </Button>
                  <Button onClick={resetUsage} disabled={testLoading} variant="outline">
                    Reset Usage
                  </Button>
                  <Button onClick={runComprehensiveTest} disabled={testLoading} className="bg-purple-600 hover:bg-purple-700">
                    Run Full Suite
                  </Button>
                  <Button onClick={refreshUserStatus} disabled={testLoading} variant="outline">
                    Refresh Status
                  </Button>
                  <Button onClick={cleanupTestData} disabled={testLoading} variant="destructive">
                    Cleanup Test Data
                  </Button>
                </div>

                {/* Test Results */}
                {testResults && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Latest Test Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {testResults.results?.results && (
                          <div>
                            <h4 className="font-semibold mb-2">Test Suite Results:</h4>
                            <div className="space-y-2">
                              {testResults.results.results.map((test: any, index: number) => (
                                <div key={index} className={`p-2 rounded border ${test.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <div className="font-medium">
                                    {test.passed ? '✅' : '❌'} {test.test}
                                  </div>
                                  <div className="text-sm text-gray-600">{test.details}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 p-3 bg-gray-100 rounded">
                              <strong>Summary: </strong>
                              {testResults.results.summary.passed}/{testResults.results.summary.total} tests passed
                              {testResults.results.summary.failed > 0 && (
                                <span className="text-red-600 ml-2">({testResults.results.summary.failed} failed)</span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {testResults.results?.success !== undefined && !testResults.results.results && (
                          <div className={`p-3 rounded ${testResults.results.success ? 'bg-green-50' : 'bg-red-50'}`}>
                            <div className="font-medium">
                              {testResults.results.success ? '✅' : '❌'} {testResults.message}
                            </div>
                            {testResults.results.error && (
                              <div className="text-sm text-red-600 mt-1">{testResults.results.error}</div>
                            )}
                            {testResults.results.results && (
                              <div className="text-sm mt-2">
                                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                                  {JSON.stringify(testResults.results.results, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {testLoading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-2"></div>
                    <p className="text-yellow-700">Running tests...</p>
                  </div>
                )}
              </div>

              {/* Test Users */}
              {status.testUsers && status.testUsers.length > 0 && (
                <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-purple-800 mb-4">
                    👤 Test Users
                  </h2>
                  <div className="space-y-2">
                    {status.testUsers.map((user: any, index: number) => (
                      <div key={index} className="bg-white rounded-lg p-3 border text-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div><span className="font-medium">Plan:</span> {user.currentPlan}</div>
                          <div><span className="font-medium">Campaigns:</span> {user.campaignsUsed}/{user.campaignsLimit}</div>
                          <div><span className="font-medium">Creators:</span> {user.creatorsUsed}/{user.creatorsLimit}</div>
                          <div><span className="font-medium">User ID:</span> {user.userId}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  🚀 Ready to Test!
                </h2>
                <div className="text-sm space-y-2">
                  <p><strong>✅ Local PostgreSQL:</strong> Running with your subscription plans</p>
                  <p><strong>✅ Plan Enforcement:</strong> Campaign and creator limits active</p>
                  <p><strong>✅ Test User:</strong> Created with Glow Up plan (3 campaigns, 1000 creators)</p>
                  <p><strong>🌐 Server:</strong> <code className="bg-gray-200 px-1 rounded">http://localhost:3002</code></p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-red-200 bg-red-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-red-800 mb-2">
                ❌ Database Error
              </h2>
              <p className="text-red-600">{status?.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}