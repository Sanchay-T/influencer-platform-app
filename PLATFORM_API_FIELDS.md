# Platform API Fields Documentation

## Overview
This document details exactly what data fields each platform's API provides for both keyword and similar search functionality.

## Keyword Search

### TikTok Keyword Search
**API Endpoint**: `https://api.scrapecreators.com/v1/tiktok/search/keyword`

**Available Fields**:
- **Creator Data**:
  - `username` (unique_id)
  - `nickname` (display name)
  - `follower_count`
  - `avatar_medium` (profile picture URL)
  - `is_verified`
  - `signature` (bio - sometimes empty in search results)
  
- **Video Data**:
  - `description` (video title/caption)
  - `share_url` (video URL)
  - `statistics`:
    - `digg_count` (likes)
    - `comment_count`
    - `share_count`
    - `play_count` (views)
  - `text_extra` (hashtags)
  - `create_time` (timestamp)

- **Extracted Fields**:
  - `emails` (extracted from bio using regex)

### YouTube Keyword Search
**API Endpoint**: `https://api.scrapecreators.com/v1/youtube/search`

**Available Fields**:
- **Channel/Creator Data**:
  - `channel.title` (channel name)
  - `channel.thumbnail` (channel avatar)
  - ❌ No follower/subscriber count
  - ❌ No bio/description
  - ❌ No verification status
  
- **Video Data**:
  - `title` (video title)
  - `url` (video URL)
  - `viewCountInt` (views only)
  - `lengthSeconds` (duration)
  - `publishedTime`
  - ❌ No likes/comments/shares
  
- **Limitations**:
  - No email extraction possible (no bio data)
  - Minimal creator information

## Similar Search

### TikTok Similar Search
**API Endpoint**: `https://api.scrapecreators.com/v1/tiktok/profile` (for target user)
**API Endpoint**: `https://api.scrapecreators.com/v1/tiktok/search/user` (for similar users)

**Available Fields**:
- `uid` (user ID)
- `unique_id` (username)
- `nickname` (full name/display name)
- `follower_count`
- `following_count`
- `aweme_count` (video count)
- `total_favorited` (total likes received)
- `avatar_medium` (profile picture URL)
- `is_private_account` (0 or 1)
- `verification_type` (> 0 means verified)
- `search_user_desc` (basic bio - often just the nickname)

- **Extracted Fields**:
  - `emails` (extracted from bio if available)
  - `profileUrl` (constructed from username)

### Instagram Similar Search
**API Endpoint**: `https://api.scrapecreators.com/v1/instagram/profile`

**Available Fields** (for related profiles):
- `id`
- `username`
- `full_name`
- `profile_pic_url`
- `is_private` (boolean)
- `is_verified` (boolean)
- ❌ No follower count
- ❌ No bio for related profiles
- ❌ No email data

**Note**: Main profile has `biography` field, but related profiles don't.

## Data Availability Summary

| Feature | TikTok Keyword | YouTube Keyword | TikTok Similar | Instagram Similar |
|---------|----------------|-----------------|----------------|-------------------|
| **Username** | ✅ | ✅ (channel name) | ✅ | ✅ |
| **Full Name** | ✅ | ❌ | ✅ | ✅ |
| **Followers** | ✅ | ❌ | ✅ | ❌ |
| **Bio** | ✅ (sometimes empty) | ❌ | ✅ (basic) | ❌ (only main profile) |
| **Email** | ✅ (if in bio) | ❌ | ✅ (if in bio) | ❌ (only main profile) |
| **Profile Pic** | ✅ | ✅ | ✅ | ✅ |
| **Verified** | ✅ | ❌ | ✅ | ✅ |
| **Private** | ❌ | ❌ | ✅ | ✅ |
| **Video Title** | ✅ | ✅ | ❌ | ❌ |
| **Views** | ✅ | ✅ | ❌ | ❌ |
| **Likes** | ✅ | ❌ | ❌ | ❌ |
| **Comments** | ✅ | ❌ | ❌ | ❌ |
| **Shares** | ✅ | ❌ | ❌ | ❌ |
| **Duration** | ❌ | ✅ | ❌ | ❌ |

## Current Frontend Table Implementation

### Keyword Search Table (Both Platforms)
- Profile (avatar)
- Username
- Bio
- Email
- Video Title
- Views
- Likes (TikTok only)
- Comments (TikTok only)
- Shares (TikTok only)
- Duration
- Link

### Similar Search Table (Both Platforms)
- Profile (avatar)
- Username
- Full Name
- Bio
- Email
- Private
- Verified

## Notes
1. YouTube provides the least creator information for keyword search
2. Instagram provides the least information for similar profiles
3. TikTok provides the most comprehensive data across both search types
4. Email extraction only works when bio data is available and contains email addresses