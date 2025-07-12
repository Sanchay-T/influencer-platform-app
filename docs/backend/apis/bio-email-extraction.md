# 📧 Bio & Email Extraction System

## Overview
Comprehensive documentation of the bio and email extraction system that enhances creator profiles across all platforms by fetching additional profile data and extracting contact information.

## 🏗️ Bio Enhancement Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  BIO & EMAIL EXTRACTION FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Initial API Response                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Check Bio     │                                           │
│  │   Availability  │                                           │
│  │                 │                                           │
│  │ Has Bio? ────────── Yes ──────┐                             │
│  │    │            │              │                             │
│  │    No           │              ▼                             │
│  └─────────────────┘      ┌─────────────────┐                  │
│         │                  │  Extract Emails  │                  │
│         ▼                  │   from Bio      │                  │
│  ┌─────────────────┐       └─────────────────┘                  │
│  │ Profile API Call│              │                             │
│  │                 │              │                             │
│  │ GET /profile    │              │                             │
│  └─────────────────┘              │                             │
│         │                         │                             │
│         ▼                         │                             │
│  ┌─────────────────┐              │                             │
│  │  Extract Bio    │              │                             │
│  │  & Description  │              │                             │
│  └─────────────────┘              │                             │
│         │                         │                             │
│         ▼                         ▼                             │
│  ┌─────────────────────────────────────────┐                    │
│  │        Email Extraction Engine          │                    │
│  │                                         │                    │
│  │  Regex: /[\w\.-]+@[\w\.-]+\.\w+/g     │                    │
│  │  Sources: Bio, Description, Links       │                    │
│  └─────────────────────────────────────────┘                    │
│                      │                                          │
│                      ▼                                          │
│              ┌─────────────────┐                                │
│              │ Enhanced Creator │                                │
│              │   Profile Data   │                                │
│              └─────────────────┘                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Platform-Specific Implementations

### 1. **TikTok Bio Enhancement**

#### **Problem Statement**
TikTok keyword search API returns `author.signature: undefined`, meaning no bio/email data is available in the initial response.

#### **Solution**
Automatic enhanced profile fetching that makes additional API calls to get complete profile information.

#### **Implementation** (`app/api/qstash/process-scraping/route.ts`):

