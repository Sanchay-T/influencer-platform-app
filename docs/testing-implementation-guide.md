# Complete Testing Implementation Guide for usegemz Platform

## Table of Contents
1. [Test User Pools](#1-test-user-pools)
2. [Database Seeding](#2-database-seeding)
3. [Development Tools](#3-development-tools)
4. [Feature Flags](#4-feature-flags)
5. [Time Manipulation](#5-time-manipulation)
6. [Automated Testing](#6-automated-testing)
7. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Test User Pools

### What It Is
Test user pools are pre-created accounts in various states that developers can reuse without creating new accounts each time.

### How It Works
Email providers support "plus addressing" - anything after `+` in an email is ignored for delivery but treated as unique by applications.

### Implementation for usegemz

#### Step 1: Create Test User Configuration
```typescript
// lib/testing/test-users.config.ts
export const TEST_USER_POOL = {
  // Fresh users - never logged in
  fresh: {
    email: 'test+fresh@usegemz.io',
    password: 'TestPassword123!',
    state: 'brand_new'
  },
  
  // Onboarding states
  onboarding: {
    step1: {
      email: 'test+onboarding1@usegemz.io',
      password: 'TestPassword123!',
      state: 'completed_personal_info',
      data: {
        fullName: 'Test User Step 1',
        businessName: 'Test Company 1',
        onboardingStep: 'step-1'
      }
    },
    step2: {
      email: 'test+onboarding2@usegemz.io',
      password: 'TestPassword123!',
      state: 'completed_business_info',
      data: {
        fullName: 'Test User Step 2',
        businessName: 'Test Company 2',
        industry: 'Fashion',
        targetAudience: '18-24 demographic',
        onboardingStep: 'step-2'
      }
    }
  },
  
  // Trial states
  trial: {
    active: {
      email: 'test+trial_active@usegemz.io',
      password: 'TestPassword123!',
      state: 'active_trial_day_3',
      data: {
        trialStartedAt: '{{NOW-3_DAYS}}',
        trialExpiresAt: '{{NOW+4_DAYS}}',
        trialStatus: 'active'
      }
    },
    expiring: {
      email: 'test+trial_expiring@usegemz.io',
      password: 'TestPassword123!',
      state: 'trial_last_day',
      data: {
        trialStartedAt: '{{NOW-6_DAYS}}',
        trialExpiresAt: '{{NOW+1_DAY}}',
        trialStatus: 'active'
      }
    },
    expired: {
      email: 'test+trial_expired@usegemz.io',
      password: 'TestPassword123!',
      state: 'trial_expired',
      data: {
        trialStartedAt: '{{NOW-10_DAYS}}',
        trialExpiresAt: '{{NOW-3_DAYS}}',
        trialStatus: 'expired'
      }
    }
  },
  
  // Subscription states
  subscription: {
    basic: {
      email: 'test+sub_basic@usegemz.io',
      password: 'TestPassword123!',
      state: 'basic_plan_active',
      clerkPlan: 'basic'
    },
    premium: {
      email: 'test+sub_premium@usegemz.io',
      password: 'TestPassword123!',
      state: 'premium_plan_active',
      clerkPlan: 'premium'
    }
  },
  
  // Edge cases
  edgeCases: {
    searchLimitReached: {
      email: 'test+search_limit@usegemz.io',
      password: 'TestPassword123!',
      state: 'trial_search_limit_reached',
      data: {
        searchesUsed: 3,
        searchesLimit: 3
      }
    }
  }
};

// Helper to get credentials
export function getTestUser(category: string, subcategory?: string) {
  if (subcategory) {
    return TEST_USER_POOL[category]?.[subcategory];
  }
  return TEST_USER_POOL[category];
}
```

#### Step 2: Create Test User Management UI (Dev Only)
```tsx
// app/dev/test-users/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { TEST_USER_POOL } from '@/lib/testing/test-users.config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function TestUsersPage() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return <div>Not available in production</div>;
  }

  const [loading, setLoading] = useState<string | null>(null);

  const loginAsTestUser = async (email: string, password: string) => {
    setLoading(email);
    try {
      // Auto-login logic here
      await fetch('/api/dev/auto-login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to login:', error);
    } finally {
      setLoading(null);
    }
  };

  const resetTestUser = async (email: string) => {
    setLoading(email);
    try {
      await fetch('/api/dev/reset-test-user', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      alert('User reset successfully!');
    } catch (error) {
      console.error('Failed to reset:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Test User Management</h1>
      
      {Object.entries(TEST_USER_POOL).map(([category, users]) => (
        <div key={category} className="mb-8">
          <h2 className="text-xl font-semibold mb-4 capitalize">
            {category.replace(/([A-Z])/g, ' $1').trim()}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(users).map(([key, user]) => (
              <Card key={key} className="p-4">
                <h3 className="font-medium mb-2">{user.state}</h3>
                <p className="text-sm text-gray-600 mb-4">{user.email}</p>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => loginAsTestUser(user.email, user.password)}
                    disabled={loading === user.email}
                  >
                    Login
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetTestUser(user.email)}
                    disabled={loading === user.email}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigator.clipboard.writeText(user.email)}
                  >
                    Copy Email
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 2. Database Seeding

### What It Is
Pre-populating your database with test data in various states for consistent testing environments.

### How It Works
Seed scripts create reproducible test data that can be reset and recreated on demand.

### Implementation for usegemz

#### Step 1: Create Seed Data Structure
```typescript
// scripts/seed/seed-data.ts
export const SEED_DATA = {
  users: [
    {
      clerkId: 'test_user_1',
      profile: {
        fullName: 'Sarah Test',
        businessName: 'Fashion Forward',
        industry: 'Fashion & Beauty',
        targetAudience: 'Young adults 18-35 interested in sustainable fashion',
        campaignGoals: 'Brand awareness and engagement',
        onboardingStep: 'completed',
        trialStartedAt: new Date('2024-01-10'),
        trialExpiresAt: new Date('2024-01-17'),
        trialStatus: 'active'
      },
      campaigns: [
        {
          name: 'Spring Collection Launch',
          description: 'Find eco-conscious fashion influencers',
          searchType: 'keyword',
          status: 'active'
        }
      ],
      searchHistory: [
        {
          platform: 'TikTok',
          keywords: ['sustainable fashion', 'eco friendly'],
          resultsCount: 45,
          createdAt: new Date('2024-01-11')
        }
      ]
    },
    {
      clerkId: 'test_user_2',
      profile: {
        fullName: 'Mike Demo',
        businessName: 'FitLife Supplements',
        industry: 'Health & Fitness',
        onboardingStep: 'step-2',
        trialStatus: 'inactive'
      },
      campaigns: []
    }
  ],
  
  // Pre-created search results for instant testing
  mockSearchResults: {
    tiktok_fashion: [
      {
        creator: {
          name: 'EcoStyleGuru',
          followers: 125000,
          bio: 'Sustainable fashion advocate 🌿 Contact: eco@style.com',
          emails: ['eco@style.com']
        },
        video: {
          description: 'Thrift haul! Making sustainable fashion trendy',
          views: 45000,
          likes: 3200
        }
      }
      // ... more mock creators
    ]
  }
};
```

#### Step 2: Create Seed Script
```typescript
// scripts/seed/seed-database.ts
import { db } from '@/lib/db';
import { userProfiles, campaigns, scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { SEED_DATA } from './seed-data';
import { clerkClient } from '@clerk/nextjs/server';

async function seedDatabase() {
  console.log('🌱 Starting database seed...');
  
  try {
    // Clear existing test data
    await db.delete(userProfiles).where(
      sql`email LIKE 'test+%@usegemz.io'`
    );
    
    // Seed each user
    for (const userData of SEED_DATA.users) {
      // Create or get Clerk user
      let clerkUser;
      try {
        clerkUser = await clerkClient.users.getUser(userData.clerkId);
      } catch {
        // Create if doesn't exist
        clerkUser = await clerkClient.users.createUser({
          emailAddress: [`test+${userData.clerkId}@usegemz.io`],
          password: 'TestPassword123!'
        });
      }
      
      // Insert profile
      await db.insert(userProfiles).values({
        userId: clerkUser.id,
        ...userData.profile
      });
      
      // Insert campaigns
      for (const campaign of userData.campaigns) {
        const [campaignResult] = await db.insert(campaigns).values({
          userId: clerkUser.id,
          ...campaign
        }).returning();
        
        // Create mock scraping job with results
        if (campaign.status === 'active') {
          const [job] = await db.insert(scrapingJobs).values({
            userId: clerkUser.id,
            campaignId: campaignResult.id,
            platform: 'TikTok',
            keywords: ['sustainable', 'fashion'],
            status: 'completed',
            processedResults: 45,
            targetResults: 100,
            progress: 100
          }).returning();
          
          // Insert mock results
          await db.insert(scrapingResults).values({
            jobId: job.id,
            creators: SEED_DATA.mockSearchResults.tiktok_fashion
          });
        }
      }
    }
    
    console.log('✅ Database seeded successfully!');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

#### Step 3: Add Seed Commands
```json
// package.json
{
  "scripts": {
    "db:seed": "tsx scripts/seed/seed-database.ts",
    "db:seed:dev": "NODE_ENV=development npm run db:seed",
    "db:reset": "npm run db:drop && npm run db:push && npm run db:seed:dev"
  }
}
```

---

## 3. Development Tools

### What It Is
Special UI components and API endpoints that only appear in development mode for testing purposes.

### How It Works
Environment checks ensure these tools are never exposed in production.

### Implementation for usegemz

#### Step 1: Create Developer Toolbar
```tsx
// components/dev/dev-toolbar.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Settings, 
  Clock, 
  User, 
  Database,
  RotateCcw,
  FastForward,
  Bug
} from 'lucide-react';

export function DevToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  
  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  useEffect(() => {
    // Fetch current user state
    fetch('/api/profile')
      .then(res => res.json())
      .then(setUser);
  }, []);
  
  const actions = {
    resetOnboarding: async () => {
      await fetch('/api/dev/reset-onboarding', { method: 'POST' });
      window.location.reload();
    },
    
    skipToStep: async (step: string) => {
      await fetch('/api/dev/skip-to-step', {
        method: 'POST',
        body: JSON.stringify({ step })
      });
      window.location.href = `/onboarding/${step}`;
    },
    
    advanceTime: async (days: number) => {
      await fetch('/api/dev/advance-time', {
        method: 'POST',
        body: JSON.stringify({ days })
      });
      window.location.reload();
    },
    
    setSearchCount: async (count: number) => {
      await fetch('/api/dev/set-search-count', {
        method: 'POST',
        body: JSON.stringify({ count })
      });
      window.location.reload();
    },
    
    triggerEmail: async (emailType: string) => {
      await fetch('/api/dev/trigger-email', {
        method: 'POST',
        body: JSON.stringify({ emailType })
      });
      alert(`Email "${emailType}" triggered!`);
    }
  };
  
  return (
    <>
      {/* Floating Dev Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700"
      >
        <Bug className="h-5 w-5" />
      </button>
      
      {/* Dev Panel */}
      {isOpen && (
        <Card className="fixed bottom-20 right-4 z-50 w-96 max-h-[600px] overflow-y-auto shadow-2xl">
          <div className="p-4 border-b bg-purple-50">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Developer Tools
            </h3>
            {user && (
              <p className="text-sm text-gray-600 mt-1">
                User: {user.email}
              </p>
            )}
          </div>
          
          <div className="p-4 space-y-4">
            {/* Current State */}
            <div className="bg-gray-50 p-3 rounded text-sm">
              <p><strong>Onboarding:</strong> {user?.onboardingStep || 'N/A'}</p>
              <p><strong>Trial:</strong> {user?.trialStatus || 'N/A'}</p>
              <p><strong>Searches:</strong> {user?.searchesUsed || 0} / {user?.searchesLimit || 3}</p>
            </div>
            
            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Onboarding</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.resetOnboarding()}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.skipToStep('step-2')}
                >
                  Skip to Step 2
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Trial Testing</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.advanceTime(5)}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  +5 Days
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.advanceTime(8)}
                >
                  <FastForward className="h-3 w-3 mr-1" />
                  Expire Trial
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Search Limits</h4>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.setSearchCount(0)}
                >
                  Reset
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.setSearchCount(2)}
                >
                  Set to 2
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.setSearchCount(3)}
                >
                  Max Out
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Email Testing</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.triggerEmail('welcome')}
                >
                  Welcome Email
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.triggerEmail('trial_expiry')}
                >
                  Trial Expiry
                </Button>
              </div>
            </div>
            
            {/* Additional Tools */}
            <div className="pt-2 border-t">
              <Button 
                size="sm" 
                variant="ghost" 
                className="w-full"
                onClick={() => window.open('/dev/test-users', '_blank')}
              >
                <User className="h-3 w-3 mr-1" />
                Test User Manager
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="w-full"
                onClick={() => window.open('/api/dev/db-viewer', '_blank')}
              >
                <Database className="h-3 w-3 mr-1" />
                Database Viewer
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
```

#### Step 2: Add Dev Toolbar to Layout
```tsx
// app/components/layout/dashboard-layout.jsx
import { DevToolbar } from '@/components/dev/dev-toolbar';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50">
        <div className="p-8">
          {children}
        </div>
      </main>
      
      {/* Dev Tools - Only in development */}
      <DevToolbar />
    </div>
  );
}
```

---

## 4. Feature Flags

### What It Is
Toggles that control feature visibility and behavior, allowing A/B testing and gradual rollouts.

### How It Works
Flags are checked at runtime to determine which code path to execute.

### Implementation for usegemz

#### Step 1: Create Feature Flag System
```typescript
// lib/features/feature-flags.ts
export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  defaultValue: boolean;
  environments: {
    development: boolean;
    staging: boolean;
    production: boolean;
  };
  userOverrides?: Record<string, boolean>; // userId -> enabled
  rolloutPercentage?: number; // 0-100
}

export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  'onboarding-v2': {
    key: 'onboarding-v2',
    name: 'New Onboarding Flow',
    description: 'Simplified 2-step onboarding process',
    defaultValue: false,
    environments: {
      development: true,
      staging: true,
      production: false
    },
    rolloutPercentage: 10 // 10% of users
  },
  
  'ai-bio-extraction': {
    key: 'ai-bio-extraction',
    name: 'AI-Powered Bio Extraction',
    description: 'Use AI to extract more email addresses from bios',
    defaultValue: false,
    environments: {
      development: true,
      staging: false,
      production: false
    }
  },
  
  'instant-trial': {
    key: 'instant-trial',
    name: 'Instant Trial Activation',
    description: 'Skip payment method for trial',
    defaultValue: false,
    environments: {
      development: true,
      staging: false,
      production: false
    }
  }
};

class FeatureFlagService {
  private flags = FEATURE_FLAGS;
  private userOverrides: Map<string, Map<string, boolean>> = new Map();
  
  isEnabled(flagKey: string, userId?: string): boolean {
    const flag = this.flags[flagKey];
    if (!flag) return false;
    
    // Check user override first
    if (userId && this.userOverrides.has(flagKey)) {
      const overrides = this.userOverrides.get(flagKey)!;
      if (overrides.has(userId)) {
        return overrides.get(userId)!;
      }
    }
    
    // Check environment setting
    const env = process.env.NODE_ENV as 'development' | 'staging' | 'production';
    const envEnabled = flag.environments[env] ?? flag.defaultValue;
    
    if (!envEnabled) return false;
    
    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      // Simple hash-based rollout
      const hash = this.hashUserId(userId || 'anonymous');
      const userPercentage = hash % 100;
      return userPercentage < flag.rolloutPercentage;
    }
    
    return envEnabled;
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  // Admin methods
  setUserOverride(flagKey: string, userId: string, enabled: boolean) {
    if (!this.userOverrides.has(flagKey)) {
      this.userOverrides.set(flagKey, new Map());
    }
    this.userOverrides.get(flagKey)!.set(userId, enabled);
  }
  
  getAllFlags(): FeatureFlag[] {
    return Object.values(this.flags);
  }
}

export const featureFlags = new FeatureFlagService();
```

#### Step 2: Create Feature Flag Hook
```typescript
// lib/hooks/use-feature-flag.ts
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { featureFlags } from '@/lib/features/feature-flags';

export function useFeatureFlag(flagKey: string): boolean {
  const { userId } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  
  useEffect(() => {
    // Check flag status
    const enabled = featureFlags.isEnabled(flagKey, userId || undefined);
    setIsEnabled(enabled);
    
    // In development, listen for flag changes
    if (process.env.NODE_ENV === 'development') {
      const handleFlagChange = (event: CustomEvent) => {
        if (event.detail.flagKey === flagKey) {
          setIsEnabled(event.detail.enabled);
        }
      };
      
      window.addEventListener('featureFlagChanged', handleFlagChange as any);
      return () => {
        window.removeEventListener('featureFlagChanged', handleFlagChange as any);
      };
    }
  }, [flagKey, userId]);
  
  return isEnabled;
}

// Usage in components
export function OnboardingFlow() {
  const useNewFlow = useFeatureFlag('onboarding-v2');
  
  if (useNewFlow) {
    return <NewOnboardingFlow />;
  }
  
  return <ClassicOnboardingFlow />;
}
```

#### Step 3: Feature Flag Admin UI
```tsx
// app/admin/feature-flags/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FEATURE_FLAGS } from '@/lib/features/feature-flags';

export default function FeatureFlagsAdmin() {
  const [flags, setFlags] = useState(FEATURE_FLAGS);
  const [testUserId, setTestUserId] = useState('');
  
  const toggleFlag = async (flagKey: string, userId?: string) => {
    const response = await fetch('/api/admin/feature-flags', {
      method: 'POST',
      body: JSON.stringify({
        flagKey,
        userId,
        enabled: !flags[flagKey].defaultValue
      })
    });
    
    if (response.ok) {
      // Update local state
      setFlags(prev => ({
        ...prev,
        [flagKey]: {
          ...prev[flagKey],
          defaultValue: !prev[flagKey].defaultValue
        }
      }));
      
      // Trigger update in development
      if (process.env.NODE_ENV === 'development') {
        window.dispatchEvent(new CustomEvent('featureFlagChanged', {
          detail: { flagKey, enabled: !flags[flagKey].defaultValue }
        }));
      }
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Feature Flags Management</h1>
      
      <Card className="mb-6 p-4">
        <h2 className="font-semibold mb-3">Test Specific User</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter user ID or email"
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
          />
          <Button onClick={() => alert('User testing not implemented')}>
            Test Flags
          </Button>
        </div>
      </Card>
      
      <div className="space-y-4">
        {Object.values(flags).map(flag => (
          <Card key={flag.key} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{flag.name}</h3>
                  <Badge variant="outline" className="text-xs">
                    {flag.key}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {flag.description}
                </p>
                
                <div className="flex gap-4 text-sm">
                  <span className={`flex items-center gap-1 ${
                    flag.environments.development ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      flag.environments.development ? 'bg-green-600' : 'bg-gray-400'
                    }`} />
                    Dev
                  </span>
                  <span className={`flex items-center gap-1 ${
                    flag.environments.staging ? 'text-yellow-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      flag.environments.staging ? 'bg-yellow-600' : 'bg-gray-400'
                    }`} />
                    Staging
                  </span>
                  <span className={`flex items-center gap-1 ${
                    flag.environments.production ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      flag.environments.production ? 'bg-blue-600' : 'bg-gray-400'
                    }`} />
                    Prod
                  </span>
                </div>
                
                {flag.rolloutPercentage !== undefined && (
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">
                      Rollout: {flag.rolloutPercentage}%
                    </span>
                  </div>
                )}
              </div>
              
              <Switch
                checked={flag.defaultValue}
                onCheckedChange={() => toggleFlag(flag.key)}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 5. Time Manipulation

### What It Is
The ability to simulate time passing for testing time-dependent features like trial expiration.

### How It Works
Override system time or use adjustable date calculations in your application.

### Implementation for usegemz

#### Step 1: Create Time Service
```typescript
// lib/services/time-service.ts
class TimeService {
  private timeOffset: number = 0; // milliseconds
  private frozenTime: Date | null = null;
  
  // Get current time with offset applied
  now(): Date {
    if (this.frozenTime) {
      return new Date(this.frozenTime);
    }
    return new Date(Date.now() + this.timeOffset);
  }
  
  // Advance time by days
  advanceTime(days: number) {
    this.timeOffset += days * 24 * 60 * 60 * 1000;
  }
  
  // Go back in time
  rewindTime(days: number) {
    this.timeOffset -= days * 24 * 60 * 60 * 1000;
  }
  
  // Freeze time at specific date
  freezeAt(date: Date) {
    this.frozenTime = date;
  }
  
  // Unfreeze time
  unfreeze() {
    this.frozenTime = null;
  }
  
  // Reset to real time
  reset() {
    this.timeOffset = 0;
    this.frozenTime = null;
  }
  
  // Get offset in days
  getOffsetDays(): number {
    return Math.floor(this.timeOffset / (24 * 60 * 60 * 1000));
  }
  
  // Development-only methods
  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }
  
  // Save/load time state
  saveState() {
    if (this.isDevelopment()) {
      localStorage.setItem('dev_time_offset', this.timeOffset.toString());
      if (this.frozenTime) {
        localStorage.setItem('dev_time_frozen', this.frozenTime.toISOString());
      }
    }
  }
  
  loadState() {
    if (this.isDevelopment()) {
      const offset = localStorage.getItem('dev_time_offset');
      if (offset) {
        this.timeOffset = parseInt(offset);
      }
      
      const frozen = localStorage.getItem('dev_time_frozen');
      if (frozen) {
        this.frozenTime = new Date(frozen);
      }
    }
  }
}

export const timeService = new TimeService();

// Replace Date.now() in your code
export function getCurrentTime(): Date {
  return timeService.now();
}

// Use in trial calculations
export function calculateTrialExpiry(startDate: Date): Date {
  const expiry = new Date(startDate);
  expiry.setDate(expiry.getDate() + 7);
  
  // Apply time manipulation in development
  if (timeService.isDevelopment()) {
    const manipulatedExpiry = new Date(expiry.getTime() - timeService.getOffsetDays() * 24 * 60 * 60 * 1000);
    return manipulatedExpiry;
  }
  
  return expiry;
}

// Use in trial status checks
export function isTrialExpired(expiryDate: Date): boolean {
  const now = getCurrentTime();
  return now > expiryDate;
}
```

#### Step 2: Time Control UI Component
```tsx
// components/dev/time-control.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, FastForward, Rewind, RotateCcw } from 'lucide-react';
import { timeService, getCurrentTime } from '@/lib/services/time-service';

export function TimeControl() {
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [offsetDays, setOffsetDays] = useState(0);
  
  useEffect(() => {
    timeService.loadState();
    setOffsetDays(timeService.getOffsetDays());
    
    // Update time display every second
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleAdvanceTime = (days: number) => {
    timeService.advanceTime(days);
    timeService.saveState();
    setOffsetDays(timeService.getOffsetDays());
    
    // Trigger page reload to apply new time
    window.location.reload();
  };
  
  const handleReset = () => {
    timeService.reset();
    timeService.saveState();
    setOffsetDays(0);
    window.location.reload();
  };
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <Card className="fixed top-4 right-4 z-50 p-4 shadow-lg bg-yellow-50 border-yellow-300">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-yellow-700" />
        <h3 className="font-semibold text-yellow-900">Time Control</h3>
      </div>
      
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-600">Current Time: </span>
          <span className="font-mono">{currentTime.toLocaleString()}</span>
        </div>
        
        {offsetDays !== 0 && (
          <div className="text-yellow-700 font-medium">
            Time offset: {offsetDays > 0 ? '+' : ''}{offsetDays} days
          </div>
        )}
        
        <div className="flex gap-1 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAdvanceTime(-1)}
            className="text-xs"
          >
            <Rewind className="h-3 w-3" />
            -1d
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAdvanceTime(1)}
            className="text-xs"
          >
            +1d
            <FastForward className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAdvanceTime(7)}
            className="text-xs"
          >
            +7d
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

#### Step 3: Integrate Time Service in Trial Logic
```typescript
// lib/trial/trial-service.ts
import { getCurrentTime, isTrialExpired } from '@/lib/services/time-service';

export async function getTrialStatus(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId)
  });
  
  if (!profile || !profile.trialExpiresAt) {
    return { status: 'inactive', daysRemaining: 0 };
  }
  
  // Use time service for current time
  const now = getCurrentTime();
  const expiresAt = new Date(profile.trialExpiresAt);
  
  if (isTrialExpired(expiresAt)) {
    return { status: 'expired', daysRemaining: 0 };
  }
  
  const daysRemaining = Math.ceil(
    (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return { status: 'active', daysRemaining };
}
```

---

## 6. Automated Testing

### What It Is
Automated test suites that run your onboarding flows without manual interaction.

### How It Works
Use testing frameworks to simulate user interactions and verify expected outcomes.

### Implementation for usegemz

#### Step 1: E2E Tests with Playwright
```typescript
// tests/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';
import { resetTestUser, TEST_USERS } from './helpers/test-users';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Reset test user before each test
    await resetTestUser(TEST_USERS.onboarding.fresh);
    
    // Login as test user
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', TEST_USERS.onboarding.fresh.email);
    await page.fill('input[name="password"]', TEST_USERS.onboarding.fresh.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL('/onboarding/step-1');
  });
  
  test('completes full onboarding flow', async ({ page }) => {
    // Step 1: Personal Information
    await expect(page.locator('h1')).toContainText('Tell us about yourself');
    
    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[name="businessName"]', 'Test Company');
    await page.click('button:has-text("Continue")');
    
    // Should redirect to step 2
    await page.waitForURL('/onboarding/step-2');
    
    // Step 2: Business Details
    await expect(page.locator('h1')).toContainText('About your business');
    
    await page.selectOption('select[name="industry"]', 'Fashion & Beauty');
    await page.fill('textarea[name="targetAudience"]', 'Young adults 18-35');
    await page.fill('textarea[name="campaignGoals"]', 'Increase brand awareness');
    await page.click('button:has-text("Continue")');
    
    // Should redirect to completion
    await page.waitForURL('/onboarding/complete');
    
    // Complete page
    await expect(page.locator('h1')).toContainText("You're All Set!");
    await page.click('button:has-text("Start 7-Day Free Trial")');
    
    // Should redirect to profile
    await page.waitForURL('/profile');
    
    // Verify trial is active
    await expect(page.locator('text=Active Trial')).toBeVisible();
  });
  
  test('validates required fields', async ({ page }) => {
    // Try to submit without filling fields
    await page.click('button:has-text("Continue")');
    
    // Should show validation errors
    await expect(page.locator('text=Full name is required')).toBeVisible();
    await expect(page.locator('text=Business name is required')).toBeVisible();
  });
  
  test('preserves data on navigation', async ({ page }) => {
    // Fill step 1
    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[name="businessName"]', 'Test Company');
    await page.click('button:has-text("Continue")');
    
    // Go to step 2
    await page.waitForURL('/onboarding/step-2');
    
    // Go back
    await page.click('button:has-text("Back")');
    
    // Data should be preserved
    await expect(page.locator('input[name="fullName"]')).toHaveValue('Test User');
    await expect(page.locator('input[name="businessName"]')).toHaveValue('Test Company');
  });
});

test.describe('Trial Expiration', () => {
  test('shows upgrade prompt when trial expires', async ({ page }) => {
    // Use expired trial user
    await resetTestUser(TEST_USERS.trial.expired);
    await loginAs(page, TEST_USERS.trial.expired);
    
    // Should see trial expired message
    await expect(page.locator('text=Your trial has ended')).toBeVisible();
    await expect(page.locator('button:has-text("Upgrade Now")')).toBeVisible();
  });
  
  test('blocks search after limit reached', async ({ page }) => {
    // Use user at search limit
    await resetTestUser(TEST_USERS.edgeCases.searchLimitReached);
    await loginAs(page, TEST_USERS.edgeCases.searchLimitReached);
    
    // Try to search
    await page.goto('/campaigns/new');
    await page.click('button:has-text("Start Search")');
    
    // Should show limit reached message
    await expect(page.locator('text=Search limit reached')).toBeVisible();
  });
});
```

#### Step 2: API Integration Tests
```typescript
// tests/api/onboarding.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { createTestClient } from './helpers/test-client';
import { resetDatabase } from './helpers/db-helpers';

describe('Onboarding API', () => {
  let client: TestClient;
  let userId: string;
  
  beforeEach(async () => {
    await resetDatabase();
    const { client: testClient, userId: testUserId } = await createTestClient();
    client = testClient;
    userId = testUserId;
  });
  
  describe('POST /api/onboarding/step-1', () => {
    test('updates user profile with personal info', async () => {
      const response = await client.post('/api/onboarding/step-1', {
        fullName: 'Test User',
        businessName: 'Test Company'
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        onboardingStep: 'step-2'
      });
      
      // Verify database update
      const profile = await getProfile(userId);
      expect(profile.fullName).toBe('Test User');
      expect(profile.businessName).toBe('Test Company');
      expect(profile.onboardingStep).toBe('step-2');
    });
    
    test('schedules welcome email', async () => {
      await client.post('/api/onboarding/step-1', {
        fullName: 'Test User',
        businessName: 'Test Company'
      });
      
      // Check email queue
      const emails = await getScheduledEmails(userId);
      expect(emails).toContainEqual(
        expect.objectContaining({
          emailType: 'welcome',
          status: 'pending'
        })
      );
    });
  });
  
  describe('POST /api/onboarding/complete', () => {
    test('starts trial and schedules email sequence', async () => {
      // Complete onboarding first
      await completeOnboarding(client);
      
      const response = await client.patch('/api/onboarding/complete', {
        completed: true
      });
      
      expect(response.status).toBe(200);
      expect(response.data.trial).toMatchObject({
        status: 'active',
        daysRemaining: 7
      });
      
      // Check scheduled emails
      const emails = await getScheduledEmails(userId);
      const emailTypes = emails.map(e => e.emailType);
      
      expect(emailTypes).toContain('welcome');
      expect(emailTypes).toContain('trial_day2');
      expect(emailTypes).toContain('trial_day5');
      expect(emailTypes).toContain('trial_expiry');
    });
  });
});
```

#### Step 3: Visual Regression Tests
```typescript
// tests/visual/onboarding.visual.ts
import { test } from '@playwright/test';
import { argosScreenshot } from '@argos-ci/playwright';

test.describe('Onboarding Visual Tests', () => {
  test('step 1 - personal info', async ({ page }) => {
    await page.goto('/onboarding/step-1');
    await argosScreenshot(page, 'onboarding-step-1');
  });
  
  test('step 2 - business details', async ({ page }) => {
    await page.goto('/onboarding/step-2');
    await argosScreenshot(page, 'onboarding-step-2');
  });
  
  test('completion page', async ({ page }) => {
    await page.goto('/onboarding/complete');
    await argosScreenshot(page, 'onboarding-complete');
  });
  
  test('trial status card states', async ({ page }) => {
    // Active trial
    await setupUserState('trial_active');
    await page.goto('/profile');
    await argosScreenshot(page, 'trial-status-active');
    
    // Expiring soon
    await setupUserState('trial_expiring');
    await page.goto('/profile');
    await argosScreenshot(page, 'trial-status-expiring');
    
    // Expired
    await setupUserState('trial_expired');
    await page.goto('/profile');
    await argosScreenshot(page, 'trial-status-expired');
  });
});
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. ✅ Create reset script (already done)
2. Set up test user pool configuration
3. Create basic seed data
4. Add development environment checks

### Phase 2: Developer Tools (Week 2)
1. Build developer toolbar component
2. Create dev-only API endpoints
3. Add time manipulation service
4. Integrate with existing UI

### Phase 3: Testing Infrastructure (Week 3)
1. Set up Playwright for E2E tests
2. Create test helpers and utilities
3. Write core onboarding tests
4. Add CI/CD integration

### Phase 4: Advanced Features (Week 4)
1. Implement feature flag system
2. Create feature flag admin UI
3. Add A/B testing capabilities
4. Document all testing procedures

### Phase 5: Polish & Documentation (Week 5)
1. Create comprehensive testing guide
2. Add visual regression tests
3. Set up monitoring and analytics
4. Train team on new tools

## Best Practices Summary

1. **Always use test users** for development, never real accounts
2. **Automate everything** - resets, time travel, state changes
3. **Make it visible** - dev tools should be easily accessible
4. **Keep it safe** - never expose test tools in production
5. **Document well** - other developers need to know how to test
6. **Test early and often** - catch issues before they reach users

## Conclusion

This comprehensive testing setup will allow you to:
- Test any onboarding state instantly
- Verify time-dependent features easily
- A/B test new flows safely
- Maintain consistent test environments
- Reduce manual testing time by 90%

The key is to invest time upfront in building these tools - they'll pay dividends throughout the project lifecycle.