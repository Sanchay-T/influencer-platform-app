# TikTok Keyword Search User Flow Documentation

## Overview
This document provides a comprehensive walkthrough of the TikTok keyword search functionality in the Influencer Platform application, from sign-in to viewing results and exporting data.

## User Flow Steps

### 1. Landing Page
- **URL**: `http://localhost:3000/`
- **Features**: 
  - Clean landing page with "Sign In" and "Create Account" buttons
  - Professional branding for the Influencer Platform
- **Action**: Click "Sign In" button

### 2. Sign In Process
- **URL**: `http://localhost:3000/` (sign-in modal)
- **Features**:
  - Email input field
  - Password input field
  - "Continue with Google" option
  - "Forgot password?" link
- **Actions**:
  - Enter email: `sanchaythalnerkar@gmail.com`
  - Enter password: `Xerxes@101`
  - Click "Continue"

### 3. Onboarding Process
- **URL**: `http://localhost:3000/` (onboarding flow)
- **Features**:
  - **Step 1**: Full Name and Business Name collection
    - Full Name: "Sanchay Thalnerkar"
    - Business Name: "Demo Business"
  - **Step 2**: Brand description textarea
    - Description: "We're a digital marketing agency that helps businesses grow through influencer partnerships. We work with content creators across various niches including tech, lifestyle, and business to create authentic brand collaborations."
  - **Step 3**: Final "Let's Start!" button
- **Actions**: Complete all onboarding steps

### 4. Dashboard
- **URL**: `http://localhost:3000/`
- **Features**:
  - Navigation header with Dashboard, Profile Settings, and Logout options
  - "Create campaign" button prominently displayed
  - List of existing campaigns with pagination
  - Campaign cards showing:
    - Campaign name and description
    - Search type (Keyword Search/Similar Search)
    - Creation date
    - Direct links to campaign details
- **Action**: Click "Create campaign"

### 5. Campaign Creation
- **URL**: `http://localhost:3000/campaigns/new`
- **Features**:
  - Campaign Name input field
  - Campaign Description textarea
  - Continue button
- **Actions**:
  - Campaign Name: "TikTok Keyword Search Demo"
  - Description: "This is a demonstration campaign to show the TikTok keyword search functionality. We'll search for tech-related content creators."
  - Click "Continue"

### 6. Search Type Selection
- **URL**: `http://localhost:3000/campaigns/new` (search type selection)
- **Features**:
  - Two search options:
    - "Keyword-Based Search" - Find influencers using keywords, hashtags, and phrases
    - "Similar Creator Search" - Discover creators similar to an existing one
- **Action**: Select "Keyword-Based Search"

### 7. Platform & Keywords Configuration
- **URL**: `http://localhost:3000/campaigns/search/keyword`
- **Features**:
  - Platform selection (TikTok, Instagram, YouTube)
  - Creator count selector
  - Keyword input field with "Add" button
  - Dynamic keyword tag display
  - "Submit Campaign" button
- **Actions**:
  - Select TikTok platform
  - Add keywords: "tech", "iPhone", "programming"
  - Click "Submit Campaign"

### 8. Search Results
- **URL**: `http://localhost:3000/campaigns/[campaign-id]`
- **Features**:
  - Campaign breadcrumb navigation
  - "Back to Campaign" and "Export CSV" buttons
  - Results table with:
    - Creator profile pictures (with HEIC conversion support)
    - Creator names (clickable links to TikTok profiles)
    - Bio information and email extraction
    - Video titles and descriptions
    - Video statistics (likes, comments, shares, views)
    - Follower counts
    - Creation dates
    - Hashtags
    - Direct "View" links to TikTok videos

### 9. Search Results Data
**Campaign**: TikTok Keyword Search Demo  
**Keywords**: tech, iPhone, programming  
**Results Found**: 7+ creators

**Sample Results**:
1. **SwiftUI_Design** - @swiftui_design
2. **Marlon Wireless** - @marlonwireless  
3. **inncoder** - @inncoder
4. **Techie** - @techie304
5. **ATHEEQ-TECH** - @phonerepairingcourse
6. **Pedro Alejandro Rocha Alvarado** - @pedroalejandroroc1
7. **Codin** - @codin.s

### 10. Export Functionality
- **Features**:
  - CSV export button available on results page
  - Exports comprehensive data including:
    - Creator information
    - Bio and email data
    - Video statistics
    - Hashtags
    - Links to profiles and videos
- **Action**: Click "Export CSV" to download results

## Technical Features Demonstrated

### 1. Authentication & User Management
- ✅ Clerk authentication integration
- ✅ User onboarding flow
- ✅ Session management
- ✅ Profile settings

### 2. Campaign Management
- ✅ Campaign creation workflow
- ✅ Search type selection
- ✅ Platform-specific configuration
- ✅ Campaign history and tracking

### 3. TikTok Integration
- ✅ ScrapeCreators API integration
- ✅ Keyword-based search
- ✅ Real-time background processing with QStash
- ✅ Enhanced profile fetching for bio/email extraction

### 4. Image Processing
- ✅ Universal image proxy system
- ✅ HEIC to JPEG conversion
- ✅ TikTok CDN 403 error handling
- ✅ Fallback placeholder generation

### 5. Data Export
- ✅ CSV export functionality
- ✅ Comprehensive data structure
- ✅ Email extraction from bios
- ✅ Platform-specific formatting

### 6. User Experience
- ✅ Responsive design
- ✅ Real-time progress tracking
- ✅ Professional interface
- ✅ Intuitive navigation

## Testing Credentials
- **Email**: `sanchaythalnerkar@gmail.com`
- **Password**: `Xerxes@101`

## Development Environment
- **Local URL**: `http://localhost:3000`
- **Network URL**: `http://192.168.1.22:3000`
- **Framework**: Next.js 15.2.3
- **Authentication**: Clerk
- **Database**: PostgreSQL with Drizzle ORM
- **Background Processing**: QStash by Upstash

## API Integrations
- **TikTok Search**: ScrapeCreators API
- **Image Processing**: Custom proxy with HEIC conversion
- **Background Jobs**: QStash for async processing

## Success Metrics
- ✅ **Authentication**: Successfully signed in and completed onboarding
- ✅ **Campaign Creation**: Created campaign with proper configuration
- ✅ **Search Execution**: TikTok keyword search completed with 7+ results
- ✅ **Data Quality**: Results include profile links, bio data, and video statistics
- ✅ **Export**: CSV export functionality working
- ✅ **User Experience**: Smooth, professional interface throughout

## Notes
- The application successfully demonstrates the complete end-to-end flow from authentication to results export
- TikTok keyword search is functioning with proper background processing
- Image proxy system handles HEIC conversion and TikTok CDN restrictions
- Bio and email extraction is working for creator contact information
- CSV export provides comprehensive data for further analysis
- The platform supports multiple search types and platforms (TikTok, Instagram, YouTube)

---

*Generated on: July 9, 2025*  
*Testing completed using browser automation*