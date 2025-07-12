# 📊 CSV Export System - Multi-Platform Data Export

## Overview
Comprehensive CSV export system that handles data export for all 6 platform search combinations with enhanced bio/email extraction, platform-specific formatting, and campaign-level aggregation across multiple jobs.

## 🏗️ CSV Export Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CSV EXPORT PROCESSING FLOW                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend Export Request                                        │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Export URL    │                                           │
│  │                 │                                           │
│  │ /api/export/csv │                                           │
│  │ ?jobId=xxx      │                                           │
│  │ ?campaignId=xxx │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Authentication│                                           │
│  │                 │                                           │
│  │ Clerk userId    │                                           │
│  │ verification    │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │          DATA RETRIEVAL MODE            │                    │
│  │                                         │                    │
│  │  ┌─────────┐     ┌─────────────────┐   │                    │
│  │  │ Single  │ OR  │   Campaign      │   │                    │
│  │  │ Job     │     │   Aggregation   │   │                    │
│  │  │         │     │   (Multi-Job)   │   │                    │
│  │  └─────────┘     └─────────────────┘   │                    │
│  └─────────────────────────────────────────┘                    │
│         │                       │                              │
│         ▼                       ▼                              │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Single Job    │    │  Multiple Jobs  │                    │
│  │   Results       │    │  Aggregation    │                    │
│  │                 │    │                 │                    │
│  │ 1 job data      │    │ N jobs data     │                    │
│  │ 1 platform      │    │ Mixed platforms │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                       │                              │
│         ▼                       ▼                              │
│  ┌─────────────────────────────────────────┐                    │
│  │        PLATFORM DETECTION               │                    │
│  │                                         │                    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │                    │
│  │  │TikTok   │ │Instagram│ │YouTube  │   │                    │
│  │  │Keyword  │ │Similar  │ │Keyword  │   │                    │
│  │  │Similar  │ │         │ │Similar  │   │                    │
│  │  └─────────┘ └─────────┘ └─────────┘   │                    │
│  └─────────────────────────────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │      CSV FORMAT SELECTION               │                    │
│  │                                         │                    │
│  │  • Platform-specific headers           │                    │
│  │  • Enhanced bio/email columns          │                    │
│  │  • Unified cross-platform format       │                    │
│  │  • Legacy format compatibility         │                    │
│  └─────────────────────────────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │            CSV GENERATION               │                    │
│  │                                         │                    │
│  │  • Headers creation                     │                    │
│  │  • Data transformation                  │                    │
│  │  • Quote escaping                       │                    │
│  │  • Array serialization                  │                    │
│  └─────────────────────────────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │           FILE RESPONSE                 │                    │
│  │                                         │                    │
│  │  • Content-Type: text/csv              │                    │
│  │  • Content-Disposition: attachment     │                    │
│  │  • Filename with date/ID               │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Core Implementation

### File: `app/api/export/csv/route.ts`

#### **Main Export Endpoint**:
```typescript
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const campaignId = searchParams.get('campaignId');
    
    // Authentication verification
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Route to appropriate handler
    if (campaignId) {
      return await handleCampaignExport(campaignId);
    } else if (jobId) {
      return await handleJobExport(jobId);
    } else {
      return NextResponse.json({ error: 'Job ID or campaign ID is required' }, { status: 400 });
    }
  } catch (error) {
    console.error('CSV Export: Error exporting CSV:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

## 📦 Data Retrieval System

### Single Job Export
```typescript
const result = await db.query.scrapingResults.findFirst({
  where: eq(scrapingResults.jobId, String(jobId))
});

const job = await db.query.scrapingJobs.findFirst({
  where: eq(scrapingJobs.id, jobId)
});

// Extract creators from various data structures
let creators: any[] = [];
const creatorsData = result.creators as any;

if (Array.isArray(creatorsData)) {
  creators = creatorsData;
} else if (creatorsData?.results && Array.isArray(creatorsData.results)) {
  // Handle nested structure
  creators = creatorsData.results.reduce((acc: any[], r: any) => {
    if (r.creators && Array.isArray(r.creators)) {
      return [...acc, ...r.creators];
    }
    return acc;
  }, []);
}
```

### Campaign Export (Multi-Job Aggregation)
```typescript
// Fetch all jobs for campaign
const jobs = await db.query.scrapingJobs.findMany({
  where: (jobs, { eq }) => eq(jobs.campaignId, String(campaignId)),
  with: { results: true }
});

let allCreators: any[] = [];
let keywords: string[] = [];

