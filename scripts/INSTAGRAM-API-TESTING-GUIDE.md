# Instagram Similar Creator API Testing Guide

This guide helps you research and test different Instagram APIs for similar creator functionality.

## 📋 Available Test Scripts

### 1. Quick Test (Recommended for Development)
```bash
node scripts/quick-test-instagram-apis.js [username] [api]
```

**Examples:**
```bash
# Test both APIs with redbull profile
node scripts/quick-test-instagram-apis.js

# Test specific username
node scripts/quick-test-instagram-apis.js nike

# Test only Apify
node scripts/quick-test-instagram-apis.js cocacola apify

# Test only ScrapeCreators  
node scripts/quick-test-instagram-apis.js redbull scrapecreators

# Show help
node scripts/quick-test-instagram-apis.js --help
```

### 2. Comprehensive Research (For Full Analysis)
```bash
node scripts/research-instagram-similar-apis.js
```

This tests multiple profiles and provides detailed analysis and recommendations.

## 🔍 What to Look For

### Key Metrics to Evaluate:

1. **Related Profiles Count**
   - How many similar creators are returned?
   - Are the profiles actually relevant/similar?

2. **Data Quality**
   - ✅ **Follower counts** - For ranking creators
   - ✅ **Biography data** - For email extraction
   - ✅ **Business emails** - Direct contact info
   - ✅ **Verification status** - Quality indicator
   - ✅ **Profile pictures** - For UI display

3. **Reliability**
   - Does it consistently return results?
   - How often are `edge_related_profiles` empty?

4. **Response Time**
   - How fast is the API?
   - Suitable for real-time usage?

## 🎯 Expected Results

### ScrapeCreators (Current)
```json
{
  "relatedProfiles": {
    "count": 0-15,  // Often 0 due to Instagram changes
    "quality": "basic", // Just username, name, verification
    "speed": "fast"     // ~1-2 seconds
  }
}
```

### Apify Profile Scraper
```json
{
  "relatedProfiles": {
    "count": 5-20,      // More consistent  
    "quality": "rich",  // Followers, bio, emails
    "speed": "slower"   // ~10-20 seconds
  }
}
```

## 📊 Analysis Questions

After running tests, evaluate:

1. **Which API returns more related profiles consistently?**
2. **Which provides better data for email extraction?**
3. **What's the cost vs. value trade-off?**
4. **Should we implement a hybrid approach?**

## 🚀 Next Steps Based on Results

### If Apify is Better:
1. Implement Apify as primary method
2. Keep ScrapeCreators as fallback
3. Add environment variable: `INSTAGRAM_SCRAPER_ACTOR_ID`

### If ScrapeCreators is Better:
1. Keep current implementation
2. Investigate why `edge_related_profiles` is empty
3. Consider keyword-based fallback

### If Both Have Issues:
1. Research alternative providers
2. Implement keyword-based similarity search
3. Look into Instagram Graph API alternatives

## 📁 Output Files

Test results are saved to `test-outputs/`:
- `scrapecreators-{username}-quick.json` - ScrapeCreators response
- `apify-{username}-quick.json` - Apify response  
- `instagram-similar-research/` - Comprehensive analysis

## 🔧 Environment Setup

Make sure your `.env.local` has:
```bash
# ScrapeCreators
SCRAPECREATORS_INSTAGRAM_API_URL=your_instagram_api_url
SCRAPECREATORS_API_KEY=your_api_key

# Apify
APIFY_TOKEN=your_apify_token
INSTAGRAM_SCRAPER_ACTOR_ID=your_actor_id  # Optional, defaults to dSCLg0C3YEZ83HzYX
```

## 💡 Pro Tips

1. **Test Multiple Profile Types:**
   - Large brands (redbull, nike)
   - Individual creators 
   - Niche accounts
   - Different languages/regions

2. **Test at Different Times:**
   - Instagram algorithms change
   - Rate limiting varies

3. **Check Related Profile Quality:**
   - Are they actually similar?
   - Do they match the target audience?
   - Are they active accounts?

## 🎯 Decision Framework

| Factor | Weight | ScrapeCreators | Apify | Winner |
|--------|--------|----------------|-------|---------|
| Reliability | 40% | ? | ? | ? |
| Data Quality | 30% | ? | ? | ? |
| Speed | 20% | ? | ? | ? |
| Cost | 10% | ? | ? | ? |

Fill this out based on your test results to make the final decision! 