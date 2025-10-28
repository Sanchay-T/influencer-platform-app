# 🎯 Task: Creator Enrichment API Integration

## Overview

Integrate the Influencers.Club enrichment API to provide detailed creator insights when users view creator profiles. This will transform our platform from a basic search tool into a comprehensive creator intelligence platform.

**Estimated Time**: 2-3 weeks
**Priority**: High
**Complexity**: Medium

---

## 📋 Task Requirements

### Objective
Build a system that enriches creator profiles with detailed data from the Influencers.Club API, including:
- Verified email addresses
- Precise engagement metrics
- Historical growth data
- Brand partnership information
- Cross-platform account discovery
- Recent content performance

### Success Criteria
- ✅ Users can enrich creator profiles by clicking "Enrich Profile" button
- ✅ Enriched data is cached in database for 14 days
- ✅ Plan-based limits are enforced (Free: 5/month, Paid: unlimited)
- ✅ Enriched data displays in creator detail view
- ✅ API errors are handled gracefully with user-friendly messages
- ✅ Loading states show during enrichment process

---

## 🔧 API Specification

### Base URL
```
https://api-dashboard.influencers.club
```

### Authentication
```
Authorization: Bearer {INFLUENCERS_CLUB_API_KEY}
```

### Endpoint: Enrich by Handle (Full)

**URL**: `POST /public/v1/creators/enrich/handle/full/`

**Request Headers**:
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "Content-Type": "application/json"
}
```

**Request Body**:
```json
{
  "handle": "thespinaparianos",
  "platform": "tiktok",
  "include_lookalikes": false,
  "email_required": "preferred"
}
```

**Request Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `handle` | string | Yes | Creator's username/handle (without @) |
| `platform` | string | Yes | Platform name: `tiktok`, `instagram`, `youtube` |
| `include_lookalikes` | boolean | No | Include similar creators (default: false) |
| `email_required` | string | No | Email handling: `preferred` or `must_have` (default: `preferred`) |

**Response** (200 OK):
```json
{
  "result": {
    "tiktok": {
      "username": "thespinaparianos",
      "full_name": "Thespina Parianos",
      "user_id": "6626387164711305221",
      "biography": "south florida\nthespina@underscoretalent.com\n🇬🇷",

      // Contact Info
      "email": "thespina@underscoretalent.com",
      "region": "United States",
      "language_code": ["en"],
      "language_confidence": [99],

      // Engagement Metrics
      "follower_count": 175781,
      "following_count": 441,
      "engagement_percent": 8.885570258679445,
      "avg_likes": 8210.58,
      "likes_median": 1270,
      "avg_comments": 72.67,
      "comments_median": 22,
      "avg_views": 63387.61,
      "play_count_median": 16842,

      // Growth Analytics
      "creator_follower_growth": {
        "3_months_ago": 3.29,
        "6_months_ago": 12.58,
        "9_months_ago": 25.89,
        "12_months_ago": 30.51
      },

      // Content Strategy
      "video_count": 556,
      "total_likes": 5618210,
      "posting_frequency_recent_months": 11,
      "duration_avg": 57.55,
      "most_recent_post_date": "2025-10-27",

      // Monetization
      "has_paid_partnership": true,
      "has_merch": false,
      "promotes_affiliate_links": false,
      "brands_found": [
        "alo", "maccosmetics", "YSL", "Fenty",
        "Tatcha", "Anastasia", "houseofcb"
        // ... 30+ brands total
      ],

      // Account Status
      "is_verified": false,
      "is_private": false,
      "is_business_account": true,
      "niche_class": ["Lifestyle"],

      // Connected Platforms
      "related_platforms": {
        "instagram_main": "thespinaparianos",
        "instagram": ["thespinaparianos"],
        "youtube_ids_main": "UCEVOvCLM9Huw-NJ14uLI6bw",
        "youtube_ids": ["UCEVOvCLM9Huw-NJ14uLI6bw"]
      },

      // Recent Content (30+ posts)
      "post_data": [
        {
          "post_id": "7565928075544857887",
          "created_at": "2025-10-27T15:45:31",
          "caption": "spend this beautiful monday morning with me",
          "post_url": "https://www.tiktok.com/@thespinaparianos/video/7565928075544857887",
          "media": {
            "type": "video",
            "url": "https://v16m.tiktokcdn-eu.com/...",
            "video_duration": 55
          },
          "engagement": {
            "like_count": 976,
            "comment_count": 15,
            "view_count": 6531,
            "share_count": 6
          },
          "mentions": ["Diorbeauty"],
          "sound": {
            "sound_name": "Solid (feat. Drake)"
          }
        }
        // ... 29 more posts
      ],

      // Hashtag Strategy
      "hashtags": ["DGMakeup", "DGBeauty"],
      "hashtags_count": {
        "DGMakeup": 15,
        "DGBeauty": 15
      }
    },

    // Cross-platform enrichment
    "instagram": {
      "userid": "1624793197",
      "username": "thespinaparianos",
      "full_name": "Thespina Parianos",
      "follower_count": 38156,
      "engagement_percent": 1.458
    },

    "youtube": {
      "id": "UCEVOvCLM9Huw-NJ14uLI6bw",
      "custom_url": "@thespinaparianos",
      "subscriber_count": 2680,
      "engagement_percent": 9.29
    }
  }
}
```

**Error Responses**:

**400 Bad Request**:
```json
{
  "error": "No data found for the provided input."
}
```

**404 Not Found**:
```json
{
  "error": "User not found on the specified platform."
}
```

**401 Unauthorized**:
```json
{
  "error": "Invalid API key"
}
```

**429 Too Many Requests**:
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

---

## 🗄️ Database Schema Changes

### Update `creator_profiles` Table

The table already exists with a `metadata` JSONB column. Use this structure:

```sql
-- No schema changes needed! The table already has metadata column
-- Just use this structure for storing enriched data:

UPDATE creator_profiles
SET metadata = {
  "enriched_at": "2025-10-28T15:30:00Z",
  "enrichment_source": "influencers_club",
  "cache_expires_at": "2025-11-11T15:30:00Z",
  "data": {
    // Store entire API response here
    "tiktok": { ... },
    "instagram": { ... },
    "youtube": { ... }
  }
}
WHERE id = 'creator-uuid';
```

### Add Usage Tracking

Update `user_usage` table to track enrichments:

```sql
-- Add enrichment tracking column
ALTER TABLE user_usage
ADD COLUMN IF NOT EXISTS enrichments_current_month INTEGER DEFAULT 0;

-- Reset monthly (handled by existing cron job)
UPDATE user_usage
SET enrichments_current_month = 0
WHERE usage_reset_date < NOW();
```

---

## 📁 File Structure

Create these new files:

```
/lib/services/
  └── creator-enrichment.ts       # Main enrichment service

/app/api/creators/
  └── enrich/
      └── route.ts                # POST /api/creators/enrich

/app/api/creators/[id]/
  └── enriched-data/
      └── route.ts                # GET /api/creators/:id/enriched-data

/app/components/creators/
  └── EnrichButton.tsx            # "Enrich Profile" button
  └── EnrichedDataDisplay.tsx     # Display enriched data
  └── EnrichmentBadge.tsx         # Show enrichment status

/lib/types/
  └── enrichment.ts               # TypeScript types
```

---

## 💻 Implementation Guide

### Step 1: Create Enrichment Service

**File**: `/lib/services/creator-enrichment.ts`

```typescript
import { db } from '@/lib/db';
import { creatorProfiles, userUsage } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface EnrichmentOptions {
  handle: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  includeLookalikes?: boolean;
  emailRequired?: 'preferred' | 'must_have';
}

export interface EnrichedCreatorData {
  enriched_at: string;
  enrichment_source: string;
  cache_expires_at: string;
  data: any; // Full API response
}

export class CreatorEnrichmentService {
  private static API_BASE = 'https://api-dashboard.influencers.club';
  private static CACHE_DURATION_DAYS = 14;