```typescript
// Enhanced Profile Fetching for TikTok
if (!bio && author.unique_id) {
  try {
    console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full profile for @${author.unique_id}`);
    
    // Make profile API call
    const profileApiUrl = `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(author.unique_id)}`;
    const profileResponse = await fetch(profileApiUrl, {
      headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! }
    });
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const profileUser = profileData.user || {};
      
      // Extract enhanced bio
      enhancedBio = profileUser.signature || profileUser.desc || profileUser.bio || '';
      
      // Extract emails
      const enhancedEmailMatches = enhancedBio.match(emailRegex) || [];
      enhancedEmails = enhancedEmailMatches;
      
      console.log(`✅ [PROFILE-FETCH] Successfully fetched profile for @${author.unique_id}:`, {
        bioFound: true,
        bioLength: enhancedBio.length,
        emailsFound: enhancedEmails.length,
        bioPreview: enhancedBio.substring(0, 80) + '...'
      });
    }
  } catch (profileError) {
    console.log(`❌ [PROFILE-FETCH] Error fetching profile for @${author.unique_id}:`, profileError.message);
  }
}
```

#### **Rate Limiting Protection**:
```typescript
// Sequential processing with delays
for (let i = 0; i < apiResponse.search_item_list.length; i++) {
  const item = apiResponse.search_item_list[i];
  // ... process creator with bio enhancement
  
  // Add delay between profile API calls
  if (i < apiResponse.search_item_list.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
  }
}
```

### 2. **YouTube Channel Enhancement**

#### **Enhanced Channel Data Fetching** (`lib/platforms/youtube/handler.ts`):

```typescript
// Get full channel profile for bio and emails
if (channel.handle) {
  try {
    console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full channel profile for ${channel.handle}`);
    
    const channelData = await getYouTubeChannelProfile(channel.handle);
    
    // Extract bio/description
    channelDescription = channelData.description || '';
    enhancedBio = channelDescription;
    
    // Extract emails from multiple sources
    const emailsFromDescription = channelDescription.match(emailRegex) || [];
    const directEmail = channelData.email ? [channelData.email] : [];
    enhancedEmails = [...new Set([...directEmail, ...emailsFromDescription])]; // Remove duplicates
    
    // Extract social links
    enhancedLinks = channelData.links || [];
    subscriberCount = channelData.subscriberCount || 0;
    
    console.log(`✅ [PROFILE-FETCH] Successfully fetched channel profile:`, {
      bioFound: !!enhancedBio,
      bioLength: enhancedBio.length,
      emailsFound: enhancedEmails.length,
      linksFound: enhancedLinks.length,
      subscribers: channelData.subscriberCountText
    });
    
  } catch (profileError) {
    console.log(`❌ [PROFILE-FETCH] Error fetching channel profile:`, profileError.message);
  }
}
```

#### **YouTube-Specific Features**:
- ✅ **Direct Email Field**: `channelData.email` if available
- ✅ **Social Links**: All channel links extracted
- ✅ **Subscriber Count**: Full subscriber data
- ✅ **Channel Handle**: For profile URL construction

### 3. **Instagram Bio Enhancement**

#### **Two-Stage Processing** (`lib/platforms/instagram-similar/handler.ts`):

```typescript
// Stage 1: Basic profile data from initial API
const transformedCreators = transformInstagramProfile(profileData);

// Stage 2: Enhanced profile fetching for bio/email
for (let i = 0; i < maxEnhancedProfiles; i++) {
  const creator = transformedCreators[i];
  
  try {
    console.log(`🔍 [INSTAGRAM-ENHANCED] Fetching enhanced data for @${creator.username}`);
    
    const enhancedResult = await getEnhancedInstagramProfile(creator.username);
    
    if (enhancedResult.success && enhancedResult.data) {
      // Transform with enhanced data
      transformedCreators[i] = transformEnhancedProfile(creator, enhancedResult.data);
      
      console.log(`✅ [INSTAGRAM-ENHANCED] Enhanced data added:`, {
        bioLength: enhancedResult.data.biography?.length || 0,
        emailsFound: transformedCreators[i].emails?.length || 0
      });
    }
    
    // Delay to avoid rate limits
    if (i < maxEnhancedProfiles - 1) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    }
    
  } catch (enhancedError) {
    console.error(`❌ [INSTAGRAM-ENHANCED] Error:`, enhancedError.message);
  }
}
```

## 📧 Email Extraction Engine

### Universal Email Regex Pattern

```typescript
const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
```

#### **Pattern Breakdown**:
- `[\w\.-]+` - Username part (letters, numbers, dots, hyphens)
- `@` - Required @ symbol
- `[\w\.-]+` - Domain name
- `\.` - Required dot
- `\w+` - Top-level domain

#### **Supported Email Formats**:
- ✅ `contact@example.com`
- ✅ `hello.world@company-name.org`
- ✅ `user123@domain.io`
- ✅ `support+help@business.com`
- ✅ `info@sub.domain.co.uk`

### Email Extraction Sources

#### **1. Bio/Description Text**:
```typescript
const bioEmails = (bio || '').match(emailRegex) || [];
```

#### **2. Social Links (YouTube)**:
```typescript
// Extract from channel links
const linkEmails = channelData.links
  ?.map(link => link.match(emailRegex))
  .flat()
  .filter(Boolean) || [];
```

#### **3. Direct Email Field (Platform-Specific)**:
```typescript
// YouTube channel email field
const directEmail = channelData.email ? [channelData.email] : [];
```

#### **4. Deduplication**:
```typescript
// Remove duplicate emails
const allEmails = [...bioEmails, ...linkEmails, ...directEmail];
const uniqueEmails = [...new Set(allEmails)];
```

## 🔍 Bio Processing Patterns

### Text Extraction Priority

```typescript
// TikTok bio extraction priority
const bio = profileUser.signature || 
            profileUser.desc || 
            profileUser.bio || 
            profileUser.description || 
            '';

// YouTube description extraction
const bio = channelData.description || 
            channelData.about || 
            channelData.bio || 
            '';

// Instagram bio extraction
const bio = profileData.biography || 
            profileData.bio || 
            profileData.description || 
            '';
```

### Bio Content Analysis

#### **Common Bio Patterns**:
1. **Contact Information**:
   - "Business inquiries: contact@example.com"
   - "Email: hello@brand.com"
   - "DM for collab 📧 info@creator.com"

2. **Social Links**:
   - "LinkTree: linktr.ee/creator"
   - "All links: beacons.ai/creator"

3. **Professional Info**:
   - "CEO @company | Speaker | Author"
   - "Fitness Coach | Nutritionist"

## 📊 Extraction Success Metrics

### Logging & Monitoring

#### **Profile Enhancement Logs**:
```typescript
console.log('🔍 [PROFILE-ENHANCEMENT] Starting enhanced profile data fetching');
console.log(`📊 [PROFILE-ENHANCEMENT] Processing ${totalCreators} creators`);

// Per-creator logs
console.log(`✅ [PROFILE-FETCH] Successfully fetched profile:`, {
  username: creator.uniqueId,
  bioFound: !!bio,
  bioLength: bio.length,
  emailsFound: emails.length,
  bioPreview: bio.substring(0, 100) + '...'
});
```

#### **Email Extraction Logs**:
```typescript
console.log('📧 [EMAIL-EXTRACTION] Email extraction result:', {
  bioInput: bio.substring(0, 100) + '...',
  emailsFound: extractedEmails,
  emailCount: extractedEmails.length
});
```

### Success Rate Tracking

```typescript
// Track extraction success
const stats = {
  totalProfiles: creators.length,
  profilesWithBio: creators.filter(c => c.creator?.bio?.length > 0).length,
  profilesWithEmail: creators.filter(c => c.creator?.emails?.length > 0).length,
  totalEmailsFound: creators.reduce((sum, c) => sum + (c.creator?.emails?.length || 0), 0)
};

console.log('📊 [EXTRACTION-STATS]', stats);
```

## 🛡️ Error Handling & Fallbacks

### Graceful Degradation

```typescript
try {
  // Attempt enhanced profile fetch
  const enhancedData = await fetchEnhancedProfile(username);
  bio = enhancedData.bio;
  emails = extractEmails(bio);
} catch (error) {
  // Fallback to basic data
  console.log(`⚠️ Using basic profile data for ${username}`);
  bio = basicProfile.bio || '';
  emails = [];
}
```

### Rate Limit Management

```typescript
// Platform-specific delays
const DELAYS = {
  tiktok: 100,      // 100ms between TikTok profiles
  youtube: 200,     // 200ms between YouTube channels
  instagram: 500    // 500ms between Instagram profiles
};

// Apply delay
await new Promise(resolve => setTimeout(resolve, DELAYS[platform]));
```

### Partial Data Handling

```typescript
// Continue with available data
const creatorData = {
  creator: {
    name: profile.name || 'Unknown',
    bio: enhancedBio || basicBio || '',
    emails: enhancedEmails.length > 0 ? enhancedEmails : basicEmails,
    // ... other fields with fallbacks
  }
};
```

## 🎯 Frontend Integration

### Displaying Bio & Email Data

#### **Table Columns** (`search-results.jsx`):
```jsx
<TableHead>Bio</TableHead>
<TableHead>Email</TableHead>
```

#### **Bio Display**:
```jsx
<TableCell>
  <div className="max-w-[200px] truncate" title={creator.creator?.bio || 'No bio available'}>
    {creator.creator?.bio ? (
      <span className="text-sm text-gray-700">{creator.creator.bio}</span>
    ) : (
      <span className="text-gray-400 text-sm">No bio</span>
    )}
  </div>
</TableCell>
```

#### **Email Display with Mailto Links**:
```jsx
<TableCell>
  {creator.creator?.emails && creator.creator.emails.length > 0 ? (
    <div className="space-y-1">
      {creator.creator.emails.map((email, emailIndex) => (
        <div key={emailIndex} className="flex items-center gap-1">
          <a 
            href={`mailto:${email}`}
            className="text-blue-600 hover:underline text-sm"
            title={`Send email to ${email}`}
          >
            {email}
          </a>
          <svg className="w-3 h-3 opacity-60 text-blue-600">
            {/* Email icon */}
          </svg>
        </div>
      ))}
    </div>
  ) : (
    <span className="text-gray-400 text-sm">No email</span>
  )}
</TableCell>
```

### CSV Export Integration

```typescript
// Include bio and email in CSV export
const headers = [
  'Username',
  'Followers', 
  'Bio',        // Full bio text
  'Email',      // Semicolon-separated emails
  // ... other fields
];

const row = [
  creator.name,
  creator.followers,
  `"${(creator.bio || '').replace(/"/g, '""')}"`, // Escape quotes
  `"${(creator.emails || []).join('; ')}"`,        // Join multiple emails
  // ... other fields
];
```

## 🔧 Configuration & Optimization

### System Configuration

```typescript
// Configurable delays and limits
const BIO_FETCH_DELAY = await SystemConfig.get('bio', 'fetch_delay_ms');
const MAX_BIO_FETCH_PER_JOB = await SystemConfig.get('bio', 'max_fetches_per_job');
const ENABLE_BIO_ENHANCEMENT = await SystemConfig.get('bio', 'enable_enhancement');
```

### Performance Considerations

1. **Batch Processing**: Process profiles in groups
2. **Caching**: Cache enhanced profiles within job
3. **Selective Enhancement**: Only enhance profiles without bio
4. **Parallel Limits**: Control concurrent API calls

## 📊 Analytics & Monitoring

### Key Metrics

1. **Bio Coverage**:
   - % of profiles with bio data
   - Average bio length
   - Bio fetch success rate

2. **Email Extraction**:
   - % of profiles with emails
   - Average emails per profile
   - Email format distribution

3. **Performance**:
   - Average fetch time per profile
   - API call success rate
   - Rate limit incidents

### Dashboard Queries

```sql
-- Bio coverage by platform
SELECT 
  platform,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 END) as profiles_with_bio,
  AVG(LENGTH(bio)) as avg_bio_length
FROM creator_profiles
GROUP BY platform;

-- Email extraction success
SELECT 
  platform,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN emails IS NOT NULL AND emails != '[]' THEN 1 END) as profiles_with_email,
  SUM(JSON_ARRAY_LENGTH(emails)) as total_emails_found
FROM creator_profiles
GROUP BY platform;
```

---

**Impact**: The bio & email extraction system significantly enhances lead generation capabilities by automatically extracting contact information from creator profiles, enabling direct outreach for influencer partnerships.