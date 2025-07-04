# YouTube Similar Search Feasibility Tests

This directory contains comprehensive test scripts to evaluate the feasibility of implementing YouTube similar search functionality using keyword-based similarity matching.

## 🎯 **Overview**

These tests validate whether we can effectively implement YouTube similar creator search by:
1. **Extracting meaningful keywords** from target channel profiles
2. **Searching YouTube** using those keywords to find related content
3. **Filtering and ranking** results to identify similar channels
4. **Scoring relevance** to ensure quality recommendations

## 📁 **Test Scripts**

### **1. test-channel-profile-api.js**
Tests the ScrapeCreators YouTube Channel API to validate data availability.

**What it tests:**
- ✅ API reliability and response times
- ✅ Channel profile data quality (descriptions, emails, links)
- ✅ Keyword extraction potential
- ✅ Data coverage across different channel niches

**Sample channels tested:**
- **Fitness**: @FitnessBlender, @athleanx, @Calisthenic-Movement
- **Tech**: @MKBHD, @UnboxTherapy, @LinusTechTips  
- **Gaming**: @PewDiePie, @Markiplier
- **Cooking**: @BingingwithBabish, @JoshuaWeissman
- **Education**: @veritasium, @3Blue1Brown

### **2. test-keyword-extraction.js**
Tests advanced keyword extraction algorithms for generating meaningful search terms.

**What it tests:**
- ✅ Basic description keyword extraction
- ✅ Enhanced extraction with hashtags and mentions
- ✅ Channel name/handle keyword extraction
- ✅ Niche-specific pattern matching
- ✅ Keyword relevance scoring

**Algorithms tested:**
- **Basic extraction**: Word frequency analysis with stop-word filtering
- **Enhanced extraction**: Hashtags, mentions, and context-aware keywords
- **Niche patterns**: Fitness, tech, gaming, cooking, education patterns
- **Combined approach**: Multi-source keyword aggregation

### **3. test-similar-search-logic.js**
Tests the complete similar search workflow end-to-end.

**What it tests:**
- ✅ Target channel profile retrieval
- ✅ Keyword extraction from target channel
- ✅ YouTube search using extracted keywords
- ✅ Channel filtering from video search results
- ✅ Similarity scoring and ranking algorithms
- ✅ Relevance threshold filtering

**Similarity factors evaluated:**
- **Name similarity** (20% weight): Keyword matches in channel names
- **Content relevance** (40% weight): Video title/description keyword matches
- **Channel activity** (20% weight): Upload frequency and recency
- **Keyword match** (20% weight): Overall keyword presence

### **4. run-all-tests.js**
Comprehensive test runner that executes all tests and generates feasibility report.

**What it provides:**
- ✅ Sequential execution of all test suites
- ✅ Comprehensive feasibility analysis
- ✅ Implementation recommendations
- ✅ Detailed results saving and reporting

## 🚀 **Running the Tests**

### **Prerequisites**
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your SCRAPECREATORS_API_KEY to .env
```

### **Individual Test Execution**
```bash
# Test 1: Channel Profile API
node test-scripts/youtube-similar-research/test-channel-profile-api.js

# Test 2: Keyword Extraction
node test-scripts/youtube-similar-research/test-keyword-extraction.js

# Test 3: Similar Search Logic (requires API key)
node test-scripts/youtube-similar-research/test-similar-search-logic.js
```

### **Complete Test Suite**
```bash
# Run all tests and generate comprehensive report
node test-scripts/youtube-similar-research/run-all-tests.js
```

## 📊 **Expected Output**

### **Console Output Example**
```
🚀 [YOUTUBE-SIMILAR-TESTS] Starting Comprehensive YouTube Similar Search Feasibility Tests
================================================================================

🔍 [TEST-1] Running Channel Profile API Tests...
✅ [TEST-1] Success! Response time: 1850ms
📊 [TEST-1] Analysis: { name: 'FitnessBlender', hasDescription: true, keywordPotential: 'high' }

🔍 [TEST-2] Running Keyword Extraction Algorithm Tests...
🎯 [TEST-1] Testing: FitnessBlender (fitness)
📝 Enhanced extraction: ['fitness', 'workout', 'hiit', 'strength', 'cardio']
📊 Relevance score: 85.2% (4 exact, 1 partial out of 5 search terms)

