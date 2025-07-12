# 🔄 QStash Implementation - Complete Background Job System

## Overview
Complete QStash implementation for serverless background job processing covering webhook handling, signature verification, job lifecycle management, and platform-specific processing workflows.

## 🏗️ QStash Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    QSTASH BACKGROUND PROCESSING                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend Request                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   API Endpoint  │                                           │
│  │                 │                                           │
│  │ /api/scraping/  │                                           │
│  │   tiktok        │                                           │
│  │   instagram     │                                           │
│  │   youtube       │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Create Job    │────│   QStash        │                    │
│  │   in Database   │    │   Message       │                    │
│  │                 │    │   Queue         │                    │
│  │  status: pending│    │                 │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                        │                             │
│         ▼                        ▼                             │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Return Job    │    │   QStash        │                    │
│  │   ID to User    │    │   Delivers      │                    │
│  │                 │    │   Webhook       │                    │
│  │  jobId: uuid    │    │                 │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                    │
│                          │   Webhook       │                    │
│                          │   Received      │                    │
│                          │                 │                    │
│                          │ /api/qstash/    │                    │
│                          │ process-scraping│                    │
│                          └─────────────────┘                    │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                    │
│                          │   Signature     │                    │
│                          │   Verification  │                    │
│                          │                 │                    │
│                          │ Upstash-Signature│                    │
│                          └─────────────────┘                    │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                    │
│                          │   Load Job      │                    │
│                          │   from DB       │                    │
│                          │                 │                    │
│                          │ status: processing│                   │
│                          └─────────────────┘                    │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                    │
│                          │   Platform      │                    │
│                          │   Processing    │                    │
│                          │                 │                    │
│                          │ TikTok/IG/YT API│                    │
│                          └─────────────────┘                    │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                    │
│                          │   Save Results  │                    │
│                          │   Update Status │                    │
│                          │                 │                    │
│                          │ status: completed│                   │
│                          └─────────────────┘                    │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                    │
│                          │   Schedule      │                    │
│                          │   Next Call     │                    │
│                          │   (if needed)   │                    │
│                          │                 │                    │
│                          │ delay: 2s       │                    │
│                          └─────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 QStash Client Configuration

### File: `lib/queue/qstash.ts`

**Simple QStash Client Setup**:
```typescript
import { Client } from '@upstash/qstash';

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!
});
```

**Usage in API Routes**:
```typescript
import { qstash } from '@/lib/queue/qstash';

// Publish message to queue
const result = await qstash.publishJSON({
  url: callbackUrl,
  body: { jobId },
  retries: 3,
  notifyOnFailure: true,
  delay: '2s'  // Optional delay
});
```

## 🎯 Job Creation Flow

### Platform API Endpoints - Job Initiation

#### **File: `app/api/scraping/tiktok/route.ts`**

