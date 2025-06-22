# Scrape Creators - YouTube API Documentation

This document provides instructions for using the Scrape Creators API to search for content on YouTube.

## Authentication

All requests to the Scrape Creators API must be authenticated with an API key. The key should be included in the `x-api-key` header of every request.

---

## Endpoints

### 1. Search by Keyword

Search YouTube and get matching videos, channels, playlists, shorts, lives, and more.

- **URL**: `https://api.scrapecreators.com/v1/youtube/search`
- **Method**: `GET`
- **Video Explaining Response Format**: [Watch here](https://www.tella.tv/video/explaining-youtube-search-results-payload-353a)

#### Headers

| Parameter   | Type   | Required | Description                |
|-------------|--------|----------|----------------------------|
| `x-api-key` | string | Yes      | Your Scrape Creators API key |

#### Query Parameters

| Parameter           | Type   | Required | Description                                                                                             | Options                                                              |
|---------------------|--------|----------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| `query`             | string | Yes      | Search query.                                                                                           |                                                                      |
| `uploadDate`        | string | No       | Filter by upload date.                                                                                  | `last_hour`, `today`, `this_week`, `this_month`, `this_year`          |
| `sortBy`            | string | No       | Sort results.                                                                                           | `relevance`, `upload_date`                                           |
| `filter`            | string | No       | Filter by type. Note: This only works with a `query` and not with `uploadDate` or `sortBy`. | `shorts`                                                             |
| `continuationToken` | string | No       | Token to get the next page of results. Get this from the previous response.                             |                                                                      |

#### Example Request (Node.js)
```javascript
import axios from 'axios';

const options = {
  method: 'GET',
  url: 'https://api.scrapecreators.com/v1/youtube/search',
  params: {
    query: 'NF running'
  },
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
};

try {
  const { data } = await axios.request(options);
  console.log(data);
} catch (error) {
  console.error(error);
}
```

#### Example Response (`200 OK`)
```json
{
  "videos": [
    {
      "type": "video",
      "id": "BzSzwqb-OEE",
      "url": "https://www.youtube.com/watch?v=BzSzwqb-OEE",
      "title": "NF - RUNNING (Audio)",
      "thumbnail": "https://i.ytimg.com/vi/BzSzwqb-OEE/hq720.jpg?sqp=-oaymwEnCNAFEJQDSFryq4qpAxkIARUAAIhCGAHYAQHiAQoIGBACGAY4AUAB&rs=AOn4CLCasEKav1CLqeSSE2IYDqjGiIMBGw",
      "channel": {
        "id": "UCoRR6OLuIZ2-5VxtnQIaN2w",
        "title": "NFrealmusic",
        "handle": "channel/UCoRR6OLuIZ2-5VxtnQIaN2w",
        "thumbnail": "https://yt3.ggpht.com/J1_Si0TYNZ-991v09y8RpCh4_Z_ALwKmPgMYnJqjNhoglVtipf3oEN8LpzG1kS0qsv8Jptpmmg=s88-c-k-c0x00ffffff-no-rj"
      },
      "viewCountText": "14,860,541 views",
      "viewCountInt": 14860541,
      "publishedTimeText": "2 years ago",
      "publishedTime": "2023-05-28T17:08:46.499Z",
      "lengthText": "4:14",
      "lengthSeconds": 254
    }
  ]
}
```
---
### 2. Search by Hashtag

Search YouTube for content associated with a specific hashtag.

- **URL**: `https://api.scrapecreators.com/v1/youtube/search/hashtag`
- **Method**: `GET`

#### Headers

| Parameter   | Type   | Required | Description                |
|-------------|--------|----------|----------------------------|
| `x-api-key` | string | Yes      | Your Scrape Creators API key |

#### Query Parameters

| Parameter           | Type   | Required | Description                                                               | Options         |
|---------------------|--------|----------|---------------------------------------------------------------------------|-----------------|
| `hashtag`           | string | Yes      | The hashtag to search for (without the '#').                              |                 |
| `type`              | string | No       | Filter for all content types or only shorts.                              | `all`, `shorts` |
| `continuationToken` | string | No       | Token for pagination. Use the `continuationToken` from the previous response. |                 |

#### Example Request (Node.js)

```javascript
import axios from 'axios';

const options = {
  method: 'GET',
  url: 'https://api.scrapecreators.com/v1/youtube/search/hashtag',
  params: {
    hashtag: 'funnyfails'
  },
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
};

try {
  const { data } = await axios.request(options);
  console.log(data);
} catch (error) {
  console.error(error);
}
```

#### Example Response (`200 OK`)

```json
{
  "videos": [
    {
      "type": "video",
      "id": "jXMISgQq9MM",
      "url": "https://www.youtube.com/watch?v=jXMISgQq9MM",
      "title": "Epic fails 🤣🤣🤣 #shorts #funny #fails",
      "description": "",
      "thumbnail": "https://i.ytimg.com/vi/jXMISgQq9MM/hqdefault.jpg?sqp=-oaymwFBCNACELwBSFryq4qpAzMIARUAAIhCGADYAQHiAQoIGBACGAY4AUAB8AEB-AG2CIACgA-KAgwIABABGGUgXyhVMA8=&rs=AOn4CLC1HXfxzLayoVBdicS5DIUQh9zGcQ",
      "channel": {
        "id": "UCvUzWu1Whyw1FWuLl9GOo_g",
        "title": "ZZang Funny",
        "thumbnail": "https://yt3.ggpht.com/rcZKcfewHTzkauGknat3NeC53rGBofYDbL8AjFkwvsk2fXzM1clht7OTn9-1IIPn"
      }
    }
  ]
}
``` 