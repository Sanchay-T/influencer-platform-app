# 🚀 API Documentation - Influencer Platform

## Overview

This document provides comprehensive documentation for the Influencer Platform API architecture. The platform supports multi-platform influencer search (TikTok, Instagram, YouTube), admin management, billing/subscription systems, dashboard overview analytics, and background job processing through QStash integration.

### Architecture Summary
- **Authentication**: Clerk-based user authentication with dual admin system
- **Background Processing**: QStash-powered async job queuing
- **Image Processing**: Universal HEIC conversion and CDN bypass
- **Billing**: Stripe integration with plan validation
- **Email System**: Resend-powered email automation

---

## Authentication & Security

### Authentication Methods
All API endpoints use **Clerk authentication** with the following pattern:
```typescript
import { auth } from '@clerk/nextjs/server';

const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Admin Authentication
Admin endpoints use **dual authentication**:
1. **Environment-based**: `NEXT_PUBLIC_ADMIN_EMAILS` (development)
2. **Database-based**: `userProfiles.isAdmin = true` (production)

```typescript
import { isAdminUser } from '@/lib/auth/admin-utils';

if (!(await isAdminUser())) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Plan Validation
Protected endpoints validate user plans using `PlanValidator`:
```typescript
import { PlanValidator } from '@/lib/services/plan-validator';

const validation = await PlanValidator.validateCreatorSearch(userId, targetResults, 'tiktok_keyword');
if (!validation.allowed) {
  return NextResponse.json({ 
    error: 'Plan limit exceeded',
    upgrade: validation.upgradeRequired 
  }, { status: 403 });
}
```

---

## Platform Scraping APIs

### TikTok Keyword Search
**Endpoint**: `POST /api/scraping/tiktok`

**Request Body**:
```json
{
  "keywords": ["marketing", "influencer"],
  "targetResults": 1000,
  "campaignId": "uuid"
}
```

**Response**:
```json
{
  "message": "Scraping job started successfully",
  "jobId": "uuid",
  "qstashMessageId": "uuid"
}
```

**Features**:
- ✅ Enhanced bio/email extraction via individual profile API calls
- ✅ HEIC image conversion and caching
- ✅ Plan validation with detailed error messages
- ✅ Comprehensive error handling and logging

**Status Polling**: `GET /api/scraping/tiktok?jobId=uuid`

---

### TikTok Similar Search
**Endpoint**: `POST /api/scraping/tiktok-similar`

**Request Body**:
```json
{
  "targetUsername": "creator_handle",
  "targetResults": 500,
  "campaignId": "uuid"
}
```

**Processing Flow**:
1. Extract target user profile
2. Generate search keywords from bio/content
3. Search for similar creators
4. Enhanced profile fetching for complete data
5. Email extraction from enhanced bios

---

### Instagram Similar Search
**Endpoint**: `POST /api/scraping/instagram`

**Features**:
- Single API call (no continuation)
- Immediate job completion
- Related profiles extraction

---

### Instagram Reels Search
**Endpoint**: `POST /api/scraping/instagram-reels`

**Advanced Features**:
- ✅ **Live Preview System**: Real-time intermediate results
- ✅ **Parallel Bio Enhancement**: Batch processing with 3-creator batches
- ✅ **Individual Profile API Calls**: Complete follower and bio data
- ✅ **Progress Tracking**: Detailed progress messages

**Processing Stages**:
```
0-10%: Searching Instagram reels...
10-25%: Found reels, getting creator profiles...
25-40%: Processing reels data...
40-100%: Enhancing X/Y creators (Z%)
```

---

### YouTube Keyword Search
**Endpoint**: `POST /api/scraping/youtube`

**Modular Processing**:
- Platform-specific handler: `/lib/platforms/youtube/handler.ts`
- Data transformation: `/lib/platforms/youtube/transformer.ts`
- API integration: `/lib/platforms/youtube/api.ts`

---

### YouTube Similar Search
**Endpoint**: `POST /api/scraping/youtube-similar`

**Features**:
- Channel-based similarity matching
- Enhanced bio/email extraction from channel descriptions
- Social media links extraction

---

## Dashboard Overview API

### Dashboard Analytics
**Endpoint**: `GET /api/dashboard/overview`

**Authentication**: Requires valid Clerk authentication

**Purpose**: Provides comprehensive dashboard data including favorite influencers, recent lists, search telemetry metrics, and user plan status for the main dashboard view.

