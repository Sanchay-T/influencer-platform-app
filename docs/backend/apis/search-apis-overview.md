# 🔍 Search APIs Overview - All 6 Platform Combinations

## Overview
Complete documentation of all 6 platform search combinations: TikTok (keyword/similar), Instagram (similar/hashtag), and YouTube (keyword/similar) with their unique features, data structures, and processing patterns.

## 🏗️ Platform Search Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 PLATFORM SEARCH COMBINATIONS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │     TikTok      │    │    Instagram    │                    │
│  │                 │    │                 │                    │
│  │ ✅ Keyword      │    │ ❌ Keyword      │                    │
│  │ ✅ Similar      │    │ ✅ Similar      │                    │
│  │                 │    │ ✅ Hashtag      │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │     YouTube     │                                           │
│  │                 │                                           │
│  │ ✅ Keyword      │                                           │
│  │ ✅ Similar      │                                           │
│  │                 │                                           │
│  └─────────────────┘                                           │
│                                                                 │
│  Total: 6 Search Combinations                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Platform Feature Matrix

| Feature | TikTok Keyword | TikTok Similar | Instagram Similar | Instagram Hashtag | YouTube Keyword | YouTube Similar |
|---------|----------------|----------------|-------------------|-------------------|-----------------|-----------------|
| **API Endpoint** | `/api/scraping/tiktok` | `/api/scraping/tiktok-similar` | `/api/scraping/instagram` | `/api/scraping/instagram-hashtag` | `/api/scraping/youtube` | `/api/scraping/youtube-similar` |
| **Search Method** | Keywords | Target Username | Target Username | Hashtag | Keywords | Target Channel |
| **Bio Extraction** | ✅ Enhanced | ✅ Basic | ✅ Enhanced | ✅ Basic | ✅ Enhanced | ✅ Enhanced |
| **Email Extraction** | ✅ Profile API | ✅ Bio Regex | ✅ Bio Regex | ✅ Bio Regex | ✅ Channel API | ✅ Channel API |
| **Follower Count** | ✅ | ✅ | ❌ | ✅ | ✅ Subscribers | ✅ Subscribers |
| **Verification Status** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Private Accounts** | ❌ | Filter Out | Show Status | Filter Out | ❌ | ❌ |
| **Max Results** | 1000 | 10 | ~20 | 1000 | 1000 | 10 |
| **Pagination** | ✅ Cursor | ❌ Single Call | ❌ Single Call | ✅ Cursor | ✅ Token | ❌ Single Call |
| **Rate Limiting** | 100ms delay | 2s delay | 500ms delay | 100ms delay | 200ms delay | 2s delay |

## 🎯 Common Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  UNIFIED PROCESSING FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. API Endpoint Receives Request                               │
│         │                                                       │
│         ▼                                                       │
│  2. Authentication & Validation                                 │
│         │                                                       │
│         ▼                                                       │
│  3. Create Job in Database                                      │
│         │                                                       │
│         ▼                                                       │
│  4. Queue Job in QStash                                         │
│         │                                                       │
│         ▼                                                       │
│  5. Return Job ID to Frontend                                   │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ Background Processing ─ ─ ─ ─ ─ ─ ─           │
│                                                                 │
│  6. QStash Webhook Received                                     │
│         │                                                       │
│         ▼                                                       │
│  7. Platform-Specific Processing                                │
│         │                                                       │
│         ├─── Call External API                                  │
│         ├─── Transform Data                                     │
│         ├─── Enhance Profiles (Bio/Email)                       │
│         └─── Save Results                                       │
│         │                                                       │
│         ▼                                                       │
│  8. Update Progress & Status                                    │
│         │                                                       │
│         ▼                                                       │
│  9. Schedule Next Call or Complete                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 API Endpoint Structure

