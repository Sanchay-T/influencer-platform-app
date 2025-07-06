# Clerk Authentication Migration Guide

**Migration Date:** July 6, 2025  
**Migration Type:** Complete Authentication System Replacement  
**From:** Supabase Auth → **To:** Clerk Auth  
**Status:** ✅ Core Migration Complete, 🔄 Some routes pending  

---

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [What Was Changed](#what-was-changed)
3. [Before vs After Comparison](#before-vs-after-comparison)
4. [File-by-File Changes](#file-by-file-changes)
5. [Database Schema Updates](#database-schema-updates)
6. [Environment Variables](#environment-variables)
7. [Testing Status](#testing-status)
8. [Remaining Work](#remaining-work)
9. [Troubleshooting](#troubleshooting)

---

## Migration Overview

### **Why We Migrated**
- **Separation of Concerns**: Use Supabase only for database hosting, Clerk for authentication
- **Better Developer Experience**: Clerk provides better Next.js integration
- **Professional Industry Standard**: Clerk is widely used in production applications
- **Simplified Architecture**: Single-purpose tools instead of monolithic solutions

### **Migration Strategy**
We followed a **complete replacement strategy** rather than gradual migration:
1. Remove all Supabase Auth code
2. Install and configure Clerk
3. Replace authentication logic throughout the application
4. Update database schema for Clerk compatibility
5. Test all authentication flows

---

## What Was Changed

### **🗑️ Deleted Components**
- **Supabase Utility Files**: `/utils/supabase/*` (client.ts, server.ts)
- **Auth Pages**: Entire `/app/auth/*` directory
- **Auth API Routes**: `/app/api/auth/*`, `/app/api/register/*`
- **Supabase Client Files**: `/app/lib/supabase.js`, `/app/lib/supabase-admin.ts`

### **⚙️ Added Components**
- **Clerk SDK**: `@clerk/nextjs` package
- **New Middleware**: Clerk-based middleware with proper route protection
- **Clerk Auth Pages**: Sign-in and sign-up using Clerk components
- **ClerkProvider**: App-wide authentication context

### **🔧 Updated Components**
- **All API Routes**: Replaced Supabase auth with Clerk auth
- **Frontend Components**: Updated to use Clerk hooks
- **Database Schema**: Modified to support Clerk user IDs
- **Layout**: Added ClerkProvider wrapper

---

## Before vs After Comparison

### **Authentication Flow - BEFORE (Supabase)**

```javascript
// Middleware
import { createClient } from '@supabase/ssr'
const supabase = createClient(url, key)
const { data: { user } } = await supabase.auth.getUser()

// API Routes
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) return 401

// Components
import { createClient } from '@/app/lib/supabase'
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()

// Pages
/app/auth/login/page.jsx
/app/auth/register/page.tsx
/app/auth/callback/route.ts
```

### **Authentication Flow - AFTER (Clerk)**

```javascript
// Middleware
import { clerkMiddleware } from '@clerk/nextjs/server'
export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
})

// API Routes
import { auth } from '@clerk/nextjs/server'
const { userId } = await auth()
if (!userId) return 401

// Components
import { useUser, useClerk } from '@clerk/nextjs'
const { user, isLoaded } = useUser()
const { signOut } = useClerk()

// Pages
/app/sign-in/[[...sign-in]]/page.tsx
/app/sign-up/[[...sign-up]]/page.tsx
```

---

## File-by-File Changes

### **📁 Core Infrastructure**

#### **middleware.ts** - ✅ COMPLETE
**Before:**
```typescript
import { createServerClient } from '@supabase/ssr'
// Complex auth logic with cookies and redirects
const supabase = createServerClient(url, key, { cookies: {...} })
const { data: { user } } = await supabase.auth.getUser()
```

**After:**
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    const { userId } = await auth()
    if (!userId) {
      const signInUrl = new URL('/sign-in', request.url)
      return NextResponse.redirect(signInUrl)
    }
  }
})
```

**Changes Made:**
- Replaced Supabase SSR client with Clerk middleware
- Simplified route protection logic
- Added special handling for QStash webhooks and API routes
- Improved error handling and redirects

#### **app/layout.tsx** - ✅ COMPLETE
**Before:**
```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
```

**After:**
```tsx
import { ClerkProvider } from '@clerk/nextjs'
export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
          <ToastProvider />
        </body>
      </html>
    </ClerkProvider>
  )
}
```

### **📁 Authentication Pages**

#### **Sign-In Page** - ✅ COMPLETE
**Location:** `/app/sign-in/[[...sign-in]]/page.tsx` (NEW)
```tsx
import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <SignIn 
          appearance={{ elements: { rootBox: "mx-auto", card: "shadow-xl border-0" }}}
          fallbackRedirectUrl="/"
        />
      </div>
    </div>
  );
}
```

#### **Sign-Up Page** - ✅ COMPLETE
**Location:** `/app/sign-up/[[...sign-up]]/page.tsx` (NEW)
```tsx
import { SignUp } from '@clerk/nextjs';
// Similar structure to SignIn but with SignUp component
```

### **📁 API Routes**

#### **Campaigns API** - ✅ COMPLETE
**File:** `/app/api/campaigns/route.ts`

**Before:**
```typescript
import { createClient } from '@/utils/supabase/server'
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) return 401
// Use user.id for database operations
```

**After:**
```typescript
import { auth } from '@clerk/nextjs/server'
const { userId } = await auth()
if (!userId) return 401
// Use userId for database operations
```

#### **TikTok Scraping API** - ✅ COMPLETE
**File:** `/app/api/scraping/tiktok/route.ts`

**Changes Made:**
- Replaced complex Supabase auth with simple Clerk auth
- Updated both POST and GET methods
- Added user verification to ensure users only access their own jobs
- Updated all `user.id` references to `userId`

#### **Instagram Hashtag API** - ✅ COMPLETE
**File:** `/app/api/scraping/instagram-hashtag/route.ts`

**Key Fix:**
- Fixed const assignment bug: Changed `const job` to `let job` to allow reassignment
- Added user verification to GET method
- Complete auth replacement

#### **YouTube API** - ✅ COMPLETE
**File:** `/app/api/scraping/youtube/route.ts`

**Changes Made:**
- Removed complex Supabase auth error handling
- Added auth protection to GET method
- Updated database queries to include user verification

#### **Export CSV API** - ✅ COMPLETE
**File:** `/app/api/export/csv/route.ts`

**Changes Made:**
- Simple auth replacement: `await auth()` instead of Supabase client
- Maintained same functionality with cleaner code

### **📁 Frontend Components**

#### **Sidebar Component** - ✅ COMPLETE
**File:** `/app/components/layout/sidebar.jsx`

**Before:**
```javascript
import { createClient } from '@/app/lib/supabase'
const supabase = createClient()
const handleLogout = async () => {
  await supabase.auth.signOut()
  window.location.href = '/auth/login'
}
```

**After:**
```javascript
import { useClerk, useUser } from '@clerk/nextjs'
const { signOut } = useClerk()
const { user } = useUser()
const handleLogout = async () => {
  await signOut()
  router.push('/sign-in')
}
```

**Enhancements:**
- Added user info display (email, name)
- Cleaner logout flow
- Better error handling

#### **Homepage** - ✅ COMPLETE
**File:** `/app/page.js`

**Added Clerk Components:**
```javascript
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs'

