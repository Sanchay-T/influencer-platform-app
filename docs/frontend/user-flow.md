# 👤 User Flow & Journey Documentation

## Overview
Complete user journey documentation for the usegemz platform, from initial sign-up through campaign results. This document covers all user interactions, state transitions, and flow patterns.

## 🎯 User Journey Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   VISITOR   │───▶│ REGISTERED  │───▶│ ONBOARDED   │───▶│ ACTIVE USER │
│             │    │    USER     │    │    USER     │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
Landing Page       Sign-up/Sign-in    Onboarding Flow    Campaign Management
```

## 🚀 Complete User Flow Breakdown

### 1. 🌐 Landing Experience
**Route**: `/`  
**State**: Unauthenticated

```
┌─────────────────────────────────────────────────────────────────┐
│                        LANDING PAGE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ╔═══════════════╗                           │
│                    ║   usegemz     ║                           │
│                    ║               ║                           │
│                    ╚═══════════════╝                           │
│                                                                 │
│       "Manage your influencer campaigns                        │
│        across multiple platforms"                              │
│                                                                 │
│           ┌─────────────┐  ┌─────────────┐                    │
│           │  Sign In    │  │Create Account│                   │
│           └─────────────┘  └─────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Component**: `SignedOut` section in `app/page.js`  
**Actions**:
- Click "Sign In" → Clerk modal opens
- Click "Create Account" → Clerk modal opens

---

### 2. 🔐 Authentication Flow
**Provider**: Clerk  
**Modals**: Sign-in/Sign-up overlays

```
Sign-up Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Email +   │───▶│  Verify     │───▶│  Profile    │
│  Password   │    │   Email     │    │  Creation   │
└─────────────┘    └─────────────┘    └─────────────┘

Sign-in Flow:
┌─────────────┐    ┌─────────────┐
│   Email +   │───▶│ Dashboard   │
│  Password   │    │  Redirect   │
└─────────────┘    └─────────────┘
```

**Post-Auth Redirect**: 
- New users → Dashboard with onboarding modal
- Returning users → Dashboard

---

### 3. 🎯 Onboarding Flow
**Trigger**: Modal overlay on dashboard for incomplete users  
**Component**: `OnboardingModal` in `app/components/onboarding/onboarding-modal.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONBOARDING MODAL                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    Step Progress:  ①━━━②━━━③                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   STEP 1                               │   │
│  │                                                        │   │
│  │  Welcome to usegemz! 🎉                               │   │
│  │                                                        │   │
│  │  Full Name:     [________________]                     │   │
│  │  Business Name: [________________]                     │   │
│  │                                                        │   │
│  │              [ Continue → ]                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 1: Personal Information
**API**: `PATCH /api/onboarding/step-1`

**Fields**:
- Full Name (required)
- Business Name (required)

**Validation**:
- Both fields must be filled
- Names are trimmed of whitespace

**Progress Visual**:
```css
Step 1: bg-blue-600 text-white (active)
Step 2: bg-gray-300 text-gray-600 (inactive)
Step 3: bg-gray-300 text-gray-600 (inactive)
```

#### Step 2: Brand Description
**API**: `PATCH /api/onboarding/step-2`

```
┌─────────────────────────────────────────────────────────────────┐
│                      STEP 2                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Describe Your Brand & Influencer Goals 🎯                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Example: We're a sustainable fashion brand targeting   │   │
│  │ young professionals. We look for eco-conscious...      │   │
│  │                                                        │   │
│  │                                              250/500   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💡 Our AI will use this context to:                           │
│     • Find influencers that match your brand values            │
│     • Identify creators with relevant audience demographics    │
│     • Prioritize accounts with authentic engagement            │
│                                                                 │
│  Example Templates:                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Sustainable skincare brand example...]                │   │
│  │ [Fitness apparel company example...]                   │   │
│  │ [Tech startup example...]                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Fields**:
- Brand Description (min 50 characters)

**Features**:
- Character counter (max 500)
- Example prompts (clickable)
- Real-time validation
- AI context explanation

#### Step 3: Trial Activation
**API**: `PATCH /api/onboarding/complete`

