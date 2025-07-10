# API Analysis Logs

This directory contains structured logs for analyzing the 6 search endpoints.

## Directory Structure

```
api-analysis/
├── requests/        # Original request payloads sent to each endpoint
├── raw-responses/   # Raw API responses before any transformation
├── transformed/     # Final processed data sent to frontend
└── analysis/        # Summary reports and data quality analysis
```

## Log File Naming Convention

Files are named using the pattern:
`{searchKey}-{logType}-{sessionId}-{timestamp}.json`

### Search Keys:
- `tiktok-keyword` - TikTok keyword search
- `tiktok-similar` - TikTok similar search  
- `instagram-similar` - Instagram similar search
- `instagram-hashtag` - Instagram hashtag search
- `youtube-keyword` - YouTube keyword search
- `youtube-similar` - YouTube similar search

### Log Types:
- `request` - Original request payload
- `raw` - Raw API response
- `transformed` - Processed data
- `summary` - Analysis summary
- `error` - Error logs

## Usage

1. **Enable Logging**: Add logging calls to each search endpoint
2. **Run Searches**: Execute searches to generate log data
3. **Analyze Data**: Use analysis scripts to compare structures
4. **Generate Reports**: Create streamlining recommendations

## Log Content Structure

### Request Logs
```json
{
  "timestamp": "2025-01-07T...",
  "sessionId": "abc123",
  "searchKey": "tiktok-keyword",
  "endpoint": "/api/scraping/tiktok",
  "platform": "TikTok",
  "searchType": "keyword",
  "requestData": {
    "keywords": ["example"],
    "campaignId": "...",
    "targetResults": 1000
  },
  "metadata": {
    "userId": "...",
    "campaignId": "..."
  }
}
```

### Raw Response Logs
```json
{
  "timestamp": "2025-01-07T...",
  "sessionId": "abc123",
  "searchKey": "tiktok-keyword",
  "rawResponse": {
    // Unprocessed API response
  },
  "metadata": {
    "responseTime": "1200ms",
    "statusCode": 200,
    "apiProvider": "scrapecreators"
  }
}
```

### Transformed Data Logs
```json
{
  "timestamp": "2025-01-07T...",
  "sessionId": "abc123",
  "searchKey": "tiktok-keyword",
  "transformedData": [
    // Final processed data structure
  ],
  "dataQuality": {
    "totalResults": 50,
    "hasImages": true,
    "hasBios": true,
    "hasEmails": true,
    "hasEngagement": true
  }
}
```

## Generated Files

Each search session generates 4 files:
1. Request payload
2. Raw API response  
3. Transformed data
4. Analysis summary

This allows complete traceability from request to final display data.