### Base Pattern
```typescript
// POST /api/scraping/{platform}
// POST /api/scraping/{platform}-{searchType}

export async function POST(req: Request) {
  // 1. Authentication
  const { userId } = await auth();
  
  // 2. Parse Body
  const body = await req.json();
  
  // 3. Validate Input
  // Platform-specific validation
  
  // 4. Create Job
  const [job] = await db.insert(scrapingJobs).values({
    userId,
    platform: 'Platform',
    // Search-specific fields
    status: 'pending',
    targetResults: 1000,
    timeoutAt: new Date(Date.now() + TIMEOUT)
  }).returning();
  
  // 5. Queue Job
  await qstash.publishJSON({
    url: `${siteUrl}/api/qstash/process-scraping`,
    body: { jobId: job.id },
    retries: 3
  });
  
  // 6. Return Response
  return NextResponse.json({
    message: 'Job started successfully',
    jobId: job.id
  });
}
```

## 📋 Platform-Specific Details

### 1. **TikTok Keyword Search**

#### **Endpoint**: `/api/scraping/tiktok`

#### **Request Structure**:
```json
{
  "keywords": ["fitness", "workout"],
  "targetResults": 1000,
  "campaignId": "uuid"
}
```

#### **Processing Features**:
- ✅ **Enhanced Bio Fetching**: Additional profile API calls for missing bios
- ✅ **Email Extraction**: Regex pattern matching from bios
- ✅ **HEIC Image Handling**: Automatic `.heic` → `.jpeg` conversion
- ✅ **Pagination**: Cursor-based continuation
- ✅ **Rate Limiting**: 100ms delay between profile fetches

#### **Data Structure**:
```json
{
  "creator": {
    "name": "Creator Name",
    "followers": 150000,
    "avatarUrl": "/api/proxy/image?url=...",
    "bio": "Fitness coach 💪 Contact: tips@fitness.com",
    "emails": ["tips@fitness.com"],
    "uniqueId": "@creatorhandle",
    "verified": true
  },
  "video": {
    "description": "Morning workout routine",
    "url": "https://tiktok.com/@creator/video/123",
    "statistics": {
      "likes": 5000,
      "comments": 150,
      "shares": 75,
      "views": 50000
    }
  },
  "hashtags": ["#fitness", "#workout"],
  "platform": "TikTok"
}
```

### 2. **TikTok Similar Search**

#### **Endpoint**: `/api/scraping/tiktok-similar`

#### **Request Structure**:
```json
{
  "targetUsername": "@fitnesscoach",
  "campaignId": "uuid"
}
```

#### **Processing Flow**:
1. Fetch target profile → Extract keywords → Search similar users → Filter & rank

#### **Unique Features**:
- 🎯 **Keyword Extraction**: Bio analysis for search terms
- 🚫 **Private Account Filtering**: Excludes private profiles
- 📊 **Follower Ranking**: Sorts by follower count
- 🔟 **Limited Results**: Returns top 10 similar creators

### 3. **Instagram Similar Search**

#### **Endpoint**: `/api/scraping/instagram`

#### **Request Structure**:
```json
{
  "targetUsername": "fitnesscoach",
  "campaignId": "uuid"
}
```

#### **Processing Features**:
- 📱 **Apify Integration**: Uses Instagram scraper API
- 🔄 **Real Incremental Processing**: Saves results in batches of 6
- 🔍 **Enhanced Profile Fetching**: Secondary API calls for bio/email
- 💾 **Live Updates**: Results available during processing

#### **Incremental Processing Pattern**:
```typescript
// Process and save in small batches
const liveBatchSize = 6;
for (let i = 0; i < creators.length; i++) {
  processedProfiles.push(creator);
  
  if (i % liveBatchSize === 0 || i === creators.length - 1) {
    // Save batch to database
    await saveResults(processedProfiles);
    // Update progress
    await updateProgress(i / creators.length * 100);
  }
}
```

### 4. **Instagram Hashtag Search**

#### **Endpoint**: `/api/scraping/instagram-hashtag`

