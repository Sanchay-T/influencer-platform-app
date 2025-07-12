# 🛡️ Admin Features - Comprehensive System Management

## Overview
Production-ready admin system with multi-layered authentication, real-time system configuration, user management, advanced email testing, and development tools for the influencer platform.

## 🏗️ Admin System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN SYSTEM ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Admin User Request                                             │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Middleware    │                                           │
│  │   Protection    │                                           │
│  │                 │                                           │
│  │ Route Matcher   │                                           │
│  │ Email Check     │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │        DUAL AUTHENTICATION              │                    │
│  │                                         │                    │
│  │  ┌─────────┐     ┌─────────────────┐   │                    │
│  │  │ Env Var │ AND │   Database      │   │                    │
│  │  │ Admin   │     │   Admin Role    │   │                    │
│  │  │ Emails  │     │   (is_admin)    │   │                    │
│  │  └─────────┘     └─────────────────┘   │                    │
│  └─────────────────────────────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │           ADMIN FEATURES                │                    │
│  │                                         │                    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │                    │
│  │  │System   │ │User     │ │Email    │   │                    │
│  │  │Config   │ │Mgmt     │ │Testing  │   │                    │
│  │  │         │ │         │ │         │   │                    │
│  │  │• API    │ │• Search │ │• 5 Types│   │                    │
│  │  │• Cache  │ │• Promote│ │• Delays │   │                    │
│  │  │• Timeout│ │• Create │ │• Tracking│   │                   │
│  │  └─────────┘ └─────────┘ └─────────┘   │                    │
│  └─────────────────────────────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │        LOGGING & MONITORING             │                    │
│  │                                         │                    │
│  │  • Admin action tracking               │                    │
│  │  • Configuration change logs           │                    │
│  │  • User promotion audit trail          │                    │
│  │  • Email delivery monitoring           │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Authentication & Authorization

### Dual Authentication System

#### **File: `lib/hooks/use-admin.ts`**
```typescript
export function useAdmin() {
  const { user, isLoaded } = useUser();
  
  // Primary authentication: Environment variable admin emails
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
  const userEmail = user?.primaryEmailAddress?.emailAddress || '';
  const isAdmin = adminEmails.includes(userEmail);
  
  return { 
    isAdmin, 
    isLoaded, 
    user, 
    userEmail, 
    adminEmails 
  };
}
```

#### **File: `lib/auth/admin-utils.ts`**
```typescript
// Server-side admin utilities with database integration
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    // Check environment variables first
    const envAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    
    // Get user from Clerk
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.primaryEmailAddress?.emailAddress;
    
    if (userEmail && envAdminEmails.includes(userEmail)) {
      console.log(`🔐 [ADMIN-AUTH] User ${userEmail} is admin via environment variable`);
      return true;
    }
    
    // Check database admin role
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });
    
    const isDbAdmin = userProfile?.isAdmin || false;
    console.log(`🔐 [ADMIN-AUTH] User ${userEmail} database admin status: ${isDbAdmin}`);
    
    return isDbAdmin;
  } catch (error) {
    console.error('[ADMIN-AUTH] Error checking admin status:', error);
    return false;
  }
}
```

### Middleware Route Protection

#### **File: `middleware.ts`**
```typescript
import { createRouteMatcher } from '@clerk/nextjs/server';

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

export default clerkMiddleware((auth, request) => {
  // Admin route protection
  if (isAdminRoute(request)) {
    const { sessionClaims } = auth();
    
    // Get admin emails from environment
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const userEmail = sessionClaims?.email as string | undefined;
    
    console.log('🔒 [MIDDLEWARE] Admin route access attempt:', {
      email: userEmail,
      isAuthorized: userEmail && adminEmails.includes(userEmail),
      route: request.nextUrl.pathname
    });
    
    if (!userEmail || !adminEmails.includes(userEmail)) {
      const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
      
      if (isApiRoute) {
        return new NextResponse('Forbidden', { status: 403 });
      } else {
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
      }
    }
  }
});
```

## ⚙️ System Configuration Management

### Real-Time Configuration Dashboard

