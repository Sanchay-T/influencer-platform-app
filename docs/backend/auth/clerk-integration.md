# 🔐 Clerk Integration - Complete Setup & Implementation

## Overview
Complete Clerk authentication integration including setup, configuration, hooks usage, API route authentication, middleware protection, and comprehensive logging system.

## 🏗️ Clerk Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLERK INTEGRATION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Access Request                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Next.js       │                                           │
│  │   Middleware    │                                           │
│  │                 │                                           │
│  │  middleware.ts  │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │     Route       │    │   Clerk Auth    │                    │
│  │   Matching      │────│   Verification  │                    │
│  │                 │    │                 │                    │
│  │  Public Routes  │    │  JWT Validation │                    │
│  │  Admin Routes   │    │  Session Check  │                    │
│  │  Webhook Routes │    │  User Claims    │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                        │                             │
│         ▼                        ▼                             │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Frontend      │    │   Backend API   │                    │
│  │   Components    │    │    Routes       │                    │
│  │                 │    │                 │                    │
│  │  useAuth()      │    │  auth() call    │                    │
│  │  useUser()      │    │  User access    │                    │
│  │  AuthLogger     │    │  Admin check    │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Clerk Provider Setup

### File: `app/layout.tsx`

**Complete Application Wrapper**:
```typescript
import { ClerkProvider } from '@clerk/nextjs';
import { AuthLogger } from './components/auth/auth-logger';
import { NavigationLogger } from './components/navigation/navigation-logger';

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <html lang="en">
        <body>
          <AuthLogger />        {/* Global auth event logging */}
          <NavigationLogger />  {/* Navigation event logging */}
          {children}
          <ToastProvider />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Key Features**:
- ✅ **Global ClerkProvider**: Wraps entire application
- ✅ **Environment Integration**: Uses publishable key from env vars
- ✅ **Global Logging**: AuthLogger and NavigationLogger for complete tracking
- ✅ **TypeScript Support**: Full type safety with Clerk hooks

## 🎣 Clerk Hooks Usage Patterns

### Frontend Authentication Hooks

#### 1. **useAuth Hook** - Session & Authentication State
```typescript
import { useAuth } from '@clerk/nextjs';

export function useAuthenticationState() {
  const { 
    isLoaded,          // Whether Clerk has loaded
    isSignedIn,        // Boolean: user signed in status
    userId,            // Clerk user ID (string | null)
    sessionId,         // Current session ID
    signOut            // Sign out function
  } = useAuth();

  return {
    isLoaded,
    isSignedIn,
    userId,
    sessionId,
    signOut,
    // Derived states
    isAuthenticated: isLoaded && isSignedIn && !!userId,
    isUnauthenticated: isLoaded && !isSignedIn
  };
}
```

#### 2. **useUser Hook** - User Profile & Details
```typescript
import { useUser } from '@clerk/nextjs';

export function useUserProfile() {
  const { 
    user,              // Complete user object
    isLoaded,          // User data loaded status
    isSignedIn         // User signed in status
  } = useUser();

  return {
    user,
    isLoaded,
    isSignedIn,
    // User profile data
    userId: user?.id,
    email: user?.primaryEmailAddress?.emailAddress,
    firstName: user?.firstName,
    lastName: user?.lastName,
    fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    profileImageUrl: user?.profileImageUrl,
    emailVerified: user?.primaryEmailAddress?.verification?.status === 'verified',
    phoneNumber: user?.primaryPhoneNumber?.phoneNumber,
    // Timestamps
    accountCreatedAt: user?.createdAt,
    lastSignInAt: user?.lastSignInAt,
    // Metadata
    publicMetadata: user?.publicMetadata,
    privateMetadata: user?.privateMetadata
  };
}
```

### Custom Admin Hook Integration

#### File: `lib/hooks/use-admin.ts`

**Frontend Admin Status Checking**:
```typescript
import { useUser } from '@clerk/nextjs';

export function useAdmin() {
  const { user, isLoaded } = useUser();
  
  // Get admin emails from environment
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
    ?.split(',')
    .map(email => email.trim()) || [];
  
  const userEmail = user?.primaryEmailAddress?.emailAddress || '';
  const isAdmin = adminEmails.includes(userEmail);

  return {
    isAdmin,                // Boolean: user is admin
    isLoaded,              // Clerk data loaded
    user,                  // Full user object
    userEmail,             // User's primary email
    adminEmails,           // List of admin emails
    // Derived states
    isAdminUser: isLoaded && isAdmin,
    canAccessAdmin: isLoaded && isAdmin && !!user
  };
}
```

**Usage in Components**:
```typescript
import { useAdmin } from '@/lib/hooks/use-admin';