// Conditional rendering based on auth state
<SignedOut>
  <SignInButton mode="modal">
    <Button>Sign In</Button>
  </SignInButton>
</SignedOut>

<SignedIn>
  <DashboardLayout>
    {/* Protected content */}
  </DashboardLayout>
</SignedIn>
```

#### **Keyword Search Form** - ✅ COMPLETE
**File:** `/app/components/campaigns/keyword-search/keyword-search-form.jsx`

**Before:**
```javascript
import { createBrowserClient } from '@supabase/ssr'
const supabase = createBrowserClient(url, key)
const { data: { user } } = await supabase.auth.getUser()
if (!isAuthenticated) return null
```

**After:**
```javascript
import { useUser } from '@clerk/nextjs'
const { user, isLoaded } = useUser()
if (!isLoaded || !user) return null
```

---

## Database Schema Updates

### **User ID Field Changes**

**File:** `/lib/db/schema.ts`

#### **Before (Supabase UUID):**
```typescript
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(), // Supabase user IDs
  // ... other fields
});
```

#### **After (Clerk String):**
```typescript
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(), // Clerk user IDs are strings
  // ... other fields
});
```

### **Database Connection**

**File:** `/lib/db/index.ts`

**Before:**
```typescript
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(url, key);
```

**After:**
```typescript
// Removed Supabase client export
// Note: We only use Supabase for database hosting, auth is handled by Clerk
```

---

## Environment Variables

### **Required Clerk Variables**
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Optional Clerk Configuration
CLERK_WEBHOOK_SECRET=whsec_xxxxx  # For user sync webhooks
```

### **Maintained Supabase Variables** (Database Only)
```bash
# Database Connection (Supabase as database host)
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres"
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Note: NEXT_PUBLIC_SUPABASE_ANON_KEY no longer used for auth
```

---

## Testing Status

### **✅ Working Features**
- [x] **User Registration**: Sign-up with Clerk
- [x] **User Login**: Sign-in with Clerk  
- [x] **Protected Routes**: Middleware redirects work
- [x] **Dashboard Access**: Authenticated users can view dashboard
- [x] **Campaign Creation**: Users can create campaigns
- [x] **TikTok Keyword Search**: Working with image proxy
- [x] **Instagram Hashtag Search**: Working (15 results found, no profile pics by design)
- [x] **YouTube Keyword Search**: Fixed and working
- [x] **User Profile Display**: Sidebar shows user info
- [x] **Logout Flow**: Clean signout and redirect

