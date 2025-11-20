#!/usr/bin/env python3
"""
Convert Instagram reels JSON output to a formatted CSV with clickable URLs
"""

import json
import csv
from datetime import datetime
from pathlib import Path

def format_number(num):
    """Format large numbers with K/M suffixes"""
    if num >= 1_000_000:
        return f"{num/1_000_000:.1f}M"
    elif num >= 1_000:
        return f"{num/1_000:.1f}K"
    return str(num)

def format_duration(seconds):
    """Format video duration in MM:SS format"""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d}"

def main():
    # Read the JSON file
    input_file = Path(__file__).parent / 'output.json'
    output_file = Path(__file__).parent / 'reels_data.csv'

    print(f"Reading from: {input_file}")

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    reels = data.get('reels', [])
    print(f"Found {len(reels)} reels")

    # Define CSV columns
    fieldnames = [
        'Reel URL',
        'Creator Username',
        'Creator Full Name',
        'Verified',
        'Follower Count',
        'Post Count',
        'Video Duration',
        'Views',
        'Plays',
        'Likes',
        'Caption Preview',
        'Location',
        'Posted Date',
        'Has Audio',
        'Music Artist',
        'Song Name',
        'Thumbnail URL'
    ]

    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        for reel in reels:
            owner = reel.get('owner', {}) or {}
            music = reel.get('clips_music_attribution_info', {}) or {}
            location = reel.get('location', {}) or {}

            # Extract caption (first 100 chars)
            caption = reel.get('caption', '')
            caption_preview = caption[:100] + '...' if len(caption) > 100 else caption
            caption_preview = caption_preview.replace('\n', ' ').strip()

            # Format posted date
            taken_at = reel.get('taken_at', '')
            if taken_at:
                try:
                    dt = datetime.fromisoformat(taken_at.replace('Z', '+00:00'))
                    posted_date = dt.strftime('%Y-%m-%d %H:%M')
                except:
                    posted_date = taken_at
            else:
                posted_date = ''

            row = {
                'Reel URL': reel.get('url', ''),
                'Creator Username': owner.get('username', ''),
                'Creator Full Name': owner.get('full_name', ''),
                'Verified': '✓' if owner.get('is_verified') else '',
                'Follower Count': format_number(owner.get('follower_count', 0)),
                'Post Count': owner.get('post_count', 0),
                'Video Duration': format_duration(reel.get('video_duration', 0)),
                'Views': format_number(reel.get('video_view_count', 0)),
                'Plays': format_number(reel.get('video_play_count', 0)),
                'Likes': format_number(reel.get('like_count', 0)),
                'Caption Preview': caption_preview,
                'Location': location.get('name', ''),
                'Posted Date': posted_date,
                'Has Audio': '✓' if reel.get('has_audio') else '✗',
                'Music Artist': music.get('artist_name', ''),
                'Song Name': music.get('song_name', ''),
                'Thumbnail URL': reel.get('thumbnail_src', '')
            }

            writer.writerow(row)

    print(f"✓ CSV created successfully: {output_file}")
    print(f"✓ Processed {len(reels)} reels")
    print(f"\nYou can open this file in Excel, Google Sheets, or any CSV viewer.")
    print(f"The 'Reel URL' column contains clickable links to view each reel.")

if __name__ == '__main__':
    main()