export function AdminOnlyComponent() {
  const { isAdmin, isLoaded, userEmail } = useAdmin();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isAdmin) return <div>Access denied</div>;

  return (
    <div>
      <h2>Admin Panel</h2>
      <p>Welcome, admin: {userEmail}</p>
    </div>
  );
}
```

## 🛡️ Backend Authentication Patterns

### 1. **API Route Authentication** - Standard Pattern

#### File: `app/api/profile/route.ts`

**Complete Auth-Protected API Route**:
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    console.log('🔐 [PROFILE-API-GET] Getting authenticated user from Clerk');
    
    // Step 1: Get authenticated user from Clerk
    const { userId } = await auth();

    // Step 2: Validate authentication
    if (!userId) {
      console.error('❌ [PROFILE-API-GET] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ [PROFILE-API-GET] User authenticated', { userId });

    // Step 3: Database operations with authenticated user
    const userProfile = await db.query.userProfiles.findFirst({
      where: (userProfiles, { eq }) => eq(userProfiles.userId, userId),
    });

    if (!userProfile) {
      console.log('ℹ️ [PROFILE-API-GET] No profile found for user');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Step 4: Return user-scoped data
    return NextResponse.json(userProfile);
    
  } catch (error: any) {
    console.error('💥 [PROFILE-API-GET] Error fetching profile:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
```

**Authentication Flow**:
1. **Clerk Auth Call**: `await auth()` gets current user
2. **User ID Validation**: Check if `userId` exists
3. **Error Response**: Return 401 if unauthorized
4. **Database Scoping**: Use `userId` for data access
5. **Logging**: Comprehensive auth event logging

### 2. **Advanced Backend Admin Utils**

#### File: `lib/auth/admin-utils.ts`

**Multi-Layer Admin Verification**:
```typescript
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * Unified admin authentication function
 * Checks both environment variable and database admin status
 */
export async function isAdminUser(): Promise<boolean> {
  try {
    console.log('🔍 [ADMIN-CHECK] Starting admin authentication check');
    
    // Step 1: Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      console.log('❌ [ADMIN-CHECK] No user ID found');
      return false;
    }

    // Step 2: Get user email from Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userEmail = user.primaryEmailAddress?.emailAddress;
    
    if (!userEmail) {
      console.log('❌ [ADMIN-CHECK] No email found for user');
      return false;
    }

    // Step 3: Check environment variable (primary method)
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
    const isEnvAdmin = adminEmails.includes(userEmail);
    
    if (isEnvAdmin) {
      console.log('✅ [ADMIN-CHECK] User is admin via environment variable:', userEmail);
      return true;
    }

    // Step 4: Check database admin status (future feature)
    try {
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
        columns: { isAdmin: true }
      });

      if (userProfile?.isAdmin) {
        console.log('✅ [ADMIN-CHECK] User is admin via database:', userEmail);
        return true;
      }
    } catch (dbError) {
      console.warn('⚠️ [ADMIN-CHECK] Database admin check failed (field may not exist yet)');
    }

    console.log('❌ [ADMIN-CHECK] User is not admin:', userEmail);
    return false;

  } catch (error) {
    console.error('❌ [ADMIN-CHECK] Error checking admin status:', error);
    return false;
  }
}
```

