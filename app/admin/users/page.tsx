'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Admin Users</h1>
      </div>
      <Card className="bg-zinc-900/80 border border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Make User Admin</CardTitle>
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
            <div className="p-2 bg-zinc-800/60 border border-zinc-700/50 rounded text-sm text-zinc-200">{message}</div>
          )}

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="border-b border-zinc-800">
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[200px]">User</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Plan</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[220px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-800">
                  {users.map((user) => {
                    const billing = user.billing || { currentPlan: 'free', isActive: false };
                    const planName = billing.currentPlan?.replace('_', ' ') || 'free';
                    const isActive = billing.isActive;
                    return (
                      <TableRow key={user.user_id || user.id} className="table-row">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.imageUrl} alt={user.full_name || user.fullName || user.firstName} />
                              <AvatarFallback className="bg-zinc-700 text-zinc-300">
                                {(user.full_name || user.fullName || user.firstName || 'U').slice(0,1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-zinc-100">
                                {user.full_name || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim()}
                              </div>
                              {user.source === 'clerk' && (
                                <div className="text-xs text-zinc-500">Clerk User (No Profile)</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-zinc-300">
                          {user.email || user.emailAddress || 'No email'}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700/50 flex items-center gap-1">
                            {planName.replace(/\b\w/g, c => c.toUpperCase())}
                            {billing.isTrialing && ' (Trial)'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          {isActive ? (
                            <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">Active</Badge>
                          ) : (
                            <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700/50">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex gap-2">
                            {billing && billing.currentPlan !== 'enterprise' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMessage(`Plan upgrade for ${user.firstName || user.full_name || 'User'} - Feature coming soon`)}
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
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
