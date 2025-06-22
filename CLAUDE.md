# TikTok Influencer Platform - Complete Technical Documentation

## Overview
This document details the complete end-to-end flow for TikTok influencer campaign creation, background processing, and results display. Use this as a blueprint for implementing similar functionality for other platforms (Instagram, YouTube, etc.).

## Architecture Overview

```mermaid
graph TD
    A[User Creates Campaign] --> B[Campaign Saved to DB]
    B --> C[User Configures Keywords]
    C --> D[Scraping Job Created]
    D --> E[QStash Message Published]
    E --> F[Background Processing]
    F --> G[ScrapeCreators API Call]
    G --> H[Data Transformation]
    H --> I[Results Saved to DB]
    I --> J[Job Status Updated]
    J --> K[Frontend Displays Results]
```

## Database Schema

### Core Tables
```sql
-- Main campaigns table
campaigns {
  id: uuid (PK)
  userId: uuid
  name: text
  description: text
  searchType: varchar ('keyword' | 'similar')
  status: varchar ('draft' | 'active' | 'completed')
  createdAt: timestamp
  updatedAt: timestamp
}

-- Background processing jobs
scrapingJobs {
  id: uuid (PK)
  userId: text
  campaignId: uuid (FK -> campaigns.id)
  keywords: jsonb (string[])
  platform: varchar ('Tiktok' | 'Instagram')
  status: varchar ('pending' | 'processing' | 'completed' | 'error')
  processedRuns: integer (tracks API calls made)
  processedResults: integer (total creators found)
  targetResults: integer (goal: 100, 500, 1000)
  cursor: integer (pagination for API)
  progress: decimal (0-100)
  timeoutAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
  error: text
}

-- Final results storage
scrapingResults {
  id: uuid (PK)
  jobId: uuid (FK -> scrapingJobs.id)
  creators: jsonb (CreatorResult[] | InstagramRelatedProfile[])
  createdAt: timestamp
}
```

## Complete End-to-End Flow

### 1. Campaign Creation Flow

#### Frontend: `/app/campaigns/new/page.jsx`
- Renders `CampaignForm` component
- User fills: name, description, search type

#### Component: `/app/components/campaigns/campaign-form.jsx`
```javascript
// Step 1: Basic campaign info
const handleSubmitBasicInfo = (e) => {
  e.preventDefault();
  setStep(2); // Move to search type selection
};

// Step 2: Search type selection
const handleSearchTypeSelection = async (type) => {
  // Create campaign via API
  const response = await fetch('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      name: formData.name,
      description: formData.description,
      searchType: type, // 'keyword' or 'similar'
    }),
  });

  // Save to sessionStorage for next steps
  sessionStorage.setItem('currentCampaign', JSON.stringify(campaign));
  
  // Redirect to search configuration
  router.push('/campaigns/search/keyword');
};
```

#### API: `/app/api/campaigns/route.ts`
```javascript
export async function POST(req: Request) {
  // 1. Authenticate user via Supabase
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 2. Create campaign record
  const [campaign] = await db.insert(campaigns).values({
    userId: user.id,
    name,
    description,
    searchType, // 'keyword' | 'similar'
    status: 'draft'
  }).returning();

  return NextResponse.json(campaign);
}
```

### 2. Keyword Configuration Flow

#### Frontend: `/app/campaigns/search/keyword/page.jsx`
```javascript
// Multi-step process:
// Step 1: Platform & creator count selection
// Step 2: Keyword input and review  
// Step 3: Results display

const handleKeywordsSubmit = async (keywords) => {
  const response = await fetch('/api/scraping/tiktok', {
    method: 'POST',
    body: JSON.stringify({
      campaignId: campaignId,
      keywords: keywords, // ['nike', 'fashion', 'sports']
      targetResults: searchData.creatorsCount // 100, 500, or 1000
    }),
  });
  
  const data = await response.json();
  setSearchData(prev => ({ 
    ...prev, 
    jobId: data.jobId // Store for polling
  }));
  setStep(3); // Move to results display
};
```