  /**
   * Enrich a creator profile with detailed data
   */
  static async enrichCreator(
    userId: string,
    creatorId: string,
    options: EnrichmentOptions
  ): Promise<EnrichedCreatorData> {
    // 1. Check if enrichment is cached and valid
    const cached = await this.getCachedEnrichment(creatorId);
    if (cached && this.isCacheValid(cached.cache_expires_at)) {
      console.log(`✅ Using cached enrichment for creator ${creatorId}`);
      return cached;
    }

    // 2. Check user's enrichment limit
    const canEnrich = await this.checkEnrichmentLimit(userId);
    if (!canEnrich) {
      throw new Error('LIMIT_REACHED');
    }

    // 3. Call Influencers.Club API
    console.log(`🔍 Enriching creator: ${options.handle} (${options.platform})`);
    const enrichedData = await this.callEnrichmentAPI(options);

    // 4. Cache the enriched data
    await this.cacheEnrichment(creatorId, enrichedData);

    // 5. Track usage
    await this.trackEnrichmentUsage(userId);

    return {
      enriched_at: new Date().toISOString(),
      enrichment_source: 'influencers_club',
      cache_expires_at: this.getCacheExpiryDate(),
      data: enrichedData
    };
  }

  /**
   * Call Influencers.Club API
   */
  private static async callEnrichmentAPI(
    options: EnrichmentOptions
  ): Promise<any> {
    const url = `${this.API_BASE}/public/v1/creators/enrich/handle/full/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.INFLUENCERS_CLUB_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        handle: options.handle,
        platform: options.platform.toLowerCase(),
        include_lookalikes: options.includeLookalikes || false,
        email_required: options.emailRequired || 'preferred'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Enrichment API failed');
    }

    return await response.json();
  }

  /**
   * Check if user can enrich more creators
   */
  private static async checkEnrichmentLimit(userId: string): Promise<boolean> {
    const usage = await db.query.userUsage.findFirst({
      where: eq(userUsage.userId, userId)
    });

    const subscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId)
    });

    if (!usage || !subscription) return false;

    // Plan limits
    const limits: Record<string, number> = {
      'free': 5,
      'glow_up': 50,
      'viral_surge': 200,
      'fame_flex': -1 // unlimited
    };

    const limit = limits[subscription.currentPlan] || 0;

    // Unlimited plan
    if (limit === -1) return true;

    // Check monthly usage
    return usage.enrichments_current_month < limit;
  }

  /**
   * Get cached enrichment data
   */
  private static async getCachedEnrichment(
    creatorId: string
  ): Promise<EnrichedCreatorData | null> {
    const creator = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.id, creatorId)
    });

    if (!creator?.metadata || typeof creator.metadata !== 'object') {
      return null;
    }

    const metadata = creator.metadata as any;

    if (!metadata.enriched_at || !metadata.data) {
      return null;
    }

    return {
      enriched_at: metadata.enriched_at,
      enrichment_source: metadata.enrichment_source,
      cache_expires_at: metadata.cache_expires_at,
      data: metadata.data
    };
  }

  /**
   * Cache enriched data in database
   */
  private static async cacheEnrichment(
    creatorId: string,
    enrichedData: any
  ): Promise<void> {
    const metadata: EnrichedCreatorData = {
      enriched_at: new Date().toISOString(),
      enrichment_source: 'influencers_club',
      cache_expires_at: this.getCacheExpiryDate(),
      data: enrichedData
    };

    await db.update(creatorProfiles)
      .set({ metadata: metadata as any })
      .where(eq(creatorProfiles.id, creatorId));
  }

  /**
   * Track enrichment usage
   */
  private static async trackEnrichmentUsage(userId: string): Promise<void> {
    await db.update(userUsage)
      .set({
        enrichments_current_month: db.$increment(userUsage.enrichments_current_month, 1)
      })
      .where(eq(userUsage.userId, userId));
  }

  /**
   * Check if cache is still valid
   */
  private static isCacheValid(expiryDate: string): boolean {
    return new Date(expiryDate) > new Date();
  }

  /**
   * Get cache expiry date (14 days from now)
   */
  private static getCacheExpiryDate(): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + this.CACHE_DURATION_DAYS);
    return expiry.toISOString();
  }
}
```

### Step 2: Create API Endpoint

**File**: `/app/api/creators/enrich/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { CreatorEnrichmentService } from '@/lib/services/creator-enrichment';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { creatorId, handle, platform } = body;

    // 3. Validate input
    if (!creatorId || !handle || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: creatorId, handle, platform' },
        { status: 400 }
      );
    }

    if (!['tiktok', 'instagram', 'youtube'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be: tiktok, instagram, or youtube' },
        { status: 400 }
      );
    }

    // 4. Enrich creator
    const enrichedData = await CreatorEnrichmentService.enrichCreator(
      userId,
      creatorId,
      { handle, platform }
    );

    // 5. Return enriched data
    return NextResponse.json({
      success: true,
      data: enrichedData
    });

  } catch (error: any) {
    console.error('Enrichment error:', error);

    // Handle specific errors
    if (error.message === 'LIMIT_REACHED') {
      return NextResponse.json(
        {
          error: 'Enrichment limit reached. Upgrade your plan to enrich more creators.',
          code: 'LIMIT_REACHED'
        },
        { status: 403 }
      );
    }

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Creator not found on this platform' },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to enrich creator. Please try again.' },
      { status: 500 }
    );
  }
}
```

**File**: `/app/api/creators/[id]/enriched-data/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { db } from '@/lib/db';
import { creatorProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get creator profile
    const creator = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.id, params.id)
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // 3. Return enriched data (if exists)
    const metadata = creator.metadata as any;

    if (!metadata?.enriched_at) {
      return NextResponse.json({
        enriched: false,
        data: null
      });
    }

    return NextResponse.json({
      enriched: true,
      data: metadata
    });

  } catch (error) {
    console.error('Error fetching enriched data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enriched data' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create UI Components

**File**: `/app/components/creators/EnrichButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface EnrichButtonProps {
  creatorId: string;
  handle: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  isEnriched?: boolean;
  onEnriched?: (data: any) => void;
}

export function EnrichButton({
  creatorId,
  handle,
  platform,
  isEnriched = false,
  onEnriched
}: EnrichButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleEnrich = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/creators/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          handle,
          platform
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'LIMIT_REACHED') {
          toast.error('Enrichment limit reached', {
            description: 'Upgrade your plan to enrich more creators'
          });
        } else {
          toast.error(result.error || 'Failed to enrich creator');
        }
        return;
      }