**Response**:
```json
{
  "favorites": [
    {
      "id": "uuid",
      "platform": "tiktok",
      "externalId": "creator123",
      "handle": "@creator_handle",
      "name": "Creator Name",
      "followerCount": 125000,
      "profilePicUrl": "https://cached-image-url.com/image.jpg",
      "bio": "Creator bio with contact info",
      "emails": ["contact@creator.com"],
      "verified": true,
      "addedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "recentLists": [
    {
      "id": "uuid",
      "name": "Holiday Campaign",
      "description": "Q4 influencer outreach list",
      "creatorCount": 42,
      "updatedAt": "2025-01-15T14:20:00Z",
      "slug": "holiday-campaign"
    }
  ],
  "metrics": {
    "averageSearchMs": 2847,
    "searchesLast30Days": 15,
    "completedSearchesLast30Days": 14,
    "searchLimit": 1000,
    "totalFavorites": 8
  }
}
```

**Features**:
- ✅ **Favorite Influencers**: Returns up to 10 most recently added favorites
- ✅ **Recent Lists**: Shows 3 most recently updated non-archived lists
- ✅ **Search Telemetry**: Aggregated performance metrics over last 30 days
- ✅ **Plan Integration**: Includes current plan limits and usage information
- ✅ **Performance Optimized**: Single request fetches all dashboard data
- ✅ **Normalized Database**: Uses updated database schema with proper relationships

**Error Responses**:
- `401`: Unauthorized - Invalid or missing authentication
- `404`: User record not found in database
- `500`: Internal server error during data aggregation

**Data Sources**:
- **Favorites**: From `list_items` with type 'favorites'
- **Lists**: From `lists` table filtered by ownership/collaboration
- **Telemetry**: Aggregated from `scraping_jobs` with performance calculations
- **Plan Status**: From `PlanValidator` service with current subscription details

---

## Creator Lists API

The creator list system allows users to curate, organize, and share sets of influencers discovered through search. Privacy flags have been removed—lists are now scoped by owner/collaborator role only.

### `GET /api/lists`
Returns every list the current user owns or collaborates on.

```json
{
  "lists": [
    {
      "id": "uuid",
      "name": "Holiday Outreach",
      "description": "Influencers to ping during Q4",
      "type": "campaign",
      "creatorCount": 42,
      "followerSum": 3184000,
      "collaboratorCount": 3,
      "viewerRole": "owner"
    }
  ]
}
```

### `POST /api/lists`
Creates a new list. Only `name`, `description`, and `type` are accepted (no privacy enum).

```json
{
  "name": "VIP Outreach",
  "description": "Creators we’re gifting next month",
  "type": "favorites"
}
```

### `GET /api/lists/[id]`
Fetches full list detail (items, collaborators, recent activity).

### `PATCH /api/lists/[id]`
Updates list metadata (name, description, type). Returns the updated summary object.

### `DELETE /api/lists/[id]`
Deletes the list and all associated items via cascading FKs. The endpoint now completes without logging a follow-up activity entry to avoid FK violations.

### `POST /api/lists/[id]/items`
Adds one or more creators to a list. Accepts an array of creator snapshots (platform, externalId, handle, metrics, etc.).

### `PATCH /api/lists/[id]/items`
Persist drag-and-drop order or bucket moves from the UI Kanban. Body signature: `{ items: [{ id, position, bucket }] }`.

### `DELETE /api/lists/[id]/items`
Removes specific list items. Body signature: `{ itemIds: ["uuid"] }`.

### `POST /api/lists/[id]/duplicate`
Clone an existing list, copying creators and metadata for the current user.

### `POST /api/lists/[id]/export`
Queue a CSV export job (handled asynchronously).

### `POST /api/lists/[id]/share`
Invite collaborators by email (stored as pending until accepted).

---

## Background Processing

### QStash Integration
**Primary Endpoint**: `POST /api/qstash/process-scraping`

**Webhook Verification**:
```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const isValid = await receiver.verify({
  signature: req.headers.get('Upstash-Signature'),
  body: await req.text(),
  url: callbackUrl
});
```

**Job Processing Flow**:
1. **Job Validation**: Verify job exists and is processable
2. **Platform Detection**: Route to appropriate handler with enhanced detection logging
3. **API Calls**: Make external API requests with rate limiting
4. **Data Transformation**: Convert to unified format
5. **Image Caching**: Cache profile images in Vercel Blob Storage
6. **Bio Enhancement**: Individual profile calls for complete data with detailed logging
7. **Progress Updates**: Real-time status and progress tracking with granular metrics
8. **Telemetry Tracking**: Enhanced usage tracking with detailed request logging
9. **Completion**: Mark job as completed or schedule continuation with performance metrics

