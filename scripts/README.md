# Search API Analysis Scripts

This directory contains scripts for comprehensive analysis of all 6 search endpoints to identify streamlining opportunities.

## Scripts Overview

### 1. `api-logger.js` - Enhanced Logging Middleware
**Purpose:** Capture detailed request/response data for all search endpoints

**Key Features:**
- Logs request payloads, raw responses, and transformed data
- Generates structured JSON files with timestamps
- Tracks data quality metrics
- Session-based logging for complete traceability

**Usage:**
```javascript
const { logApiCallSafe } = require('./scripts/api-logger');

// In your search endpoint:
const result = logApiCallSafe(
  'tiktok-keyword',      // Search key
  requestData,           // Original request
  rawApiResponse,        // Raw API response
  transformedData,       // Final processed data
  { userId, campaignId } // Metadata
);
```

### 2. `test-all-searches.js` - Automated Testing
**Purpose:** Systematically test all 6 search endpoints with sample data

**Features:**
- Tests all search types with predefined sample data
- Waits for job completion and collects results
- Generates comprehensive test reports
- Rate limiting to avoid API issues

**Usage:**
```bash
node scripts/test-all-searches.js
```

**Sample Data Used:**
- **TikTok Keyword:** tech, review, unboxing
- **TikTok Similar:** mkbhd
- **Instagram Similar:** tech
- **Instagram Hashtag:** tech, gadgets
- **YouTube Keyword:** tech review, smartphone
- **YouTube Similar:** mkbhd

### 3. `analyze-search-data.js` - Data Analysis
**Purpose:** Process logged data to identify patterns and recommendations

**Analysis Types:**
- **Data Structure Comparison:** Common vs unique fields
- **Quality Analysis:** Image, bio, email availability rates
- **Coverage Analysis:** Field presence across platforms
- **Recommendations:** Prioritized streamlining actions

**Usage:**
```bash
node scripts/analyze-search-data.js
```

## Complete Workflow

### Step 1: Enable Logging
Add logging calls to your search endpoints:

```javascript
// Example: In /app/api/scraping/tiktok/route.ts
const { logApiCallSafe } = require('@/scripts/api-logger');

export async function POST(req) {
  // ... existing code ...
  
  // Log the API call
  logApiCallSafe(
    'tiktok-keyword',
    { keywords, campaignId, targetResults },
    rawApiResponse,
    transformedCreators,
    { userId, responseTime: Date.now() - startTime }
  );
  
  // ... rest of function ...
}
```

### Step 2: Run Tests
Execute comprehensive testing:
```bash
cd /path/to/your/project
node scripts/test-all-searches.js
```

### Step 3: Analyze Results
Process the collected data:
```bash
node scripts/analyze-search-data.js
```

## Log File Structure

```
logs/api-analysis/
├── requests/           # Original request payloads
│   ├── tiktok-keyword-request-abc123-2025-01-07T...json
│   └── instagram-similar-request-def456-2025-01-07T...json
├── raw-responses/      # Unprocessed API responses
│   ├── tiktok-keyword-raw-abc123-2025-01-07T...json
│   └── instagram-similar-raw-def456-2025-01-07T...json
├── transformed/        # Final frontend data
│   ├── tiktok-keyword-transformed-abc123-2025-01-07T...json
│   └── instagram-similar-transformed-def456-2025-01-07T...json
└── analysis/          # Reports and summaries
    ├── tiktok-keyword-summary-abc123-2025-01-07T...json
    ├── test-report-2025-01-07T...json
    └── data-analysis-report-2025-01-07T...json
```

## Generated Reports

### Test Report
- Success/failure rates for each search type
- Performance metrics (response times)
- Result counts and data quality

### Analysis Report
- Data structure comparison across all platforms
- Field coverage analysis
- Quality metrics (images, bios, emails)
- Prioritized recommendations for streamlining

## Sample Analysis Output

```json
{
  "recommendations": {
    "priorityActions": [
      {
        "priority": "High",
        "action": "Standardize bio field across all platforms",
        "impact": "Consistent lead generation capabilities"
      },
      {
        "priority": "Medium", 
        "action": "Implement image proxy for Instagram/YouTube",
        "impact": "Consistent image display experience"
      }
    ],
    "dataUnification": [
      {
        "field": "creator.bio",
        "currentCoverage": 66.7,
        "missingFrom": ["youtube-keyword", "youtube-similar"],
        "action": "Extend bio extraction to YouTube"
      }
    ]
  }
}
```

## Integration Examples

### Adding Logging to Existing Endpoints
```javascript
// Before transformation
const startTime = Date.now();
const rawResponse = await fetch(apiUrl);
const rawData = await rawResponse.json();

// Your existing transformation logic
const transformedData = transformApiResponse(rawData);

// Add logging
logApiCallSafe(
  'your-search-key',
  requestPayload,
  rawData,
  transformedData,
  { 
    responseTime: Date.now() - startTime,
    statusCode: rawResponse.status,
    userId,
    campaignId 
  }
);
```

### Custom Analysis
```javascript
const { analyzeDataStructure } = require('./scripts/analyze-search-data');

// Analyze your own data
const structure = analyzeDataStructure(yourData);
console.log('Data structure:', structure);
```

## Next Steps

1. **Enable Logging:** Add `logApiCallSafe()` calls to all 6 search endpoints
2. **Run Tests:** Execute `test-all-searches.js` to generate baseline data
3. **Analyze:** Run `analyze-search-data.js` to get recommendations
4. **Implement:** Use analysis results to guide streamlining efforts
5. **Monitor:** Regular testing to track improvements

## Troubleshooting

### Common Issues
- **Permission Errors:** Ensure log directories are writable
- **Large Files:** Raw responses may be large, ensure sufficient disk space
- **API Rate Limits:** Test script includes delays, adjust if needed
- **Authentication:** Test script may need real auth tokens for production APIs

### Log File Cleanup
```bash
# Clean old log files (optional)
find logs/api-analysis -name "*.json" -mtime +7 -delete
```

This comprehensive analysis system will give you complete visibility into your search data flow and clear guidance for streamlining efforts.