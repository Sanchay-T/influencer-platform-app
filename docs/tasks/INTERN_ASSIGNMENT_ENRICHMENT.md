# 🎯 Assignment: Creator Enrichment API - Backend Integration

**Priority**: High
**Deadline**: 1 week
**Complexity**: Medium

---

## 📋 Your Mission

Integrate the Influencers.Club enrichment API to add detailed creator insights to our platform. This is a **backend-only task** for now - I'll handle the UI integration after you complete the backend.

**Success Criteria**: Come back to me with a **100% working backend** that I can test via API calls. All endpoints working, all tests passing, proper error handling in place.

---

## 🎯 What You're Building

We currently scrape basic creator data (username, followers, bio). The enrichment API gives us **40+ additional data points**:

- ✅ Verified email addresses
- ✅ Precise engagement rates (7.9% vs just "175K followers")
- ✅ Historical growth data ("+25% in 6 months")
- ✅ Brand partnerships (all brands they've mentioned)
- ✅ Cross-platform accounts (auto-discover Instagram, YouTube)
- ✅ Recent content performance (last 30 posts with metrics)

**Example**: A creator with 175K followers might have:
- Email: `creator@agency.com`
- Engagement: 8.9% (much better than 175K sounds)
- Growth: +30% in 12 months (trending up!)
- Works with: YSL, Fenty, Anastasia (relevant brands)
- Also on Instagram: 38K followers (cross-platform reach)

This data helps users decide which creators to work with.

---

## 📚 Step 1: Understand the API (30 minutes)

### 1.1 Read the Quick Start

```bash
# Open this file and read it (15 mins)
open docs/tasks/README_ENRICHMENT.md
```

This gives you the overview.

### 1.2 Run the Demo Script

```bash
# This will:
# - Query real creators from database
# - Make an actual API call
# - Show formatted request/response
# - Save full response to logs/enrichment-tests/

node scripts/test-enrichment-api-demo.js
```

**What to observe**:
- The API request format (URL, headers, body)
- The response structure (nested JSON with platform data)
- Response time (~4-5 seconds)
- All the data points returned

### 1.3 Check the Saved Response

```bash
# Open the JSON file to see the full API response
open logs/enrichment-tests/tiktok-*.json
```

This is what you'll be working with. Study the structure.

### 1.4 Read the Full Spec

```bash
# Open this for detailed implementation guidance
open docs/tasks/CREATOR_ENRICHMENT_INTEGRATION.md
```

Focus on:
- API specification section (request/response)
- Database schema section
- Implementation guide (Step 1, Step 2, Step 3)

---

## 🛠️ Step 2: Backend Implementation (4-5 days)

### Task 2.1: Create the Enrichment Service

**File**: `/lib/services/creator-enrichment.ts`

Create a service class that:

1. **Calls the Influencers.Club API**
   - URL: `https://api-dashboard.influencers.club/public/v1/creators/enrich/handle/full/`
   - Method: POST
   - Auth: `Authorization: Bearer ${process.env.INFLUENCERS_CLUB_API_KEY}`
   - Body: `{ handle, platform, include_lookalikes: false, email_required: 'preferred' }`

2. **Implements caching**
   - Check if creator already enriched in `creator_profiles.metadata`
   - Check if cache is still valid (< 14 days old)
   - If valid cache exists, return cached data
   - If not, call API and cache result

3. **Enforces plan limits**
   - Free: 5 enrichments/month
   - Glow Up: 50 enrichments/month
   - Viral Surge: 200 enrichments/month
   - Fame Flex: Unlimited
   - Throw error if limit exceeded

4. **Tracks usage**
   - Increment `user_usage.enrichments_current_month`
   - Store enrichment timestamp in cache

**Code skeleton** (fill in the TODOs):

```typescript
import { db } from '@/lib/db';
import { creatorProfiles, userUsage, userSubscriptions, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface EnrichmentOptions {
  handle: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  includeLookalikes?: boolean;
  emailRequired?: 'preferred' | 'must_have';
}

export class CreatorEnrichmentService {
  private static API_BASE = 'https://api-dashboard.influencers.club';
  private static CACHE_DURATION_DAYS = 14;

  /**
   * Main enrichment function
   */
  static async enrichCreator(
    clerkUserId: string,
    creatorId: string,
    options: EnrichmentOptions
  ) {
    // TODO 1: Get cached enrichment
    const cached = await this.getCachedEnrichment(creatorId);
    if (cached && this.isCacheValid(cached.cache_expires_at)) {
      console.log(`✅ Using cached enrichment for ${creatorId}`);
      return cached;
    }

    // TODO 2: Get internal user ID from Clerk ID
    const internalUserId = await this.getInternalUserId(clerkUserId);

    // TODO 3: Check if user can enrich
    const canEnrich = await this.checkEnrichmentLimit(internalUserId);
    if (!canEnrich) {
      throw new Error('LIMIT_REACHED');
    }

    // TODO 4: Call API
    console.log(`🔍 Enriching ${options.handle} on ${options.platform}`);
    const enrichedData = await this.callEnrichmentAPI(options);

    // TODO 5: Cache the result
    await this.cacheEnrichment(creatorId, enrichedData);

    // TODO 6: Track usage
    await this.trackEnrichmentUsage(internalUserId);

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
  private static async callEnrichmentAPI(options: EnrichmentOptions) {
    // TODO: Implement API call
    // - Use fetch()
    // - Set Authorization header with API key from env
    // - Handle errors (404, 400, 429, 500)
    // - Return parsed JSON
    throw new Error('Not implemented');
  }

  /**
   * Get cached enrichment data
   */
  private static async getCachedEnrichment(creatorId: string) {
    // TODO: Query creator_profiles.metadata
    // - Check if metadata exists
    // - Check if enriched_at field exists
    // - Return enrichment data or null
    throw new Error('Not implemented');
  }

  /**
   * Cache enrichment in database
   */
  private static async cacheEnrichment(creatorId: string, enrichedData: any) {
    // TODO: Update creator_profiles.metadata
    // - Store enriched_at, enrichment_source, cache_expires_at, data
    // - Use db.update()
    throw new Error('Not implemented');
  }

  /**
   * Check if user can enrich more creators
   */
  private static async checkEnrichmentLimit(internalUserId: string): Promise<boolean> {
    // TODO: Get user's current plan and usage
    // - Query user_subscriptions for current_plan
    // - Query user_usage for enrichments_current_month
    // - Check against plan limits
    // - Return true if can enrich, false otherwise
    throw new Error('Not implemented');
  }

  /**
   * Track enrichment usage
   */
  private static async trackEnrichmentUsage(internalUserId: string) {
    // TODO: Increment user_usage.enrichments_current_month
    // - Use db.update() with SQL increment
    throw new Error('Not implemented');
  }

  /**
   * Get internal user ID from Clerk ID
   */
  private static async getInternalUserId(clerkUserId: string): Promise<string> {
    // TODO: Query users table to get internal UUID from Clerk user_id
    throw new Error('Not implemented');
  }

  /**
   * Check if cache is valid
   */
  private static isCacheValid(expiryDate: string): boolean {
    return new Date(expiryDate) > new Date();
  }

  /**
   * Get cache expiry date
   */
  private static getCacheExpiryDate(): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + this.CACHE_DURATION_DAYS);
    return expiry.toISOString();
  }
}
```

**Reference**: See full implementation in `CREATOR_ENRICHMENT_INTEGRATION.md` under "Step 1".

---

### Task 2.2: Create API Endpoints

#### Endpoint 1: Enrich Creator

**File**: `/app/api/creators/enrich/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { CreatorEnrichmentService } from '@/lib/services/creator-enrichment';

export async function POST(request: NextRequest) {
  try {
    // TODO 1: Get authenticated user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO 2: Parse and validate request body
    const body = await request.json();
    const { creatorId, handle, platform } = body;

    // Validate required fields
    if (!creatorId || !handle || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: creatorId, handle, platform' },
        { status: 400 }
      );
    }

    // Validate platform
    if (!['tiktok', 'instagram', 'youtube'].includes(platform.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be: tiktok, instagram, or youtube' },
        { status: 400 }
      );
    }

    // TODO 3: Call enrichment service
    const enrichedData = await CreatorEnrichmentService.enrichCreator(
      userId,
      creatorId,
      {
        handle: handle,
        platform: platform.toLowerCase()
      }
    );

    // TODO 4: Return success response
    return NextResponse.json({
      success: true,
      data: enrichedData
    });

  } catch (error: any) {
    console.error('❌ Enrichment error:', error);

    // Handle specific errors
    if (error.message === 'LIMIT_REACHED') {
      return NextResponse.json(
        {
          error: 'Enrichment limit reached. Upgrade your plan to enrich more creators.',
          code: 'LIMIT_REACHED',
          upgradeUrl: '/billing'
        },
        { status: 403 }
      );
    }

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Creator not found on this platform', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to enrich creator. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

#### Endpoint 2: Get Enriched Data

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
    // TODO 1: Authenticate
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO 2: Get creator profile
    const creator = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.id, params.id)
    });

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // TODO 3: Return enriched data if exists
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
    console.error('❌ Error fetching enriched data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enriched data' },
      { status: 500 }
    );
  }
}
```

---

### Task 2.3: Database Migration (If Needed)

**Check if column exists**:

```sql
-- Run this in database console
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_usage'
  AND column_name = 'enrichments_current_month';
```

**If column doesn't exist**, create migration file:

**File**: `/supabase/migrations/XXXX_add_enrichment_tracking.sql`

```sql
-- Add enrichment tracking to user_usage table
ALTER TABLE user_usage
ADD COLUMN IF NOT EXISTS enrichments_current_month INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN user_usage.enrichments_current_month IS 'Number of creator enrichments this month (resets with usage_reset_date)';
```

**Run migration**:
```bash
node run-migration.js
```

**Note**: The `creator_profiles.metadata` column already exists, so no changes needed there.

---

## 🧪 Step 3: Testing (1-2 days)

### Test 3.1: Unit Tests for Service

Create test file: `/tests/services/creator-enrichment.test.ts`

```typescript
import { CreatorEnrichmentService } from '@/lib/services/creator-enrichment';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('CreatorEnrichmentService', () => {
  it('should enrich creator with valid data', async () => {
    // TODO: Test enrichment with real API call
    // Use a known working creator like @thespinaparianos
  });

  it('should use cached data if valid', async () => {
    // TODO: Enrich twice, verify second call uses cache
  });

  it('should throw error when limit reached', async () => {
    // TODO: Create free user, enrich 6 times, verify error
  });

  it('should handle API errors gracefully', async () => {
    // TODO: Test with invalid handle, verify error handling
  });
});
```

**Run tests**:
```bash
npm test tests/services/creator-enrichment.test.ts
```

### Test 3.2: Manual API Testing

Create a test script: `/scripts/test-enrichment-backend.js`

```javascript
/**
 * Test the enrichment backend end-to-end
 *
 * This script:
 * 1. Gets a test creator from database
 * 2. Calls POST /api/creators/enrich
 * 3. Verifies response
 * 4. Checks database was updated
 * 5. Tests caching
 * 6. Tests plan limits
 */

import fetch from 'node-fetch';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_BASE = 'http://localhost:3001'; // Or your dev server URL
const TEST_USER_ID = process.env.TEST_USER_ID;

async function testEnrichmentBackend() {
  console.log('🧪 Testing Enrichment Backend\n');

  // Test 1: Get a creator to enrich
  console.log('Test 1: Getting test creator...');
  const sql = postgres(process.env.DATABASE_URL);
  const [creator] = await sql`
    SELECT id, handle, platform
    FROM creator_profiles
    WHERE handle = 'thespinaparianos'
    LIMIT 1
  `;

  if (!creator) {
    console.error('❌ No test creator found');
    return;
  }

  console.log(`✅ Found creator: @${creator.handle} (${creator.platform})`);

  // Test 2: Call enrichment API
  console.log('\nTest 2: Calling enrichment API...');
  const response = await fetch(`${API_BASE}/api/creators/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // TODO: Add authentication header
    },
    body: JSON.stringify({
      creatorId: creator.id,
      handle: creator.handle,
      platform: creator.platform.toLowerCase()
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ API call failed:', result);
    return;
  }

  console.log('✅ Enrichment successful');
  console.log('   Response:', JSON.stringify(result, null, 2).substring(0, 200) + '...');

  // Test 3: Verify database was updated
  console.log('\nTest 3: Checking database...');
  const [updated] = await sql`
    SELECT metadata
    FROM creator_profiles
    WHERE id = ${creator.id}
  `;

  const metadata = updated.metadata;
  if (metadata?.enriched_at) {
    console.log('✅ Database updated with enriched data');
    console.log('   Enriched at:', metadata.enriched_at);
    console.log('   Cache expires:', metadata.cache_expires_at);
  } else {
    console.error('❌ Database not updated');
  }

  // Test 4: Test caching
  console.log('\nTest 4: Testing cache...');
  const response2 = await fetch(`${API_BASE}/api/creators/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      creatorId: creator.id,
      handle: creator.handle,
      platform: creator.platform.toLowerCase()
    })
  });

  const result2 = await response2.json();

  if (result2.data.enriched_at === result.data.enriched_at) {
    console.log('✅ Cache working (same enrichment timestamp)');
  } else {
    console.error('❌ Cache not working (different timestamps)');
  }

  // Test 5: Check usage tracking
  console.log('\nTest 5: Checking usage tracking...');
  const [usage] = await sql`
    SELECT u.enrichments_current_month
    FROM user_usage u
    JOIN users usr ON usr.id = u.user_id
    WHERE usr.user_id = ${TEST_USER_ID}
  `;

  console.log(`✅ Current usage: ${usage.enrichments_current_month} enrichments`);

  await sql.end();

  console.log('\n🎉 All tests passed!\n');
}

testEnrichmentBackend().catch(console.error);
```

**Run the test**:
```bash
node scripts/test-enrichment-backend.js
```

### Test 3.3: Test Plan Limits

```bash
# Create test script to verify plan limits
# 1. Get free plan user
# 2. Enrich 5 creators (should succeed)
# 3. Try to enrich 6th creator (should fail with LIMIT_REACHED)
# 4. Verify error response
```

### Test 3.4: Test Error Handling

Test these scenarios:
- Invalid creator handle → 404 error
- Invalid platform → 400 error
- Missing API key → 500 error
- Rate limit exceeded → 429 error
- Database connection error → 500 error

---

## ✅ Step 4: Deliverables

When you're done, provide me with:

### 4.1 Code Files
- [ ] `/lib/services/creator-enrichment.ts` (fully implemented)
- [ ] `/app/api/creators/enrich/route.ts` (fully implemented)
- [ ] `/app/api/creators/[id]/enriched-data/route.ts` (fully implemented)
- [ ] Migration file (if needed)
- [ ] Test files

### 4.2 Test Results

Create a document: `/docs/ENRICHMENT_BACKEND_TEST_RESULTS.md`

Include:
```markdown
# Enrichment Backend Test Results

## Manual API Tests

### Test 1: Enrich Creator
- ✅ Request: POST /api/creators/enrich with valid data
- ✅ Response: 200 OK with enriched data
- ✅ Database: metadata updated correctly
- ✅ Duration: X seconds

### Test 2: Test Caching
- ✅ First enrichment: Called API
- ✅ Second enrichment: Used cache
- ✅ Cache expires in 14 days

### Test 3: Test Plan Limits
- ✅ Free plan: Limited to 5 enrichments
- ✅ 6th enrichment: Returned 403 with LIMIT_REACHED
- ✅ Error message clear

### Test 4: Error Handling
- ✅ Invalid handle: 404 error
- ✅ Invalid platform: 400 error
- ✅ Missing auth: 401 error

## Sample API Calls

### Successful Enrichment
```bash
curl -X POST http://localhost:3001/api/creators/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "creatorId": "uuid-here",
    "handle": "thespinaparianos",
    "platform": "tiktok"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "enriched_at": "2025-10-28T15:30:00Z",
    "cache_expires_at": "2025-11-11T15:30:00Z",
    "data": { ... }
  }
}
```

### Limit Reached Error
```bash
# Same curl command after 5 enrichments
```

Response:
```json
{
  "error": "Enrichment limit reached. Upgrade your plan to enrich more creators.",
  "code": "LIMIT_REACHED",
  "upgradeUrl": "/billing"
}
```

## Database Verification

### Check Enriched Creator
```sql
SELECT
  handle,
  platform,
  metadata->>'enriched_at' as enriched_at,
  metadata->>'cache_expires_at' as cache_expires