#### Component: `/app/components/campaigns/keyword-search/keyword-search-form.jsx`
```javascript
// Configures:
// - Platform selection (TikTok checked by default)
// - Creator count slider (100-1000)
// - Validates input before submission
```

### 3. Scraping Job Creation & QStash Integration

#### API: `/app/api/scraping/tiktok/route.ts`
```javascript
export async function POST(req: Request) {
  // 1. Authentication & validation
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 2. Parse and validate request
  const { keywords, targetResults, campaignId } = await req.json();
  
  // 3. Verify campaign ownership
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.userId, user.id)
    )
  });

  // 4. Create scraping job
  const [job] = await db.insert(scrapingJobs).values({
    userId: user.id,
    keywords: sanitizedKeywords,
    targetResults, // 100, 500, or 1000
    status: 'pending',
    platform: 'Tiktok',
    campaignId,
    processedRuns: 0,
    processedResults: 0,
    cursor: 0,
    timeoutAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour timeout
  }).returning();

  // 5. Publish to QStash for background processing
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  const result = await qstash.publishJSON({
    url: `${siteUrl}/api/qstash/process-scraping`,
    body: { jobId: job.id },
    retries: 3,
    notifyOnFailure: true
  });

  return NextResponse.json({
    message: 'Scraping job started successfully',
    jobId: job.id,
    qstashMessageId: result.messageId
  });
}
```

### 4. Background Processing with QStash

#### API: `/app/api/qstash/process-scraping/route.ts`

##### Core Processing Logic
```javascript
export async function POST(req: Request) {
  // 1. Verify QStash signature
  const signature = req.headers.get('Upstash-Signature');
  const body = await req.text();
  const isValid = await receiver.verify({
    signature,
    body,
    url: `${baseUrl}/api/qstash/process-scraping`
  });

  // 2. Extract job ID and fetch job
  const { jobId } = JSON.parse(body);
  const job = await db.query.scrapingJobs.findFirst({
    where: eq(scrapingJobs.id, jobId)
  });

  // 3. Check if job already completed or hit testing limits
  if (job.status === 'completed' || job.status === 'error') {
    return NextResponse.json({ status: job.status });
  }

  // TESTING LIMIT CHECK
  const currentRuns = job.processedRuns || 0;
  if (currentRuns >= MAX_API_CALLS_FOR_TESTING) {
    await db.update(scrapingJobs).set({ 
      status: 'completed',
      completedAt: new Date(),
      error: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made`
    }).where(eq(scrapingJobs.id, jobId));
    return NextResponse.json({ status: 'completed' });
  }

  // 4. Platform-specific processing
  if (job.platform === 'Tiktok') {
    await processTikTokJob(job, jobId);
  } else if (job.platform === 'Instagram') {
    await processInstagramJob(job, jobId);
  }
}
```

##### TikTok-Specific Processing
```javascript
async function processTikTokJob(job, jobId) {
  // 1. Update job status to processing
  await db.update(scrapingJobs).set({ 
    status: 'processing',
    startedAt: new Date(),
    updatedAt: new Date()
  }).where(eq(scrapingJobs.id, jobId));

  // 2. Call ScrapeCreators API
  const keywordQuery = job.keywords.join(', ');
  const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywordQuery)}&cursor=${job.cursor || 0}`;
  
  const scrapingResponse = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'x-api-key': process.env.SCRAPECREATORS_API_KEY!
    }
  });

  const apiResponse = await scrapingResponse.json();

  // 3. Transform API response to match frontend expectations
  const creators = apiResponse.search_item_list.map((item) => {
    const awemeInfo = item.aweme_info || {};
    const author = awemeInfo.author || {};
    const statistics = awemeInfo.statistics || {};
    
    return {
      // Frontend expects: creator.creator?.name
      creator: {
        name: author.nickname || author.unique_id || 'Unknown Creator',
        followers: author.follower_count || 0,
        avatarUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg'),
        profilePicUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg')
      },
      // Frontend expects: creator.video?.description, etc.
      video: {
        description: awemeInfo.desc || 'No description',
        url: awemeInfo.share_url || '',
        statistics: {
          likes: statistics.digg_count || 0,
          comments: statistics.comment_count || 0,
          shares: statistics.share_count || 0,
          views: statistics.play_count || 0
        }
      },
      // Frontend expects: creator.hashtags
      hashtags: awemeInfo.text_extra
        ?.filter((extra) => extra.type === 1 && extra.hashtag_name)
        ?.map((extra) => extra.hashtag_name) || [],
      // Additional metadata
      createTime: awemeInfo.create_time || Date.now() / 1000,
      platform: 'TikTok',
      keywords: job.keywords || []
    };
  });

  // 4. Save results to database
  await db.insert(scrapingResults).values({
    jobId: job.id,
    creators: creators,
    createdAt: new Date()
  });

  // 5. Update job progress
  const newProcessedRuns = (job.processedRuns || 0) + 1;
  const totalProcessedResults = (job.processedResults || 0) + creators.length;
  
  await db.update(scrapingJobs).set({ 
    processedRuns: newProcessedRuns,
    processedResults: totalProcessedResults,
    updatedAt: new Date()
  }).where(eq(scrapingJobs.id, jobId));

  // 6. Check if we should continue or complete
  if (newProcessedRuns >= MAX_API_CALLS_FOR_TESTING || 
      totalProcessedResults >= job.targetResults) {
    // Complete the job
    await db.update(scrapingJobs).set({ 
      status: 'completed',
      completedAt: new Date(),
      progress: '100'
    }).where(eq(scrapingJobs.id, jobId));
  } else {
    // Schedule next API call
    await qstash.publishJSON({
      url: `${baseUrl}/api/qstash/process-scraping`,
      body: { jobId: job.id },
      delay: '2s', // Short delay between calls
      retries: 3,
      notifyOnFailure: true
    });
  }
}
```