      toast.success('Creator profile enriched!', {
        description: 'Detailed insights are now available'
      });

      onEnriched?.(result.data);

    } catch (error) {
      console.error('Enrichment error:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (isEnriched) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Sparkles className="w-4 h-4 mr-2" />
        Enriched
      </Button>
    );
  }

  return (
    <Button
      onClick={handleEnrich}
      disabled={loading}
      size="sm"
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {!loading && <Sparkles className="w-4 h-4 mr-2" />}
      Enrich Profile
    </Button>
  );
}
```

**File**: `/app/components/creators/EnrichedDataDisplay.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, TrendingUp, Users, Calendar } from 'lucide-react';

interface EnrichedDataDisplayProps {
  data: any;
  platform: string;
}

export function EnrichedDataDisplay({ data, platform }: EnrichedDataDisplayProps) {
  const platformData = data.data?.result?.[platform.toLowerCase()];

  if (!platformData) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Contact Information */}
      {platformData.email && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Email:</span>
                <a
                  href={`mailto:${platformData.email}`}
                  className="ml-2 text-sm font-medium hover:underline"
                >
                  {platformData.email}
                </a>
              </div>
              {platformData.region && (
                <div>
                  <span className="text-sm text-muted-foreground">Location:</span>
                  <span className="ml-2 text-sm">{platformData.region}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Engagement Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {platformData.engagement_percent && (
              <div>
                <div className="text-2xl font-bold">
                  {platformData.engagement_percent.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">Engagement Rate</div>
              </div>
            )}
            {platformData.avg_likes && (
              <div>
                <div className="text-2xl font-bold">
                  {platformData.avg_likes.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Avg Likes</div>
              </div>
            )}
            {platformData.avg_comments && (
              <div>
                <div className="text-2xl font-bold">
                  {platformData.avg_comments.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Avg Comments</div>
              </div>
            )}
            {platformData.posting_frequency_recent_months && (
              <div>
                <div className="text-2xl font-bold">
                  {platformData.posting_frequency_recent_months}
                </div>
                <div className="text-xs text-muted-foreground">Posts/Month</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Growth Analytics */}
      {platformData.creator_follower_growth && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Follower Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(platformData.creator_follower_growth).map(([period, growth]) => (
                <div key={period} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {period.replace('_', ' ')}:
                  </span>
                  <Badge variant={Number(growth) > 0 ? 'default' : 'secondary'}>
                    +{growth}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Brand Partnerships */}
      {platformData.brands_found && platformData.brands_found.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Brand Partnerships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {platformData.brands_found.slice(0, 10).map((brand: string) => (
                <Badge key={brand} variant="outline">
                  {brand}
                </Badge>
              ))}
              {platformData.brands_found.length > 10 && (
                <Badge variant="secondary">
                  +{platformData.brands_found.length - 10} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Platforms */}
      {platformData.related_platforms && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connected Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {platformData.related_platforms.instagram_main && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Instagram:</span>
                  <a
                    href={`https://instagram.com/${platformData.related_platforms.instagram_main}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    @{platformData.related_platforms.instagram_main}
                  </a>
                </div>
              )}
              {platformData.related_platforms.youtube_ids_main && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">YouTube:</span>
                  <a
                    href={`https://youtube.com/channel/${platformData.related_platforms.youtube_ids_main}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Channel
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## 🧪 Testing Instructions

### 1. Test API Integration

Run the test script:
```bash
node scripts/test-enrichment-api-demo.js
```

This will:
- Query real creators from your database
- Call the enrichment API
- Show detailed request/response examples
- Save responses to `logs/enrichment-tests/`

### 2. Manual Testing Steps

1. **Test Enrichment Button**:
   - Navigate to a creator profile
   - Click "Enrich Profile"
   - Verify loading state shows
   - Check toast notification appears
   - Confirm enriched data displays

2. **Test Caching**:
   - Enrich a creator
   - Refresh the page
   - Verify button shows "Enriched" (not "Enrich Profile")
   - Check data loads from cache (check Network tab)

3. **Test Plan Limits**:
   - Create a free plan user
   - Enrich 5 creators
   - Try to enrich 6th creator
   - Verify error message about limit

4. **Test Error Handling**:
   - Try enriching invalid handle
   - Check error message displays
   - Verify no data is cached

### 3. Database Verification

```sql
-- Check enriched creators
SELECT
  id,
  handle,
  platform,
  metadata->>'enriched_at' as enriched_at,
  metadata->>'cache_expires_at' as cache_expires
FROM creator_profiles
WHERE metadata IS NOT NULL
  AND metadata->>'enriched_at' IS NOT NULL;

-- Check user enrichment usage
SELECT
  u.user_id,
  u.enrichments_current_month,
  s.current_plan
FROM user_usage u
JOIN user_subscriptions s ON s.user_id = u.user_id
WHERE u.enrichments_current_month > 0;
```

---

## 📊 Plan Limits

Configure these limits in the enrichment service:

| Plan | Enrichments/Month |
|------|------------------|
| Free | 5 |
| Glow Up | 50 |
| Viral Surge | 200 |
| Fame Flex | Unlimited (-1) |

---

## ⚠️ Important Notes

1. **API Key Security**:
   - Never expose `INFLUENCERS_CLUB_API_KEY` in client-side code
   - Only use in server-side API routes

2. **Cost Management**:
   - Each enrichment costs ~$0.01-$0.05
   - Cache data for 14 days to minimize costs
   - Enforce plan limits strictly

3. **Error Handling**:
   - Handle rate limits gracefully
   - Show user-friendly error messages
   - Don't cache failed enrichments

4. **Performance**:
   - Enrich in background (async)
   - Show loading states
   - Don't block UI during enrichment

---

## 📚 Resources

- **Test Script**: `/scripts/test-enrichment-api-demo.js`
- **Full Analysis**: `/docs/ENRICHMENT_API_ANALYSIS.md`
- **Environment Variable**: `INFLUENCERS_CLUB_API_KEY` (already set in `.env.local`)

---

## ✅ Acceptance Criteria

Before marking this task complete, verify:

- [ ] Enrichment service class created and tested
- [ ] API endpoints created (`POST /api/creators/enrich`, `GET /api/creators/[id]/enriched-data`)
- [ ] Database migration for usage tracking (if needed)
- [ ] UI components created (EnrichButton, EnrichedDataDisplay)
- [ ] Plan limits enforced correctly
- [ ] Caching working (14-day expiry)
- [ ] Error handling implemented
- [ ] Loading states shown
- [ ] Toast notifications working
- [ ] Connected platforms discovered and displayed
- [ ] All manual tests passed
- [ ] Code documented with comments

---

## 🤝 Need Help?

If you get stuck:
1. Check the test script output for API examples
2. Review the full analysis document
3. Test with `@thespinaparianos` (known working creator)
4. Ask questions in team channel

Good luck! 🚀
