# 🖼️ Image Proxy System - Universal HEIC & CDN Handling

## Overview
Comprehensive image proxy system that handles HEIC conversion, bypasses CDN restrictions, provides fallback placeholders, and optimizes image delivery across all platforms with advanced retry strategies.

## 🏗️ Image Proxy Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMAGE PROXY PROCESSING FLOW                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend Image Request                                         │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Proxy URL     │                                           │
│  │                 │                                           │
│  │ /api/proxy/     │                                           │
│  │ image?url=...   │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   URL Analysis  │                                           │
│  │                 │                                           │
│  │ • Format Check  │                                           │
│  │ • CDN Detection │                                           │
│  │ • Platform ID   │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   Multi-Layer   │                                           │
│  │   Fetch         │                                           │
│  │                 │                                           │
│  │ Layer 1: Headers│                                           │
│  │ Layer 2: No Ref │                                           │
│  │ Layer 3: Simple │                                           │
│  │ Layer 4: Minimal│                                           │
│  │ Layer 5: Alt CDN│                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   HEIC/HEIF     │    │   Standard      │                    │
│  │   Conversion    │    │   Images        │                    │
│  │                 │    │                 │                    │
│  │ heic-convert    │    │ Direct Pass     │                    │
│  │ → JPEG          │    │ Through         │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                        │                             │
│         ▼                        ▼                             │
│  ┌─────────────────────────────────────────┐                    │
│  │            RESPONSE DELIVERY            │                    │
│  │                                         │                    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐ │                    │
│  │  │Success  │  │Converted│  │Placeholder│ │                   │
│  │  │Image    │  │HEIC     │  │SVG      │ │                    │
│  │  └─────────┘  └─────────┘  └─────────┘ │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Core Implementation

### File: `app/api/proxy/image/route.ts`

#### **Main Proxy Endpoint**:
```typescript
export async function GET(request: Request) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    console.log('🖼️ [IMAGE-PROXY] Starting image proxy request');
    console.log('🔗 [IMAGE-PROXY] Source URL:', imageUrl);

    if (!imageUrl) {
      return new NextResponse('Missing image URL', { status: 400 });
    }

    // Step 1: Format Detection
    const isHeic = imageUrl.toLowerCase().includes('.heic') || 
                   imageUrl.toLowerCase().includes('.heif');
    console.log('🔍 [IMAGE-PROXY] Detected format:', isHeic ? 'HEIC/HEIF' : 'Other');

    // Step 2: Multi-Layer Fetch Strategy
    const { response, fetchStrategy } = await performMultiLayerFetch(imageUrl);

    if (!response.ok) {
      // Step 3: Fallback to Placeholder
      return generatePlaceholderResponse(imageUrl);
    }

    // Step 4: Process Image Data
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(new Uint8Array(arrayBuffer));
    let contentType = response.headers.get('content-type') || 'image/jpeg';

    // Step 5: HEIC Conversion if Needed
    if (isHeic || contentType === 'image/heic' || contentType === 'image/heif') {
      const conversionResult = await convertHeicImage(buffer);
      buffer = conversionResult.buffer;
      contentType = conversionResult.contentType;
    }

    const totalTime = Date.now() - startTime;
    console.log('🏁 [IMAGE-PROXY] Total processing time:', totalTime + 'ms');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Image-Proxy-Time': totalTime.toString(),
        'X-Image-Proxy-Source': conversionResult?.method || 'original',
        'X-Image-Fetch-Strategy': fetchStrategy,
      },
    });
  } catch (error) {
    console.error('❌ [IMAGE-PROXY] Critical error:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
```

## 🔄 Multi-Layer Fetch Strategy

### 5-Layer CDN Bypass System

#### **Layer 1: Enhanced Headers**
```typescript
const fetchHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

// TikTok-specific headers
if (imageUrl.includes('tiktokcdn')) {
  fetchHeaders['Referer'] = 'https://www.tiktok.com/';
  fetchHeaders['Origin'] = 'https://www.tiktok.com';
  fetchHeaders['Sec-Fetch-Dest'] = 'image';
  fetchHeaders['Sec-Fetch-Mode'] = 'no-cors';
  fetchHeaders['Sec-Fetch-Site'] = 'cross-site';
  console.log('🎯 [IMAGE-PROXY] Using TikTok-specific headers');
}
```