### 5. Results Display & Polling

#### Frontend: `/app/components/campaigns/keyword-search/search-results.jsx`
```javascript
// Polls for job completion
useEffect(() => {
  const fetchResults = async () => {
    const response = await fetch(`/api/scraping/tiktok?jobId=${searchData.jobId}`);
    const data = await response.json();

    if (data.status === 'completed') {
      // Combine all creators from all results
      const allCreators = data.results?.reduce((acc, result) => {
        return [...acc, ...(result.creators || [])];
      }, []) || [];
      
      setCreators(allCreators);
      setIsLoading(false);
    }
  };

  const interval = setInterval(fetchResults, 3000); // Poll every 3 seconds
  return () => clearInterval(interval);
}, [searchData.jobId]);
```

#### API: `/app/api/scraping/tiktok/route.ts` (GET)
```javascript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  // Get job with results
  const job = await db.query.scrapingJobs.findFirst({
    where: eq(scrapingJobs.id, jobId),
    with: {
      results: {
        columns: {
          id: true,
          jobId: true,
          creators: true,
          createdAt: true
        }
      }
    }
  });

  // Check for timeouts and stalled jobs
  if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
    if (job.status === 'processing' || job.status === 'pending') {
      await db.update(scrapingJobs).set({ 
        status: 'timeout',
        error: 'Job exceeded maximum allowed time'
      }).where(eq(scrapingJobs.id, jobId));
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
}
```

### 6. Image Proxying System

#### API: `/app/api/proxy/image/route.ts`
```javascript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  // Fetch image with proper headers
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });

  const arrayBuffer = await response.arrayBuffer();
  let buffer = Buffer.from(arrayBuffer);
  let contentType = response.headers.get('content-type') || 'image/jpeg';

  // Return proxied image with CORS headers
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

## Key Configuration Files

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# QStash (Background Processing)
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=xxx
QSTASH_NEXT_SIGNING_KEY=xxx

# External APIs
SCRAPECREATORS_API_URL=https://api.scrapecreators.com/v1/tiktok/search/keyword
SCRAPECREATORS_API_KEY=xxx

# Deployment
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
VERCEL_URL=your-app.vercel.app
```

### QStash Configuration: `/lib/queue/qstash.ts`
```javascript
import { Client } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});
```