#### **File: `app/admin/system-config/page.tsx`**
```typescript
export default function SystemConfigPage() {
  const [configs, setConfigs] = useState<Record<string, SystemConfiguration[]>>({});
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);

  const configCategories = {
    api_limits: { icon: '🚀', description: 'API call limits and rate limiting' },
    qstash_delays: { icon: '⏱️', description: 'Message scheduling delays' },
    timeouts: { icon: '⏰', description: 'Job timeout settings' },
    polling: { icon: '🔄', description: 'Frontend polling intervals' },
    cache: { icon: '💾', description: 'Cache duration settings' },
    processing: { icon: '⚙️', description: 'Data processing parameters' },
    cleanup: { icon: '🗑️', description: 'Data retention rules' }
  };

  const updateConfiguration = async (category: string, key: string, value: string) => {
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, key, value, valueType: 'number' })
    });
    
    await loadConfigurations();
    showToast('Configuration updated successfully');
  };
  
  // Real-time config editing with inline updates
  const renderConfigValue = (config: SystemConfiguration) => {
    const configKey = `${config.category}.${config.key}`;
    
    if (editingConfig === configKey) {
      return (
        <Input
          defaultValue={config.value}
          onBlur={(e) => {
            updateConfiguration(config.category, config.key, e.target.value);
            setEditingConfig(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateConfiguration(config.category, config.key, e.currentTarget.value);
              setEditingConfig(null);
            }
          }}
          autoFocus
          className="w-24"
        />
      );
    }
    
    return (
      <span 
        className="cursor-pointer hover:underline font-mono"
        onClick={() => setEditingConfig(configKey)}
        title="Click to edit"
      >
        {config.value}
      </span>
    );
  };
}
```

### Configuration API Endpoints

#### **File: `app/api/admin/config/route.ts`**
```typescript
// GET - Retrieve all configurations or specific category
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  
  try {
    let configs;
    if (category) {
      configs = await db.select().from(systemConfigurations)
        .where(eq(systemConfigurations.category, category));
    } else {
      configs = await db.select().from(systemConfigurations)
        .orderBy(systemConfigurations.category, systemConfigurations.key);
    }
    
    const grouped: Record<string, SystemConfiguration[]> = {};
    configs.forEach((config: SystemConfiguration) => {
      if (!grouped[config.category]) {
        grouped[config.category] = [];
      }
      grouped[config.category].push(config);
    });
    
    return NextResponse.json({ configs: grouped });
  } catch (error) {
    console.error('[ADMIN-CONFIG] Error loading configurations:', error);
    return NextResponse.json({ error: 'Failed to load configurations' }, { status: 500 });
  }
}

// POST - Create or update single configuration
export async function POST(request: Request) {
  try {
    const { category, key, value, valueType, description } = await request.json();
    
    // Validate the value
    validateConfigValue(value, valueType);
    
    await db.insert(systemConfigurations)
      .values({
        category,
        key,
        value,
        valueType,
        description,
        isHotReloadable: 'true',
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [systemConfigurations.category, systemConfigurations.key],
        set: {
          value,
          valueType,
          description,
          updatedAt: new Date()
        }
      });
    
    // Invalidate SystemConfig cache
    SystemConfig.clearCache();
    
    console.log(`[ADMIN-CONFIG] Updated: ${category}.${key} = ${value}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN-CONFIG] Error updating configuration:', error);
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }
}

