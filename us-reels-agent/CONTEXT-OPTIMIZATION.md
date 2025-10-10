# 🧠 Context Optimization - ULTRA Solution

**Philosophy:** Make the AI brain-heavy, not context-heavy
**Analogy:** How would a human read? Check count, glance at 2-3 samples, decide.

---

## The Problem

### Before Optimization:
```
Agent sends to AI:
├─ 49 full post objects with ALL fields (thumbnails, timestamps, etc.)
├─ 49 full transcript objects
├─ Profile objects with profile pictures, etc.
└─ Total: 30,000+ tokens → RATE LIMIT EXCEEDED
```

### Why This is Bad:
1. **Context window fills up fast** → Rate limits at iteration 4-5
2. **AI gets overwhelmed** → Can't make decisions efficiently
3. **Unnecessary data** → AI doesn't need thumbnails to match keywords
4. **Not how humans work** → We don't read 49 full objects, we skim

---

## The Solution

### Human-Like Processing:
```
Human sees:
✅ 49 posts retrieved
✅ 35 have captions
📋 Sample: "fitness tips", "workout routine", "gym motivation"
→ Decides: "Good, proceed to transcripts"
```

### New AI Response Format:
```typescript
// BEFORE (sent everything)
{
  posts: [
    {
      url: "...",
      shortcode: "abc123",           // ❌ AI doesn't need
      caption: "fitness tips",       // ✅ Needed for keyword match
      owner_handle: "gymguy",        // ✅ Needed for profiles
      owner_name: "Gym Guy Pro",     // ❌ Redundant
      is_video: true,                // ❌ Not needed
      product_type: "clips",         // ❌ Not needed
      views: 1000,                   // ✅ Maybe useful
      taken_at_iso: "2025-01-01",    // ❌ Not needed
      thumbnail: "https://...",      // ❌ Definitely not needed
      location_name: "Los Angeles"   // ✅ US indicator!
    },
    // ... 48 more full objects
  ]
}

// AFTER (context-efficient)
{
  count: 49,
  with_captions: 35,
  posts: [
    {
      url: "...",
      owner_handle: "gymguy",
      caption: "fitness tips",
      views: 1000,
      location_name: "Los Angeles"
    },
    // ... only essential fields
  ]
}
```

---

## Field Trimming Strategy

### Posts
**Keep:**
- `url` - Identity
- `owner_handle` - For profile lookup
- `caption` - For keyword matching
- `views` - Quality indicator
- `location_name` - US hint

**Remove:**
- `shortcode`, `owner_name`, `is_video`, `product_type`, `taken_at_iso`, `thumbnail`

### Transcripts
**Keep:**
- `url` - Identity
- `transcript` - For keyword matching

**Remove:**
- Everything else

### Profiles
**Keep:**
- `handle` - Identity
- `biography` - US hints ("based in LA", "NYC trainer")
- `business_address_json` - Strongest US indicator
- `external_url` - `.com` vs `.co.uk` hints
- `is_verified`, `followers` - Trust signals

**Remove:**
- `full_name`, `profile_pic_url`

---

## Context Savings

### Example: 49 Posts

**Before:**
```json
Full objects: ~150KB
Token estimate: ~20,000 tokens
```

**After:**
```json
Trimmed objects: ~30KB
Token estimate: ~4,000 tokens
Savings: 80% reduction
```

### Multiply Across Iterations:
- Iteration 1: Search (minimal)
- Iteration 2: Posts (4K tokens vs 20K)
- Iteration 3: Transcripts (5K vs 25K)
- Iteration 4: Profiles (2K vs 8K)

**Total savings: 40K+ tokens → Fits in 30K limit!**

---

## Implementation

### src/agent/router.ts

```typescript
// Trimming functions
function trimPostsForAI(posts: any[]) {
    return posts.map(p => ({
        url: p.url,
        owner_handle: p.owner_handle,
        caption: p.caption,
        views: p.views,
        location_name: p.location_name
    }));
}

// In tool execution
case 'sc_batch_posts': {
    const fullPosts = await scBatchPosts(urls);
    const trimmedPosts = trimPostsForAI(fullPosts);

    result = {
        count: trimmedPosts.length,
        with_captions: trimmedPosts.filter(p => p.caption).length,
        posts: trimmedPosts  // ← Only essential fields
    };
}
```

---

## Serper US Filtering Issue

### The Misconception:
```bash
SERPER_GL=us         # ← Affects RANKING, not filtering
SERPER_HL=en         # ← UI language preference
SERPER_LOCATION=US   # ← Affects RANKING, not filtering
```

### The Reality:
**Serper returns global Instagram content.** The `gl/hl/location` parameters affect:
- Search result **ranking** (US content ranked higher)
- Ad personalization
- Some featured snippets

**They DO NOT filter out non-US creators.**

### Why?
Instagram is a global platform. A creator from Indonesia can:
- Use English hashtags (#fitness)
- Create fitness content
- Appear in US search results (ranked lower, but still there)

### Solution:
**We MUST filter by creator location ourselves:**
1. Fetch posts → Get `owner_handle`
2. Fetch profiles → Get `business_address_json`, `biography`, `external_url`
3. **Reason about US location** using those fields
4. Filter to US-only in post-processing

**This is working as designed.** The prompt already tells AI to do this.

---

## Testing

### Test Serper:
```bash
npm run test:serper
```

Will show that Serper returns mixed results regardless of location params.

### Test Full Agent:
```bash
npm run dev -- "gym workout"
```

Now with 80% less context usage!

---

## Expected Improvement

### Before:
- Hits rate limit at iteration 4-5
- Returns 0 results (context too large)

### After:
- Should complete all 8-10 iterations
- Stay under 30K token limit
- Return 20-30 US-based results

---

## Future Enhancements

### 1. Pagination (If Still Hitting Limits)
Instead of sending all 49 posts, send in chunks:
```typescript
{
  count: 49,
  page: 1,
  per_page: 20,
  posts: trimmedPosts.slice(0, 20)
}
```

### 2. Aggressive Summarization
For transcripts, send:
```typescript
{
  url: "...",
  word_count: 150,
  contains_keyword: true,  // Pre-computed!
  snippet: "...fitness...workout...gym..."
}
```

### 3. Binary Decisions
Instead of sending data, ask yes/no:
```typescript
{
  url: "...",
  is_relevant: true,  // ← Computed server-side
  is_us_based: true,  // ← Computed server-side
  confidence: 0.95
}
```

---

## Key Takeaway

**Send the AI what it needs to DECIDE, not what it needs to STORE.**

Think like giving someone a report:
- ❌ Don't: Dump 50 pages of raw data
- ✅ Do: Executive summary + key findings + 2-3 examples

This is how the AI should work too!

---

**Status:** Implemented in `src/agent/router.ts`
**Next Test:** Run with "gym workout" keyword