**Unified Progress Calculation**:
```typescript
function calculateUnifiedProgress(processedRuns, maxRuns, processedResults, targetResults) {
  const apiCallsProgress = (processedRuns / maxRuns) * 100 * 0.3;
  const resultsProgress = (processedResults / targetResults) * 100 * 0.7;
  return Math.min(apiCallsProgress + resultsProgress, 100);
}
```

**Enhanced Telemetry & Logging Features**:
- ✅ **Structured Logging**: Uses logger service with categorized log levels
- ✅ **Job Detection Logging**: Comprehensive platform and job type detection with fallback logic
- ✅ **Bio Enhancement Tracking**: Detailed logging of profile API calls and email extraction
- ✅ **Performance Metrics**: Request timing and processing duration tracking
- ✅ **Progress Granularity**: Batch-level progress updates with detailed status messages
- ✅ **API Call Documentation**: Per-request logging for debugging and optimization
- ✅ **Error Context**: Enhanced error messages with job and user context
- ✅ **Request Correlation**: Unique request IDs for tracking across systems

**Enhanced Bio Enhancement Process**:
```typescript
// Individual profile API calls for complete data
console.log(`🔍 [BIO-ENHANCEMENT] Fetching profile for @${username}`);
const profileResponse = await fetch(profileApiUrl, headers);
const enhancedBio = profileUser.biography || '';
const enhancedEmails = enhancedBio.match(emailRegex) || [];
console.log(`✅ [BIO-ENHANCEMENT] Enhanced @${username}:`, {
  bioLength: enhancedBio.length,
  emailsFound: enhancedEmails.length,
  followerCount: realFollowerCount
});
```

---

## Admin APIs

### System Configuration Management
**Base Endpoint**: `/api/admin/config`

**Get All Configurations**: `GET /api/admin/config`
```json
{
  "configurations": {
    "api_limits": [
      {
        "category": "api_limits",
        "key": "max_api_calls_tiktok",
        "value": "10",
        "valueType": "number"
      }
    ]
  },
  "categories": ["api_limits", "timeouts", "features"]
}
```

**Update Configuration**: `POST /api/admin/config`
```json
{
  "category": "api_limits",
  "key": "max_api_calls_tiktok", 
  "value": "15",
  "valueType": "number",
  "description": "Maximum API calls for TikTok search"
}
```

**Bulk Update**: `PUT /api/admin/config`
**Delete Configuration**: `DELETE /api/admin/config?category=x&key=y`

---

### User Management
**Promote User to Admin**: `POST /api/admin/users/promote`
```json
{
  "userId": "clerk_user_id",
  "promote": true
}
```

**Get User Billing Status**: `GET /api/admin/users/billing-status?userId=x`

**Set User Plan**: `POST /api/admin/users/set-plan`
```json
{
  "userId": "clerk_user_id",
  "planId": "pro_plan"
}
```

---

### Email Testing System
**Send Test Email**: `POST /api/admin/email-testing/send`
```json
{
  "emailType": "welcome",
  "recipients": ["user1", "user2"],
  "scheduleFor": "2025-01-01T10:00:00Z"
}
```

**Supported Email Types**:
- `welcome`: Welcome email for new users
- `trial_day2`: Day 2 of trial reminder
- `trial_day5`: Day 5 of trial reminder
- `trial_expiry`: Trial expiration notice
- `campaign_finished`: Campaign completion notification

**Fast User Search**: `GET /api/admin/email-testing/users-fast?q={query}`
```json
{
  "users": [
    {
      "user_id": "clerk_user_id",
      "full_name": "John Doe",
      "business_name": "Company Inc",
      "trial_status": "active",
      "onboarding_step": "completed",
      "stripe_customer_id": "cus_xxx",
      "computed_trial_status": "Active"
    }
  ],
  "query": "john",
  "count": 1,
  "performance": {
    "dbTime": 15,
    "processTime": 2,
    "totalTime": 23
  }
}
```

**Cached User Search**: `GET /api/admin/email-testing/users-cached?q={query}`
```json
{
  "users": [
    {
      "user_id": "clerk_user_id",
      "full_name": "John Doe",
      "business_name": "Company Inc",
      "trial_status": "active",
      "onboarding_step": "completed",
      "computed_trial_status": "Active"
    }
  ],
  "query": "john",
  "count": 1,
  "cached": true,
  "dbTime": 15,
  "totalTime": 5
}
```