```
┌─────────────────────────────────────────────────────────────────┐
│                      STEP 3                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│               ✓  You're All Set! 🎉                            │
│                                                                 │
│  Your profile is complete and our AI is ready to find          │
│  perfect influencers for your brand.                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 What's next?                           │   │
│  │                                                        │   │
│  │  ① Create your first campaign                          │   │
│  │    Search for influencers across platforms            │   │
│  │                                                        │   │
│  │  ② Get detailed insights                               │   │
│  │    Access contact info and analytics                  │   │
│  │                                                        │   │
│  │  ③ Export and contact                                  │   │
│  │    Download contact lists                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                    [ Let's Start! ]                            │
└─────────────────────────────────────────────────────────────────┘
```

**Actions**:
- Activates 7-day trial
- Triggers welcome email sequence
- Sets `onboardingStep: 'completed'`
- Redirects to dashboard

---

### 4. 🏠 Dashboard Experience
**Route**: `/`  
**State**: Authenticated + Onboarded

```
┌─────────────────────────────────────────────────────────────────┐
│                      DASHBOARD                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Your campaigns                        [ + Create campaign ]    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                        │   │
│  │  📊 Summer Fashion Campaign                           │   │
│  │      TikTok Keyword Search • 250 results             │   │
│  │      Created 2 days ago                               │   │
│  │                                         [ View ]     │   │
│  │                                                        │   │
│  │  📊 Fitness Influencers                               │   │
│  │      Instagram Similar Search • 120 results           │   │
│  │      Created 1 week ago                               │   │
│  │                                         [ View ]     │   │
│  │                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [ Empty State when no campaigns ]                             │
│  "No campaigns yet. Create your first campaign to get          │
│   started with influencer discovery!"                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Component**: `CampaignList`  
**Actions**:
- Click "Create campaign" → `/campaigns/new`
- Click "View" on campaign → `/campaigns/[id]`

---

### 5. 🎯 Campaign Creation Flow
**Route**: `/campaigns/new`  
**Component**: `CampaignForm`

```
┌─────────────────────────────────────────────────────────────────┐
│                   CREATE A CAMPAIGN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Campaign Name:     [________________________]                 │
│                                                                 │
│  Description:       ┌─────────────────────────┐                │
│                     │ Optional description    │                │
│                     │ for your campaign...    │                │
│                     └─────────────────────────┘                │
│                                                                 │
│  Search Type:                                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔍 Keyword Search                                     │   │
│  │      Find creators by searching for specific keywords  │   │
│  │      Platforms: TikTok, YouTube                        │   │
│  │                                     [ Select ]         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  👥 Similar Search                                     │   │
│  │      Find creators similar to a specific username      │   │
│  │      Platforms: TikTok, Instagram, YouTube             │   │
│  │                                     [ Select ]         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Step 1: Basic Information**
- Campaign name (required)
- Description (optional)
- Search type selection

**Step 2: Search Type Selection**
- Keyword Search → `/campaigns/search/keyword?campaignId=xxx`
- Similar Search → `/campaigns/search/similar?campaignId=xxx`

---

### 6. 🔍 Search Interface Flows

#### Keyword Search Flow
**Route**: `/campaigns/search/keyword`

```
STEP 1: Platform & Keywords Selection
┌─────────────────────────────────────────────────────────────────┐
│                   KEYWORD SEARCH                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Platform:         ☑️ TikTok    ☐ YouTube                      │
│                                                                 │
│  Keywords:         [_____________] [ + Add Keyword ]           │
│                    📝 fitness motivation                       │
│                    📝 workout tips        [ × ]                │
│                    📝 gym lifestyle       [ × ]                │
│                                                                 │
│  Target Results:   (•) 1000  ( ) 500  ( ) 2000                │
│                                                                 │
│                              [ Continue → ]                    │
└─────────────────────────────────────────────────────────────────┘

STEP 2: Review & Launch
┌─────────────────────────────────────────────────────────────────┐
│                      REVIEW                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Campaign: Summer Fashion Campaign                              │
│  Platform: TikTok                                               │
│  Keywords: fitness motivation, workout tips, gym lifestyle     │
│  Target:   1000 creators                                        │
│                                                                 │
│                      [ Start Search ]                          │
└─────────────────────────────────────────────────────────────────┘

STEP 3: Real-time Results
[See Real-time Features section below]
```

#### Similar Search Flow
**Route**: `/campaigns/search/similar`

