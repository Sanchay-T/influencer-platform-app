'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      setUsers(data.users || []);
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
            {users.map((user) => (
              <div key={user.user_id || user.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">
                    {user.full_name || user.fullName || user.firstName + ' ' + user.lastName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {user.email || 'No email'}
                  </div>
                  {user.source === 'clerk' && (
                    <div className="text-xs text-blue-600">Clerk User (No Profile)</div>
                  )}
                </div>
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}