**Features**:
- ✅ **Performance Optimized**: Fast endpoint with minimal processing
- ✅ **In-Memory Caching**: 5-minute TTL cache for repeated searches
- ✅ **Normalized Database**: Uses new users/user_subscriptions tables
- ✅ **Performance Metrics**: Detailed timing breakdown in responses
- ✅ **Auto Cache Cleanup**: Prevents memory leaks with size limits

---

### Administrative Utilities
**Create Test User**: `POST /api/admin/create-test-user`
**Reset User State**: `POST /api/admin/reset-user-state`
**Backfill Campaign Counts**: `POST /api/admin/backfill-campaign-counts`

---

## Image Proxy System

### Universal Image Processing
**Endpoint**: `GET /api/proxy/image?url=<encoded_url>`

**Features**:
- ✅ **HEIC to JPEG Conversion**: Using `heic-convert` package
- ✅ **TikTok CDN 403 Bypass**: 5-layer strategy for blocked images
- ✅ **SVG Placeholder Generation**: Colored avatars for failed images
- ✅ **Vercel Blob Storage Detection**: Prevents double-proxying

**Processing Pipeline**:
```typescript
// 1. Format Detection
const isHeic = imageUrl.toLowerCase().includes('.heic');

// 2. Enhanced Headers for CDN Bypass
const fetchHeaders = {
  'User-Agent': 'Mozilla/5.0...',
  'Referer': 'https://www.tiktok.com/',
  'Origin': 'https://www.tiktok.com'
};

// 3. HEIC Conversion
if (isHeic) {
  const outputBuffer = await convert({
    buffer: buffer,
    format: 'JPEG',
    quality: 0.85
  });
}

// 4. Fallback Strategies
// - Remove referrer headers
// - Simplify URL (remove query params)
// - Use minimal curl-like headers
// - Try alternative CDN domains
// - Generate SVG placeholder
```

**Response Headers**:
- `X-Image-Proxy-Time`: Processing time in milliseconds
- `X-Image-Proxy-Source`: Conversion method used
- `X-Image-Fetch-Strategy`: Which fetch strategy succeeded
- `X-Image-Final-Status`: Final response status

---

## Billing & Subscription APIs

### Billing Status
**Endpoint**: `GET /api/billing/status`

**Enhanced Response**:
```json
{
  "currentPlan": "glow_up",
  "isTrialing": true,
  "hasActiveSubscription": false,
  "trialStatus": "active",
  "daysRemaining": 5,
  "hoursRemaining": 120,
  "minutesRemaining": 7200,
  "subscriptionStatus": "trialing",
  "usageInfo": {
    "campaignsUsed": 2,
    "creatorsUsed": 450,
    "progressPercentage": 45,
    "campaignsLimit": 3,
    "creatorsLimit": 1000
  },
  "stripeCustomerId": "cus_xxx",
  "stripeSubscriptionId": "sub_xxx",
  "nextBillingDate": "2025-02-08",
  "billingAmount": 99,
  "billingCycle": "monthly",
  "paymentMethod": {
    "brand": "visa",
    "last4": "4242",
    "expiryMonth": 12,
    "expiryYear": 2025
  },
  "trialEndsAt": "2025-01-08",
  "canManageSubscription": true,
  "trialProgressPercentage": 28.5,
  "trialTimeRemaining": "5 days, 2 hours",
  "trialStartDate": "2025-01-01T10:00:00Z",
  "trialEndDate": "2025-01-08T10:00:00Z",
  "lastWebhookEvent": "customer.subscription.created",
  "lastWebhookTimestamp": "2025-01-01T10:05:00Z",
  "billingSyncStatus": "webhook_subscription_created"
}
```

**Enhanced Features**:
- ✅ **Auto-creates user profile** if missing with Clerk user details
- ✅ **Comprehensive trial tracking** with detailed time remaining
- ✅ **Enhanced subscription management** with payment method info
- ✅ **Plan limits from database** using subscription_plans table
- ✅ **Inconsistent state detection** with diagnostic logging
- ✅ **Performance headers** with request ID and timing
- ✅ **Billing sync status tracking** for webhook integration
- ✅ **Usage percentage calculation** based on highest utilization
- ✅ **Normalized database integration** using new table structure

**Response Headers**:
- `x-request-id`: Unique request identifier for tracking
- `x-started-at`: Request start timestamp
- `x-duration-ms`: Total request processing time

---