```
STEP 1: Platform & Username Selection
┌─────────────────────────────────────────────────────────────────┐
│                   SIMILAR SEARCH                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Platform:    (•) TikTok  ( ) Instagram  ( ) YouTube          │
│                                                                 │
│  Username:    [_____________________]                          │
│               e.g. stoolpresidente                             │
│                                                                 │
│                      [ Find Similar Creators ]                 │
└─────────────────────────────────────────────────────────────────┘

STEP 2: Real-time Results
[See Real-time Features section below]
```

**Platform Order**: TikTok → Instagram → YouTube (updated)

---

### 7. ⚡ Real-time Features & Progress

#### Search Progress Component
**Component**: `SearchProgress`

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH IN PROGRESS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔄 Searching TikTok for "fitness motivation"...               │
│                                                                 │
│  Progress: ▓▓▓▓▓▓▓▓░░ 78%                                      │
│  Found 156 creators so far • Est. 2 min remaining              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Latest Results (5)                        │   │
│  │                                                        │   │
│  │  🟢 @fitnessqueen      • 2.3M followers               │   │
│  │  🟢 @workoutwarrior    • 1.8M followers               │   │
│  │  🟢 @gymlover24        • 950K followers               │   │
│  │  🟢 @strengthsister    • 1.2M followers               │   │
│  │  🟢 @fitnessfanatic    • 780K followers               │   │
│  │                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features**:
- Live progress bar updates
- Real-time creator discovery
- Status messages with estimates
- Latest results preview
- Smooth animations for new entries

#### Progress States
```javascript
// State progression
'starting'    → 'processing' → 'completed'
     ↓               ↓             ↓
"Initializing"  "Searching..."  "Search Complete"
```

#### Real-time Updates
- **Polling Interval**: 3 seconds
- **Progress Calculation**: Based on API calls vs target
- **Live Results**: New creators appear with animations
- **Status Messages**: Dynamic based on current state

---

### 8. 📊 Results Display

```
┌─────────────────────────────────────────────────────────────────┐
│                       RESULTS                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Results Found                                                  │
│  Page 1 of 12 • Showing 1-10 of 120                           │
│                                            [ Export CSV ]       │
│                                                                 │
│  ┌─────┬─────────────┬─────────┬─────────┬─────────────────┐   │
│  │ 👤  │ Username    │   Bio   │  Email  │ Video Title     │   │
│  ├─────┼─────────────┼─────────┼─────────┼─────────────────┤   │
│  │ 🖼️  │ @fitgirl24  │ Fitness │ fit@... │ Morning Workout │   │
│  │     │ 2.3M ♥️     │ lover   │         │ 1.2M views     │   │
│  ├─────┼─────────────┼─────────┼─────────┼─────────────────┤   │
│  │ 🖼️  │ @gymking    │ Build   │ No      │ Chest Day Tips  │   │
│  │     │ 1.8M ♥️     │ muscle  │ email   │ 890K views     │   │
│  └─────┴─────────────┴─────────┴─────────┴─────────────────┘   │
│                                                                 │
│              [ ← Previous ]  1 2 3 ... 12  [ Next → ]         │
└─────────────────────────────────────────────────────────────────┘
```

**Table Features**:
- **Avatar Images**: Profile pictures with proxy loading
- **Bio & Email**: Enhanced profile fetching for TikTok
- **Clickable Usernames**: Direct links to profiles
- **Statistics**: Followers, views, engagement
- **Pagination**: 10 results per page
- **Export**: CSV download with all data

**Table Columns**:
1. Profile (Avatar + Name + Followers)
2. Bio (Enhanced bio from profile API)
3. Email (Extracted from bio)
4. Video Title/Description
5. Statistics (Views, Likes, Comments)
6. Platform-specific data

---

### 9. 📁 Data Export Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CSV EXPORT                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Export CSV ] → Browser Download                              │
│                                                                 │
│  File Format: campaign-name-YYYY-MM-DD.csv                     │
│                                                                 │
│  Columns Include:                                               │
│  • Username, Followers, Bio, Email                             │
│  • Video URL, Description, Views                               │
│  • Likes, Comments, Shares                                     │
│  • Hashtags, Keywords, Platform                                │
│  • Created Date                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**API**: `GET /api/export/csv?jobId=xxx`  
**Features**:
- Platform-specific CSV formats
- All extracted data included
- Instant download
- Professional formatting

