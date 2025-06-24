# API Response Logs

This directory contains raw API responses captured during similar search operations.

## Directory Structure

- `raw-responses/` - Contains JSON files with complete API responses

## File Naming Convention

### TikTok Similar Search
- **Profile API**: `tiktok-profile-{username}-{timestamp}.json`
- **User Search API**: `tiktok-usersearch-{keyword}-{timestamp}.json`

### Instagram Similar Search
- **Similar Search API**: `instagram-similar-{username}-{timestamp}.json`

## File Structure

Each JSON file contains:
```json
{
  "timestamp": "2024-06-24T...",
  "platform": "TikTok|Instagram",
  "apiType": "Profile|UserSearch|SimilarSearch",
  "handle|keyword|targetUsername": "...",
  "requestUrl": "https://api.scrapecreators.com/...",
  "responseStatus": 200,
  "responseTime": 1234,
  "rawResponse": "... complete API response as string ..."
}
```

## Usage

After running similar searches, check these files to:
1. Analyze complete API response structure
2. Identify available bio/email fields
3. Understand data relationships
4. Debug API issues

## Analysis

Use these files to understand:
- Which fields contain bio information
- Email extraction opportunities  
- Profile data structure
- Related profiles format