### Stripe Integration
**Base Endpoints**: `/api/stripe/*`

**Create Checkout Session**: `POST /api/stripe/create-checkout`
**Upgrade Direct**: `POST /api/stripe/upgrade-direct`
**Customer Portal**: `GET /api/stripe/customer-portal`
**Webhook Handler**: `POST /api/stripe/webhook`

**Webhook Events Handled**:
- `customer.subscription.created`: Creates subscription with event sourcing
- `customer.subscription.updated`: Updates plan and handles trial conversion
- `customer.subscription.deleted`: Downgrades user to free plan
- `customer.subscription.trial_will_end`: Triggers trial ending notifications
- `invoice.payment_succeeded`: Updates billing sync status
- `invoice.payment_failed`: Marks payment failures for retry logic
- `setup_intent.succeeded`: Confirms payment method setup
- `payment_method.attached`: Stores card details in user profile

**Enhanced Processing Features**:
- ✅ **Event Sourcing Integration**: Creates audit trail events for all subscription changes
- ✅ **Background Job Queue**: Automatically queues onboarding completion jobs
- ✅ **Plan Limits from Database**: Fetches limits from subscription_plans table
- ✅ **Comprehensive Error Handling**: Emergency fallback for critical operations
- ✅ **Diagnostic Logging**: Detailed system availability checks
- ✅ **Correlation ID Tracking**: Links related events across systems
- ✅ **Normalized Database Updates**: Uses new users/user_subscriptions tables
- ✅ **Intelligent Plan Detection**: Multiple fallback methods for plan identification

**Error Recovery**:
```typescript
// Emergency fallback if background jobs fail
if (jobError) {
  console.log('🔧 [STRIPE-WEBHOOK] EMERGENCY FALLBACK: Completing onboarding directly');
  // Direct database update to prevent user being stuck
}
```

**Event Sourcing Pattern**:
```typescript
const subscriptionEvent = await EventService.createEvent({
  aggregateId: user.userId,
  aggregateType: AGGREGATE_TYPES.SUBSCRIPTION,
  eventType: EVENT_TYPES.SUBSCRIPTION_CREATED,
  correlationId,
  idempotencyKey: EventService.generateIdempotencyKey('stripe', subscription.id)
});
```

---

## CSV Export System

### Universal Export Handler
**Endpoint**: `GET /api/export/csv?jobId=uuid` or `?campaignId=uuid`

**Feature Gate Validation**:
```typescript
const gate = await FeatureGateService.assertExportFormat(userId, 'CSV');
if (!gate.allowed) {
  return NextResponse.json({
    error: 'CSV export not available on your plan',
    upgrade: true
  }, { status: 403 });
}
```

**Platform-Specific Formats**:

**TikTok Export Headers**:
```csv
Username,Followers,Bio,Email,Video URL,Description,Likes,Comments,Shares,Views,Hashtags,Created Date,Keywords,Platform
```

**YouTube Export Headers**:
```csv
Channel Name,Video Title,Video URL,Views,Duration (seconds),Published Date,Hashtags,Keywords,Platform
```

**Instagram Export Headers**:
```csv
Username,Full Name,Private,Verified,Platform,Search Type
```

---

## Webhook Handlers

### Clerk Webhooks
**Endpoint**: `POST /api/webhooks/clerk`

**Events Handled**:
- `user.created`: Create user profile with trial
- `user.updated`: Update user profile information
- `user.deleted`: Clean up user data

**Verification**:
```typescript
import { Webhook } from 'svix';

const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
const payload = webhook.verify(body, headers) as WebhookEvent;
```

---

### Stripe Webhooks
**Endpoint**: `POST /api/webhooks/stripe`

**Signature Validation**:
```typescript
const event = StripeService.validateWebhookSignature(body, signature);
```

**Event Processing**: Automatic subscription status updates, payment processing, and user plan changes.

---

## Common Patterns & Utilities

### Error Handling
**Standardized Error Response**:
```typescript
return NextResponse.json({
  error: 'Descriptive error message',
  details: 'Additional context',
  code: 'ERROR_CODE'
}, { status: 400 });
```

**Comprehensive Logging**:
```typescript
console.log('✅ [COMPONENT] Success message');
console.error('❌ [COMPONENT] Error details');
console.warn('⚠️ [COMPONENT] Warning message');
```

---

### Rate Limiting & Throttling
**QStash Job Delays**:
```typescript
await qstash.publishJSON({
  url: callbackUrl,
  body: { jobId },
  delay: '2s',
  retries: 3
});
```