#### **Request Structure**:
```json
{
  "hashtag": "fitness",
  "targetResults": 1000,
  "campaignId": "uuid"
}
```

#### **Processing Features**:
- #️⃣ **Hashtag Normalization**: Removes # prefix
- 📸 **Post-Based Discovery**: Finds creators through posts
- 🔁 **Pagination**: Cursor-based for large result sets
- 🎯 **Creator Deduplication**: Unique creators only

### 5. **YouTube Keyword Search**

#### **Endpoint**: `/api/scraping/youtube`

#### **Request Structure**:
```json
{
  "keywords": ["fitness", "home workout"],
  "targetResults": 1000,
  "campaignId": "uuid"
}
```

#### **Enhanced Features**:
- 📺 **Channel Profile API**: Fetches full channel data
- 📧 **Email Extraction**: From channel description + links
- 🔗 **Social Links**: Extracts all channel links
- 📊 **Subscriber Count**: Full subscriber data
- ⏱️ **Video Metadata**: Duration, publish date

#### **Enhanced Channel Data**:
```json
{
  "creator": {
    "name": "Fitness Channel",
    "followers": 250000,
    "avatarUrl": "https://youtube.com/channel-avatar.jpg",
    "bio": "Professional fitness trainer. Business: contact@fitness.com",
    "emails": ["contact@fitness.com"],
    "socialLinks": ["https://instagram.com/fitness", "https://fitness.com"],
    "handle": "@fitnesschannel",
    "channelId": "UC123..."
  },
  "video": {
    "description": "30-Minute Home Workout",
    "url": "https://youtube.com/watch?v=...",
    "statistics": {
      "views": 100000
    }
  },
  "publishedTime": "2024-01-15",
  "lengthSeconds": 1800,
  "platform": "YouTube"
}
```

### 6. **YouTube Similar Search**

#### **Endpoint**: `/api/scraping/youtube-similar`

#### **Request Structure**:
```json
{
  "targetChannel": "@fitnesschannel",
  "campaignId": "uuid"
}
```

#### **Processing Features**:
- 🎯 **Channel Analysis**: Extracts channel topics
- 🔍 **Related Channels**: Finds similar content creators
- 📊 **Engagement Metrics**: Views and subscriber data
- 🔟 **Top Results**: Returns 10 most relevant channels

## 🔄 Data Transformation Patterns

### Universal Creator Structure
```typescript
interface UniversalCreator {
  creator: {
    name: string;
    followers: number;
    avatarUrl: string;
    bio?: string;
    emails?: string[];
    uniqueId?: string;
    verified?: boolean;
    socialLinks?: string[];
  };
  video?: {
    description: string;
    url: string;
    statistics: {
      views: number;
      likes?: number;
      comments?: number;
      shares?: number;
    };
  };
  hashtags?: string[];
  platform: 'TikTok' | 'Instagram' | 'YouTube';
}
```

### Platform-Specific Transformers

#### **TikTok Transformer**:
```typescript
function transformTikTokCreator(item: any) {
  const author = item.aweme_info?.author || {};
  
  return {
    creator: {
      name: author.nickname || author.unique_id,
      followers: author.follower_count || 0,
      avatarUrl: author.avatar_medium?.url_list?.[0]?.replace('.heic', '.jpeg'),
      bio: author.signature || '',
      emails: extractEmails(author.signature),
      uniqueId: author.unique_id,
      verified: author.is_verified || false
    },
    // ... video data
  };
}
```

#### **Instagram Transformer**:
```typescript
function transformInstagramCreator(profile: any) {
  return {
    creator: {
      name: profile.full_name || profile.username,
      followers: profile.follower_count || 0,
      avatarUrl: profile.profile_pic_url,
      bio: profile.biography || '',
      emails: extractEmails(profile.biography),
      verified: profile.is_verified || false
    },
    platform: 'Instagram'
  };
}
```

