# Multi-Platform Influencer Platform - Complete Technical Documentation

## Overview
This document details the complete end-to-end flow for multi-platform influencer campaign creation, background processing, and results display. Supports TikTok keyword/similar search, Instagram similar search, and YouTube keyword search with comprehensive image handling and async processing.

## Architecture Overview

```mermaid
graph TD
    A[User Creates Campaign] --> B[Campaign Saved to DB]
    B --> C{Search Type?}
    C -->|Keyword| D[Platform Selection: TikTok/YouTube]
    C -->|Similar| E[Platform Selection: TikTok/Instagram]
    D --> F[Keywords Configuration]
    E --> G[Username Input]
    F --> H[Scraping Job Created]
    G --> H
    H --> I[QStash Message Published]
    I --> J[Background Processing]
    J --> K[Platform-Specific API Call]
    K --> L[Data Transformation]
    L --> M[HEIC Image Processing]
    M --> N[Results Saved to DB]
    N --> O[Job Status Updated]
    O --> P[Frontend Displays Results]
    P --> Q[CSV Export Available]
```

## Supported Platforms & Search Types

| Platform | Keyword Search | Similar Search | Image Support | API Endpoint |
|----------|---------------|----------------|---------------|--------------|
| **TikTok** | ✅ | ✅ | HEIC → JPEG | `/api/scraping/tiktok`, `/api/scraping/tiktok-similar` |
| **Instagram** | ❌ | ✅ | Standard | `/api/scraping/instagram` |
| **YouTube** | ✅ | ❌ | Thumbnails | `/api/scraping/youtube` |

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

-- Background processing jobs (updated schema)
scrapingJobs {
  id: uuid (PK)
  userId: text
  campaignId: uuid (FK -> campaigns.id)
  keywords: jsonb (string[] for keyword search)
  targetUsername: text (for similar search)
  platform: varchar ('TikTok' | 'Instagram' | 'YouTube')
  status: varchar ('pending' | 'processing' | 'completed' | 'error' | 'timeout')
  processedRuns: integer (tracks API calls made)
  processedResults: integer (total creators found)
  targetResults: integer (goal: 100, 500, 1000)
  cursor: integer (pagination for API)
  progress: decimal (0-100)
  timeoutAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
  startedAt: timestamp
  completedAt: timestamp
  error: text
}

-- Final results storage
scrapingResults {
  id: uuid (PK)
  jobId: uuid (FK -> scrapingJobs.id)
  creators: jsonb (Platform-specific creator data)
  createdAt: timestamp
}
```

## Complete End-to-End Flow

### 1. Campaign Creation Flow

#### Frontend Routes & Components
- **Main Campaign Page**: `/app/campaigns/new/page.jsx`
- **Campaign Form**: `/app/components/campaigns/campaign-form.jsx`
- **Keyword Search**: `/app/campaigns/search/keyword/page.jsx`
- **Similar Search**: `/app/campaigns/search/similar/page.jsx`

### 2. Platform-Specific Implementations

## TikTok Keyword Search Implementation

### File Structure
```
/app/api/scraping/tiktok/route.ts                    # TikTok keyword API endpoint
/app/api/qstash/process-scraping/route.ts            # Background processor (inline TikTok handling)
/app/components/campaigns/keyword-search/
  ├── keyword-search-form.jsx                       # Platform + keyword selection
  ├── search-results.jsx                             # Results display with image handling
  └── search-progress.jsx                            # Progress UI component
