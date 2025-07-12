# 🗺️ URL Mapping & Route Structure

## Overview
Complete URL structure for the usegemz platform with detailed component mapping and navigation flows. This document serves as the definitive guide for understanding the frontend routing system.

## 📋 Route Summary Table

| URL Pattern | Page Component | Auth Required | Admin Only | Description |
|------------|----------------|---------------|------------|-------------|
| `/` | `app/page.js` | ❌ | ❌ | Landing/Dashboard |
| `/sign-in` | Clerk Modal | ❌ | ❌ | Authentication |
| `/sign-up` | Clerk Modal | ❌ | ❌ | User registration |
| `/campaigns/new` | `app/campaigns/new/page.jsx` | ✅ | ❌ | Campaign creation |
| `/campaigns/search/keyword` | `app/campaigns/search/keyword/page.jsx` | ✅ | ❌ | Keyword search interface |
| `/campaigns/search/similar` | `app/campaigns/search/similar/page.jsx` | ✅ | ❌ | Similar search interface |
| `/campaigns/[id]` | `app/campaigns/[id]/page.tsx` | ✅ | ❌ | Individual campaign view |
| `/profile` | `app/profile/page.tsx` | ✅ | ❌ | User profile (admin vs user) |
| `/onboarding/step-1` | `app/onboarding/step-1/page.tsx` | ✅ | ❌ | Personal information |
| `/onboarding/step-2` | `app/onboarding/step-2/page.tsx` | ✅ | ❌ | Brand description |
| `/onboarding/complete` | `app/onboarding/complete/page.tsx` | ✅ | ❌ | Trial activation |
| `/admin/system-config` | `app/admin/system-config/page.tsx` | ✅ | ✅ | System configuration |
| `/admin/email-testing` | `app/admin/email-testing/page.tsx` | ✅ | ✅ | Email testing interface |
| `/admin/users` | `app/admin/users/page.tsx` | ✅ | ✅ | User management |

## 🏗️ Complete Navigation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNAUTHENTICATED                         │
├─────────────────────────────────────────────────────────────────┤
│  / (Landing)                                                    │
│  ├── "Sign In" → /sign-in (Clerk Modal)                       │
│  └── "Create Account" → /sign-up (Clerk Modal)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (After Auth)
┌─────────────────────────────────────────────────────────────────┐
│                         ONBOARDING FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│  Modal Overlay on / (Dashboard)                                │
│  ├── Step 1: Personal Info (name, business)                   │
│  ├── Step 2: Brand Description                                │
│  └── Step 3: Trial Activation                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Onboarding Complete)
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN DASHBOARD (/)                        │
├─────────────────────────────────────────────────────────────────┤
│  Campaign List + "Create Campaign" Button                      │
│  └── "Create Campaign" → /campaigns/new                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMPAIGN CREATION                           │
├─────────────────────────────────────────────────────────────────┤
│  /campaigns/new                                                │
│  ├── Campaign Name & Description                              │
│  ├── "Keyword Search" → /campaigns/search/keyword             │
│  └── "Similar Search" → /campaigns/search/similar             │
└─────────────────────────────────────────────────────────────────┘
                         │                │
                         ▼                ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│     KEYWORD SEARCH          │   │     SIMILAR SEARCH          │
├─────────────────────────────┤   ├─────────────────────────────┤
│ /campaigns/search/keyword   │   │ /campaigns/search/similar   │
│ ├── Platform: TikTok, YouTube│   │ ├── Platform: TikTok, Instagram│
│ ├── Keywords Input          │   │ ├── Username Input          │
│ ├── Target Count            │   │ └── Submit → Job Creation   │
│ └── Submit → Job Creation   │   └─────────────────────────────┘
│                             │
│ Progress → Results Display  │
└─────────────────────────────┘
```

## 📱 Detailed Route Specifications

### 🏠 Root Route: `/`
**File**: `app/page.js`  
**Component**: `Home`  
**Layout**: `DashboardLayout` (authenticated) | Custom landing (unauthenticated)

```typescript
// Conditional rendering based on auth state
<SignedOut>
  // Landing page with sign-in/sign-up buttons
</SignedOut>

<SignedIn>
  <DashboardLayout>
    // Campaign list + onboarding modal overlay
  </DashboardLayout>
</SignedIn>
```

**Key Features**:
- Onboarding modal overlay for incomplete users
- Campaign list with creation button
- Auth state detection and routing

---

### 🎯 Campaign Creation: `/campaigns/new`
**File**: `app/campaigns/new/page.jsx`  
**Component**: `NewCampaign`  
**Layout**: `DashboardLayout`

```javascript
<DashboardLayout>
  <div className="max-w-4xl mx-auto py-8">
    <CampaignForm />
  </div>