#### **Layer 2: Remove Referrer Headers**
```typescript
if (response.status === 403) {
  console.log('🔄 [IMAGE-PROXY] Retry 1: Removing referrer headers...');
  const noReferrerHeaders = { ...fetchHeaders };
  delete noReferrerHeaders['Referer'];
  delete noReferrerHeaders['Origin'];
  
  response = await fetch(imageUrl, { headers: noReferrerHeaders });
  console.log('📡 [IMAGE-PROXY] Retry 1 status:', response.status);
  
  if (response.ok) {
    fetchStrategy = 'no-referrer';
  }
}
```

#### **Layer 3: Simplified URL**
```typescript
if (response.status === 403 && imageUrl.includes('tiktokcdn')) {
  console.log('🔄 [IMAGE-PROXY] Retry 2: Simplifying TikTok URL...');
  const simplifiedUrl = imageUrl.split('?')[0]; // Remove query parameters
  
  response = await fetch(simplifiedUrl, { headers: noReferrerHeaders });
  console.log('📡 [IMAGE-PROXY] Retry 2 status:', response.status);
  
  if (response.ok) {
    fetchStrategy = 'simplified-url';
  }
}
```

#### **Layer 4: Minimal Headers**
```typescript
if (response.status === 403) {
  console.log('🔄 [IMAGE-PROXY] Retry 3: Using minimal headers...');
  const minimalHeaders = {
    'User-Agent': 'curl/7.68.0',
    'Accept': '*/*'
  };
  
  response = await fetch(simplifiedUrl, { headers: minimalHeaders });
  console.log('📡 [IMAGE-PROXY] Retry 3 status:', response.status);
  
  if (response.ok) {
    fetchStrategy = 'minimal-headers';
  }
}
```

#### **Layer 5: Alternative CDN Domains**
```typescript
if (response.status === 403) {
  console.log('🔄 [IMAGE-PROXY] Retry 4: Trying alternative CDN domains...');
  const cdnDomains = [
    'p16-sign-va.tiktokcdn.com',
    'p19-sign-va.tiktokcdn.com', 
    'p16-amd-va.tiktokcdn.com',
    'p77-sign-va.tiktokcdn.com'
  ];
  
  for (const domain of cdnDomains) {
    if (simplifiedUrl.includes(domain)) continue;
    
    const alternativeDomainUrl = simplifiedUrl.replace(
      /p\d+-[^.]+\.tiktokcdn[^/]*/, 
      domain
    );
    
    try {
      response = await fetch(alternativeDomainUrl, { headers: minimalHeaders });
      console.log('📡 [IMAGE-PROXY] Alternative domain status:', response.status);
      
      if (response.ok) {
        fetchStrategy = 'alternative-domain';
        break;
      }
    } catch (domainError) {
      console.log('❌ [IMAGE-PROXY] Alternative domain failed:', domain);
      continue;
    }
  }
}
```

## 🔄 HEIC Conversion System

### Vercel-Compatible HEIC Processing

#### **Primary Method: heic-convert Package**
```typescript
async function convertHeicImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: string;
  method: string;
}> {
  try {
    console.log('🔄 [IMAGE-PROXY] Converting HEIC using heic-convert package...');
    const convertStartTime = Date.now();
    
    // Primary conversion method (works on Vercel)
    const outputBuffer = await convert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.85
    });
    
    const convertTime = Date.now() - convertStartTime;
    const convertedBuffer = Buffer.from(outputBuffer);
    
    console.log('✅ [IMAGE-PROXY] HEIC conversion successful with heic-convert');
    console.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
    console.log('📏 [IMAGE-PROXY] Converted buffer size:', convertedBuffer.length, 'bytes');
    
    return {
      buffer: convertedBuffer,
      contentType: 'image/jpeg',
      method: 'heic-converted'
    };
  } catch (heicConvertError) {
    console.error('❌ [IMAGE-PROXY] heic-convert failed:', heicConvertError.message);
    return trySharpFallback(buffer);
  }
}
```

