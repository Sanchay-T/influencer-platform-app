# 🚀 API Documentation - Influencer Platform

## Overview

This document provides comprehensive documentation for the Influencer Platform API architecture. The platform supports multi-platform influencer search (TikTok, Instagram, YouTube), admin management, billing/subscription systems, and background job processing through QStash integration.

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
2. **Platform Detection**: Route to appropriate handler
3. **API Calls**: Make external API requests with rate limiting
4. **Data Transformation**: Convert to unified format
5. **Image Caching**: Cache profile images in Vercel Blob Storage
6. **Bio Enhancement**: Individual profile calls for complete data
7. **Progress Updates**: Real-time status and progress tracking
8. **Completion**: Mark job as completed or schedule continuation

**Unified Progress Calculation**:
```typescript
function calculateUnifiedProgress(processedRuns, maxRuns, processedResults, targetResults) {
  const apiCallsProgress = (processedRuns / maxRuns) * 100 * 0.3;
  const resultsProgress = (processedResults / targetResults) * 100 * 0.7;
  return Math.min(apiCallsProgress + resultsProgress, 100);
}
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

**Response**:
```json
{
  "currentPlan": "pro",
  "trialStatus": "active",
  "trialExpiresAt": "2025-01-08T10:00:00Z",
  "usage": {
    "creators": 450,
    "campaigns": 5
  },
  "limits": {
    "creators": 1000,
    "campaigns": 10
  }
}
```

**Features**:
- Auto-creates user profile if missing
- Fetches Clerk user details for defaults
- Includes comprehensive trial information

---

### Stripe Integration
**Base Endpoints**: `/api/stripe/*`

**Create Checkout Session**: `POST /api/stripe/create-checkout`
**Upgrade Direct**: `POST /api/stripe/upgrade-direct`
**Customer Portal**: `GET /api/stripe/customer-portal`
**Webhook Handler**: `POST /api/stripe/webhook`

**Webhook Events Handled**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `setup_intent.succeeded`

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