**Admin-Protected API Route Example**:
```typescript
import { isAdminUser } from '@/lib/auth/admin-utils';

export async function POST(request: Request) {
  try {
    // Check admin status
    const isAdmin = await isAdminUser();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Admin-only operations
    const result = await performAdminOperation();
    return NextResponse.json({ success: true, data: result });
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## 🛡️ Middleware Route Protection

### File: `middleware.ts`

**Complete Route Protection System**:
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Route Matchers for Different Protection Levels
const isPublicRoute = createRouteMatcher([
  '/',                    // Landing page
  '/sign-in(.*)',        // Sign-in pages
  '/sign-up(.*)',        // Sign-up pages
  '/sso-callback(.*)',   // SSO callbacks
]);

const isWebhookRoute = createRouteMatcher([
  '/api/qstash/(.*)',           // QStash webhooks
  '/api/scraping/(.*)',         // Search API endpoints
  '/api/proxy/(.*)',            // Image proxy
  '/api/export/(.*)',           // CSV exports
  '/api/email/send-scheduled',  // Scheduled emails
]);

const isProtectedApiRoute = createRouteMatcher([
  '/api/campaigns(.*)',         // Campaign APIs
  '/api/admin(.*)',            // Admin APIs
]);

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',                // Admin UI routes
  '/api/admin(.*)',           // Admin API routes
]);

export default clerkMiddleware(async (auth, request) => {
  // 1. Handle Webhook Routes (No Auth Required)
  if (isWebhookRoute(request)) {
    const response = NextResponse.next();
    
    // CORS headers for webhook endpoints
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', '*');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
    
    return response;
  }

  // 2. Protected API Routes (Handle Auth Internally)
  if (isProtectedApiRoute(request)) {
    return NextResponse.next();
  }

  // 3. Authentication Check for Non-Public Routes
  if (!isPublicRoute(request)) {
    const { userId, sessionClaims } = await auth();
    
    // Redirect unauthenticated users to sign-in
    if (!userId) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('redirect_url', request.url);
      return NextResponse.redirect(signInUrl);
    }

    // 4. Admin Route Protection
    if (isAdminRoute(request)) {
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
        ?.split(',')
        .map(e => e.trim()) || [];
      const userEmail = sessionClaims?.email as string | undefined;
      
      if (!userEmail || !adminEmails.includes(userEmail)) {
        // UI routes: redirect to home
        if (!request.url.includes('/api/')) {
          return NextResponse.redirect(new URL('/', request.url));
        }
        
        // API routes: return 403
        return NextResponse.json(
          { error: 'Forbidden: Admin access required' },
          { status: 403 }
        );
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

**Route Protection Levels**:
- 🟢 **Public**: Landing page, auth pages, webhooks
- 🟡 **Auth Required**: User dashboard, campaigns, profile
- 🔴 **Admin Only**: Admin panel, admin APIs
- 🔵 **Special Handling**: QStash webhooks, image proxy

## 📊 Comprehensive Authentication Logging

### File: `app/components/auth/auth-logger.tsx`

**Complete Auth Event Tracking**:
```typescript
'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { logAuth, logUserAction, logError } from '@/lib/utils/frontend-logger';

export function AuthLogger() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { user, isLoaded: userIsLoaded } = useUser();

  // Authentication State Changes
  useEffect(() => {
    if (isLoaded) {
      logAuth('session_check', {
        userId: userId || 'ANONYMOUS',
        userEmail: user?.primaryEmailAddress?.emailAddress || 'NO_EMAIL',
        isLoaded,
        isSignedIn,
        sessionId,
        userIsLoaded,
        hasUserData: !!user
      });

      if (isSignedIn && userId) {
        logUserAction('authentication_success', {
          authMethod: 'clerk',
          userId,
          userEmail: user?.primaryEmailAddress?.emailAddress,
          firstName: user?.firstName,
          lastName: user?.lastName,
          hasProfileImage: !!user?.profileImageUrl,
          accountCreatedAt: user?.createdAt,
          lastSignInAt: user?.lastSignInAt
        }, {
          userId,
          userEmail: user?.primaryEmailAddress?.emailAddress
        });
      } else if (isLoaded && !isSignedIn) {
        logUserAction('authentication_required', {
          currentPath: window.location.pathname,
          reason: 'user_not_signed_in'
        });
      }
    }
  }, [isLoaded, isSignedIn, userId, sessionId, user, userIsLoaded]);

  // User Data Loading
  useEffect(() => {
    if (userIsLoaded && user && isSignedIn) {
      logAuth('user_loaded', {
        userId: user.id,
        userEmail: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        profileImageUrl: user.profileImageUrl,
        emailVerified: user.primaryEmailAddress?.verification?.status === 'verified',
        phoneNumber: user.primaryPhoneNumber?.phoneNumber || 'None',
        accountCreatedAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        publicMetadata: user.publicMetadata,
        privateMetadata: Object.keys(user.privateMetadata || {}).length > 0 ? 'HAS_DATA' : 'EMPTY'
      });
    }
  }, [userIsLoaded, user, isSignedIn]);

  // Error Logging for Protected Routes
  useEffect(() => {
    if (isLoaded && !isSignedIn && window.location.pathname.includes('/onboarding')) {
      logError('authentication_required_for_onboarding', 
        new Error('User must be signed in to access onboarding'), {
        currentPath: window.location.pathname,
        requiredAuth: true,
        redirectNeeded: true
      });
    }
  }, [isLoaded, isSignedIn]);

  return null; // No UI rendering
}
```

### Authentication Hook for Components

**Custom Logging Hook**:
```typescript
export function useAuthLogging() {
  const auth = useAuth();
  const { user } = useUser();

  const logAuthEvent = (event: string, additionalData?: any) => {
    logAuth(event as any, {
      userId: auth.userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      isLoaded: auth.isLoaded,
      isSignedIn: auth.isSignedIn,
      sessionId: auth.sessionId,
      ...additionalData
    });
  };

  const logUserEvent = (action: string, data: any) => {
    logUserAction(action, data, {
      userId: auth.userId,
      userEmail: user?.primaryEmailAddress?.emailAddress
    });
  };

  return {
    logAuthEvent,
    logUserEvent,
    auth,
    user
  };
}
```

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"    # Public key for frontend
CLERK_SECRET_KEY="sk_test_xxx"                     # Secret key for backend

# Admin System
NEXT_PUBLIC_ADMIN_EMAILS="admin1@company.com,admin2@company.com"

# Site URL (for redirects)
NEXT_PUBLIC_SITE_URL="https://your-app.vercel.app"
```

