# Scrape Creators Instagram API Documentation

## Overview

This document outlines the Instagram API endpoints provided by Scrape Creators for retrieving public Instagram data including posts, reels, and detailed media information.

## Authentication

All endpoints require authentication using an API key:

```
Headers:
x-api-key: YOUR_API_KEY
```

## Endpoints

### 1. Get User Posts

Retrieve all public posts from a user's profile.

**Endpoint:** `GET /v2/instagram/user/posts`

**Query Parameters:**
- `handle` (string, required) - Instagram handle
- `next_max_id` (string, optional) - Cursor to get next page of results
- `trim` (boolean, optional) - Set to true to get a trimmed response

**Key Response Fields:**
- `items[0].video_versions[0].url` - Video URL (if post is a video)
- `num_results` - Number of results returned
- `more_available` - Boolean indicating if more posts are available
- `items[].caption.text` - Post caption
- `items[].play_count` - Video play count
- `items[].taken_at` - Post timestamp
- `items[].code` - Post shortcode for URL construction

**Example Request:**
```javascript
import axios from 'axios';

const { data } = await axios.get(
  'https://api.scrapecreators.com/v2/instagram/user/posts',
  {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    },
    params: {
      handle: 'username'
    }
  }
);
```

### 2. Get Post/Reel Details

Get detailed information about a specific Instagram post or reel.

**Endpoint:** `GET /v1/instagram/post`

**Query Parameters:**
- `url` (string, required) - Instagram post or reel URL
- `trim` (boolean, optional) - Set to true to get a trimmed response

**Key Response Fields:**
- `data.xdt_shortcode_media.video_url` - Video URL (if post is a video)
- `data.xdt_shortcode_media.video_play_count` - Views (only for reels)
- `data.xdt_shortcode_media.edge_media_preview_like.count` - Likes count
- `data.xdt_shortcode_media.edge_media_to_parent_comment.count` - Comments count
- `data.xdt_shortcode_media.edge_media_to_caption.edges[0].node.text` - Caption text
- `data.xdt_shortcode_media.owner` - Creator information
- `data.xdt_shortcode_media.video_duration` - Video duration in seconds
- `data.xdt_shortcode_media.clips_music_attribution_info` - Music attribution for reels

**Example Request:**
```javascript
import axios from 'axios';

const { data } = await axios.get(
  'https://api.scrapecreators.com/v1/instagram/post',
  {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    },
    params: {
      url: 'https://www.instagram.com/p/POST_ID/'
    }
  }
);
```

### 3. Get User Reels

Retrieve all public reels from a user's profile.

**Endpoint:** `GET /v1/instagram/user/reels`

**Query Parameters:**
- `user_id` (string, optional) - Instagram user ID (recommended for faster response)
- `handle` (string, optional) - Instagram handle
- `max_id` (string, optional) - Max ID to get more reels from previous response
- `trim` (boolean, optional) - Set to true for a trimmed response

**Key Response Fields:**
- `items[0].media.video_versions[0].url` - Video URL
- `items[0].media.taken_at` - Reel timestamp
- `items[0].media.pk` - Reel ID
- `items[0].media.play_count` - Play count
- `items[0].media.code` - Reel shortcode

**Notes:**
- Use `user_id` instead of `handle` for faster response times
- This endpoint doesn't include pinned reels
- Reel descriptions are not returned; use the post detail endpoint for captions

**Example Request:**
```javascript
import axios from 'axios';

const { data } = await axios.get(
  'https://api.scrapecreators.com/v1/instagram/user/reels',
  {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    },
    params: {
      user_id: '123456789' // or handle: 'username'
    }
  }
);
```

### 4. Get User Reels (Simple with Pagination)

Get public reels with automatic pagination handling.

**Endpoint:** `GET /v1/instagram/user/reels/simple`

**Query Parameters:**
- `user_id` (string, optional) - Instagram user ID
- `handle` (string, optional) - Instagram handle
- `amount` (number, optional) - Number of reels to fetch (default: 12)
- `trim` (boolean, optional) - Set to true for a trimmed response

**Key Response Fields:**
- `[0].media.video_versions[0].url` - Video URL
- `[0].media.taken_at` - Reel timestamp
- `[0].media.pk` - Reel ID
- `[0].media.play_count` - Play count
- `[0].media.code` - Reel shortcode

**Example Request:**
```javascript
import axios from 'axios';

const { data } = await axios.get(
  'https://api.scrapecreators.com/v1/instagram/user/reels/simple',
  {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    },
    params: {
      handle: 'username',
      amount: 20
    }
  }
);
```

## Response Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `500` - Internal Server Error

## Important Notes

1. **Rate Limiting:** Be mindful of API rate limits when making requests
2. **User ID vs Handle:** Use `user_id` instead of `handle` when possible for faster response times
3. **Pagination:** Use `next_max_id` or `max_id` from responses to paginate through results
4. **Trimmed Responses:** Use the `trim` parameter to get smaller response payloads when full data isn't needed
5. **Video URLs:** Video URLs are temporary and should be used promptly after retrieval
6. **Private Accounts:** These endpoints only work with public Instagram accounts

## Common Use Cases

- **Content Analysis:** Retrieve posts and reels for content analysis and insights
- **Media Downloading:** Extract video/image URLs for downloading media content
- **Engagement Metrics:** Get likes, comments, and view counts for engagement analysis
- **Profile Monitoring:** Track new posts and reels from specific creators
- **Content Discovery:** Find and analyze trending content from popular accounts 