🔍 [TEST-3] Running Similar Search Logic Tests...
🎯 [TEST-1] Testing similar search for: @FitnessBlender
✅ [STEP-1] Target profile retrieved: { name: 'FitnessBlender', hasDescription: true }
✅ [STEP-2] Keywords extracted: { finalKeywords: ['fitness', 'workout', 'hiit'] }
✅ [STEP-3] Search completed: { query: 'fitness workout hiit', videosFound: 47 }
✅ [STEP-4] Channels extracted: { totalChannels: 23 }
✅ [STEP-5] Channels ranked: Athlean-X (score: 78.5), Calisthenic Movement (score: 71.2)

🏁 [FINAL-REPORT] YouTube Similar Search Feasibility Assessment
================================================================================

📊 [EXECUTIVE-SUMMARY]
🎯 Overall Feasibility: HIGH
📈 Combined Score: 82.3%

🎯 [RECOMMENDATIONS]
✅ STRONG RECOMMENDATION: Proceed with YouTube Similar Search implementation
🚀 Expected high success rate and user satisfaction
```

### **Generated Files**
```
test-outputs/youtube-similar-research/
├── youtube-similar-feasibility-test-2025-01-XX.json    # Detailed results
├── youtube-similar-summary-2025-01-XX.txt              # Human-readable summary
└── individual-test-results/                            # Individual test outputs
```

## 📈 **Success Criteria**

### **🟢 HIGH Feasibility (Recommended)**
- ✅ API reliability > 80%
- ✅ Data quality > 70% (channels with good descriptions)
- ✅ Average relevance score > 60%
- ✅ Processing time < 15 seconds

### **🟡 MEDIUM Feasibility (Proceed with caution)**
- ⚠️ API reliability > 60%
- ⚠️ Data quality > 50%
- ⚠️ Average relevance score > 45%
- ⚠️ Processing time < 20 seconds

### **🔴 LOW Feasibility (Not recommended)**
- ❌ API reliability < 60%
- ❌ Data quality < 50%
- ❌ Average relevance score < 45%
- ❌ Processing time > 20 seconds

## 🛠️ **Implementation Decision Matrix**

| Feasibility | API Reliability | Data Quality | Relevance Score | Recommendation |
|-------------|----------------|--------------|-----------------|----------------|
| **HIGH** | >80% | >70% | >60% | ✅ Full implementation |
| **MEDIUM** | >60% | >50% | >45% | ⚠️ Implement with optimizations |
| **LOW** | <60% | <50% | <45% | ❌ Find alternative approach |

## 🔧 **Troubleshooting**

### **Common Issues**

#### **API Key Errors**
```bash
❌ SCRAPECREATORS_API_KEY environment variable is required
```
**Solution**: Add your API key to `.env` file

#### **Rate Limiting**
```bash
❌ YouTube API Error (429 Too Many Requests)
```
**Solution**: Tests include 1-2 second delays. If still occurring, increase delays in test scripts.

#### **No Results Found**
```bash
⚠️ No channels found in search results
```
**Solution**: This may indicate keyword extraction needs tuning for specific niches.

## 📊 **Test Data Analysis**

### **Metrics Tracked**
- **API Response Times**: Average time to fetch channel profiles
- **Data Coverage**: Percentage of channels with usable descriptions
- **Keyword Quality**: Relevance of extracted keywords to expected niche
- **Search Effectiveness**: Number of relevant channels found per search
- **Similarity Accuracy**: How well similar channels match target niche

### **Performance Benchmarks**
- **Target Response Time**: < 15 seconds end-to-end
- **Minimum Relevance**: > 30% average relevance score
- **Data Quality Threshold**: > 60% channels with good descriptions
- **Search Coverage**: > 10 similar channels per target

## 🚀 **Next Steps Based on Results**

### **If HIGH Feasibility**
1. ✅ Implement YouTube similar search following Instagram pattern
2. 🏗️ Create `/lib/platforms/youtube-similar/` module structure
3. 🎯 Use validated keyword extraction algorithms
4. 📊 Implement relevance scoring with proven thresholds

### **If MEDIUM Feasibility**
1. ⚠️ Implement with enhanced safeguards
2. 🔧 Add additional keyword extraction strategies
3. 📈 Use higher relevance thresholds (>50%)
4. 🔄 Implement fallback to alternative methods

### **If LOW Feasibility**
1. 🔄 Research alternative similarity detection methods
2. 🧪 Test different data sources (Apify YouTube scrapers)
3. 💡 Consider hybrid approaches with multiple data points
4. ⏳ Postpone implementation until better solution found

---

This testing framework provides a comprehensive evaluation of YouTube similar search feasibility, ensuring data-driven implementation decisions.