### Database Connection: `/lib/db/index.ts`
```javascript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

## Testing & Development Configuration

### Testing Limits
```javascript
// In /app/api/qstash/process-scraping/route.ts
const MAX_API_CALLS_FOR_TESTING = 1; // Limits to 1 API call for testing

// For production, either:
// 1. Set to high number: const MAX_API_CALLS_FOR_TESTING = 999;
// 2. Or remove the limit check entirely
```

### Local Development with QStash
```bash
# Option 1: Use ngrok tunnel
ngrok http 3000
# Update NEXT_PUBLIC_SITE_URL to ngrok URL

# Option 2: Use Vercel dev
vercel dev
# QStash can reach vercel dev URLs
```

## Implementation Guide for Other Platforms (Instagram)

### 1. Database Changes
```sql
-- Add new platform option
ALTER TABLE scraping_jobs 
ALTER COLUMN platform TYPE varchar(50);
-- Now supports 'Tiktok' | 'Instagram' | 'YouTube' etc.

-- Add platform-specific fields if needed
ALTER TABLE scraping_jobs 
ADD COLUMN target_username text; -- For Instagram similar search
```

### 2. API Endpoint Structure
```
/app/api/scraping/instagram/route.ts (similar to tiktok/route.ts)
├── POST: Create Instagram scraping job
└── GET: Check Instagram job status
```

### 3. QStash Processing Updates
```javascript
// In process-scraping/route.ts, add Instagram handler:
if (job.platform === 'Instagram') {
  await processInstagramJob(job, jobId);
}

async function processInstagramJob(job, jobId) {
  // 1. Call Instagram API (different endpoint)
  const apiUrl = `${process.env.SCRAPECREATORS_INSTAGRAM_API_URL}?handle=${job.targetUsername}`;
  
  // 2. Transform Instagram response format
  const creators = instagramData.data.user.edge_related_profiles.edges.map(edge => ({
    creator: {
      name: edge.node.full_name,
      followers: edge.node.follower_count || 0,
      // Instagram-specific transformation
    }
  }));
  
  // 3. Same save/update logic as TikTok
}
```

### 4. Frontend Components
```
/app/campaigns/search/instagram/page.jsx
/app/components/campaigns/instagram-search/
├── instagram-search-form.jsx
├── instagram-review.jsx
└── instagram-results.jsx
```

### 5. Data Transformation Differences
```javascript
// TikTok format
{
  creator: { name, followers, avatarUrl },
  video: { description, statistics: { likes, comments, shares } },
  hashtags: []
}

// Instagram format  
{
  creator: { name, followers, profilePicUrl },
  post: { caption, statistics: { likes, comments } },
  tags: []
}
```

## Error Handling & Monitoring

### Common Error Scenarios
1. **QStash signature verification fails**: Check signing keys
2. **External API rate limits**: Implement exponential backoff
3. **Job timeouts**: Set appropriate timeout values
4. **Image proxy failures**: Graceful fallbacks for missing images

### Monitoring Points
1. **Job completion rates**: Track failed vs successful jobs
2. **API response times**: Monitor external API performance
3. **QStash delivery**: Track message delivery success
4. **Image proxy performance**: Monitor proxy response times

## Performance Optimizations

### 1. Database Indexing
```sql
CREATE INDEX idx_scraping_jobs_user_id ON scraping_jobs(user_id);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_results_job_id ON scraping_results(job_id);
```

### 2. Caching Strategy
- Image proxy: 1 hour cache
- Job status: No cache (real-time updates needed)
- Campaign list: 1 minute cache

### 3. QStash Optimization
- Batch multiple API calls when possible
- Use appropriate delays between calls (2-5 seconds)
- Set reasonable retry limits (3-5 retries)

## Security Considerations

### 1. Authentication
- All API endpoints verify user authentication
- Campaign ownership validation before job creation
- QStash signature verification for webhook security

### 2. Rate Limiting
- Testing limits prevent excessive API usage
- User-based rate limiting in production
- External API key management

### 3. Data Privacy
- User data isolation by userId
- Secure storage of API keys
- Image proxy doesn't store images permanently

---

This documentation provides a complete blueprint for understanding and extending the TikTok influencer platform to support additional social media platforms.