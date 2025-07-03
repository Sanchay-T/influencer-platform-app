# ✅ CONFIRMED: Apify Instagram Hashtag Scraper Integration

## 🎯 Final Recommendation

**Use Actor ID: `reGe1ST3OBgYZSsZJ` (Instagram Hashtag Scraper)**

✅ **Successfully tested with #redbull**  
✅ **Returns 15 real Instagram posts in 12 seconds**  
✅ **Complete data structure with all needed fields**  
✅ **Perfect for your hashtag search feature**

## 📊 Test Results Summary

- **Actor**: Instagram Hashtag Scraper (`reGe1ST3OBgYZSsZJ`)
- **Test Query**: `#redbull`
- **Results**: 15 posts retrieved
- **Speed**: 12 seconds
- **Status**: ✅ SUCCEEDED
- **Data Quality**: Excellent (all posts have captions, owners, URLs)

## 🔧 Data Structure (Perfect for your platform!)

```javascript
{
  // Post Information
  "id": "3668512091586452049",
  "type": "Sidecar", // Image, Video, Sidecar
  "shortCode": "DLpLE-JPFpR",
  "url": "https://www.instagram.com/p/DLpLE-JPFpR/",
  "caption": "Geate Briten #f1 #macleren #redbull",
  "timestamp": "2025-07-03T11:05:41.000Z",
  
  // Creator Information
  "ownerUsername": "sb_formula1",
  "ownerFullName": "Bhuva Shreyash", 
  "ownerId": "70825801529",
  
  // Engagement
  "commentsCount": 0,
  "likesCount": 0, // Note: Recent posts often show 0 initially
  
  // Content
  "hashtags": ["f1", "macleren", "redbull"],
  "displayUrl": "https://scontent-vie1-1.cdninstagram.com/...",
  "images": ["url1", "url2"], // For carousels
  "videoUrl": "https://...", // For videos
  
  // Rich Data
  "dimensionsHeight": 612,
  "dimensionsWidth": 612,
  "musicInfo": {...}, // For videos with music
  "childPosts": [...] // For carousel posts
}
```

## 🔄 Mapping to Your Current Data Model

```javascript
// Transform Apify data to your existing format
function transformApifyToYourFormat(apifyPosts) {
  return apifyPosts.map(post => ({
    creator: {
      name: post.ownerFullName || post.ownerUsername,
      uniqueId: post.ownerUsername,
      followers: 0, // Not available in hashtag search
      avatarUrl: '', // Would need separate profile fetch
      verified: false, // Not available
      bio: '', // Not available
      emails: [] // Not available
    },
    video: {
      description: post.caption || '',
      url: post.url,
      statistics: {
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        views: 0, // Not available for Instagram
        shares: 0 // Not available
      }
    },
    hashtags: post.hashtags || [],
    publishedTime: post.timestamp,
    platform: 'Instagram',
    postType: post.type, // Image, Video, Sidecar
    mediaUrl: post.displayUrl,
    postId: post.id,
    shortCode: post.shortCode
  }));
}
```

## 🚀 Integration Steps

### 1. Update Environment Variables
Add to your `.env.local`:
```bash
INSTAGRAM_HASHTAG_SCRAPER_ID="reGe1ST3OBgYZSsZJ"
```

### 2. Create New Instagram Hashtag Search Endpoint
```typescript
// /app/api/scraping/instagram-hashtag/route.ts
import { ApifyClient } from 'apify-client';

export async function POST(req: Request) {
  const { keywords, userId } = await req.json();
  
  const client = new ApifyClient({
    token: process.env.APIFY_TOKEN
  });
  
  // Create job in your database
  const job = await createScrapingJob({
    userId,
    platform: 'Instagram',
    searchType: 'hashtag',
    keywords,
    status: 'pending'
  });
  
  // Start Apify actor
  const input = {
    hashtags: keywords, // ["redbull", "energy"]
    resultsLimit: 50    // Adjust based on your needs
  };
  
  const run = await client.actor(process.env.INSTAGRAM_HASHTAG_SCRAPER_ID).start(input);
  
  // Store run ID for tracking
  await updateJob(job.id, {
    apifyRunId: run.id,
    status: 'processing'
  });
  
  return NextResponse.json({ jobId: job.id });
}
```

### 3. Update Background Processor
```typescript
// /app/api/qstash/process-scraping/route.ts
// Add new case for Instagram hashtag processing

if (job.platform === 'Instagram' && job.searchType === 'hashtag') {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  
  // Check if run is complete
  const run = await client.run(job.apifyRunId).get();
  
  if (run.status === 'SUCCEEDED') {
    // Get results
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    // Transform data
    const transformedCreators = transformApifyToYourFormat(items);
    
    // Save to database
    await saveResults(job.id, transformedCreators);
    await markJobCompleted(job.id);
    
  } else if (run.status === 'RUNNING') {
    // Re-schedule check in 30 seconds
    await qstash.publishJSON({
      url: callbackUrl,
      body: { jobId },
      delay: '30s'
    });
  } else {
    // Handle failed run
    await markJobFailed(job.id, run.statusMessage);
  }
}
```

### 4. Frontend Integration
Update your search forms to include Instagram hashtag search:

```jsx
// Platform selection
const platforms = [
  { id: 'TikTok', name: 'TikTok', supports: ['keyword', 'similar'] },
  { id: 'Instagram', name: 'Instagram', supports: ['similar', 'hashtag'] }, // Add hashtag
  { id: 'YouTube', name: 'YouTube', supports: ['keyword'] }
];

// When Instagram + hashtag is selected, use new endpoint
if (platform === 'Instagram' && searchType === 'hashtag') {
  endpoint = '/api/scraping/instagram-hashtag';
}
```

## 💰 Cost Analysis

**Apify Instagram Hashtag Scraper Pricing:**
- ~$2-3 per 1,000 posts
- Your test: 15 posts = ~$0.05
- For 100 posts: ~$0.30
- Very cost-effective!

## 🎉 Immediate Benefits

1. **Real hashtag search** - Get actual Instagram posts with specific hashtags
2. **Rich data** - Complete post information, media URLs, engagement
3. **Fast results** - 12 seconds for 15 posts
4. **Creator discovery** - Find influencers posting about specific topics
5. **Content analysis** - See trending hashtags and content types

## 📝 Next Actions

1. **Add environment variable**: `INSTAGRAM_HASHTAG_SCRAPER_ID="reGe1ST3OBgYZSsZJ"`
2. **Implement new API endpoint** for Instagram hashtag search
3. **Update background processor** to handle Apify runs
4. **Test with different hashtags** (`#fitness`, `#travel`, etc.)
5. **Update frontend** to offer Instagram hashtag search option

## 🔍 Testing Commands

```bash
# Test the actor directly
node scripts/test-both-hashtag-scrapers.js

# View results
cat test-outputs/apify-hashtag-scraper-results.json | jq '.summary'
```

---

## 🎯 Final Implementation Priority

1. **High Priority**: Instagram hashtag search (working perfectly)
2. **Medium Priority**: Keep existing Instagram similar search 
3. **Future**: Explore TikTok Apify actors if needed

**This gives you powerful Instagram hashtag search functionality that your competitors likely don't have!** 🚀