**Complete Job Creation Pattern**:
```typescript
export async function POST(req: Request) {
  try {
    // Step 1: Authentication Check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Parse Request Body
    const body = await req.json();
    const { keywords, targetResults = 1000, campaignId } = body;

    // Step 3: Validate Input
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords are required and must be an array' },
        { status: 400 }
      );
    }

    // Step 4: Verify Campaign Ownership
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId)
      )
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or unauthorized' },
        { status: 404 }
      );
    }

    // Step 5: Load Dynamic Configuration
    const TIMEOUT_MINUTES = await SystemConfig.get('timeouts', 'standard_job_timeout') / (60 * 1000);

    // Step 6: Create Job in Database
    const [job] = await db.insert(scrapingJobs).values({
      userId,
      keywords: sanitizedKeywords,
      targetResults,
      status: 'pending',
      processedRuns: 0,
      processedResults: 0,
      platform: 'TikTok',
      region: 'US',
      campaignId,
      createdAt: new Date(),
      updatedAt: new Date(),
      cursor: 0,
      timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
    }).returning();

    // Step 7: Queue Job in QStash
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
    const qstashCallbackUrl = `${siteUrl}/api/qstash/process-scraping`;
    
    const result = await qstash.publishJSON({
      url: qstashCallbackUrl,
      body: { jobId: job.id },
      retries: 3,
      notifyOnFailure: true
    });

    // Step 8: Return Job ID
    return NextResponse.json({
      message: 'Scraping job started successfully',
      jobId: job.id,
      qstashMessageId: result.messageId
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

#### **Key Features**:
- ✅ **Authentication**: Clerk user verification
- ✅ **Input Validation**: Keywords, campaign ownership
- ✅ **Dynamic Config**: Timeout and limits from database
- ✅ **Database Transaction**: Job creation with proper fields
- ✅ **QStash Queuing**: Message publishing with retry logic
- ✅ **Error Handling**: Comprehensive error responses

### Job Status Polling

#### **GET Endpoint Pattern**:
```typescript
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    // Get job with results (user-scoped)
    const job = await db.query.scrapingJobs.findFirst({
      where: and(
        eq(scrapingJobs.id, jobId),
        eq(scrapingJobs.userId, userId)
      ),
      with: {
        results: true
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check for timeout
    if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
      if (job.status === 'processing' || job.status === 'pending') {
        await db.update(scrapingJobs)
          .set({ 
            status: 'timeout',
            error: 'Job exceeded maximum allowed time',
            completedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        
        return NextResponse.json({ 
          status: 'timeout',
          error: 'Job exceeded maximum allowed time'
        });
      }
    }

    return NextResponse.json({
      status: job.status,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      error: job.error,
      results: job.results,
      progress: parseFloat(job.progress || '0')
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## 🔐 Webhook Processing System

### File: `app/api/qstash/process-scraping/route.ts`

#### **Complete Webhook Handler**:

**1. Signature Verification Setup**:
```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});
```

**2. Webhook Request Processing**:
```typescript
export async function POST(req: Request) {
  console.log('🚀 [QSTASH-WEBHOOK] RECEIVED POST REQUEST');
  console.log('📅 [QSTASH-WEBHOOK] Timestamp:', new Date().toISOString());
  
  // Step 1: Extract Signature
  const signature = req.headers.get('Upstash-Signature');
  if (!signature) {
    console.error('❌ QStash signature not provided');
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  try {
    // Step 2: Get Base URL
    const currentHost = req.headers.get('host') || process.env.VERCEL_URL;
    const protocol = currentHost.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${currentHost}`;
    
    // Step 3: Read Request Body
    const body = await req.text();
    console.log('📝 Request body length:', body.length);
    
    // Step 4: Verify QStash Signature
    const isValid = await receiver.verify({
      signature,
      body,
      url: `${baseUrl}/api/qstash/process-scraping`
    });

    if (!isValid) {
      console.error('❌ Invalid QStash signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Step 5: Parse JSON Body
    const data = JSON.parse(body);
    const jobId = data.jobId;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Step 6: Load Job from Database
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId)
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log('📋 Job loaded:', {
      id: job.id,
      platform: job.platform,
      status: job.status,
      keywords: job.keywords,
      targetUsername: job.targetUsername
    });

    // Step 7: Platform-Specific Processing
    return await processJobByPlatform(job, jobId);

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

#### **Platform Routing Logic**:
```typescript
async function processJobByPlatform(job: any, jobId: string) {
  // Route to platform-specific handlers
  if (job.platform === 'YouTube' && job.keywords) {
    return await processYouTubeJob(job, jobId);
  } 
  else if (job.platform === 'YouTube' && job.targetUsername) {
    return await processYouTubeSimilarJob(job, jobId);
  }
  else if (job.platform === 'TikTok' && job.targetUsername) {
    return await processTikTokSimilarJob(job, jobId);
  }
  else if (job.platform === 'Instagram' && job.targetUsername) {
    return await processInstagramSimilarJob(job, jobId);
  }
  else if (job.platform === 'TikTok' && job.keywords) {
    // Inline TikTok keyword processing
    return await processTikTokKeywordInline(job, jobId);
  }
  else {
    throw new Error(`Unsupported platform or search type: ${job.platform}`);
  }
}
```

## 🎯 Platform-Specific Processing

### TikTok Keyword Processing (Inline)

#### **Complete Processing Logic**:
```typescript
async function processTikTokKeywordInline(job: any, jobId: string) {
  console.log('🎬 [TIKTOK-KEYWORD] Starting TikTok keyword processing');
  
  try {
    // Step 1: Load Configuration
    const MAX_API_CALLS = await SystemConfig.get('api', 'max_api_calls_testing');
    
    // Step 2: Check Processing Limits
    if (job.processedRuns >= MAX_API_CALLS) {
      console.log('🏁 [TIKTOK-KEYWORD] Max API calls reached, completing job');
      return await markJobCompleted(jobId);
    }

    // Step 3: Update Job Status
    await db.update(scrapingJobs)
      .set({
        status: 'processing',
        startedAt: job.startedAt || new Date(),
        updatedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));

    // Step 4: Prepare API Call
    const keywords = Array.isArray(job.keywords) ? job.keywords.join(',') : job.keywords;
    const cursor = job.cursor || 0;
    
    const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywords)}&cursor=${cursor}`;
    
    console.log('🔍 [TIKTOK-KEYWORD] API Request:', {
      url: apiUrl,
      keywords,
      cursor,
      processedRuns: job.processedRuns
    });

    // Step 5: Make API Call
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'x-api-key': process.env.SCRAPECREATORS_API_KEY!
      }
    });

    if (!apiResponse.ok) {
      throw new Error(`TikTok API error: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const data = await apiResponse.json();
    
    // Step 6: Log Raw API Data
    logApiCall('tiktok', 'keyword', { keywords, cursor }, data);

    // Step 7: Transform Data with Bio Enhancement
    const creators = await transformTikTokDataWithBioEnhancement(data.search_item_list || []);
    
    // Step 8: Save Results
    if (creators.length > 0) {
      await db.insert(scrapingResults).values({
        jobId,
        creators
      });
    }

    // Step 9: Update Progress
    const newProcessedRuns = job.processedRuns + 1;
    const newProcessedResults = (job.processedResults || 0) + creators.length;
    const newCursor = data.cursor || cursor + 1;
    
    const progress = calculateUnifiedProgress(
      newProcessedRuns, MAX_API_CALLS,
      newProcessedResults, job.targetResults
    );

    await db.update(scrapingJobs)
      .set({
        processedRuns: newProcessedRuns,
        processedResults: newProcessedResults,
        cursor: newCursor,
        progress: progress.toString(),
        updatedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));

    // Step 10: Schedule Next Call or Complete
    if (newProcessedRuns < MAX_API_CALLS && newProcessedResults < job.targetResults) {
      console.log('🔄 [TIKTOK-KEYWORD] Scheduling next API call');
      
      await qstash.publishJSON({
        url: callbackUrl,
        body: { jobId },
        delay: '2s',
        retries: 3
      });
      
      return NextResponse.json({ 
        status: 'processing', 
        progress,
        processedResults: newProcessedResults,
        nextCall: 'scheduled'
      });
    } else {
      console.log('✅ [TIKTOK-KEYWORD] Job completed');
      return await markJobCompleted(jobId);
    }

  } catch (error) {
    console.error('❌ [TIKTOK-KEYWORD] Processing error:', error);
    return await markJobFailed(jobId, error.message);
  }
}
```

### Bio Enhancement System

#### **Enhanced Profile Fetching**:
```typescript
async function transformTikTokDataWithBioEnhancement(searchItems: any[]) {
  const creators = [];
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;

  // Sequential processing to avoid rate limits
  for (let i = 0; i < searchItems.length; i++) {
    const item = searchItems[i];
    const awemeInfo = item.aweme_info || {};
    const author = awemeInfo.author || {};
    
    // Extract basic bio and emails
    const initialBio = author.signature || '';
    let extractedEmails = initialBio.match(emailRegex) || [];

    // Enhanced Profile Fetching: If no bio found, try to get full profile data
    let enhancedBio = initialBio;
    let enhancedEmails = extractedEmails;

    if (!initialBio && author.unique_id) {
      try {
        console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full profile for @${author.unique_id}`);
        
        const profileApiUrl = `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(author.unique_id)}`;
        const profileResponse = await fetch(profileApiUrl, {
          headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const profileUser = profileData.user || {};
          
          enhancedBio = profileUser.signature || profileUser.desc || profileUser.bio || '';
          const enhancedEmailMatches = enhancedBio.match(emailRegex) || [];
          enhancedEmails = enhancedEmailMatches;
          
          console.log(`✅ [PROFILE-FETCH] Successfully fetched profile for @${author.unique_id}:`, {
            bioFound: !!enhancedBio,
            bioLength: enhancedBio.length,
            emailsFound: enhancedEmails.length,
            bioPreview: enhancedBio.substring(0, 50) + '...'
          });
        }
      } catch (profileError) {
        console.log(`❌ [PROFILE-FETCH] Error fetching profile for @${author.unique_id}:`, profileError.message);
      }
    }

    // Create enhanced creator object
    const creatorData = {
      creator: {
        name: author.nickname || author.unique_id || 'Unknown Creator',
        followers: author.follower_count || 0,
        avatarUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg'),
        profilePicUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg'),
        bio: enhancedBio,                    // ✅ Enhanced bio from profile API
        emails: enhancedEmails,              // ✅ Extracted emails array
        uniqueId: author.unique_id || '',
        verified: author.is_verified || false
      },
      video: {
        description: awemeInfo.desc || 'No description',
        url: awemeInfo.share_url || '',
        statistics: {
          likes: awemeInfo.statistics?.digg_count || 0,
          comments: awemeInfo.statistics?.comment_count || 0,
          shares: awemeInfo.statistics?.share_count || 0,
          views: awemeInfo.statistics?.play_count || 0
        }
      },
      hashtags: awemeInfo.text_extra?.filter(e => e.type === 1).map(e => e.hashtag_name) || [],
      platform: 'TikTok'
    };

    creators.push(creatorData);
    
    // Add delay between profile API calls
    if (i < searchItems.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }
  }

  return creators;
}
```

## 📊 Progress Calculation System

### Unified Progress Formula

#### **Multi-Factor Progress Calculation**:
```typescript
function calculateUnifiedProgress(processedRuns, maxRuns, processedResults, targetResults) {
  // API calls progress (30% weight)
  const apiCallsProgress = maxRuns > 0 ? (processedRuns / maxRuns) * 100 * 0.3 : 0;
  
  // Results progress (70% weight)
  const resultsProgress = targetResults > 0 ? (processedResults / targetResults) * 100 * 0.7 : 0;
  
  // Combined progress, capped at 100%
  const totalProgress = Math.min(apiCallsProgress + resultsProgress, 100);
  
  console.log('📊 [UNIFIED-PROGRESS] Calculation:', {
    processedRuns,
    maxRuns,
    processedResults,
    targetResults,
    apiCallsProgress: Math.round(apiCallsProgress * 10) / 10,
    resultsProgress: Math.round(resultsProgress * 10) / 10,
    totalProgress: Math.round(totalProgress * 10) / 10,
    formula: `(${processedRuns}/${maxRuns} × 30%) + (${processedResults}/${targetResults} × 70%) = ${Math.round(totalProgress)}%`
  });
  
  return totalProgress;
}
```

**Progress Examples**:
```
Initial: 0 API calls, 0 results = 0%
Mid-processing: 1/1 API calls, 50/1000 results = 30% + 3.5% = 33.5%
Completed: 1/1 API calls, 1000/1000 results = 30% + 70% = 100%
```

## 🔄 Job Lifecycle Management

### Job Status Flow

```
pending → processing → completed
                   ↘ error
                   ↘ timeout
```

#### **Status Update Functions**:

**Mark Job as Completed**:
```typescript
async function markJobCompleted(jobId: string) {
  await db.update(scrapingJobs)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      progress: '100'
    })
    .where(eq(scrapingJobs.id, jobId));

  console.log('✅ [JOB-LIFECYCLE] Job marked as completed:', jobId);
  
  return NextResponse.json({ 
    status: 'completed',
    message: 'Job completed successfully'
  });
}
```

**Mark Job as Failed**:
```typescript
async function markJobFailed(jobId: string, errorMessage: string) {
  await db.update(scrapingJobs)
    .set({
      status: 'error',
      error: errorMessage,
      completedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(scrapingJobs.id, jobId));

  console.error('❌ [JOB-LIFECYCLE] Job marked as failed:', { jobId, errorMessage });
  
  return NextResponse.json({ 
    status: 'error',
    error: errorMessage
  }, { status: 500 });
}
```

**Timeout Handling**:
```typescript
// In job status polling
if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
  if (job.status === 'processing' || job.status === 'pending') {
    await db.update(scrapingJobs)
      .set({ 
        status: 'timeout',
        error: 'Job exceeded maximum allowed time',
        completedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));
  }
}
```

## 🔧 Configuration Management

### Environment Variables

#### **Required QStash Settings**:
```bash
# QStash Configuration
QSTASH_URL="https://qstash.upstash.io"
QSTASH_TOKEN="qstash_token_here"
QSTASH_CURRENT_SIGNING_KEY="current_signing_key"
QSTASH_NEXT_SIGNING_KEY="next_signing_key"

