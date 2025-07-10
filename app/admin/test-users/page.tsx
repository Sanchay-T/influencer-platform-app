'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminTestUsersPage() {
  const [email, setEmail] = useState('');
  const [testUser, setTestUser] = useState(null);
  const [testUsers, setTestUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const createTestUser = async () => {
    if (!email.trim()) {
      setMessage('❌ Email is required');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/admin/create-test-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTestUser(result.credentials);
        setMessage('✅ Test user created successfully! Check console for detailed instructions.');
        console.log('🧪 [TEST-USER-CREATED] Test user credentials:', result.credentials);
        console.log('📋 [TEST-USER-INSTRUCTIONS]:', result.credentials.instructions);
        loadTestUsers(); // Refresh the list
      } else {
        setMessage(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Error creating test user');
      console.error('Error:', error);
    }
    
    setLoading(false);
  };

  const loadTestUsers = async () => {
    try {
      const response = await fetch('/api/admin/create-test-user');
      const result = await response.json();
      setTestUsers(result.testUsers || []);
    } catch (error) {
      console.error('Error loading test users:', error);
    }
  };

  const setupTestLogin = async (userId) => {
    try {
      const response = await fetch('/api/admin/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          password: 'test_password' // Not actually used for validation
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage(`✅ Test login setup for ${userId}. Follow instructions in console.`);
        console.log('🔐 [TEST-LOGIN-SETUP] Instructions:', result.instructions);
        console.log('🔐 [TEST-LOGIN-SETUP] Next steps:', result.nextSteps);
      } else {
        setMessage(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Error setting up test login');
      console.error('Error:', error);
    }
  };

  // Load test users on component mount
  useEffect(() => {
    loadTestUsers();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Create Test User Section */}
      <Card>
        <CardHeader>
          <CardTitle>🧪 Create Test User for Onboarding Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter email for test user..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createTestUser()}
            />
            <Button onClick={createTestUser} disabled={loading}>
              {loading ? 'Creating...' : 'Create Test User'}
            </Button>
          </div>

          {message && (
            <div className="p-3 bg-gray-100 rounded text-sm font-mono">
              {message}
            </div>
          )}

          {testUser && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded space-y-2">
              <h3 className="font-semibold text-blue-800">🎯 New Test User Created</h3>
              <div className="space-y-1 text-sm font-mono">
                <div><strong>User ID:</strong> {testUser.userId}</div>
                <div><strong>Email:</strong> {testUser.email}</div>
                <div><strong>Password:</strong> {testUser.password}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  onClick={() => setupTestLogin(testUser.userId)}
                >
                  Setup Test Login
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.open(testUser.onboardingUrl, '_blank')}
                >
                  Go to Onboarding
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions Section */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <h4 className="font-semibold text-yellow-800 mb-2">🚀 How to Test Onboarding Flow:</h4>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Create a test user above</li>
              <li>Click "Setup Test Login" to configure authentication</li>
              <li>Restart your dev server (npm run dev)</li>
              <li>Go to /onboarding and complete the flow</li>
              <li>Watch console logs for detailed tracking</li>
            </ol>
          </div>
          
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <h4 className="font-semibold text-green-800 mb-2">📊 What You'll See:</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>🚀🚀🚀 Step headers for each major action</li>
              <li>⏱️ Execution timing for each operation</li>
              <li>📧📧📧 Email scheduling details</li>
              <li>🎯 Trial setup and activation logs</li>
              <li>💳 Mock Stripe customer creation</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Existing Test Users */}
      <Card>
        <CardHeader>
          <CardTitle>📝 Existing Test Users</CardTitle>
        </CardHeader>
        <CardContent>
          {testUsers.length === 0 ? (
            <p className="text-gray-500">No test users found. Create one above.</p>
          ) : (
            <div className="space-y-2">
              {testUsers.map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-3 border rounded">
                  <div className="space-y-1">
                    <div className="font-mono text-sm">{user.userId}</div>
                    <div className="text-xs text-gray-600">
                      Step: {user.onboardingStep} | Trial: {user.trialStatus || 'None'}
                    </div>
                    {user.fullName && (
                      <div className="text-xs text-gray-600">
                        {user.fullName} - {user.businessName}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setupTestLogin(user.userId)}
                  >
                    Use This User
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}