### **🔄 Partially Working**
- [ ] **Instagram Profile Pictures**: Hashtag search doesn't include profile pics (API limitation)
- [ ] **CSV Export**: Core functionality works, user verification complete

### **❌ Pending Fixes**
- [ ] **YouTube Similar Search**: Still has Supabase auth code
- [ ] **TikTok Similar Search**: Still has Supabase auth code  
- [ ] **Instagram Similar Search**: Still has Supabase auth code
- [ ] **Individual Campaign Routes**: `/app/api/campaigns/[id]/route.ts`
- [ ] **QStash Processor**: Some routes still reference Supabase

---

## Remaining Work

### **High Priority - Broken Routes**
```bash
# Files still using createClient (broken):
/app/api/scraping/youtube-similar/route.ts
/app/api/scraping/tiktok-similar/route.ts  
/app/api/scraping/instagram/route.ts
/app/api/campaigns/[id]/route.ts
```

### **Required Actions:**
1. **Replace Authentication**: Same pattern as completed routes
   ```typescript
   // Replace this:
   const supabase = await createClient()
   const { data: { user } } = await supabase.auth.getUser()
   
   // With this:
   const { userId } = await auth()
   if (!userId) return 401
   ```

2. **Update User References**: Replace `user.id` with `userId`

3. **Add Missing Imports**: Ensure `auth` is imported from `@clerk/nextjs/server`

### **Medium Priority - Enhancements**
- [ ] **Database Migration**: Run schema migration for userProfiles table
- [ ] **Error Handling**: Improve error messages for auth failures
- [ ] **User Profile Page**: Update to use Clerk user data
- [ ] **Email Verification**: Configure Clerk email settings

### **Low Priority - Optimizations**
- [ ] **Webhook Setup**: Configure Clerk webhooks for user sync
- [ ] **Role-Based Access**: Add role management if needed
- [ ] **SSO Integration**: Configure social login providers

---

## Troubleshooting

### **Common Issues and Solutions**

#### **1. `createClient is not defined`**
**Error:** Routes trying to import deleted Supabase utilities
**Solution:** Replace with Clerk auth pattern:
```typescript
import { auth } from '@clerk/nextjs/server'
const { userId } = await auth()
```

#### **2. `auth().protect is not a function`**
**Error:** Incorrect Clerk middleware syntax
**Solution:** Use the correct pattern:
```typescript
export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth()
  // Handle auth logic
})
```

#### **3. `Assignment to constant variable`**
**Error:** Trying to reassign const variables
**Solution:** Change `const job` to `let job` when reassignment is needed

#### **4. User ID Type Mismatch**
**Error:** Database expects UUID but Clerk provides string
**Solution:** Update schema to use `text` instead of `uuid` for userId fields

### **Debugging Tips**

#### **Check Auth Status:**
```javascript
// In API routes
console.log('Auth result:', await auth())

// In components  
console.log('User:', user, 'Loaded:', isLoaded)
```

#### **Verify Environment Variables:**
```bash
# Check Clerk keys are set
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
echo $CLERK_SECRET_KEY
```

#### **Test Auth Flow:**
1. Try accessing protected route while logged out → Should redirect to sign-in
2. Sign in → Should redirect to dashboard  
3. Access API endpoint → Should work with valid auth
4. Sign out → Should clear session and redirect

---

## Migration Summary

### **Migration Scope:**
- **Files Modified:** 25+ files
- **Lines of Code Changed:** 500+ lines
- **Duration:** 1 development session
- **Breaking Changes:** Complete auth system replacement

### **Benefits Achieved:**
- ✅ **Simplified Architecture**: Single-purpose authentication
- ✅ **Better Security**: Professional-grade auth with Clerk
- ✅ **Improved DX**: Cleaner code and better error handling
- ✅ **Industry Standard**: Using widely-adopted patterns
- ✅ **Maintainability**: Easier to debug and extend

### **Next Developer Notes:**
1. **Understanding**: This migration replaced the entire auth system - no Supabase auth code should remain
2. **Pattern**: All API routes should use `const { userId } = await auth()` pattern
3. **Components**: All frontend components should use Clerk hooks (`useUser`, `useClerk`)
4. **Database**: User IDs are now strings (Clerk format) instead of UUIDs (Supabase format)
5. **Environment**: Ensure Clerk environment variables are set in production

---

**Migration Completed By:** Claude Code Assistant  
**Migration Date:** July 6, 2025  
**Status:** Core migration complete, some routes pending cleanup  
**Next Steps:** Fix remaining broken routes following established patterns