jobs.forEach((job) => {
  // Aggregate keywords from all jobs
  if (Array.isArray(job.keywords)) {
    keywords = keywords.concat(job.keywords);
  }
  
  // Process each result within each job
  if (Array.isArray(job.results)) {
    job.results.forEach((result) => {
      const creatorsData = result.creators;
      
      if (Array.isArray(creatorsData)) {
        allCreators = allCreators.concat(creatorsData);
      } else if (creatorsData?.results && Array.isArray(creatorsData.results)) {
        // Handle nested results structure
        const nested = creatorsData.results.reduce((acc: any[], r: any) => {
          if (r.creators && Array.isArray(r.creators)) {
            return [...acc, ...r.creators];
          }
          return acc;
        }, []);
        allCreators = allCreators.concat(nested);
      }
    });
  }
});

keywords = Array.from(new Set(keywords)); // Remove duplicates
```

## 🎯 Platform-Specific CSV Formats

### TikTok Keyword/Similar Search Export
```typescript
// Enhanced TikTok format with bio/email extraction
const headers = [
  'Username',
  'Followers', 
  'Bio',           // NEW: Enhanced bio extraction
  'Email',         // NEW: Extracted email addresses
  'Video URL',
  'Description',
  'Likes',
  'Comments', 
  'Shares',
  'Views',
  'Hashtags',
  'Created Date',
  'Keywords',
  'Platform'
];