**Sequential Processing**:
```typescript
// Add delay between API calls to respect rate limits
await new Promise(resolve => setTimeout(resolve, 100));
```

---

### Configuration Management
**Dynamic Configuration Loading**:
```typescript
import { SystemConfig } from '@/lib/config/system-config';

const timeout = await SystemConfig.get('timeouts', 'standard_job_timeout');
const maxCalls = await SystemConfig.get('api_limits', 'max_api_calls_tiktok');
```

**Hot-Reloadable Settings**: Configuration changes take effect immediately without deployment.

---

### Request/Response Logging
**API Call Logging** (Development):
```typescript
if (logApiCallSafe) {
  logApiCallSafe(
    'platform-searchtype',
    requestData,
    rawResponse,
    transformedData,
    metadata
  );
}
```

**Billing Logger Integration**:
```typescript
import BillingLogger from '@/lib/loggers/billing-logger';

await BillingLogger.logUsage('LIMIT_CHECK', 'Description', userId, metadata, requestId);
await BillingLogger.logAccess('GRANTED', 'Description', userId, metadata, requestId);
```

---

## Environment Configuration

### Required Environment Variables
```bash
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Database
DATABASE_URL=postgresql://user:pass@host:port/database

# QStash (Background Processing)
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=xxx
QSTASH_NEXT_SIGNING_KEY=xxx

# External APIs
SCRAPECREATORS_API_KEY=xxx
SCRAPECREATORS_API_URL=https://api.scrapecreators.com/v1/tiktok/search/keyword
SCRAPECREATORS_TIKTOK_SIMILAR_API_URL=https://api.scrapecreators.com/v1/tiktok/similar
SCRAPECREATORS_INSTAGRAM_API_URL=https://api.scrapecreators.com/v1/instagram/profile
SCRAPECREATORS_INSTAGRAM_REELS_API_URL=https://api.scrapecreators.com/v1/instagram/reels
SCRAPECREATORS_YOUTUBE_API_URL=https://api.scrapecreators.com/v1/youtube/search
SCRAPECREATORS_YOUTUBE_SIMILAR_API_URL=https://api.scrapecreators.com/v1/youtube/similar

# Image Processing
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Email System
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Billing
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Site Configuration  
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

---

## Testing & Development

### API Call Limits
**Development Limits**: Controlled via `SystemConfig`:
```typescript
const MAX_API_CALLS = await SystemConfig.get('api_limits', 'max_api_calls_testing');
```

**Production Configuration**: Remove or increase limits for full functionality.

### Local Development
**QStash Local Testing**: Use ngrok for webhook callbacks:
```bash
ngrok http 3000
# Update NEXT_PUBLIC_SITE_URL to ngrok URL
```

**Image Processing Testing**: Ensure `heic-convert` package is installed:
```bash
npm install heic-convert sharp
```

---

## Performance & Monitoring

### Image Caching Strategy
- **Cache Duration**: 1 hour for successful images, 5 minutes for placeholders
- **Blob Storage**: Permanent URLs via Vercel Blob Storage
- **Conversion Time**: Typically 200-500ms for HEIC conversion

### Job Processing Metrics
- **Timeout**: 1 hour per job (configurable)
- **Progress Updates**: Real-time via database polling
- **Retry Logic**: 3 retries per QStash message

### Error Recovery
- **Stalled Job Detection**: 5-minute inactivity threshold
- **Automatic Requeue**: Failed jobs are automatically restarted
- **Graceful Degradation**: Fallback to basic data if enhancement fails

---

## API Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Missing parameters, invalid JSON |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Plan limits exceeded, admin access required |
| 404 | Not Found | Job/campaign not found or unauthorized |
| 500 | Internal Server Error | Database errors, external API failures |

---

## Troubleshooting Common Issues

### Stuck Jobs
**Symptoms**: Jobs remain in 'processing' status indefinitely
**Solution**: Check QStash message delivery and webhook accessibility

### Image Loading Failures
**Symptoms**: Broken images or 403 errors
**Solution**: Verify image proxy is functioning and HEIC conversion is working

### Plan Validation Errors
**Symptoms**: Unexpected 403 responses for valid plans
**Solution**: Check user profile creation and plan assignment

### Email Delivery Issues
**Symptoms**: Trial emails not sending
**Solution**: Verify Resend API key and from email configuration

---

This documentation covers the complete API architecture of the Influencer Platform. For implementation details of specific endpoints, refer to the individual route files in the `/app/api` directory.
