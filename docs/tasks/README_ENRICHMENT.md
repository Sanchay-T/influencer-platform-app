# 🎯 Creator Enrichment Integration - Quick Start

## What You're Building

Add a "Enrich Profile" button to creator cards that fetches **40+ detailed data points** about creators including:
- ✅ Verified email addresses
- ✅ Precise engagement rates (not just follower count)
- ✅ Historical growth data (3/6/9/12 months)
- ✅ Brand partnerships (all brands they've mentioned)
- ✅ Cross-platform accounts (auto-discover Instagram, YouTube, etc.)
- ✅ Recent content performance (last 30+ posts)

---

## 📚 Quick Links

| Document | Purpose |
|----------|---------|
| **[CREATOR_ENRICHMENT_INTEGRATION.md](./CREATOR_ENRICHMENT_INTEGRATION.md)** | Full task specification with code examples |
| **[ENRICHMENT_API_ANALYSIS.md](../ENRICHMENT_API_ANALYSIS.md)** | Complete API documentation (600+ lines) |
| **Test Script** | `scripts/test-enrichment-api-demo.js` |

---

## 🚀 Quick Start (5 mins)

### 1. Run the Demo Script

This shows you exactly how the API works with real data from our database:

```bash
node scripts/test-enrichment-api-demo.js
```

**Output**:
- ✅ Queries real creators from database
- ✅ Calls enrichment API with one creator
- ✅ Shows formatted request/response
- ✅ Saves full JSON response to `logs/enrichment-tests/`
- ✅ Displays code examples for integration

### 2. Review a Sample Response

Check the JSON file saved in `logs/enrichment-tests/`. You'll see data like:

```json
{
  "result": {
    "tiktok": {
      "username": "chlogeddes",
      "full_name": "Chloe Geddes",
      "email": "email@example.com",           // ← Contact info!
      "follower_count": 163474,
      "engagement_percent": 7.90,             // ← Real engagement!
      "creator_follower_growth": {            // ← Growth history!
        "3_months_ago": 1.77,
        "6_months_ago": 2.46,
        "12_months_ago": 6.63
      },
      "brands_found": [                       // ← Brand partnerships!
        "Gisou", "LOCCITANE", "..."
      ],
      "related_platforms": {                  // ← Cross-platform discovery!
        "instagram_main": "chlogeddes"
      }
    },
    "instagram": {                            // ← Auto-enriched Instagram!
      "follower_count": 507852,
      "engagement_percent": 0.273
    }
  }
}
```

### 3. Read the Task Document

Open **[CREATOR_ENRICHMENT_INTEGRATION.md](./CREATOR_ENRICHMENT_INTEGRATION.md)** and read:
- API specification (request/response examples)
- Database schema (how to store enriched data)
- Code examples (service, API routes, UI components)
- Testing instructions

---

## 📋 Implementation Checklist

### Backend (Week 1)

- [ ] **Create enrichment service** (`/lib/services/creator-enrichment.ts`)
  - Function to call Influencers.Club API
  - Caching logic (14-day cache)
  - Plan limit checking
  - Error handling

- [ ] **Create API endpoints**
  - `POST /api/creators/enrich` - Enrich a creator
  - `GET /api/creators/[id]/enriched-data` - Get cached data

- [ ] **Database migration** (if needed)
  - Add `enrichments_current_month` to `user_usage` table
  - Already have `metadata` JSONB column in `creator_profiles` ✅

### Frontend (Week 2)

- [ ] **Create UI components**
  - `EnrichButton.tsx` - Button with loading state
  - `EnrichedDataDisplay.tsx` - Display enriched data
  - `EnrichmentBadge.tsx` - Show "Enriched" status

- [ ] **Update existing pages**
  - Add EnrichButton to creator cards
  - Add EnrichedDataDisplay to creator detail page
  - Handle loading/error states

### Testing (Week 2)

- [ ] **Test enrichment flow**
  - Click "Enrich Profile" button
  - Verify API call works
  - Check data saved to database
  - Confirm data displays correctly

- [ ] **Test plan limits**
  - Free plan: can enrich 5 creators/month
  - Paid plan: unlimited enrichments
  - Error message when limit reached

- [ ] **Test caching**
  - Enrich creator once
  - Verify button shows "Enriched"
  - Confirm data loads from cache (no API call)
  - Check cache expires after 14 days

---

## 🔑 Key Concepts

### API Call Flow

```
User clicks "Enrich Profile"
  ↓
Frontend → POST /api/creators/enrich
  ↓
Backend checks plan limits
  ↓
Backend checks cache (14-day)
  ↓
If not cached: Call Influencers.Club API
  ↓
Save response to creator_profiles.metadata
  ↓
Track usage (enrichments_current_month++)
  ↓
Return enriched data to frontend
  ↓
Display enriched data in UI
```

### Data Storage

```sql
-- Store enriched data in existing metadata column
UPDATE creator_profiles
SET metadata = {
  "enriched_at": "2025-10-28T15:30:00Z",
  "enrichment_source": "influencers_club",
  "cache_expires_at": "2025-11-11T15:30:00Z",  -- 14 days later
  "data": {
    "tiktok": { ... },     -- Full API response
    "instagram": { ... },
    "youtube": { ... }
  }
}
WHERE id = 'creator-uuid';
```

### Plan Limits

| Plan | Enrichments/Month |
|------|------------------|
| Free | 5 |
| Glow Up | 50 |
| Viral Surge | 200 |
| Fame Flex | Unlimited |

---

## 🧪 Testing Tools

### Test Script
```bash
node scripts/test-enrichment-api-demo.js
```

This will:
1. Query creators from your database
2. Pick one real creator
3. Call the enrichment API
4. Show formatted request/response
5. Save full response to JSON file
6. Display integration code examples

### Manual Testing

Use these test creators (confirmed working):
- **TikTok**: `@thespinaparianos` (175K followers)
- **TikTok**: `@chlogeddes` (163K followers)
- **Instagram**: Any creator from your database

### Database Queries

```sql
-- Check enriched creators
SELECT
  handle,
  platform,
  metadata->>'enriched_at' as enriched_at
FROM creator_profiles
WHERE metadata->>'enriched_at' IS NOT NULL;

-- Check user enrichment usage
SELECT
  user_id,
  enrichments_current_month
FROM user_usage
WHERE enrichments_current_month > 0;
```

---

## 💡 Code Examples

### Backend Service (Simplified)

```typescript
// /lib/services/creator-enrichment.ts
export class CreatorEnrichmentService {
  static async enrichCreator(userId: string, creatorId: string, options: {
    handle: string;
    platform: 'tiktok' | 'instagram' | 'youtube';
  }) {
    // 1. Check cache
    const cached = await this.getCachedEnrichment(creatorId);
    if (cached && this.isCacheValid(cached.cache_expires_at)) {
      return cached;
    }

    // 2. Check plan limits
    const canEnrich = await this.checkEnrichmentLimit(userId);
    if (!canEnrich) {
      throw new Error('LIMIT_REACHED');
    }

    // 3. Call API
    const response = await fetch(
      'https://api-dashboard.influencers.club/public/v1/creators/enrich/handle/full/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.INFLUENCERS_CLUB_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          handle: options.handle,
          platform: options.platform,
          include_lookalikes: false,
          email_required: 'preferred'
        })
      }
    );

    const data = await response.json();

    // 4. Cache & track usage
    await this.cacheEnrichment(creatorId, data);
    await this.trackEnrichmentUsage(userId);

    return data;
  }
}
```

### Frontend Component (Simplified)

```typescript
// EnrichButton.tsx
export function EnrichButton({ creatorId, handle, platform }) {
  const [loading, setLoading] = useState(false);

  const handleEnrich = async () => {
    setLoading(true);

    const response = await fetch('/api/creators/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId, handle, platform })
    });

    const result = await response.json();

    if (result.success) {
      toast.success('Creator enriched!');
      // Refresh data or update state
    } else {
      toast.error(result.error);
    }

    setLoading(false);
  };

  return (
    <Button onClick={handleEnrich} disabled={loading}>
      {loading ? 'Enriching...' : 'Enrich Profile'}
    </Button>
  );
}
```

---

## ❓ Common Questions

**Q: Where do I find the API key?**
A: It's already set in `.env.local` as `INFLUENCERS_CLUB_API_KEY`

**Q: How much does each enrichment cost?**
A: ~$0.01-$0.05 per creator (estimated)

**Q: Why cache for 14 days?**
A: To save costs. Creator data doesn't change much in 2 weeks.

**Q: What if a creator doesn't have an email?**
A: The API still returns valuable data (engagement, growth, brands, etc.)

**Q: Can I test without using real API calls?**
A: Yes! Check the saved JSON files in `logs/enrichment-tests/` for sample responses.

---

## 🆘 Need Help?

1. **Run the test script first**: `node scripts/test-enrichment-api-demo.js`
2. **Check the saved JSON responses**: `logs/enrichment-tests/`
3. **Read the full task doc**: `CREATOR_ENRICHMENT_INTEGRATION.md`
4. **Review code examples**: Full examples in the task doc
5. **Ask in team chat**: Share specific error messages

---

## ✅ Definition of Done

Your implementation is complete when:

- [ ] Enrichment button works on creator cards
- [ ] Enriched data displays in creator detail page
- [ ] Plan limits enforced (Free: 5/month, Paid: unlimited)
- [ ] Caching works (14-day expiry)
- [ ] Error messages show for failures
- [ ] Loading states display during API calls
- [ ] Toast notifications work
- [ ] All manual tests pass
- [ ] Code has comments explaining key logic

---

**Time Estimate**: 2-3 weeks
**Priority**: High
**Complexity**: Medium

Good luck! 🚀