creators.forEach(item => {
  const creator = item.creator || {};
  const video = item.video || {};
  const stats = video.statistics || {};
  
  // Enhanced bio and email extraction
  const bio = (creator.bio || '').replace(/"/g, '""'); // Escape quotes for CSV
  const emails = Array.isArray(creator.emails) ? creator.emails.join('; ') : '';
  
  const row = [
    `"${creator.name || ''}"`,
    `"${creator.followers || 0}"`,
    `"${bio}"`,        // Full bio content
    `"${emails}"`,     // All extracted emails (semicolon-separated)
    `"${video.url || ''}"`,
    `"${(video.description || '').replace(/"/g, '""')}"`,
    `"${stats.likes || 0}"`,
    `"${stats.comments || 0}"`,
    `"${stats.shares || 0}"`,
    `"${stats.views || 0}"`,
    `"${hashtags}"`,
    `"${createdDate}"`,
    `"${keywordsStr}"`,
    `"${itemPlatform}"`
  ];
});
```

### Instagram Similar Search Export
```typescript
// Enhanced Instagram format with bio/email support
const headers = [
  'Username',
  'Full Name',
  'Bio',           // NEW: Bio content extraction
  'Email',         // NEW: Email extraction from bio
  'Private',
  'Verified', 
  'Profile URL',
  'Platform'
];

creators.forEach(creator => {
  const bio = (creator.bio || '').replace(/"/g, '""');
  const emails = Array.isArray(creator.emails) ? creator.emails.join('; ') : '';
  const profileUrl = creator.profileUrl || `https://instagram.com/${creator.username}`;
  
  const row = [
    `"${creator.username || ''}"`,
    `"${creator.full_name || ''}"`,
    `"${bio}"`,        // Bio content
    `"${emails}"`,     // Extracted emails
    `"${creator.is_private ? 'Yes' : 'No'}"`,
    `"${creator.is_verified ? 'Yes' : 'No'}"`,
    `"${profileUrl}"`,
    `"${creator.platform || 'Instagram'}"`
  ];
});
```

### YouTube Keyword Search Export
```typescript
// YouTube video-based export format
const headers = [
  'Channel Name',
  'Subscribers',
  'Bio',           // NEW: Channel bio/description
  'Email',         // NEW: Extracted contact emails
  'Social Links',  // NEW: Social media links
  'Video Title',
  'Video URL', 
  'Views',
  'Duration (seconds)',
  'Hashtags',
  'Keywords',
  'Platform'
];

creators.forEach(item => {
  const creator = item.creator || {};
  const video = item.video || {};
  
  const bio = (creator.bio || '').replace(/"/g, '""');
  const emails = Array.isArray(creator.emails) ? creator.emails.join('; ') : '';
  const socialLinks = Array.isArray(creator.socialLinks) ? creator.socialLinks.join('; ') : '';
  
  const row = [
    `"${creator.name || ''}"`,
    `"${creator.followers || 0}"`,
    `"${bio}"`,
    `"${emails}"`,
    `"${socialLinks}"`,
    `"${(video.description || '').replace(/"/g, '""')}"`, // Video title
    `"${video.url || ''}"`,
    `"${stats.views || 0}"`,
    `"${item.lengthSeconds || 0}"`,
    `"${hashtags}"`,
    `"${keywordsStr}"`,
    `"${itemPlatform}"`
  ];
});
```

### YouTube Similar Search Export
```typescript
// YouTube channel-based export format
const headers = [
  'Channel Name',
  'Handle',
  'Full Name',
  'Bio',
  'Email',
  'Social Links',
  'Subscribers',
  'Target Channel',
  'Platform'
];

creators.forEach(item => {
  const bio = (item.bio || '').replace(/"/g, '""');
  const emails = Array.isArray(item.emails) ? item.emails.join('; ') : '';
  const socialLinks = Array.isArray(item.socialLinks) ? item.socialLinks.join('; ') : '';
  
  const row = [
    `"${item.name || ''}"`,
    `"${item.handle || ''}"`,
    `"${item.full_name || item.name || ''}"`,
    `"${bio}"`,
    `"${emails}"`,
    `"${socialLinks}"`,
    `"${item.subscriberCount || 'N/A'}"`,
    `"${job.targetUsername || ''}"`,
    `"${itemPlatform}"`
  ];
});
```

## 🔄 Data Structure Detection

### Platform Detection Logic
```typescript
// Detect platform and search type from data structure
const firstCreator = creators[0];

if (firstCreator.username && (firstCreator.is_verified !== undefined || firstCreator.full_name)) {
  // Similar search format (Instagram or TikTok similar)
  const platform = firstCreator.platform || 'Unknown';
  return generateSimilarSearchCSV(creators, platform);
  
} else if (firstCreator.creator && firstCreator.video) {
  // Keyword search format (TikTok/YouTube with video data)
  const platform = firstCreator.platform || 'Unknown';
  
  if (platform === 'YouTube' && job?.targetUsername) {
    return generateYouTubeSimilarCSV(creators, job.targetUsername);
  } else if (platform === 'YouTube') {
    return generateYouTubeKeywordCSV(creators, keywords);
  } else {
    return generateTikTokKeywordCSV(creators, keywords);
  }
  
} else if ('profile' in firstCreator) {
  // Legacy TikTok format
  return generateLegacyTikTokCSV(creators);
  
} else {
  // Unknown format - use generic field extraction
  return generateGenericCSV(creators);
}
```

### Unified Campaign Format
```typescript
// For campaign exports with mixed platforms
if (campaignId) {
  const platforms = [...new Set(allCreators.map(item => item.platform || 'Unknown'))];
  
  // Use unified format that works for all platforms
  const headers = [
    'Platform',
    'Creator/Channel Name', 
    'Followers',
    'Video/Content URL',
    'Title/Description',
    'Views',
    'Likes', 
    'Comments',
    'Shares',
    'Duration (seconds)',
    'Hashtags',
    'Date',
    'Keywords'
  ];
  
  allCreators.forEach(item => {
    const creator = item.creator || {};
    const video = item.video || {};
    const stats = video.statistics || {};
    const itemPlatform = item.platform || 'Unknown';
    
    // Handle date based on platform
    let dateStr = '';
    if (itemPlatform === 'YouTube' && item.publishedTime) {
      dateStr = new Date(item.publishedTime).toISOString().split('T')[0];
    } else if (item.createTime) {
      dateStr = new Date(item.createTime * 1000).toISOString().split('T')[0];
    }
    
    const row = [
      `"${itemPlatform}"`,
      `"${creator.name || ''}"`,
      `"${creator.followers || 0}"`,
      `"${video.url || ''}"`,
      `"${(video.description || '').replace(/"/g, '""')}"`,
      `"${stats.views || 0}"`,
      `"${stats.likes || 0}"`,
      `"${stats.comments || 0}"`,
      `"${stats.shares || 0}"`,
      `"${item.lengthSeconds || 0}"`,
      `"${hashtags}"`,
      `"${dateStr}"`,
      `"${keywordsStr}"`
    ];
  });
}
```

## 📝 Data Processing & Validation

### CSV Data Sanitization
```typescript
// Quote escaping for CSV safety
const sanitizeForCSV = (value: any): string => {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  // Escape double quotes by doubling them
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
};

// Array serialization
const serializeArray = (arr: any[]): string => {
  if (!Array.isArray(arr)) return '';
  return arr.join('; '); // Use semicolon as separator
};

// JSON object handling
const serializeObject = (obj: any): string => {
  if (typeof obj !== 'object' || obj === null) return String(obj || '');
  return JSON.stringify(obj).replace(/"/g, '""');
};
```

### Bio and Email Enhancement
```typescript
// Extract enhanced bio and email data for all platforms
const extractBioAndEmails = (creator: any) => {
  const bio = creator.bio || creator.signature || creator.description || '';
  
  // Email extraction regex (matches multiple email formats)
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  const emails = bio.match(emailRegex) || [];
  
  return {
    bio: bio.replace(/"/g, '""'), // Escape for CSV
    emails: emails.join('; ')     // Semicolon-separated
  };
};
```

## 🔧 File Response Handling

### Response Headers Configuration
```typescript
// CSV file download headers
const headers = new Headers();
headers.set('Content-Type', 'text/csv');

// Filename generation with context
let filename;
if (campaignId) {
  filename = `creators-campaign-${campaignId}-${new Date().toISOString().split('T')[0]}.csv`;
} else {
  filename = `creators-${new Date().toISOString().split('T')[0]}.csv`;
}

headers.set('Content-Disposition', `attachment; filename=${filename}`);

return new NextResponse(csvContent, {
  headers,
  status: 200,
});
```

### Error Handling
```typescript
// Comprehensive error handling with context
try {
  // CSV generation logic
} catch (parseError) {
  console.error('CSV Export: Error parsing creators data:', parseError);
  console.error('CSV Export: Data structure sample:', 
    JSON.stringify(creatorsData).substring(0, 500) + '...');
  
  return NextResponse.json({ 
    error: 'Error parsing creators data',
    details: parseError instanceof Error ? parseError.message : 'Unknown error'
  }, { status: 500 });
}
```

## 📊 Performance & Optimization

### Memory Management
```typescript
// Stream processing for large datasets
const processInBatches = (creators: any[], batchSize = 1000) => {
  let csvContent = headers.join(',') + '\n';
  
  for (let i = 0; i < creators.length; i += batchSize) {
    const batch = creators.slice(i, i + batchSize);
    
    batch.forEach(creator => {
      const row = generateRow(creator);
      csvContent += row.join(',') + '\n';
    });
    
    // Log progress for large exports
    if (creators.length > 5000) {
      console.log(`CSV Export: Processed ${Math.min(i + batchSize, creators.length)}/${creators.length} creators`);
    }
  }
  
  return csvContent;
};
```

### Comprehensive Logging
```typescript
// Export process logging
console.log('CSV Export: Starting export process');
console.log(`CSV Export: Processing ${creators.length} creators`);
console.log('CSV Export: Detected platforms:', platforms);
console.log(`CSV Export: Generated CSV with ${platform} structure`);
console.log('CSV Export: Returning CSV file');

// Data structure analysis
console.log('CSV Export: First creator structure sample', 
  JSON.stringify(firstCreator).substring(0, 200) + '...');
console.log(`CSV Export: Found ${creators.length} creators`);
```

## 🎯 Frontend Integration

### Export Button Implementation
```typescript
// Frontend export handler
const handleExportCSV = async (jobId?: string, campaignId?: string) => {
  try {
    const params = new URLSearchParams();
    if (jobId) params.append('jobId', jobId);
    if (campaignId) params.append('campaignId', campaignId);
    
    const response = await fetch(`/api/export/csv?${params}`);
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFilenameFromHeaders(response.headers) || 'creators.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Export error:', error);
    // Show error toast/notification
  }
};
```

### Export UI Components
```typescript
// Campaign export button
<Button
  onClick={() => handleExportCSV(undefined, campaign.id)}
  variant="outline"
  size="sm"
  disabled={!hasCompletedJobs}
>
  <Download className="w-4 h-4 mr-2" />
  Export Campaign CSV
</Button>

// Individual job export button  
<Button
  onClick={() => handleExportCSV(job.id)}
  variant="outline"
  size="sm"
  disabled={job.status !== 'completed'}
>
  <Download className="w-4 h-4 mr-2" />
  Export CSV
</Button>
```

## 🔍 Debugging & Monitoring

### Export Analytics
```typescript
// Track export metrics
const trackExport = {
  userId,
  exportType: campaignId ? 'campaign' : 'job',
  recordCount: creators.length,
  platforms: [...new Set(creators.map(c => c.platform))],
  timestamp: new Date(),
  fileSize: csvContent.length
};

console.log('CSV Export: Analytics:', trackExport);
```

### Error Recovery
```typescript
// Fallback for unknown data structures
if (creators.length === 0) {
  console.log('CSV Export: No creators found, attempting structure analysis...');
  
  // Try different extraction methods
  if (typeof creatorsData === 'object' && creatorsData !== null) {
    Object.keys(creatorsData).forEach(key => {
      if (Array.isArray(creatorsData[key])) {
        creators = creatorsData[key];
        console.log(`CSV Export: Found creators under key '${key}'`);
      }
    });
  }
}
```

---

**Impact**: The CSV export system provides comprehensive data export capabilities with enhanced bio/email extraction, supporting all 6 platform combinations with campaign-level aggregation and platform-specific formatting for maximum data utility and lead generation potential.