#### **YouTube Transformer**:
```typescript
function transformYouTubeCreator(video: any, channelData?: any) {
  return {
    creator: {
      name: video.channel?.title || 'Unknown Channel',
      followers: channelData?.subscriberCount || 0,
      avatarUrl: video.channel?.thumbnail || '',
      bio: channelData?.description || '',
      emails: [...extractEmails(channelData?.description), channelData?.email].filter(Boolean),
      socialLinks: channelData?.links || [],
      handle: video.channel?.handle
    },
    // ... video data
  };
}
```

## 🛡️ Error Handling & Recovery

### Common Error Patterns

#### **API Rate Limiting**:
```typescript
if (error.status === 429) {
  console.log('⚠️ Rate limit reached, scheduling retry');
  await qstash.publishJSON({
    url: callbackUrl,
    body: { jobId },
    delay: '10s' // Longer delay for rate limits
  });
}
```

#### **Profile Not Found**:
```typescript
catch (profileError) {
  console.log(`⚠️ Profile not found: ${username}`);
  // Continue with basic data or skip
  continue;
}
```

#### **Timeout Handling**:
```typescript
if (job.timeoutAt && new Date() > new Date(job.timeoutAt)) {
  await markJobTimeout(jobId);
  return { status: 'timeout' };
}
```

### Recovery Strategies
1. **Automatic Retries**: QStash retry configuration
2. **Graceful Degradation**: Continue with partial data
3. **Incremental Saving**: Results saved during processing
4. **Timeout Protection**: Jobs auto-complete after timeout

## 📊 Progress Tracking

### Unified Progress Formula
```typescript
function calculateProgress(apiCalls, maxCalls, results, targetResults) {
  const apiProgress = (apiCalls / maxCalls) * 30; // 30% weight
  const resultsProgress = (results / targetResults) * 70; // 70% weight
  return Math.min(apiProgress + resultsProgress, 100);
}
```

### Platform-Specific Progress Points
- **Initial**: 0% - Job created
- **Profile Fetch**: 20% - Target profile loaded
- **Search Started**: 40% - API calls begin
- **Results Processing**: 50-70% - Incremental updates
- **Enhancement**: 70-85% - Bio/email fetching
- **Completion**: 100% - All processing done

## 🔧 Configuration & Limits

### Dynamic Configuration
```typescript
// Load from system_configurations table
const MAX_API_CALLS = await SystemConfig.get('api_limits', 'max_api_calls_platform');
const TIMEOUT_MINUTES = await SystemConfig.get('timeouts', 'standard_job_timeout');
const DELAY_BETWEEN_CALLS = await SystemConfig.get('api', 'delay_between_calls');
```

### Platform Limits
| Platform | Max API Calls | Delay Between Calls | Profile Enhancement Delay |
|----------|---------------|---------------------|--------------------------|
| TikTok Keyword | 1 (test) / 999 (prod) | 2s | 100ms |
| TikTok Similar | 1 (test) / 10 (prod) | 2s | N/A |
| Instagram Similar | 1 | N/A | 500ms |
| Instagram Hashtag | 1 (test) / 999 (prod) | 2s | 100ms |
| YouTube Keyword | 1 (test) / 999 (prod) | 2s | 200ms |
| YouTube Similar | 1 (test) / 10 (prod) | 2s | 200ms |

## 🎯 Best Practices

### 1. **Rate Limit Management**
- Sequential processing for profile enhancements
- Configurable delays between API calls
- Exponential backoff for retries

### 2. **Data Consistency**
- Atomic result saving
- Incremental updates for long processes
- Validation before saving

### 3. **User Experience**
- Real-time progress updates
- Intermediate results availability
- Clear error messages

### 4. **Performance Optimization**
- Batch processing where possible
- Efficient data transformation
- Minimal database queries

---

**Next**: See platform-specific documentation for detailed implementation:
- [TikTok APIs](./tiktok-apis.md)
- [Instagram APIs](./instagram-apis.md)  
- [YouTube APIs](./youtube-apis.md)