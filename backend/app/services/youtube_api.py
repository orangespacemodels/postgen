"""YouTube Data API v3 client for free metadata extraction.

This module provides free YouTube video metadata extraction using the official
YouTube Data API v3. It's used as the primary method, with ScrapeCreators as fallback.

Features:
- Extract video metadata (title, description, thumbnail, duration)
- Extract statistics (views, likes, comments count)
- Extract channel information
- Parse ISO 8601 duration to seconds

Quota:
- 10,000 units/day free tier
- videos.list costs 1 unit per call
- This gives ~10,000 video lookups per day for free

Setup:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new API key
3. Enable YouTube Data API v3
4. Set YOUTUBE_API_KEY in environment
"""

import re
from typing import Optional
from dataclasses import dataclass

from app.config import get_settings


@dataclass
class YouTubeMetadata:
    """YouTube video metadata extracted from API."""
    video_id: str
    title: str
    description: str
    thumbnail_url: str
    duration_seconds: int
    views: int
    likes: int
    comments: int
    channel_name: str
    channel_id: str
    published_at: str


def extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from various YouTube URL formats.

    Supported formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://www.youtube.com/v/VIDEO_ID

    Args:
        url: YouTube video URL

    Returns:
        Video ID (11 characters) or None if not found
    """
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def parse_iso8601_duration(duration: str) -> int:
    """Parse ISO 8601 duration string to seconds.

    Examples:
    - PT1H2M3S -> 3723 seconds
    - PT5M30S -> 330 seconds
    - PT45S -> 45 seconds
    - P1DT2H -> 93600 seconds (1 day + 2 hours)

    Args:
        duration: ISO 8601 duration string (e.g., "PT1H2M3S")

    Returns:
        Duration in seconds
    """
    if not duration or not duration.startswith('P'):
        return 0

    # Remove 'P' prefix
    duration = duration[1:]

    # Split into date and time parts
    if 'T' in duration:
        date_part, time_part = duration.split('T')
    else:
        date_part, time_part = duration, ''

    total_seconds = 0

    # Parse date part (days, weeks, months, years - less common for videos)
    date_pattern = re.compile(r'(\d+)([DWMY])')
    for match in date_pattern.finditer(date_part):
        value = int(match.group(1))
        unit = match.group(2)
        if unit == 'D':
            total_seconds += value * 86400
        elif unit == 'W':
            total_seconds += value * 604800
        # Months and years are approximations
        elif unit == 'M':
            total_seconds += value * 2592000  # ~30 days
        elif unit == 'Y':
            total_seconds += value * 31536000  # 365 days

    # Parse time part (hours, minutes, seconds)
    time_pattern = re.compile(r'(\d+)([HMS])')
    for match in time_pattern.finditer(time_part):
        value = int(match.group(1))
        unit = match.group(2)
        if unit == 'H':
            total_seconds += value * 3600
        elif unit == 'M':
            total_seconds += value * 60
        elif unit == 'S':
            total_seconds += value

    return total_seconds


async def get_youtube_metadata(url: str) -> Optional[YouTubeMetadata]:
    """Fetch YouTube video metadata using YouTube Data API v3.

    This is the FREE method for getting video metadata. Falls back to
    ScrapeCreators only if this fails or API key is not configured.

    Args:
        url: YouTube video URL

    Returns:
        YouTubeMetadata object or None if extraction fails
    """
    settings = get_settings()

    # Check if API key is configured
    if not settings.youtube_api_key:
        print("[youtube_api] No YOUTUBE_API_KEY configured, skipping free API")
        return None

    # Extract video ID
    video_id = extract_video_id(url)
    if not video_id:
        print(f"[youtube_api] Could not extract video ID from URL: {url}")
        return None

    try:
        # Import here to avoid loading the library if not needed
        from googleapiclient.discovery import build

        # Build the YouTube API client
        youtube = build('youtube', 'v3', developerKey=settings.youtube_api_key)

        # Request video details
        # parts: snippet (title, description, thumbnails, channel)
        #        statistics (views, likes, comments)
        #        contentDetails (duration)
        request = youtube.videos().list(
            part='snippet,statistics,contentDetails',
            id=video_id
        )
        response = request.execute()

        # Check if video was found
        items = response.get('items', [])
        if not items:
            print(f"[youtube_api] Video not found: {video_id}")
            return None

        video = items[0]
        snippet = video.get('snippet', {})
        statistics = video.get('statistics', {})
        content_details = video.get('contentDetails', {})

        # Get best thumbnail (maxres > high > medium > default)
        thumbnails = snippet.get('thumbnails', {})
        thumbnail_url = (
            thumbnails.get('maxres', {}).get('url') or
            thumbnails.get('high', {}).get('url') or
            thumbnails.get('medium', {}).get('url') or
            thumbnails.get('default', {}).get('url') or
            ''
        )

        # Parse duration from ISO 8601
        duration_iso = content_details.get('duration', 'PT0S')
        duration_seconds = parse_iso8601_duration(duration_iso)

        metadata = YouTubeMetadata(
            video_id=video_id,
            title=snippet.get('title', ''),
            description=snippet.get('description', ''),
            thumbnail_url=thumbnail_url,
            duration_seconds=duration_seconds,
            views=int(statistics.get('viewCount', 0)),
            likes=int(statistics.get('likeCount', 0)),
            comments=int(statistics.get('commentCount', 0)),
            channel_name=snippet.get('channelTitle', ''),
            channel_id=snippet.get('channelId', ''),
            published_at=snippet.get('publishedAt', ''),
        )

        print(f"[youtube_api] Successfully fetched metadata for: {video_id} - {metadata.title[:50]}...")
        return metadata

    except ImportError:
        print("[youtube_api] google-api-python-client not installed")
        return None
    except Exception as e:
        print(f"[youtube_api] Error fetching metadata: {e}")
        return None