#### **Fallback Method: Sharp**
```typescript
async function trySharpFallback(buffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: string;
  method: string;
}> {
  try {
    console.log('🔄 [IMAGE-PROXY] Trying Sharp as fallback...');
    
    const convertStartTime = Date.now();
    const convertedBuffer = await sharp(buffer)
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const convertTime = Date.now() - convertStartTime;
    
    console.log('✅ [IMAGE-PROXY] HEIC conversion successful with Sharp fallback');
    console.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
    
    return {
      buffer: convertedBuffer,
      contentType: 'image/jpeg',
      method: 'sharp-converted'
    };
  } catch (sharpError) {
    console.error('❌ [IMAGE-PROXY] Sharp fallback also failed:', sharpError.message);
    return tryJpegAlternative(buffer);
  }
}
```

#### **Final Fallback: JPEG URL Alternative**
```typescript
async function tryJpegAlternative(originalBuffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: string;
  method: string;
}> {
  try {
    if (imageUrl.includes('tiktokcdn') && imageUrl.includes('.heic')) {
      console.log('🔄 [IMAGE-PROXY] Trying to fetch JPEG version from TikTok...');
      
      // Replace .heic with .jpeg and remove quality params
      let jpegUrl = imageUrl.replace(/\.heic(\?|$)/, '.jpeg$1');
      jpegUrl = jpegUrl.replace(/~tplv-[^~]*~/g, '~tplv-default~');
      
      const jpegResponse = await fetch(jpegUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (jpegResponse.ok) {
        const jpegArrayBuffer = await jpegResponse.arrayBuffer();
        const jpegBuffer = Buffer.from(new Uint8Array(jpegArrayBuffer));
        
        console.log('✅ [IMAGE-PROXY] Successfully fetched JPEG alternative');
        
        return {
          buffer: jpegBuffer,
          contentType: 'image/jpeg',
          method: 'jpeg-alternative'
        };
      }
    }
    
    // Keep original if no alternatives work
    console.log('🔄 [IMAGE-PROXY] Serving original HEIC (modern browsers may support it)');
    return {
      buffer: originalBuffer,
      contentType: 'image/heic',
      method: 'heic-original'
    };
  } catch (error) {
    console.error('❌ [IMAGE-PROXY] All conversion methods failed:', error.message);
    return {
      buffer: originalBuffer,
      contentType: 'image/heic',
      method: 'heic-original'
    };
  }
}
```

## 🎨 Placeholder Generation System

### Dynamic SVG Placeholders

#### **Platform-Specific Placeholders**
```typescript
function generatePlaceholderResponse(imageUrl: string) {
  console.log('🎨 [IMAGE-PROXY] Generating placeholder for failed image:', imageUrl);
  
  let initial = '?';
  let color = '#6B7280'; // Default gray
  
  try {
    // Platform-specific styling
    if (imageUrl.includes('instagram')) {
      initial = 'I';
      color = '#E1306C'; // Instagram pink
    } else if (imageUrl.includes('tiktok')) {
      initial = 'T';
      color = '#FF0050'; // TikTok red
    } else if (imageUrl.includes('youtube')) {
      initial = 'Y';
      color = '#FF0000'; // YouTube red
    } else {
      initial = 'U'; // Unknown/User
      color = '#3B82F6'; // Blue
    }
  } catch (e) {
    // Use defaults
  }
  
  const placeholderSvg = `
    <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
      <circle cx="75" cy="75" r="75" fill="${color}"/>
      <text x="75" y="85" font-family="Arial, sans-serif" font-size="60" font-weight="bold" 
            fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `;
  
  console.log('✅ [IMAGE-PROXY] Generated placeholder SVG');
  
  return new NextResponse(Buffer.from(placeholderSvg), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300', // 5 minute cache
      'Access-Control-Allow-Origin': '*',
      'X-Image-Proxy-Source': 'placeholder-network-error',
      'X-Image-Original-Format': 'failed',
    },
  });
}
```

