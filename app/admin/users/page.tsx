'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Shield } from 'lucide-react';

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/email-testing/users?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      // Enhance user data with billing status
      const usersWithBilling = await Promise.all(
        (data.users || []).map(async (user) => {
          try {
            const billingResponse = await fetch(`/api/admin/users/billing-status?userId=${user.id}`);
            const billingData = await billingResponse.json();
            return { ...user, billing: billingData };
          } catch {
            return { ...user, billing: { currentPlan: 'free', isActive: false } };
          }
        })
      );
      
      setUsers(usersWithBilling);
    } catch (error) {
      setMessage('Error searching users');
    }
    setLoading(false);
  };

  const promoteToAdmin = async (userId, userName) => {
    try {
      const response = await fetch('/api/admin/users/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const result = await response.json();
      if (result.success) {
        setMessage(`✅ ${userName} is now an admin`);
      } else {
        setMessage(`❌ Failed: ${result.message}`);
      }
    } catch (error) {
      setMessage('❌ Error promoting user');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Make User Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
            />
            <Button onClick={searchUsers} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {message && (
            <div className="p-2 bg-gray-100 rounded text-sm">{message}</div>
          )}

          <div className="space-y-2">
            {users.map((user) => {
              const getBillingBadge = (billing) => {
                if (!billing) return null;
                
                const planConfig = {
                  free: { icon: Shield, color: 'bg-gray-100 text-gray-800' },
                  premium: { icon: Zap, color: 'bg-blue-100 text-blue-800' },
                  enterprise: { icon: Crown, color: 'bg-purple-100 text-purple-800' }
                };
                
                const config = planConfig[billing.currentPlan] || planConfig.free;
                const Icon = config.icon;
                
                return (
                  <Badge className={`${config.color} flex items-center gap-1`}>
                    <Icon className="h-3 w-3" />
                    {billing.currentPlan?.charAt(0).toUpperCase() + billing.currentPlan?.slice(1)}
                    {billing.isTrialing && ' (Trial)'}
                  </Badge>
                );
              };
              
              return (
                <div key={user.user_id || user.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">
                        {user.full_name || user.fullName || user.firstName + ' ' + user.lastName}
                      </div>
                      {getBillingBadge(user.billing)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {user.email || 'No email'}
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500 mt-1">
                      {user.source === 'clerk' && (
                        <span className="text-blue-600">Clerk User (No Profile)</span>
                      )}
                      {user.billing && (
                        <span>
                          {user.billing.isActive ? '✅ Active' : '❌ Inactive'} • 
                          Plan: {user.billing.currentPlan}
                          {user.billing.subscriptionId && ` • Sub: ${user.billing.subscriptionId.slice(-8)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user.billing && user.billing.currentPlan !== 'enterprise' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // TODO: Add plan upgrade functionality
                          setMessage(`Plan upgrade for ${user.firstName} - Feature coming soon`);
                        }}
                      >
                        Upgrade Plan
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => promoteToAdmin(
                        user.user_id || user.id, 
                        user.full_name || user.fullName || user.firstName
                      )}
                    >
                      Make Admin
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}