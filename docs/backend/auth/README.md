# 🔐 Authentication System

## Overview
The usegemz platform uses Clerk for complete authentication management with custom admin verification layers. This section covers all authentication aspects including setup, flows, security, and admin systems.

## 📁 Authentication Documentation Index

### 🔐 [Clerk Integration](./clerk-integration.md)
Complete Clerk authentication setup, configuration, and usage patterns throughout the application.

### 👑 [Admin System](./admin-system.md)  
Multi-layer admin verification system with environment variables and database-based permissions.

### 🛡️ [Middleware](./middleware.md)
Route protection, admin verification, and security middleware implementation.

## 🎯 Authentication Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend Request                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Next.js       │  Clerk Middleware                         │
│  │   Middleware    │  ┌─────────────────┐                      │
│  │                 │──│ Route Matcher   │                      │
│  │  middleware.ts  │  │ Public Routes   │                      │
│  └─────────────────┘  │ Admin Routes    │                      │
│         │              └─────────────────┘                      │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │ Authentication  │                                           │
│  │     Check       │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│    ┌────┴────┐                                                 │
│    ▼         ▼                                                 │
│ ┌─────┐  ┌──────────┐                                          │
│ │Public│  │Protected │                                         │
│ │Route │  │  Route   │                                         │
│ └─────┘  └──────────┘                                          │
│             │                                                  │
│             ▼                                                  │
│     ┌─────────────────┐                                        │
│     │   Admin Check   │                                        │
│     │  (if required)  │                                        │
│     └─────────────────┘                                        │
│             │                                                  │
│        ┌────┴────┐                                             │
│        ▼         ▼                                             │
│    ┌─────┐  ┌─────────┐                                        │
│    │User │  │  Admin  │                                        │
│    │Route│  │  Route  │                                        │
│    └─────┘  └─────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Quick Reference

### Core Components
- **Clerk Provider**: Authentication context and hooks
- **Middleware**: Route protection and admin verification
- **Admin Utils**: Backend admin verification functions
- **useAdmin Hook**: Frontend admin status checking

### Key Files
```
middleware.ts                           # Route protection
lib/auth/admin-utils.ts                # Backend admin verification
lib/hooks/use-admin.ts                 # Frontend admin hook
app/sign-in/[[...sign-in]]/page.tsx   # Sign-in page
app/sign-up/[[...sign-up]]/page.tsx   # Sign-up page
```

### Environment Variables
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"
CLERK_SECRET_KEY="sk_test_xxx"
NEXT_PUBLIC_ADMIN_EMAILS="admin1@company.com,admin2@company.com"
```

## 🎯 Authentication States

### User States
```typescript
type AuthState = 
  | 'unauthenticated'     // Not signed in
  | 'authenticated'       // Signed in, regular user
  | 'admin'              // Signed in, admin user
  | 'onboarding'         // Signed in, incomplete onboarding
```

### Route Protection Levels
```typescript
type RouteProtection = 
  | 'public'             // No authentication required
  | 'auth-required'      // Authentication required
  | 'admin-only'         // Admin verification required
  | 'webhook'            // Special handling for webhooks
```

## 🔄 Authentication Flows

### Sign-up Flow
```
User Registration → Email Verification → Profile Creation → Onboarding → Dashboard
                                                   ↓
                           Database User Profile Created (pending onboarding)
```

### Sign-in Flow
```
User Sign-in → Clerk Verification → User Profile Check → Route to Appropriate Page
                                           ↓
                        ┌─────────────────────┴─────────────────────┐
                        ▼                                           ▼
              Onboarding Required                           Dashboard Access
                (incomplete profile)                         (complete profile)
```

### Admin Flow
```
Admin Sign-in → Clerk Verification → Admin Email Check → Admin Route Access
                                           ↓
                        ┌─────────────────────┴─────────────────────┐
                        ▼                                           ▼
                Regular User Access                          Admin Panel Access
               (standard features)                          (admin features)
```

## 🛡️ Security Features

### Multi-layer Security
1. **Clerk Authentication** - JWT tokens and session management
2. **Route Middleware** - Server-side route protection
3. **Admin Verification** - Environment variable and database checks
4. **API Protection** - Endpoint-level authentication
5. **Webhook Security** - QStash signature verification

### Session Management
- **JWT Tokens** - Clerk-managed session tokens
- **Automatic Refresh** - Token refresh handling
- **Secure Storage** - HttpOnly cookies for session data
- **Logout Handling** - Complete session cleanup

---

**Next**: Start with [Clerk Integration](./clerk-integration.md) for detailed authentication setup and implementation patterns.