---

### 10. 👤 Profile Management

#### Regular User Profile
```
┌─────────────────────────────────────────────────────────────────┐
│                   PROFILE SETTINGS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Trial Status                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⏰ 7-Day Free Trial                    [Active Trial] │   │
│  │                                                        │   │
│  │               5 days 14 hours                          │   │
│  │                  remaining                             │   │
│  │                                                        │   │
│  │  Trial Progress  ▓▓▓▓▓░░░░░ 40%                       │   │
│  │                                                        │   │
│  │  Started: Jan 15, 2024                                │   │
│  │  Expires: Jan 22, 2024                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Account Information                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Name:     John Doe                                    │   │
│  │  Email:    john@example.com                            │   │
│  │  Company:  Fitness Brand Inc                           │   │
│  │  Industry: Health & Wellness                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Admin User Profile
```
┌─────────────────────────────────────────────────────────────────┐
│                 PROFILE SETTINGS (ADMIN)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Trial Status                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⏰ 7-Day Free Trial                    [Active Trial] │   │
│  │                                                        │   │
│  │  Customer ID: cus_123456789 (MOCK)                    │   │
│  │  Subscription ID: sub_987654321 (MOCK)                │   │
│  │                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Email Schedule Status                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📧 Welcome Email: ✅ Sent                             │   │
│  │  📧 Day 2 Email: ⏰ Scheduled                          │   │
│  │  📧 Day 5 Email: ⏰ Pending                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Debug Information (Development)                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [JSON trial data display]                            │   │
│  │  [Refresh Profile Data] [Log Current State]           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Differences**:
- Regular users: Clean trial view without sensitive data
- Admin users: Full trial details + email schedule + debug info

---

### 11. 🔄 State Management Patterns

#### Campaign Flow State
```javascript
// Session storage persistence
sessionStorage: {
  currentCampaign: {
    id: "uuid",
    name: "Campaign Name",
    searchType: "keyword" | "similar"
  }
}

// Search state progression
searchState: {
  step: 1 | 2 | 3,
  status: 'idle' | 'searching' | 'processing' | 'completed',
  jobId: "uuid",
  progress: 0-100,
  results: []
}
```

#### Real-time Polling
```javascript
// Job status polling every 3 seconds
useEffect(() => {
  const interval = setInterval(() => {
    if (jobId && status !== 'completed') {
      fetchJobStatus(jobId);
    }
  }, 3000);
  
  return () => clearInterval(interval);
}, [jobId, status]);
```

---

### 12. 🎯 Error Handling & Edge Cases

#### Connection Issues
```
┌─────────────────────────────────────────────────────────────────┐
│                      ERROR STATE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              ⚠️ Connection Error                               │
│                                                                 │
│       Unable to connect to search servers.                     │
│       Please check your connection and try again.              │
│                                                                 │
│                       [ Retry ]                                │
└─────────────────────────────────────────────────────────────────┘
```

#### Empty Results
```
┌─────────────────────────────────────────────────────────────────┐
│                    NO RESULTS FOUND                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     🔍 No Results                              │
│                                                                 │
│    No creators found for your search criteria.                 │
│    Try different keywords or adjust your search.               │
│                                                                 │
│               [ Try Different Keywords ]                       │
└─────────────────────────────────────────────────────────────────┘
```

#### Job Timeout
```
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH TIMEOUT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                   ⏰ Search Timeout                            │
│                                                                 │
│    Search took longer than expected. You can view              │
│    partial results or try searching again.                     │
│                                                                 │
│      [ View Partial Results ]  [ Search Again ]               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 13. 📱 Mobile Experience

#### Responsive Patterns
- **Cards**: Stack vertically on mobile
- **Tables**: Horizontal scroll with fixed height
- **Forms**: Single column layout
- **Modals**: Full-screen on small devices
- **Navigation**: Collapsible sidebar

#### Touch Interactions
- **Buttons**: Minimum 44px touch targets
- **Swipe**: Table horizontal scrolling
- **Pull-to-refresh**: Search results updates
- **Toast**: Mobile-optimized positioning

---

**Next**: Continue with [Search UI](./search-ui.md) for detailed breakdown of search interface components and [Real-time Features](./real-time-features.md) for technical implementation of live updates.