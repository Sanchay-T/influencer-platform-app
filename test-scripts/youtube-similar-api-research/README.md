# YouTube Similar Channel API Research

This directory contains comprehensive test scripts to evaluate different YouTube APIs for finding similar channels and creators.

## 🎯 **Overview**

These tests compare multiple YouTube API options to determine the best approach for finding similar channels:

1. **ScrapeCreators YouTube API** (Current implementation)
2. **YouTube Official Data API** (Google's official API)
3. **Apify YouTube Scrapers** (Third-party scraping service)

## 📁 **Test Scripts**

### **1. test-scrapecreators-features.js**
Tests ScrapeCreators YouTube API to explore similar channel capabilities.

**What it tests:**
- ✅ Channel Profile API (basic channel info)
- ✅ Channel Videos API (recent videos from channel)
- ✅ Video Details API (video metadata, potential suggestions)
- ✅ Search API (finding channels by keywords)

**Sample channels tested:**
- **Tech**: @mkbhd (MKBHD)
- **Fitness**: @fitnessblender (FitnessBlender)  
- **Cooking**: @bingingwithbabish (Binging with Babish)

### **2. test-youtube-official-api.js**
Tests YouTube's Official Data API for similar channel features.

**What it tests:**
- ✅ Channels API (basic channel information)
- ✅ Branding Settings API (featured channels data)
- ✅ Channel Sections API (channel organization sections)
- ✅ Popular Videos + Related Videos approach
- ✅ Search API (finding similar content by topic)

**Key findings:**
- Featured channels available in branding settings
- Channel sections may contain recommended channels
- Search API can find channels by niche (expensive: 100 quota per call)
- Related videos API was discontinued in 2012

### **3. test-apify-youtube.js**
Tests Apify's YouTube scrapers for comprehensive channel data.

**What it tests:**
- ✅ Main YouTube Scraper (streamers/youtube-scraper)
- ✅ Fast YouTube Channel Scraper (streamers/youtube-channel-scraper)
- ✅ Best YouTube Channels Scraper (scrape-creators/best-youtube-channels-scraper)

**Pricing model:**
- $1 per 1,000 results
- No API quotas or limits
- Pay-per-result pricing

### **4. run-all-api-tests.js**
Comprehensive test runner that executes all API tests and generates comparison report.

**What it provides:**
- ✅ Sequential execution of all test suites
- ✅ Comprehensive API comparison analysis
- ✅ Cost vs benefit analysis
- ✅ Implementation recommendations
- ✅ Detailed results saving and reporting

## 🚀 **Running the Tests**

### **Prerequisites**
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys to .env:
# SCRAPECREATORS_API_KEY=xxx (required)
# APIFY_TOKEN=xxx (optional - for Apify tests)
# YOUTUBE_API_KEY=xxx (optional - for YouTube Official API tests)
```

### **Individual Test Execution**
```bash
# Test 1: ScrapeCreators Features
node test-scripts/youtube-similar-api-research/test-scrapecreators-features.js

# Test 2: YouTube Official API
node test-scripts/youtube-similar-api-research/test-youtube-official-api.js

# Test 3: Apify YouTube Scrapers (requires APIFY_TOKEN)
node test-scripts/youtube-similar-api-research/test-apify-youtube.js
```

### **Complete API Comparison**
```bash
# Run all tests and generate comprehensive comparison report
node test-scripts/youtube-similar-api-research/run-all-api-tests.js
```

## 📊 **Expected Output**

### **Console Output Example**
```
🚀 [API-COMPARISON] Starting Comprehensive YouTube Similar API Comparison Tests
================================================================================

🔍 [TEST-1] Testing ScrapeCreators YouTube API Features...
✅ Profile API: Success
📊 Response structure: name, description, subscriberCountText, thumbnail
❌ No related channel fields found

🔍 [TEST-2] Testing YouTube Official Data API...
✅ Channels API: Success (1 quota)
✅ Branding API: Success (1 quota) 
🎯 Featured channels: 3 found
✅ Search API: Success (100 quota)
🎯 Similar channels found: 8

🔍 [TEST-3] Testing Apify YouTube Scrapers...
✅ Main Scraper: 25 items
✅ Fast Scraper: 1 items
✅ Best Scraper: 15 items

🏁 [FINAL-REPORT] YouTube Similar Channel API Comparison Results
================================================================================

📊 [EXECUTIVE-SUMMARY]
🎯 Best Option: SCRAPECREATORS
📈 Combined Score: 85.3%

🎯 [RECOMMENDATIONS]
✅ RECOMMENDATION: Stick with current ScrapeCreators approach
🎯 Our keyword-based similarity algorithm is actually quite good
💰 Cost-effective and no quota limits
🔄 Consider removing relevance score column as requested
```

### **Generated Files**
```
test-outputs/youtube-similar-api-research/
├── youtube-api-comparison-2025-01-XX.json           # Detailed results
├── youtube-api-comparison-summary-2025-01-XX.txt    # Human-readable summary
```

## 📈 **Comparison Criteria**

### **📊 Evaluation Metrics**
- **API Reliability**: Success rate of API calls
- **Data Quality**: Richness and completeness of channel data
- **Similar Channel Data**: Availability of related/similar channels
- **Cost Efficiency**: API costs and quota limitations
- **Implementation Complexity**: Ease of integration

### **💰 Cost Comparison**

| API Provider | Pricing Model | Similar Channel Data | Quota Limits |
|--------------|---------------|---------------------|--------------|
| **ScrapeCreators** | Fixed cost per API call | ❌ No direct data | ✅ No limits |
| **YouTube Official** | Free (with limits) | ⚠️ Limited (featured channels) | ❌ 10,000 units/day |
| **Apify** | $1 per 1,000 results | 🔍 To be determined | ✅ No limits |

### **🎯 Success Criteria**

**🟢 HIGH Viability (Recommended)**
- ✅ API reliability > 80%
- ✅ Cost effective for production use
- ✅ Provides meaningful similar channel data
- ✅ No restrictive quota limits

**🟡 MEDIUM Viability (Proceed with caution)**
- ⚠️ API reliability > 60%
- ⚠️ Moderate costs or quota restrictions
- ⚠️ Limited similar channel data
- ⚠️ Requires workarounds or optimizations

**🔴 LOW Viability (Not recommended)**
- ❌ API reliability < 60%
- ❌ High costs or severe quota limits
- ❌ No meaningful similar channel data
- ❌ Complex implementation required

## 🔧 **Troubleshooting**

### **Common Issues**

#### **API Key Errors**
```bash
❌ SCRAPECREATORS_API_KEY environment variable is required
```
**Solution**: Add your ScrapeCreators API key to `.env` file

#### **Rate Limiting**
```bash
❌ YouTube API Error (429 Too Many Requests)
```
**Solution**: Tests include delays between calls. Increase delays if still occurring.

#### **Quota Exceeded (YouTube Official API)**
```bash
❌ YouTube API Error (403 Quota Exceeded)
```
**Solution**: YouTube Official API has daily limits. Wait for quota reset or increase limits.

## 📊 **Test Data Analysis**

### **Metrics Tracked**
- **API Response Times**: Average time for each API call
- **Data Coverage**: Percentage of successful API calls
- **Similar Channel Quality**: Relevance of found similar channels
- **Cost Efficiency**: Cost per similar channel found
- **Implementation Complexity**: Development effort required

### **Performance Benchmarks**
- **Target Response Time**: < 5 seconds per API call
- **Minimum Success Rate**: > 80% successful API calls
- **Cost Threshold**: < $0.01 per similar channel found
- **Data Quality**: > 60% relevant similar channels

## 🚀 **Next Steps Based on Results**

### **If ScrapeCreators Wins**
1. ✅ Continue with current implementation
2. 🗑️ Remove relevance score column as requested
3. 🎨 Update table format to match Instagram/TikTok style
4. 🔧 Consider improving keyword extraction algorithms

### **If YouTube Official API Wins**
1. ⚠️ Implement quota management and caching
2. 🎯 Use featured channels and search API strategically
3. 💰 Implement cost controls and fallback to ScrapeCreators
4. 🔄 Hybrid approach for better data quality

### **If Apify Wins**
1. 🧪 Implement specific Apify scrapers that showed promise
2. 💰 Evaluate cost vs current approach
3. ⚖️ Gradual migration with A/B testing
4. 📊 Monitor cost and data quality improvements

---

This testing framework provides comprehensive evaluation of YouTube similar channel APIs, ensuring data-driven implementation decisions for the best user experience and cost efficiency.