```

### API Flow
1. **POST `/api/scraping/tiktok`**
   - Creates job with `platform: 'TikTok'` and `keywords: string[]`
   - Publishes to QStash for background processing
   - Returns `jobId` for polling

2. **QStash Processing** (`/app/api/qstash/process-scraping/route.ts`)
   ```javascript
   // TikTok keyword search handling (inline)
   if (job.platform === 'TikTok' && job.keywords) {
     // Call ScrapeCreators TikTok API
     const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${keywords}&cursor=${cursor}`;
     
     // Transform response to common format
     const creators = transformTikTokResponse(apiResponse);
     
     // Save results and schedule continuation if needed
     if (processedRuns < MAX_API_CALLS_FOR_TESTING) {
       await qstash.publishJSON({ url: callbackUrl, body: { jobId }, delay: '2s' });
     }
   }
   ```

3. **GET `/api/scraping/tiktok?jobId=xxx`**
   - Returns job status and results for frontend polling

### Data Transformation
```javascript
// TikTok API Response → Common Format
const creators = apiResponse.search_item_list.map((item) => {
  const awemeInfo = item.aweme_info || {};
  const author = awemeInfo.author || {};
  
  return {
    creator: {
      name: author.nickname || author.unique_id,
      followers: author.follower_count || 0,
      avatarUrl: author.avatar_medium?.url_list?.[0]?.replace('.heic', '.jpeg'),
    },
    video: {
      description: awemeInfo.desc || 'No description',
      url: awemeInfo.share_url || '',
      statistics: {
        likes: awemeInfo.statistics?.digg_count || 0,
        comments: awemeInfo.statistics?.comment_count || 0,
        views: awemeInfo.statistics?.play_count || 0
      }
    },
    hashtags: awemeInfo.text_extra?.filter(e => e.type === 1).map(e => e.hashtag_name) || [],
    platform: 'TikTok'
  };
});
```

## TikTok Similar Search Implementation

### File Structure
```
/app/api/scraping/tiktok-similar/route.ts             # TikTok similar API endpoint
/lib/platforms/tiktok-similar/
  ├── types.ts                                       # TypeScript interfaces
  ├── api.ts                                         # ScrapeCreators API calls
  ├── transformer.ts                                 # Data transformation
  └── handler.ts                                     # Background processing logic
/app/components/campaigns/similar-search/
  ├── similar-search-form.jsx                       # Username input form
  ├── search-results.jsx                             # Results with progress UI
  └── similar-search-progress.jsx                    # Progress component
```

### Modular Architecture
```javascript
// lib/platforms/tiktok-similar/handler.ts
export async function processTikTokSimilarJob(job: any, jobId: string) {
  // Step 1: Get target user profile
  const profileData = await getTikTokProfile(job.targetUsername);
  
  // Step 2: Extract keywords from profile
  const keywords = extractSearchKeywords(profileData);
  
  // Step 3: Search for similar users using keywords
  const searchResults = await searchTikTokUsers(keywords[0]);
  
  // Step 4: Transform and filter results
  const creators = transformTikTokUsers(searchResults, keywords);
  
  // Step 5: Save results and handle continuation
  if (processedRuns < MAX_API_CALLS_FOR_TESTING) {
    await qstash.publishJSON({ url: callbackUrl, body: { jobId }, delay: '2s' });
  } else {
    await markJobCompleted(jobId);
  }
}
```

### QStash Integration
```javascript
// /app/api/qstash/process-scraping/route.ts
else if (job.platform === 'TikTok' && job.targetUsername) {
  const result = await processTikTokSimilarJob(job, jobId);
  return NextResponse.json(result);
}
```

## YouTube Keyword Search Implementation

### File Structure
```
/app/api/scraping/youtube/route.ts                   # YouTube API endpoint
/lib/platforms/youtube/
  ├── types.ts                                       # YouTube-specific interfaces
  ├── api.ts                                         # ScrapeCreators YouTube API
  ├── transformer.ts                                 # YouTube data transformation
  └── handler.ts                                     # Background processing
```

### Modular Processing
```javascript
// lib/platforms/youtube/handler.ts
export async function processYouTubeJob(job: any, jobId: string) {
  // Check testing limits
  if (currentRuns >= MAX_API_CALLS_FOR_TESTING) {
    return markJobCompleted(jobId);
  }

  // Call YouTube API
  const searchParams = { keywords: job.keywords, mode: 'keyword' };
  const youtubeResponse = await searchYouTube(searchParams);
  
  // Transform and save
  const creators = transformYouTubeVideos(youtubeResponse.videos, job.keywords);
  await saveResults(jobId, creators);
  
  // Schedule continuation or complete
  if (newProcessedRuns < MAX_API_CALLS_FOR_TESTING) {
    await scheduleNextCall(jobId);
  } else {
    await markJobCompleted(jobId);
  }
}
```

### YouTube Data Transformation
```javascript
// lib/platforms/youtube/transformer.ts
export function transformYouTubeVideo(video, keywords = []) {
  return {
    creator: {
      name: video.channel?.title || 'Unknown Channel',
      followers: 0, // Not available in YouTube search API
      avatarUrl: video.channel?.thumbnail || ''
    },
    video: {
      description: video.title || 'No title',
      url: video.url || '',
      statistics: {
        views: video.viewCountInt || 0, // Only views available
        likes: 0, comments: 0, shares: 0 // Not available in search API
      }
    },
    hashtags: extractHashtags(video.title || ''),
    publishedTime: video.publishedTime || '',
    lengthSeconds: video.lengthSeconds || 0,
    platform: 'YouTube'
  };
}
```

## Instagram Similar Search Implementation

### File Structure
```
/app/api/scraping/instagram/route.ts                 # Instagram API endpoint
/app/api/qstash/process-scraping/route.ts            # Inline Instagram processing
```

### Inline Processing (Single API Call)
```javascript
// Instagram processing in QStash handler (lines 164-399)
if (job.platform === 'Instagram' && job.targetUsername) {
  // Single API call - no continuation needed
  const apiUrl = `${process.env.SCRAPECREATORS_INSTAGRAM_API_URL}?handle=${job.targetUsername}`;
  const response = await fetch(apiUrl, { headers: { 'x-api-key': apiKey } });
  
  // Transform related profiles
  const relatedProfiles = response.data.user.edge_related_profiles.edges.map(edge => ({
    id: edge.node.id,
    username: edge.node.username,
    full_name: edge.node.full_name,
    is_private: edge.node.is_private,
    is_verified: edge.node.is_verified,
    profile_pic_url: edge.node.profile_pic_url
  }));
  
  // Save and complete immediately
  await saveResults(jobId, relatedProfiles);
  await markJobCompleted(jobId);
}
```

## Image Proxy System - Universal HEIC & CDN Handling

### File Structure
```
/app/api/proxy/image/route.ts                        # Universal image proxy with HEIC conversion
```

### Comprehensive Image Processing Pipeline

#### 1. HEIC Conversion (Vercel-Compatible)
```javascript
// Primary: heic-convert package (works on Vercel)
import convert from 'heic-convert';

if (isHeic || contentType === 'image/heic') {
  try {
    const outputBuffer = await convert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.85
    });
    buffer = Buffer.from(outputBuffer);
    contentType = 'image/jpeg';
    console.log('✅ [IMAGE-PROXY] HEIC conversion successful with heic-convert');
  } catch (heicError) {
    // Fallback to Sharp if available
    console.log('🔄 [IMAGE-PROXY] Trying Sharp as fallback...');
  }
}
```

#### 2. TikTok CDN 403 Handling (5-Layer Strategy)
```javascript
// Layer 1: Enhanced headers with TikTok referrer
const fetchHeaders = {
  'User-Agent': 'Mozilla/5.0...',
  'Referer': 'https://www.tiktok.com/',
  'Origin': 'https://www.tiktok.com'
};

// Layer 2: Remove referrer headers
if (response.status === 403) {
  delete headers['Referer'];
  delete headers['Origin'];
  response = await fetch(url, { headers });
}

// Layer 3: Simplify URL (remove query parameters)
if (still403) {
  const simplifiedUrl = imageUrl.split('?')[0];
  response = await fetch(simplifiedUrl, { headers });
}

// Layer 4: Minimal curl-like headers
if (still403) {
  const minimalHeaders = { 'User-Agent': 'curl/7.68.0', 'Accept': '*/*' };
  response = await fetch(simplifiedUrl, { headers: minimalHeaders });
}

// Layer 5: Alternative CDN domains
if (still403) {
  const cdnDomains = ['p16-sign-va.tiktokcdn.com', 'p19-sign-va.tiktokcdn.com'];
  for (const domain of cdnDomains) {
    const altUrl = simplifiedUrl.replace(/p\d+-[^.]+\.tiktokcdn[^/]*/, domain);
    response = await fetch(altUrl, { headers: minimalHeaders });
    if (response.ok) break;
  }
}
```

#### 3. SVG Placeholder Generation
```javascript
// Final fallback: Generate colored avatar placeholders
if (allAttemptsFailed && imageUrl.includes('tiktokcdn')) {
  const username = extractUsernameFromUrl(imageUrl);
  const color = `hsl(${username.charCodeAt(0) * 7 % 360}, 70%, 50%)`;
  const initial = username.charAt(0).toUpperCase();
  
  const placeholderSvg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="100" fill="${color}"/>
      <text x="100" y="120" font-family="Arial" font-size="80" font-weight="bold" 
            fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `;
  
  return new NextResponse(Buffer.from(placeholderSvg), {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}
```

### Response Headers for Debugging
```javascript
headers: {
  'Content-Type': contentType,
  'X-Image-Proxy-Time': totalTime.toString(),
  'X-Image-Proxy-Source': 'heic-converted' | 'original' | 'placeholder-403',
  'X-Image-Original-Format': 'heic' | 'other' | 'blocked',
  'X-Image-Fetch-Strategy': 'initial-success' | 'no-referrer' | 'simplified-url' | 'minimal-headers' | 'alternative-domain' | 'placeholder',
  'X-Image-Final-Status': response.status.toString()
}
```

## Frontend Image Loading with Enhanced Debugging

### Universal Image Loading Handlers
```javascript
// app/components/campaigns/keyword-search/search-results.jsx
// app/components/campaigns/similar-search/search-results.jsx

const handleImageLoad = (e, username) => {
  const img = e.target;
  console.log('✅ [BROWSER-IMAGE] Image loaded successfully for', username);
  console.log('  📏 Natural size:', img.naturalWidth + 'x' + img.naturalHeight);
  console.log('  🔗 Loaded URL:', img.src);
  console.log('  ⏱️ Load time:', (Date.now() - parseInt(img.dataset.startTime || '0')) + 'ms');
};

const handleImageError = (e, username, originalUrl) => {
  console.error('❌ [BROWSER-IMAGE] Image failed to load for', username);
  console.error('  🔗 Failed URL:', img.src);
  console.error('  📍 Original URL:', originalUrl);
  img.style.display = 'none'; // Hide broken images
};

// Usage in AvatarImage
<AvatarImage
  src={getProxiedImageUrl(creator.profile_pic_url)}
  onLoad={(e) => handleImageLoad(e, creator.username)}
  onError={(e) => handleImageError(e, creator.username, creator.profile_pic_url)}
  onLoadStart={(e) => handleImageStart(e, creator.username)}
/>
```

## CSV Export System

### Universal Export Handler
```javascript
// app/api/export/csv/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  
  // Get job with results
  const job = await db.query.scrapingJobs.findFirst({
    where: eq(scrapingJobs.id, jobId),
    with: { results: true }
  });
  
  // Platform-specific CSV generation
  if (job.platform === 'YouTube') {
    return generateYouTubeCSV(job);
  } else if (job.platform === 'TikTok') {
    return generateTikTokCSV(job);
  } else if (job.platform === 'Instagram') {
    return generateInstagramCSV(job);
  }
}
```

### Platform-Specific CSV Formats

#### YouTube CSV Export
```javascript
headers = [
  'Channel Name', 'Video Title', 'Video URL', 'Views', 
  'Duration (seconds)', 'Published Date', 'Hashtags', 'Keywords', 'Platform'
];

row = [
  creator.name,
  video.description, // Video title
  video.url,
  stats.views || 0,
  item.lengthSeconds || 0,
  publishedDate,
  hashtags,
  keywords,
  'YouTube'
];
```

#### TikTok CSV Export (Keyword & Similar)
```javascript
headers = [
  'Creator Name', 'Followers', 'Video Description', 'Video URL',
  'Likes', 'Comments', 'Shares', 'Views', 'Hashtags', 'Platform', 'Keywords'
];

row = [
  creator.name,
  creator.followers || 0,
  video.description,
  video.url,
  stats.likes || 0,
  stats.comments || 0,
  stats.shares || 0,
  stats.views || 0,
  hashtags,
  'TikTok',
  keywords
];
```

#### Instagram CSV Export (Similar)
```javascript
headers = [
  'Username', 'Full Name', 'Private', 'Verified', 'Platform', 'Search Type'
];

row = [
  creator.username,
  creator.full_name,
  creator.is_private ? 'Yes' : 'No',
  creator.is_verified ? 'Yes' : 'No',
  'Instagram',
  'Similar'
];
```

## Testing Configuration

### API Call Limits
```javascript
// /app/api/qstash/process-scraping/route.ts
const MAX_API_CALLS_FOR_TESTING = 1; // Limits to 1 API call for testing

// For production, change to:
const MAX_API_CALLS_FOR_TESTING = 999; // Or remove limit entirely
```

### Local Development Setup
```bash
# Install dependencies
npm install heic-convert

# Environment variables needed
SCRAPECREATORS_API_KEY=xxx
SCRAPECREATORS_API_URL=https://api.scrapecreators.com/v1/tiktok/search/keyword
SCRAPECREATORS_INSTAGRAM_API_URL=https://api.scrapecreators.com/v1/instagram/profile
QSTASH_TOKEN=xxx
DATABASE_URL=xxx

# For local development with QStash
ngrok http 3000
# Update NEXT_PUBLIC_SITE_URL to ngrok URL
```

## Environment Configuration

### Required Environment Variables
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
SCRAPECREATORS_INSTAGRAM_API_URL=https://api.scrapecreators.com/v1/instagram/profile
SCRAPECREATORS_API_KEY=xxx

# Deployment
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
VERCEL_URL=your-app.vercel.app
```

### Package Dependencies
```json
{
  "dependencies": {
    "heic-convert": "^1.2.4",
    "sharp": "^0.33.0",
    "@upstash/qstash": "^1.0.0",
    "drizzle-orm": "latest",
    "postgres": "latest"
  }
}
```

## Deployment & Production Configuration

### Vercel Deployment
1. **Set Environment Variables** in Vercel dashboard
2. **Update API Limits** for production:
   ```javascript
   const MAX_API_CALLS_FOR_TESTING = 999; // Remove testing restrictions
   ```
3. **Configure Domains** for CORS if needed
4. **Monitor Function Logs** for image processing issues

### Performance Optimizations
1. **Database Indexing**
   ```sql
   CREATE INDEX idx_scraping_jobs_user_id ON scraping_jobs(user_id);
   CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
   CREATE INDEX idx_scraping_results_job_id ON scraping_results(job_id);
   ```

2. **Caching Strategy**
   - Image proxy: 1 hour cache (`max-age=3600`)
   - Placeholders: 5 minutes cache (`max-age=300`)
   - Job status: No cache (real-time updates)

3. **QStash Optimization**
   - 2-second delays between API calls
   - Maximum 3 retries per message
   - Proper error handling and recovery

## Monitoring & Debugging

### Server-Side Logging
Monitor these log patterns in Vercel Functions:

#### Successful HEIC Conversion
```
🔄 [IMAGE-PROXY] Converting HEIC using heic-convert package...
✅ [IMAGE-PROXY] HEIC conversion successful with heic-convert
⏱️ [IMAGE-PROXY] Conversion time: 245ms
📤 [IMAGE-PROXY] Sending response with content-type: image/jpeg
```

#### TikTok CDN Access Success
```
🎯 [IMAGE-PROXY] Using TikTok-specific headers
📡 [IMAGE-PROXY] Fetch status: 403 Forbidden
🔄 [IMAGE-PROXY] Retry 1: Removing referrer headers...
📡 [IMAGE-PROXY] Retry 1 status: 200 OK
```

#### Placeholder Generation
```
❌ [IMAGE-PROXY] All fetch attempts failed: 403 Forbidden
🔄 [IMAGE-PROXY] Serving placeholder for blocked TikTok image
✅ [IMAGE-PROXY] Generated placeholder SVG
```

#### QStash Job Processing
```
🎬 Processing TikTok similar job for username: testuser
🔍 Step 1: Getting TikTok profile data
🔍 Step 2: Extracting keywords from profile
✅ TikTok similar search completed successfully
```

### Browser-Side Debugging
Monitor these patterns in browser console:

#### Image Loading Success
```
🖼️ [BROWSER-IMAGE] Generating proxied URL:
🚀 [BROWSER-IMAGE] Starting image load for username123
✅ [BROWSER-IMAGE] Image loaded successfully for username123
  📏 Natural size: 400x400
  ⏱️ Load time: ~523ms
```

#### Image Loading Failure
```
❌ [BROWSER-IMAGE] Image failed to load for username123
  🔗 Failed URL: /api/proxy/image?url=...
  📍 Original URL: https://tiktokcdn.com/...
```

### Performance Monitoring Headers
Check response headers for debugging:
- `X-Image-Proxy-Time`: Processing time
- `X-Image-Fetch-Strategy`: Which fetch method worked
- `X-Image-Proxy-Source`: Conversion method used

## Troubleshooting Common Issues

### 1. HEIC Images Not Converting
**Symptoms**: Images show as broken or don't load
**Check**: 
- Verify `heic-convert` package is installed
- Check server logs for conversion errors
- Ensure Vercel has enough memory allocation

**Solution**: The `heic-convert` package should handle this automatically

### 2. TikTok Images Getting 403 Errors
**Symptoms**: Multiple 403 Forbidden errors in logs
**Check**:
- Server logs show retry attempts
- Response headers indicate which strategy worked
- Placeholder generation as fallback

**Solution**: The 5-layer retry strategy should handle most cases

### 3. QStash Jobs Not Processing
**Symptoms**: Jobs stuck in 'pending' status
**Check**:
- QStash signature verification
- NEXT_PUBLIC_SITE_URL correctly set
- Callback URL accessibility

**Solution**: 
```javascript
// Verify QStash setup
const isValid = await receiver.verify({
  signature: req.headers.get('Upstash-Signature'),
  body: await req.text(),
  url: `${baseUrl}/api/qstash/process-scraping`
});
```

### 4. Frontend Not Showing Results
**Symptoms**: Infinite loading or no results display
**Check**:
- Browser console for polling errors
- Job status API responses
- Frontend polling interval (3 seconds)

**Solution**: Check job polling logic and API endpoints

### 5. CSV Export Issues
**Symptoms**: Export button not working or wrong format
**Check**:
- Job ID passed correctly to export endpoint
- Platform-specific CSV generation
- Results data structure

## Error Recovery & Resilience

### Automatic Recovery Features
1. **QStash Retries**: Up to 3 automatic retries per message
2. **Image Fallbacks**: 5-layer strategy ending with placeholders
3. **Job Timeouts**: 1-hour timeout with automatic cleanup
4. **Progress Tracking**: Real-time status updates

### Manual Recovery Procedures
1. **Stuck Jobs**: Check job status and manually update if needed
2. **Missing Images**: Clear browser cache and retry
3. **API Limits**: Adjust `MAX_API_CALLS_FOR_TESTING` as needed

## Future Platform Extensions

### Adding New Platforms
To add a new platform (e.g., LinkedIn), follow this pattern:

1. **Create Platform Module**:
   ```
   /lib/platforms/linkedin/
     ├── types.ts
     ├── api.ts
     ├── transformer.ts
     └── handler.ts
   ```

2. **Add API Endpoint**:
   ```
   /app/api/scraping/linkedin/route.ts
   ```

3. **Update QStash Processor**:
   ```javascript
   else if (job.platform === 'LinkedIn') {
     const result = await processLinkedInJob(job, jobId);
     return NextResponse.json(result);
   }
   ```

4. **Update Frontend**:
   - Add platform option to forms
   - Update results display components
   - Add platform-specific CSV export

5. **Update Database Schema**:
   ```sql
   ALTER TABLE scraping_jobs 
   ALTER COLUMN platform TYPE varchar(50);
   -- Now supports 'TikTok' | 'Instagram' | 'YouTube' | 'LinkedIn'
   ```

This modular architecture ensures new platforms can be added without affecting existing functionality.

---

**This documentation covers the complete multi-platform influencer search system with comprehensive image handling, async processing, and monitoring capabilities.**
