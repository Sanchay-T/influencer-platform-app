'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Search,
  Send, 
  Clock, 
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  Rocket,
  Users,
  RefreshCw,
  TestTube,
  Database,
  Eye
} from 'lucide-react';

interface UserProfile {
  user_id: string;
  full_name: string;
  business_name: string;
  email_address: string;
  onboarding_step: string;
  trial_status: string;
  trial_start_date: string;
  trial_end_date: string;
  email_schedule_status: any;
  stripe_customer_id: string;
  stripe_subscription_id: string;
}

interface EmailResult {
  type: string;
  status: 'success' | 'error';
  message: string;
  timestamp: string;
  userId: string;
  userEmail: string;
}

export default function AdminEmailTestingPage() {
  const { user: currentUser } = useUser(); // Get current admin user
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedEmailType, setSelectedEmailType] = useState<string>('trial_day2');
  const [customDelay, setCustomDelay] = useState<string>('1m');
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailResults, setEmailResults] = useState<EmailResult[]>([]);
  const [showBulkMode, setShowBulkMode] = useState(false);

  const emailTypes = [
    { value: 'welcome', label: 'Welcome Email', description: 'Initial welcome message' },
    { value: 'trial_day2', label: 'Trial Day 2 Reminder', description: 'Check-in after 2 days' },
    { value: 'trial_day5', label: 'Trial Day 5 Reminder', description: 'Mid-trial engagement' },
    { value: 'trial_expiry', label: 'Trial Expiry Notice', description: 'Final reminder before expiry' },
    { value: 'abandonment', label: 'Trial Abandonment', description: 'Re-engagement email' },
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

  // Search users
  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/admin/email-testing/users-cached?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      } else {
        console.error('Failed to search users:', response.statusText);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input changes with optimized debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 150); // Reduced from 300ms to 150ms for faster response

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Send test email
  const sendTestEmail = async (userId?: string, userEmail?: string) => {
    const targetUserId = userId || selectedUser?.user_id;
    // Use admin's email for testing (real email from Clerk)
    const adminEmail = currentUser?.emailAddresses?.[0]?.emailAddress;
    const targetEmail = userEmail || adminEmail;
    
    if (!targetUserId || !targetEmail) {
      console.error('No user selected for email sending. Debug:', {
        selectedUser,
        targetUserId,
        targetEmail,
        adminEmail,
        userIdParam: userId,
        userEmailParam: userEmail,
        currentUser: currentUser?.id
      });
      return;
    }

    setIsSending(true);
    
    try {
      console.log('🚀 [ADMIN-EMAIL] Sending test email:', {
        userId: targetUserId,
        emailType: selectedEmailType,
        delay: customDelay,
        userEmail: targetEmail
      });

      const response = await fetch('/api/admin/email-testing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          emailType: selectedEmailType,
          delay: customDelay,
          userEmail: targetEmail,
          templateProps: {
            fullName: selectedUser?.full_name || 'Admin Test User',
            businessName: selectedUser?.business_name || 'Test Business',
            dashboardUrl: `${window.location.origin}/campaigns`
          }
        })
      });

      const data = await response.json();
      
      const result: EmailResult = {
        type: selectedEmailType,
        status: response.ok ? 'success' : 'error',
        message: response.ok 
          ? `Email scheduled successfully! Message ID: ${data.messageId}` 
          : data.error || 'Failed to schedule email',
        timestamp: new Date().toLocaleTimeString(),
        userId: targetUserId,
        userEmail: targetEmail
      };

      setEmailResults(prev => [result, ...prev].slice(0, 10)); // Keep last 10 results

      if (response.ok) {
        console.log('✅ [ADMIN-EMAIL] Email scheduled successfully:', data);
      } else {
        console.error('❌ [ADMIN-EMAIL] Failed to schedule:', data);
      }

    } catch (error) {
      console.error('❌ [ADMIN-EMAIL] Error sending email:', error);
      
      setEmailResults(prev => [{
        type: selectedEmailType,
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString(),
        userId: targetUserId,
        userEmail: targetEmail
      }, ...prev].slice(0, 10));
    } finally {
      setIsSending(false);
    }
  };

  // Calculate trial status for user
  const getTrialStatus = (user: UserProfile) => {
    if (!user.trial_start_date || !user.trial_end_date) {
      return { status: 'No Trial', color: 'gray', timeLeft: 'N/A' };
    }

    const now = new Date();
    const endDate = new Date(user.trial_end_date);
    const timeDiff = endDate.getTime() - now.getTime();

    if (timeDiff <= 0) {
      return { status: 'Expired', color: 'red', timeLeft: 'Expired' };
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return { 
      status: 'Active', 
      color: 'green', 
      timeLeft: `${days}d ${hours}h remaining` 
    };
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Mail className="h-8 w-8 mr-3 text-blue-600" />
              Admin: Email Testing & Trial Management
            </h1>
            <p className="text-gray-600 mt-2">
              Test trial emails, manage user communications, and monitor delivery status
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setEmailResults([])}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear Results
            </Button>
            
            <Button 
              variant="secondary"
              onClick={() => setShowBulkMode(!showBulkMode)}
            >
              <Users className="h-4 w-4 mr-2" />
              {showBulkMode ? 'Single Mode' : 'Bulk Mode'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: User Search & Selection */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                User Lookup
              </CardTitle>
              <CardDescription>
                Search by email address or user ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Input */}
              <div>
                <Label htmlFor="search">Search Users</Label>
                <div className="relative">
                  <Input
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter email or user ID..."
                    className="pr-10"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <Label>Search Results</Label>
                  {searchResults.map((user) => {
                    const trialStatus = getTrialStatus(user);
                    return (
                      <div
                        key={user.user_id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedUser?.user_id === user.user_id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          console.log('🔄 [ADMIN-UI] User clicked, setting selectedUser:', user);
                          setSelectedUser(user);
                        }}
                      >
                        <div className="font-medium text-sm">{user.full_name || 'Unnamed User'}</div>
                        <div className="text-xs text-gray-600">{user.user_id}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              trialStatus.color === 'green' ? 'text-green-700 border-green-300' :
                              trialStatus.color === 'red' ? 'text-red-700 border-red-300' :
                              'text-gray-700 border-gray-300'
                            }`}
                          >
                            {trialStatus.status}
                          </Badge>
                          <span className="text-xs text-gray-500">{trialStatus.timeLeft}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected User Details */}
              {selectedUser && (
                <div className="border-t pt-4">
                  <Label>Selected User</Label>
                  <div className="mt-2 p-4 bg-blue-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{selectedUser.full_name || 'Unnamed User'}</span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>📧 Test emails → {currentUser?.emailAddresses?.[0]?.emailAddress || 'Admin email'}</div>
                      <div>🏢 {selectedUser.business_name || 'No business name'}</div>
                      <div>📋 Onboarding: {selectedUser.onboarding_step}</div>
                      <div>🎯 Trial: {getTrialStatus(selectedUser).status}</div>
                      {selectedUser.stripe_customer_id && (
                        <div className="text-xs font-mono bg-white px-2 py-1 rounded">
                          💳 {selectedUser.stripe_customer_id}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Email Testing Controls & Results */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* Email Testing Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-purple-600" />
                  Email Testing Controls
                </CardTitle>
                <CardDescription>
                  Configure and send test emails with custom delays
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email-type">Email Type</Label>
                    <Select value={selectedEmailType} onValueChange={setSelectedEmailType}>
                      <SelectTrigger id="email-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {emailTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-gray-500">{type.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="delay">Delay Before Sending</Label>
                    <div className="flex gap-2">
                      <Select value={customDelay} onValueChange={setCustomDelay}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {presetDelays.map((delay) => (
                            <SelectItem key={delay.value} value={delay.value}>
                              {delay.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input 
                        value={customDelay}
                        onChange={(e) => setCustomDelay(e.target.value)}
                        placeholder="e.g., 45s, 3m"
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button 
                    onClick={() => {
                      console.log('🚀 [ADMIN-UI] Send button clicked, selectedUser state:', selectedUser);
                      sendTestEmail();
                    }}
                    disabled={isSending || !selectedUser}
                    className="flex-1"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
                    onClick={() => {
                      const originalDelay = customDelay;
                      setCustomDelay('30s');
                      sendTestEmail().finally(() => setCustomDelay(originalDelay));
                    }}
                    disabled={isSending || !selectedUser}
                    variant="outline"
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Send Now
                  </Button>

                  <Button 
                    variant="secondary"
                    disabled={!selectedUser}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>

                {!selectedUser && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">No user selected</p>
                        <p className="text-xs mt-1">Search and select a user to send test emails.</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Email Activity */}
            {emailResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-green-600" />
                    Recent Email Activity
                  </CardTitle>
                  <CardDescription>
                    Live log of email operations and delivery status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {emailResults.map((result, index) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-lg border flex items-start gap-3 ${
                          result.status === 'success' 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        {result.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">
                              {emailTypes.find(t => t.value === result.type)?.label || result.type}
                            </span>
                            <span className="text-xs text-gray-500">{result.timestamp}</span>
                          </div>
                          <div className="text-xs text-gray-600 mb-1">
                            📧 {result.userEmail} ({result.userId.substring(0, 8)}...)
                          </div>
                          <div className="text-sm break-all">{result.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions & Tips */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Send className="h-5 w-5" />
                  Admin Email Testing Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-blue-800">
                  <div>
                    <h4 className="font-medium mb-1">📋 Testing Workflow:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Search for user by email or ID</li>
                      <li>Select user from search results</li>
                      <li>Choose email type and delay</li>
                      <li>Send test email or preview template</li>
                      <li>Monitor results in activity log</li>
                    </ol>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">⚡ Quick Actions:</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li><strong>Send Now:</strong> Uses 30-second delay for immediate testing</li>
                      <li><strong>Preview:</strong> Review email content before sending</li>
                      <li><strong>Bulk Mode:</strong> Send to multiple users at once</li>
                    </ul>
                  </div>

                  <div className="bg-white/50 rounded p-2 mt-3">
                    <p className="text-xs italic">
                      💡 <strong>Tip:</strong> Use short delays (30s-2m) for quick testing. 
                      All emails are sent via Resend + QStash with full delivery tracking.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}