FROM creator_profiles
WHERE id = 'uuid-here';
```

Result: [paste result here]

### Check Usage Tracking
```sql
SELECT enrichments_current_month
FROM user_usage u
JOIN users usr ON usr.id = u.user_id
WHERE usr.user_id = 'clerk-user-id';
```

Result: [paste result here]

## Issues Found & Resolved
- None / [list any issues and how you fixed them]

## Performance Metrics
- Average API call duration: X seconds
- Cache hit rate: X%
- Error rate: X%

## Ready for UI Integration: ✅
```

### 4.3 Demo Video

Record a 3-5 minute video showing:
1. Running `node scripts/test-enrichment-backend.js`
2. Showing successful API call in Postman/Insomnia
3. Verifying database updates in Supabase console
4. Testing plan limits
5. Testing error handling

Upload to Loom/Google Drive and share link.

---

## 🚨 Important Notes

### Environment Variables

Make sure these are set in `.env.local`:
```bash
INFLUENCERS_CLUB_API_KEY=eyJhbGci... # Already set
DATABASE_URL=postgresql://...        # Already set
TEST_USER_ID=b9b65707-...            # Already set
```

### API Key Security

⚠️ **NEVER** expose the API key in:
- Frontend code
- Git commits
- Console logs
- Error messages