</DashboardLayout>
```

**Navigation Flow**:
1. User fills campaign name/description
2. Chooses search type (Keyword/Similar)
3. Redirects to appropriate search interface

---

### 🔍 Search Interfaces

#### Keyword Search: `/campaigns/search/keyword`
**File**: `app/campaigns/search/keyword/page.jsx`  
**Component**: `KeywordSearch`  
**Layout**: `DashboardLayout`

**Three-Step Interface**:
```
Step 1: Platform Selection (TikTok/YouTube) + Keywords Input
Step 2: Review & Confirmation  
Step 3: Real-time Results Display
```

**State Management**:
```javascript
const [step, setStep] = useState(1);
const [searchData, setSearchData] = useState({
  platforms: [],      // Selected platforms
  creatorsCount: 1000, // Target result count
  keywords: [],        // Search keywords
  jobId: null,        // QStash job ID
  campaignId: null    // Campaign association
});
```

#### Similar Search: `/campaigns/search/similar`
**File**: `app/campaigns/search/similar/page.jsx`  
**Component**: `SimilarCreatorSearch`  
**Layout**: `DashboardLayout`

**Two-Step Interface**:
```
Step 1: Platform Selection (TikTok/Instagram/YouTube) + Username Input
Step 2: Real-time Results Display
```

**Default Platform Order**: TikTok → Instagram → YouTube

---

### 👤 Profile Management: `/profile`
**File**: `app/profile/page.tsx`  
**Component**: `ProfileSettingsPage`  
**Layout**: `DashboardLayout`

**Conditional Rendering**:
```typescript
// Admin users see additional fields
{isAdmin ? (
  <TrialStatusCard />        // With customer ID, subscription ID
) : (
  <TrialStatusCardUser />    // Without sensitive data
)}

{isAdmin && (
  <EmailScheduleDisplay />   // Admin-only email schedule
)}
```

---

### 🛠️ Onboarding Flow

#### Step 1: `/onboarding/step-1`
**File**: `app/onboarding/step-1/page.tsx`  
**API**: `PATCH /api/onboarding/step-1`  
**Fields**: Full name, business name

#### Step 2: `/onboarding/step-2`
**File**: `app/onboarding/step-2/page.tsx`  
**API**: `PATCH /api/onboarding/step-2`  
**Fields**: Brand description (min 50 chars)

#### Complete: `/onboarding/complete`
**File**: `app/onboarding/complete/page.tsx`  
**API**: `PATCH /api/onboarding/complete`  
**Action**: Activates 7-day trial + email sequence

---

### 🔐 Admin Routes (Admin Only)

#### System Config: `/admin/system-config`
**File**: `app/admin/system-config/page.tsx`  
**Features**: 
- System configuration management
- Hot-reloadable settings
- Category-based organization

#### Email Testing: `/admin/email-testing`
**File**: `app/admin/email-testing/page.tsx`  
**Features**:
- User search and selection
- Email template testing
- Send test emails to any user

#### User Management: `/admin/users`
**File**: `app/admin/users/page.tsx`  
**Features**:
- Promote users to admin
- Search user database
- User role management

---

## 🔒 Route Protection Patterns

### Authentication Middleware
**File**: `middleware.ts`

```typescript
// Public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

// Admin routes (admin verification)
const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);
```

### Admin Verification
**Hook**: `lib/hooks/use-admin.ts`

```typescript
export function useAdmin() {
  const { user } = useUser();
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
  
  return {
    isAdmin: adminEmails.includes(user?.primaryEmailAddress?.emailAddress || ''),
    user
  };
}
```

## 📊 State Management Patterns

### Session Storage
- `currentCampaign`: Campaign data persistence across search flows
- `searchData`: Search parameters and job IDs

### URL Parameters
- `campaignId`: Campaign association for search interfaces
- Query string parsing for campaign context

### Real-time Updates
- Job status polling every 3 seconds
- Progress bar updates
- Live result streaming

## 🎨 Layout Components

### `DashboardLayout`
**File**: `app/components/layout/dashboard-layout.jsx`  
**Features**:
- Sidebar navigation with admin conditional items
- User profile display
- Responsive design

### `Sidebar`
**File**: `app/components/layout/sidebar.jsx`  
**Conditional Navigation**:
```javascript
// Regular users see
- Dashboard
- Profile Settings

// Admins additionally see
- System Config
- Email Testing
```

## 🔄 Navigation Patterns

### Programmatic Navigation
```javascript
import { useRouter } from 'next/navigation';

// Campaign creation flow
router.push(`/campaigns/search/${searchType}?campaignId=${id}`);

// Results redirection
router.push(`/campaigns/${campaignId}`);
```

### Link-based Navigation
```javascript
import Link from 'next/link';

<Link href="/campaigns/new">
  <Button>Create Campaign</Button>
</Link>
```

### Modal-based Navigation
- Onboarding overlay on dashboard
- Clerk authentication modals
- Confirmation dialogs for destructive actions

---

**Next**: Continue with [Design System](./design-system.md) to understand the component architecture and styling patterns.