// PUT - Bulk update configurations
export async function PUT(request: Request) {
  try {
    const { updates } = await request.json();
    
    for (const update of updates) {
      const { category, key, value, valueType } = update;
      validateConfigValue(value, valueType);
      
      await db.insert(systemConfigurations)
        .values({
          category,
          key,
          value,
          valueType,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [systemConfigurations.category, systemConfigurations.key],
          set: { value, updatedAt: new Date() }
        });
    }
    
    SystemConfig.clearCache();
    console.log(`[ADMIN-CONFIG] Bulk updated ${updates.length} configurations`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN-CONFIG] Error bulk updating:', error);
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}
```

## 👥 User Management System

### User Promotion and Management

#### **File: `app/admin/users/page.tsx`**
```typescript
export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const promoteToAdmin = async (userId: string, userName: string) => {
    try {
      const response = await fetch('/api/admin/users/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        showToast(`${userName} promoted to admin successfully`);
        await loadUsers();
      } else {
        throw new Error('Promotion failed');
      }
    } catch (error) {
      console.error('Error promoting user:', error);
      showToast('Failed to promote user', 'error');
    }
  };

  const demoteFromAdmin = async (userId: string, userName: string) => {
    try {
      const response = await fetch('/api/admin/users/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        showToast(`${userName} demoted from admin`);
        await loadUsers();
      }
    } catch (error) {
      console.error('Error demoting user:', error);
      showToast('Failed to demote user', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={() => setShowCreateUser(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Test User
        </Button>
      </div>
      
      {/* User search and filtering */}
      <div className="flex gap-4">
        <Input
          placeholder="Search users by email or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Button onClick={loadUsers} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Users table with admin actions */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Admin Status</TableHead>
                <TableHead>Trial Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.firstName} {user.lastName}</TableCell>
                  <TableCell>{user.primaryEmailAddress?.emailAddress}</TableCell>
                  <TableCell>
                    <Badge variant={user.isAdmin ? 'default' : 'secondary'}>
                      {user.isAdmin ? 'Admin' : 'User'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TrialStatusBadge trialStatus={user.trialStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {!user.isAdmin ? (
                        <Button
                          size="sm"
                          onClick={() => promoteToAdmin(user.id, user.firstName)}
                        >
                          Promote to Admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => demoteFromAdmin(user.id, user.firstName)}
                        >
                          Remove Admin
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### **File: `app/api/admin/users/promote/route.ts`**
```typescript
export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Check if user profile exists
    const existing = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });
    
    if (existing) {
      // Update existing profile
      await db.update(userProfiles)
        .set({ 
          isAdmin: true, 
          updatedAt: new Date() 
        })
        .where(eq(userProfiles.userId, userId));
      
      console.log(`[ADMIN-USERS] Updated user ${userId} to admin in existing profile`);
    } else {
      // Create new profile with admin status
      await db.insert(userProfiles).values({
        userId,
        isAdmin: true,
        onboardingStep: 'pending'
      });
      
      console.log(`[ADMIN-USERS] Created new admin profile for user ${userId}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN-USERS] Error promoting user:', error);
    return NextResponse.json({ error: 'Failed to promote user' }, { status: 500 });
  }
}
```

## 📧 Advanced Email Testing System

### Email Testing Dashboard

#### **File: `app/admin/email-testing/page.tsx`**
```typescript
export default function EmailTestingPage() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [emailType, setEmailType] = useState<string>('welcome');
  const [customDelay, setCustomDelay] = useState<string>('30s');
  const [activities, setActivities] = useState<any[]>([]);

  const emailTypes = {
    welcome: { 
      label: 'Welcome Email', 
      description: 'Sent immediately after signup',
      icon: '👋'
    },
    trial_day2: { 
      label: 'Trial Day 2', 
      description: 'Engagement reminder on day 2',
      icon: '⏰'
    },
    trial_day5: { 
      label: 'Trial Day 5', 
      description: 'Trial midpoint check-in',
      icon: '📈'
    },
    trial_expiry: { 
      label: 'Trial Expiry', 
      description: 'Trial ending notification',
      icon: '⏳'
    },
    abandonment: { 
      label: 'Abandonment', 
      description: 'Re-engagement for inactive users',
      icon: '📤'
    }
  };

  const delayOptions = [
    { value: '30s', label: '30 seconds' },
    { value: '2m', label: '2 minutes' },
    { value: '5m', label: '5 minutes' },
    { value: '1h', label: '1 hour' },
    { value: '1d', label: '1 day' },
    { value: '5d', label: '5 days' }
  ];

  const sendTestEmail = async () => {
    if (!selectedUser) {
      showToast('Please select a user first', 'error');
      return;
    }
    
    try {
      setIsSending(true);
      
      const response = await fetch('/api/admin/email-testing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          userName: selectedUser.firstName || 'User',
          userEmail: selectedUser.primaryEmailAddress?.emailAddress,
          emailType,
          delay: customDelay
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        showToast(`Email scheduled successfully! ${result.message}`, 'success');
        
        // Add to activity log
        const activity = {
          id: Date.now(),
          timestamp: new Date(),
          user: selectedUser.firstName || 'Unknown',
          email: selectedUser.primaryEmailAddress?.emailAddress,
          type: emailType,
          delay: customDelay,
          status: 'scheduled',
          messageId: result.messageId
        };
        
        setActivities(prev => [activity, ...prev]);
        
      } else {
        throw new Error('Failed to schedule email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showToast('Failed to schedule email', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Email Testing System</h1>
      
      {/* User Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserSelector 
            onUserSelect={setSelectedUser} 
            selectedUser={selectedUser}
          />
        </CardContent>
      </Card>
      
      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Type Selection */}
          <div>
            <Label>Email Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {Object.entries(emailTypes).map(([key, type]) => (
                <Card 
                  key={key}
                  className={`cursor-pointer transition-colors ${
                    emailType === key ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setEmailType(key)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{type.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Delay Configuration */}
          <div>
            <Label>Delivery Delay</Label>
            <Select value={customDelay} onValueChange={setCustomDelay}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {delayOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={sendTestEmail} 
            disabled={!selectedUser || isSending}
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scheduling Email...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Schedule Test Email
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Real-time Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Email Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmailActivityLog activities={activities} />
        </CardContent>
      </Card>
    </div>
  );
}
```

#### **File: `app/api/admin/email-testing/send/route.ts`**
```typescript
export async function POST(request: Request) {
  try {
    const { userId, userName, userEmail, emailType, delay } = await request.json();
    
    console.log('[EMAIL-TESTING] Scheduling test email:', {
      userId, userName, userEmail, emailType, delay
    });
    
    // Schedule email via QStash with delay
    const qstash = new Client({
      token: process.env.QSTASH_TOKEN!,
    });
    
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`;
    
    const message = await qstash.publishJSON({
      url: callbackUrl,
      body: {
        userId,
        userName,
        userEmail,
        emailType,
        source: 'admin-testing'
      },
      delay: delay, // e.g., "30s", "2m", "1h", "1d"
      retries: 3
    });
    
    console.log('[EMAIL-TESTING] Email scheduled with QStash:', message.messageId);
    
    return NextResponse.json({
      success: true,
      messageId: message.messageId,
      message: `Email will be sent in ${delay}`
    });
    
  } catch (error) {
    console.error('[EMAIL-TESTING] Error scheduling email:', error);
    return NextResponse.json(
      { error: 'Failed to schedule email' },
      { status: 500 }
    );
  }
}
```

## 🧪 Test User Creation System

### Test User Management

#### **File: `app/admin/test-users/page.tsx`**
```typescript
export default function TestUsersPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [testUsers, setTestUsers] = useState<any[]>([]);

  const createTestUser = async () => {
    try {
      setIsCreating(true);
      
      const response = await fetch('/api/admin/create-test-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeOnboarding: true,
          trialStatus: 'active'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        showToast('Test user created successfully!', 'success');
        
        setTestUsers(prev => [...prev, result.user]);
        
        // Optionally set up test authentication
        if (result.authToken) {
          console.log('Test auth token:', result.authToken);
        }
        
      } else {
        throw new Error('Failed to create test user');
      }
    } catch (error) {
      console.error('Error creating test user:', error);
      showToast('Failed to create test user', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Test User Management</h1>
        <Button onClick={createTestUser} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create Test User
            </>
          )}
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Test User Options</CardTitle>
          <CardDescription>
            Create test users for development and testing purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">🎯 Onboarding Test User</h3>
                <p className="text-sm text-gray-600 mb-3">
                  User ready for onboarding flow testing
                </p>
                <Button 
                  onClick={() => createTestUser({ type: 'onboarding' })}
                  className="w-full"
                >
                  Create Onboarding User
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">⚡ Active Trial User</h3>
                <p className="text-sm text-gray-600 mb-3">
                  User with active trial for feature testing
                </p>
                <Button 
                  onClick={() => createTestUser({ type: 'active_trial' })}
                  className="w-full"
                >
                  Create Trial User
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      {/* Test Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Created Test Users</CardTitle>
        </CardHeader>
        <CardContent>
          <TestUsersList users={testUsers} />
        </CardContent>
      </Card>
    </div>
  );
}
```

## 🎛️ Admin Navigation Integration

### Conditional Admin Menu

#### **File: `app/components/layout/sidebar.jsx`**
```jsx
export function Sidebar() {
  const { isAdmin } = useAdmin();
  
  return (
    <div className="w-64 bg-white shadow-lg">
      {/* Regular navigation items */}
      <nav className="mt-8 space-y-2">
        <SidebarItem href="/" icon={Home} label="Dashboard" />
        <SidebarItem href="/campaigns" icon={Target} label="Campaigns" />
        <SidebarItem href="/profile" icon={User} label="Profile" />
        
        {/* Admin-only navigation */}
        {isAdmin && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase">
                  Admin Tools
                </span>
              </div>
              
              <SidebarItem 
                href="/admin/system-config" 
                icon={Settings} 
                label="System Config"
                badge="Admin"
              />
              
              <SidebarItem 
                href="/admin/users" 
                icon={Users} 
                label="User Management"
                badge="Admin"
              />
              
              <SidebarItem 
                href="/admin/email-testing" 
                icon={Mail} 
                label="Email Testing"
                badge="Admin"
              />
              
              <SidebarItem 
                href="/admin/test-users" 
                icon={UserPlus} 
                label="Test Users"
                badge="Admin"
              />
            </div>
          </>
        )}
      </nav>
    </div>
  );
}
```

## 📊 Database Schema Extensions

### Admin-Related Tables

#### **User Profiles with Admin Flag**
```sql
-- Enhanced user profiles table with admin capabilities
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,           -- Database-based admin role
  onboarding_step VARCHAR(50) DEFAULT 'pending',
  trial_started_at TIMESTAMP,
  trial_expires_at TIMESTAMP,
  trial_status VARCHAR(20) DEFAULT 'inactive',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin actions audit log
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  action_type VARCHAR(50) NOT NULL,        -- 'config_update', 'user_promotion', 'email_sent'
  target_user_id TEXT,
  details JSONB,                           -- Action-specific details
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔍 Logging & Monitoring

### Comprehensive Admin Logging
```typescript
// Admin action logging
const logAdminAction = async (adminUserId: string, actionType: string, details: any) => {
  try {
    await db.insert(adminActions).values({
      adminUserId,
      actionType,
      targetUserId: details.targetUserId || null,
      details: details,
      createdAt: new Date()
    });
    
    console.log(`[ADMIN-AUDIT] ${actionType} by ${adminUserId}:`, details);
  } catch (error) {
    console.error('[ADMIN-AUDIT] Failed to log admin action:', error);
  }
};

// Usage examples
await logAdminAction(adminUserId, 'config_update', {
  category: 'api_limits',
  key: 'max_api_calls_tiktok',
  oldValue: '1',
  newValue: '999'
});

await logAdminAction(adminUserId, 'user_promotion', {
  targetUserId: userId,
  targetEmail: userEmail,
  action: 'promoted_to_admin'
});

await logAdminAction(adminUserId, 'email_sent', {
  targetUserId: userId,
  emailType: 'trial_expiry',
  delay: '1h',
  messageId: qstashMessageId
});
```

### Performance Monitoring
```typescript
// Admin dashboard metrics
const getAdminMetrics = async () => {
  const metrics = {
    totalUsers: await db.select().from(userProfiles).count(),
    adminUsers: await db.select().from(userProfiles)
      .where(eq(userProfiles.isAdmin, true)).count(),
    activeTrials: await db.select().from(userProfiles)
      .where(eq(userProfiles.trialStatus, 'active')).count(),
    recentActions: await db.select().from(adminActions)
      .orderBy(desc(adminActions.createdAt))
      .limit(10)
  };
  
  return metrics;
};
```

---

**Impact**: The admin system provides comprehensive platform management with dual authentication, real-time configuration management, advanced user administration, sophisticated email testing capabilities, and extensive logging for audit trails and monitoring.