Always use it **only in server-side code**.

### Plan Limits Reference

```typescript
const PLAN_LIMITS = {
  'free': 5,
  'glow_up': 50,
  'viral_surge': 200,
  'fame_flex': -1  // unlimited
};
```

### Cost Awareness

Each enrichment costs ~$0.01-$0.05. That's why we:
- Cache for 14 days
- Enforce plan limits
- Only enrich on user request (not automatically)

---

## ❓ Common Issues & Solutions

### Issue 1: "Module not found" error
**Solution**: Make sure you're importing from the correct path. Check if the file exists.

### Issue 2: "API key not found"
**Solution**: Check `.env.local` has `INFLUENCERS_CLUB_API_KEY` set. Restart dev server.

### Issue 3: "Database connection error"
**Solution**: Check `DATABASE_URL` in `.env.local`. Test connection with test script.

### Issue 4: "TypeError: Cannot read property 'metadata'"
**Solution**: Add null checks. The metadata column might be null for some creators.

### Issue 5: "Rate limit exceeded"
**Solution**: Wait a few seconds between API calls during testing. Add delays in test scripts.

---

## 📞 When to Ask for Help

Ask me if:
- [ ] You're stuck for more than 2 hours on the same issue
- [ ] You're unsure about database schema changes
- [ ] You get consistent API errors (400, 500)
- [ ] Tests pass locally but fail in production
- [ ] You need clarification on requirements

**Don't wait until the deadline** - ask early if blocked!

---

## ✅ Definition of Done

Check these before coming back to me:

- [ ] All TODO comments implemented
- [ ] Both API endpoints working
- [ ] Caching implemented and tested
- [ ] Plan limits enforced correctly
- [ ] Usage tracking working
- [ ] Error handling for all scenarios
- [ ] Manual test script runs successfully
- [ ] Database queries verified
- [ ] Test results document created
- [ ] Demo video recorded
- [ ] Code has comments explaining key logic
- [ ] No console errors or warnings
- [ ] Ready for production deployment

---

## 🎯 Summary

**What you're doing**: Building the backend for creator enrichment
**What I'll do next**: Build the UI components after you finish
**Your deadline**: 1 week from now
**Expected output**: 100% working backend with test results

**Questions?** Slack me or email. Don't struggle alone!

Good luck! 🚀

---

**Files to read**:
1. `docs/tasks/README_ENRICHMENT.md` - Quick overview
2. `docs/tasks/CREATOR_ENRICHMENT_INTEGRATION.md` - Full spec
3. Run: `node scripts/test-enrichment-api-demo.js` - Understand the API