### Clerk Dashboard Configuration

**Required Settings**:
1. **Sign-in Options**: Email + Password
2. **Social Providers**: (Optional) Google, GitHub
3. **Session Settings**: JWT templates configured
4. **Redirect URLs**: 
   - Sign-in: `/dashboard`
   - Sign-up: `/onboarding`
   - Sign-out: `/`

## 🎯 Authentication Flows

### 1. **Sign-up Flow**
```
User Registration → Email Verification → Profile Creation → Onboarding → Trial Start
      ↓                    ↓                    ↓              ↓            ↓
  Clerk Account      Email Verified     Database Profile   Complete    Start Trial
     Created           Status            Created         Onboarding     & Emails
```

### 2. **Sign-in Flow**
```
User Sign-in → Clerk JWT → Middleware Check → Route Access
      ↓             ↓            ↓              ↓
  Session        Token         Route          Dashboard
  Created       Validated     Protected       Access
```

### 3. **Admin Access Flow**
```
Admin Sign-in → Email Check → Admin Verification → Admin Route Access
      ↓            ↓              ↓                     ↓
  Regular       Environment    Database Check      Admin Panel
  Sign-in       Variable       (Future)            Features
```

## 🛡️ Security Features

### 1. **JWT Token Management**
- **Automatic Refresh**: Clerk handles token renewal
- **Secure Storage**: HttpOnly cookies for session data
- **Token Validation**: Server-side verification on every request

### 2. **Session Security**
- **CSRF Protection**: Built-in CSRF token handling
- **Secure Cookies**: SameSite and Secure flags set
- **Session Timeout**: Configurable session expiration

### 3. **Route Protection**
- **Middleware Security**: Pre-route authentication checks
- **API Security**: Per-endpoint auth verification
- **Admin Security**: Multi-layer admin verification

## 🔍 Debugging & Monitoring

### Console Log Patterns

#### **Successful Authentication**:
```
🔐 [PROFILE-API-GET] Getting authenticated user from Clerk
✅ [PROFILE-API-GET] User authenticated { userId: "user_2..." }
🔍 [ADMIN-CHECK] Starting admin authentication check
✅ [ADMIN-CHECK] User is admin via environment variable: admin@company.com
```

#### **Authentication Failure**:
```
❌ [PROFILE-API-GET] Unauthorized - No valid user session
❌ [ADMIN-CHECK] No user ID found
⚠️ [ADMIN-CHECK] Database admin check failed (field may not exist yet)
```

#### **Frontend Auth Events**:
```
🔐 [AUTH-LOG] session_check: { userId: "user_2...", isSignedIn: true }
✅ [USER-ACTION] authentication_success: { authMethod: "clerk", userEmail: "user@example.com" }
📋 [AUTH-LOG] user_loaded: { fullName: "John Doe", emailVerified: true }
```

## 🎯 Best Practices

### 1. **Error Handling**
```typescript
try {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... operation
} catch (error) {
  console.error('[API-ERROR]', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### 2. **Loading States**
```typescript
const { isLoaded, isSignedIn, userId } = useAuth();

if (!isLoaded) return <div>Loading...</div>;
if (!isSignedIn) return <SignInButton />;
// ... authenticated content
```

### 3. **Conditional Rendering**
```typescript
const { isAdmin } = useAdmin();

return (
  <div>
    <UserContent />
    {isAdmin && <AdminContent />}
  </div>
);
```

---

**Next**: Continue with [Admin System](./admin-system.md) for detailed admin verification and permissions management.