# Application URLs
NEXT_PUBLIC_SITE_URL="https://your-app.vercel.app"
VERCEL_URL="your-app.vercel.app"

# External APIs
SCRAPECREATORS_API_KEY="api_key_here"
SCRAPECREATORS_API_URL="https://api.scrapecreators.com/v1/tiktok/search/keyword"
```

### Dynamic Configuration

#### **System Config Integration**:
```typescript
import { SystemConfig } from '@/lib/config/system-config';

// Load configuration values dynamically
const MAX_API_CALLS = await SystemConfig.get('api', 'max_api_calls_testing');
const TIMEOUT_MINUTES = await SystemConfig.get('timeouts', 'standard_job_timeout') / (60 * 1000);
const DELAY_BETWEEN_CALLS = await SystemConfig.get('api', 'delay_between_calls') || '2s';
```

## 🛡️ Security & Error Handling

### Signature Verification

#### **Multi-Layer Security**:
```typescript
// 1. Check signature exists
const signature = req.headers.get('Upstash-Signature');
if (!signature) {
  return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
}

// 2. Verify signature with correct URL
const isValid = await receiver.verify({
  signature,
  body,
  url: `${baseUrl}/api/qstash/process-scraping`
});

if (!isValid) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}

// 3. Validate job ownership (user isolation)
const job = await db.query.scrapingJobs.findFirst({
  where: and(
    eq(scrapingJobs.id, jobId),
    eq(scrapingJobs.userId, userId)
  )
});
```

### Error Recovery

#### **Automatic Retry Logic**:
```typescript
// QStash message with retry configuration
await qstash.publishJSON({
  url: callbackUrl,
  body: { jobId },
  retries: 3,                    // Automatic retries
  notifyOnFailure: true,         // Failure notifications
  delay: '2s'                    // Delay between calls
});
```

#### **Job Recovery System**:
```typescript
// Detect stalled jobs (optional, currently disabled)
if (job.status === 'processing' && 
    (new Date().getTime() - new Date(job.updatedAt).getTime()) > 5 * 60 * 1000) {
  
  console.log('🔄 Reactivating stalled job');
  
  // Update timestamp to prevent multiple reactivations
  await db.update(scrapingJobs)
    .set({ 
      updatedAt: new Date(),
      error: 'Process restarted after interruption'
    })
    .where(eq(scrapingJobs.id, jobId));
  
  // Re-queue the job
  await qstash.publishJSON({
    url: callbackUrl,
    body: { jobId },
    delay: '5s',
    retries: 3
  });
}
```

## 📊 Logging & Monitoring

### Comprehensive Logging

#### **API Data Logging**:
```typescript
function logApiCall(platform: string, searchType: string, request: any, response: any) {
  try {
    const logDir = path.join(process.cwd(), 'logs/api-raw', searchType);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${platform}-${timestamp}.json`;
    const filepath = path.join(logDir, filename);
    
    const logData = {
      timestamp: new Date().toISOString(),
      platform,
      searchType,
      request,
      response
    };
    
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
    
    console.log('🚨 RAW API DATA SAVED TO FILE');
    console.log(`🔥 PLATFORM: ${platform.toUpperCase()}`);
    console.log(`🔥 FULL FILE PATH: ${filepath}`);
    console.log(`🔥 REQUEST SIZE: ${JSON.stringify(request).length} characters`);
    console.log(`🔥 RESPONSE SIZE: ${JSON.stringify(response).length} characters`);
    
  } catch (error) {
    console.error('❌ [INLINE-LOGGING] Failed to save API data:', error);
  }
}
```

#### **Job Processing Logs**:
```typescript
console.log('🚀 [QSTASH-WEBHOOK] RECEIVED POST REQUEST');
console.log('📅 [QSTASH-WEBHOOK] Timestamp:', new Date().toISOString());
console.log('🔑 [QSTASH-WEBHOOK] QStash headers present:', {
  signature: !!req.headers.get('Upstash-Signature'),
  messageId: req.headers.get('Upstash-Message-Id'),
  timestamp: req.headers.get('Upstash-Timestamp')
});
```

### Performance Monitoring

#### **Processing Time Tracking**:
```typescript
const startTime = Date.now();

// ... processing logic ...

const processingTime = Date.now() - startTime;
console.log(`⏱️ [PERFORMANCE] Total processing time: ${processingTime}ms`);
```

#### **Memory Usage Monitoring**:
```typescript
console.log('💾 [MEMORY] Usage:', {
  used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
  total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
});
```

## 🎯 Best Practices

### 1. **Rate Limiting**
```typescript
// Sequential processing to avoid API rate limits
for (let i = 0; i < items.length; i++) {
  await processItem(items[i]);
  
  // Add delay between API calls
  if (i < items.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### 2. **Error Handling**
```typescript
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('❌ [API-ERROR]', error);
  
  // Specific error handling
  if (error.status === 429) {
    // Rate limit - schedule retry with longer delay
    await qstash.publishJSON({
      url: callbackUrl,
      body: { jobId },
      delay: '10s'
    });
  } else {
    // Other errors - mark job as failed
    await markJobFailed(jobId, error.message);
  }
}
```

### 3. **Resource Management**
```typescript
// Use AbortController for request timeouts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { ... }
  });
} finally {
  clearTimeout(timeoutId);
}
```

---

**Next**: Continue with [Job Processing Patterns](./job-processing.md) for detailed platform-specific processing workflows and advanced patterns.