#### **User-Specific Placeholders for TikTok**
```typescript
// Generate personalized placeholder for blocked TikTok images
if (imageUrl.includes('tiktokcdn') && response.status === 403) {
  console.log('🔄 [IMAGE-PROXY] Serving placeholder for blocked TikTok image');
  
  // Extract username from URL for personalization
  const username = imageUrl.split('/').pop()?.split('~')[0] || 'user';
  const color = `hsl(${username.charCodeAt(0) * 7 % 360}, 70%, 50%)`;
  const initial = username.charAt(0).toUpperCase();
  
  const placeholderSvg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="100" fill="${color}"/>
      <text x="100" y="120" font-family="Arial, sans-serif" font-size="80" font-weight="bold" 
            fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `;
  
  return new NextResponse(Buffer.from(placeholderSvg), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
      'X-Image-Proxy-Source': 'placeholder-403',
      'X-Image-Final-Status': '403-placeholder',
    },
  });
}
```

## 📊 Error Handling & Recovery

### Network Error Handling

#### **DNS Resolution Errors**
```typescript
catch (fetchError: any) {
  console.error('❌ [IMAGE-PROXY] Network error:', fetchError.message);
  
  // Handle DNS resolution errors (common with Instagram CDN)
  if (fetchError.cause?.code === 'ENOTFOUND' || 
      fetchError.message.includes('getaddrinfo ENOTFOUND')) {
    console.log('🔄 [IMAGE-PROXY] DNS resolution failed, generating placeholder...');
    return generatePlaceholderResponse(imageUrl);
  }
  
  // Handle other network errors
  console.log('🔄 [IMAGE-PROXY] Network error, generating placeholder...');
  return generatePlaceholderResponse(imageUrl);
}
```

#### **CDN Restrictions**
```typescript
// Special handling for 403 Forbidden from TikTok CDN
if (response.status === 403 && imageUrl.includes('tiktokcdn')) {
  // Try multiple strategies before giving up
  const strategies = [
    'no-referrer',
    'simplified-url', 
    'minimal-headers',
    'alternative-domain'
  ];
  
  for (const strategy of strategies) {
    const result = await tryFetchStrategy(imageUrl, strategy);
    if (result.ok) {
      console.log(`✅ [IMAGE-PROXY] Success with strategy: ${strategy}`);
      return result;
    }
  }
  
  // All strategies failed, serve placeholder
  return generatePlaceholderResponse(imageUrl);
}
```

### Performance Monitoring

#### **Response Headers for Debugging**
```typescript
return new NextResponse(buffer, {
  headers: {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
    'X-Image-Proxy-Time': totalTime.toString(),
    'X-Image-Proxy-Source': conversionMethod,
    'X-Image-Original-Format': isHeic ? 'heic' : 'other',
    'X-Image-Fetch-Strategy': fetchStrategy,
    'X-Image-Final-Status': response.status.toString(),
  },
});
```

#### **Performance Logging**
```typescript
console.log('📊 [IMAGE-PROXY] Fetch completed in', fetchTime + 'ms');
console.log('⏱️ [IMAGE-PROXY] Conversion time:', convertTime + 'ms');
console.log('🏁 [IMAGE-PROXY] Total processing time:', totalTime + 'ms');
console.log('📏 [IMAGE-PROXY] Final buffer size:', buffer.length, 'bytes');
```

## 🔧 Frontend Integration

### Universal Image Component Usage

#### **Profile Image with Proxy**
```typescript
// Frontend usage pattern
const getProxiedImageUrl = (originalUrl: string): string => {
  if (!originalUrl) return '/default-avatar.png';
  return `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
};

// Usage in components
<AvatarImage
  src={getProxiedImageUrl(creator.profile_pic_url)}
  onLoad={(e) => handleImageLoad(e, creator.username)}
  onError={(e) => handleImageError(e, creator.username)}
  alt={`${creator.username} profile`}
/>
```

#### **Image Loading Event Handlers**
```typescript
const handleImageLoad = (e: Event, username: string) => {
  const img = e.target as HTMLImageElement;
  console.log('✅ [BROWSER-IMAGE] Image loaded successfully for', username);
  console.log('  📏 Natural size:', img.naturalWidth + 'x' + img.naturalHeight);
  console.log('  🔗 Loaded URL:', img.src);
  
  // Check response headers for debugging
  fetch(img.src, { method: 'HEAD' })
    .then(response => {
      console.log('  🔧 Proxy headers:', {
        strategy: response.headers.get('X-Image-Fetch-Strategy'),
        source: response.headers.get('X-Image-Proxy-Source'),
        time: response.headers.get('X-Image-Proxy-Time') + 'ms'
      });
    });
};

const handleImageError = (e: Event, username: string) => {
  const img = e.target as HTMLImageElement;
  console.error('❌ [BROWSER-IMAGE] Image failed to load for', username);
  console.error('  🔗 Failed URL:', img.src);
  
  // Hide broken images gracefully
  img.style.display = 'none';
};
```

## 🎯 Cache Strategy

### Multi-Level Caching

#### **Browser Cache Headers**
```typescript
// Successful images - cache for 1 hour
'Cache-Control': 'public, max-age=3600'

// Placeholders - cache for 5 minutes (shorter to retry sooner)
'Cache-Control': 'public, max-age=300'

// Failed requests - no cache
'Cache-Control': 'no-cache, no-store'
```

#### **CDN Considerations**
- **TikTok CDN**: Often blocks requests, requires multiple retry strategies
- **Instagram CDN**: DNS resolution issues common, fallback to placeholders
- **YouTube CDN**: Generally reliable, standard processing
- **Profile Images**: High cache duration for avatar images
- **Content Images**: Medium cache duration for post images

## 🔍 Debugging & Monitoring

### Comprehensive Logging

#### **Request Flow Logging**
```typescript
console.log('🖼️ [IMAGE-PROXY] Starting image proxy request');
console.log('🔗 [IMAGE-PROXY] Source URL:', imageUrl);
console.log('🔍 [IMAGE-PROXY] Detected format:', isHeic ? 'HEIC/HEIF' : 'Other');
console.log('🎯 [IMAGE-PROXY] Using TikTok-specific headers');
console.log('📡 [IMAGE-PROXY] Fetch status:', response.status, response.statusText);
console.log('🔄 [IMAGE-PROXY] Retry strategy:', strategy);
console.log('✅ [IMAGE-PROXY] HEIC conversion successful');
console.log('🏁 [IMAGE-PROXY] Total processing time:', totalTime + 'ms');
```

#### **Error Tracking**
```typescript
// Track different types of failures
const errorTypes = {
  networkError: 'DNS/Network failure',
  cdnBlocked: '403 Forbidden from CDN', 
  conversionFailed: 'HEIC conversion failed',
  invalidUrl: 'Invalid image URL provided'
};

// Log with error classification
console.error('❌ [IMAGE-PROXY] Error type:', errorTypes.cdnBlocked);
console.error('📍 [IMAGE-PROXY] Failed URL:', imageUrl);
console.error('🔧 [IMAGE-PROXY] Attempted strategies:', attemptedStrategies);
```

### Performance Metrics

#### **Key Performance Indicators**
- **Average Processing Time**: Target < 2 seconds
- **HEIC Conversion Rate**: % of HEIC images successfully converted
- **CDN Success Rate**: % of images fetched successfully vs placeholders
- **Cache Hit Rate**: Browser cache effectiveness
- **Error Rate by Platform**: Track which CDNs cause most issues

#### **Monitoring Queries**
```sql
-- Image proxy performance monitoring
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  AVG(processing_time_ms) as avg_processing_time,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN status = 'placeholder' THEN 1 ELSE 0 END) as placeholder_requests,
  SUM(CASE WHEN conversion_method = 'heic-converted' THEN 1 ELSE 0 END) as heic_conversions
FROM image_proxy_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

**Impact**: The image proxy system ensures reliable image delivery across all platforms by handling format conversion, bypassing CDN restrictions, and providing graceful fallbacks, resulting in a consistent user experience regardless of external service limitations.