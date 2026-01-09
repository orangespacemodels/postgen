"""ScrapeCreators API client for social media content analysis.

Supported platforms:
- Instagram (posts, reels, stories)
- TikTok (videos)
- YouTube (videos, shorts)
- Twitter/X (tweets)
- LinkedIn (posts)
- Reddit (posts)
- Facebook (posts)
- Threads (posts)
"""

import httpx
from typing import Literal, Optional
from app.config import get_settings

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v1"

Platform = Literal[
    "instagram", "tiktok", "youtube", "twitter",
    "linkedin", "reddit", "facebook", "threads", "unknown"
]


class ScrapeCreatorsClient:
    """Client for ScrapeCreators API - supports multiple social platforms."""

    def __init__(self):
        self.settings = get_settings()
        self.headers = {"x-api-key": self.settings.scrapecreators_api_key}

    def detect_platform(self, url: str) -> Platform:
        """Detect social media platform from URL."""
        url_lower = url.lower()

        # Instagram
        if "instagram.com" in url_lower or "instagr.am" in url_lower:
            return "instagram"

        # TikTok
        if "tiktok.com" in url_lower or "vm.tiktok.com" in url_lower:
            return "tiktok"

        # YouTube
        if any(x in url_lower for x in ["youtube.com", "youtu.be", "youtube.com/shorts"]):
            return "youtube"

        # Twitter/X
        if any(x in url_lower for x in ["twitter.com", "x.com", "t.co"]):
            return "twitter"

        # LinkedIn
        if "linkedin.com" in url_lower:
            return "linkedin"

        # Reddit
        if "reddit.com" in url_lower or "redd.it" in url_lower:
            return "reddit"

        # Facebook
        if any(x in url_lower for x in ["facebook.com", "fb.com", "fb.watch"]):
            return "facebook"

        # Threads
        if "threads.net" in url_lower:
            return "threads"

        return "unknown"

    def detect_instagram_type(self, url: str) -> Literal["post", "reel", "story"]:
        """Detect Instagram content type from URL."""
        if "/reel/" in url or "/reels/" in url:
            return "reel"
        elif "/stories/" in url:
            return "story"
        return "post"

    def detect_youtube_type(self, url: str) -> Literal["video", "short"]:
        """Detect YouTube content type from URL."""
        if "/shorts/" in url.lower():
            return "short"
        return "video"

    def extract_youtube_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL."""
        import re

        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def _make_request(self, endpoint: str, params: dict) -> dict:
        """Make request to ScrapeCreators API."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{SCRAPECREATORS_BASE}{endpoint}",
                params=params,
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def analyze_instagram(self, url: str) -> dict:
        """Analyze Instagram post/reel using ScrapeCreators API."""
        raw_data = await self._make_request("/instagram/post", {"url": url})

        # ScrapeCreators returns nested structure: data.xdt_shortcode_media
        # or sometimes flat structure for legacy compatibility
        data = raw_data.get("xdt_shortcode_media") or raw_data.get("data", {}).get("xdt_shortcode_media") or raw_data

        content_type = self.detect_instagram_type(url)
        is_video = content_type == "reel" or data.get("is_video", False)

        # Extract caption from nested structure
        caption = ""
        caption_edges = data.get("edge_media_to_caption", {}).get("edges", [])
        if caption_edges:
            caption = caption_edges[0].get("node", {}).get("text", "")
        # Fallback to flat structure
        if not caption:
            caption = data.get("caption", "")

        # Extract display URL
        display_url = data.get("display_url") or data.get("thumbnail_src") or data.get("thumbnail_url")

        # Extract video URL
        video_url = data.get("video_url") if is_video else None

        # Extract video duration (in seconds, convert to minutes)
        video_duration = data.get("video_duration", 0)
        video_duration_minutes = video_duration / 60 if video_duration else None

        # Extract owner/author
        owner = data.get("owner", {})
        author = owner.get("username", "")

        # Extract engagement metrics
        likes = data.get("edge_media_preview_like", {}).get("count", 0) or data.get("like_count", 0)
        comments = data.get("edge_media_to_parent_comment", {}).get("count", 0) or data.get("comment_count", 0)

        return {
            "success": True,
            "platform": "instagram",
            "content_type": "video" if is_video else "post",
            "has_image": bool(display_url),
            "has_video": is_video,
            "post_text": caption,
            "narrative": caption,
            "image_url": display_url,
            "video_url": video_url,
            "video_duration_minutes": video_duration_minutes,
            "likes": likes,
            "comments": comments,
            "author": author,
            "source_url": url,
        }

    async def analyze_tiktok(self, url: str) -> dict:
        """Analyze TikTok video using ScrapeCreators API."""
        data = await self._make_request("/tiktok/post", {"url": url})

        duration_seconds = data.get("duration", 0)
        duration_minutes = duration_seconds / 60 if duration_seconds else None

        return {
            "success": True,
            "platform": "tiktok",
            "content_type": "video",
            "has_image": bool(data.get("cover")),
            "has_video": True,
            "post_text": data.get("desc", ""),
            "narrative": data.get("desc", ""),
            "image_url": data.get("cover"),
            "video_url": data.get("video", {}).get("playAddr"),
            "video_duration_minutes": duration_minutes,
            "likes": data.get("stats", {}).get("diggCount", 0),
            "comments": data.get("stats", {}).get("commentCount", 0),
            "shares": data.get("stats", {}).get("shareCount", 0),
            "author": data.get("author", {}).get("uniqueId"),
            "source_url": url,
        }

    async def analyze_youtube(self, url: str) -> dict:
        """Analyze YouTube video/short using ScrapeCreators API."""
        # ScrapeCreators YouTube API uses 'url' parameter
        data = await self._make_request("/youtube/video", {"url": url})

        # Duration is usually in ISO 8601 format (PT1H2M3S) or seconds
        duration_seconds = data.get("duration", 0)
        if isinstance(duration_seconds, str):
            # Parse ISO 8601 duration if needed
            duration_seconds = 0  # Simplified, actual parsing would be more complex
        duration_minutes = duration_seconds / 60 if duration_seconds else None

        is_short = self.detect_youtube_type(url) == "short"

        return {
            "success": True,
            "platform": "youtube",
            "content_type": "video",
            "has_image": bool(data.get("thumbnail")),
            "has_video": True,
            "post_text": data.get("description", ""),
            "narrative": data.get("description", ""),
            "title": data.get("title", ""),
            "image_url": data.get("thumbnail"),
            "video_url": url,  # YouTube doesn't provide direct video URL
            "video_duration_minutes": duration_minutes,
            "likes": data.get("likes", 0),
            "comments": data.get("comments", 0),
            "views": data.get("views", 0),
            "author": data.get("channelTitle") or data.get("channel", {}).get("name"),
            "source_url": url,
            "is_short": is_short,
        }

    async def analyze_twitter(self, url: str) -> dict:
        """Analyze Twitter/X tweet using ScrapeCreators API."""
        data = await self._make_request("/twitter/tweet", {"url": url})

        # Check for media
        media = data.get("media", [])
        has_image = any(m.get("type") == "photo" for m in media)
        has_video = any(m.get("type") in ["video", "animated_gif"] for m in media)

        image_url = None
        video_url = None
        for m in media:
            if m.get("type") == "photo" and not image_url:
                image_url = m.get("url")
            elif m.get("type") in ["video", "animated_gif"] and not video_url:
                video_url = m.get("url")
                if not image_url:
                    image_url = m.get("thumbnail")

        return {
            "success": True,
            "platform": "twitter",
            "content_type": "video" if has_video else "post",
            "has_image": has_image,
            "has_video": has_video,
            "post_text": data.get("text", ""),
            "narrative": data.get("text", ""),
            "image_url": image_url,
            "video_url": video_url,
            "likes": data.get("likes", 0),
            "comments": data.get("replies", 0),
            "retweets": data.get("retweets", 0),
            "author": data.get("author", {}).get("username"),
            "source_url": url,
        }

    async def analyze_linkedin(self, url: str) -> dict:
        """Analyze LinkedIn post using ScrapeCreators API."""
        data = await self._make_request("/linkedin/post", {"url": url})

        # Check for media
        media = data.get("media", []) or []
        images = [m for m in media if m.get("type") == "image"]
        videos = [m for m in media if m.get("type") == "video"]

        return {
            "success": True,
            "platform": "linkedin",
            "content_type": "video" if videos else "post",
            "has_image": bool(images),
            "has_video": bool(videos),
            "post_text": data.get("text", ""),
            "narrative": data.get("text", ""),
            "image_url": images[0].get("url") if images else None,
            "video_url": videos[0].get("url") if videos else None,
            "likes": data.get("likes", 0),
            "comments": data.get("comments", 0),
            "author": data.get("author", {}).get("name"),
            "author_headline": data.get("author", {}).get("headline"),
            "source_url": url,
        }

    async def analyze_reddit(self, url: str) -> dict:
        """Analyze Reddit post using ScrapeCreators API."""
        data = await self._make_request("/reddit/post", {"url": url})

        # Reddit posts can have images, videos, or just text
        media_type = data.get("post_hint", "")
        has_video = "video" in media_type or bool(data.get("media"))
        has_image = "image" in media_type or bool(data.get("preview", {}).get("images"))

        image_url = None
        if has_image and data.get("preview", {}).get("images"):
            image_url = data["preview"]["images"][0].get("source", {}).get("url")

        return {
            "success": True,
            "platform": "reddit",
            "content_type": "video" if has_video else "post",
            "has_image": has_image,
            "has_video": has_video,
            "post_text": data.get("selftext", "") or data.get("title", ""),
            "narrative": data.get("selftext", "") or data.get("title", ""),
            "title": data.get("title", ""),
            "image_url": image_url or data.get("thumbnail"),
            "video_url": data.get("media", {}).get("reddit_video", {}).get("fallback_url") if has_video else None,
            "upvotes": data.get("ups", 0),
            "comments": data.get("num_comments", 0),
            "author": data.get("author"),
            "subreddit": data.get("subreddit"),
            "source_url": url,
        }

    async def analyze_facebook(self, url: str) -> dict:
        """Analyze Facebook post using ScrapeCreators API."""
        data = await self._make_request("/facebook/post", {"url": url})

        # Check for media
        has_video = bool(data.get("video"))
        has_image = bool(data.get("images") or data.get("image"))

        images = data.get("images", [])
        image_url = images[0] if images else data.get("image")

        return {
            "success": True,
            "platform": "facebook",
            "content_type": "video" if has_video else "post",
            "has_image": has_image,
            "has_video": has_video,
            "post_text": data.get("text", ""),
            "narrative": data.get("text", ""),
            "image_url": image_url,
            "video_url": data.get("video"),
            "likes": data.get("likes", 0),
            "comments": data.get("comments", 0),
            "shares": data.get("shares", 0),
            "author": data.get("author", {}).get("name"),
            "source_url": url,
        }

    async def analyze_threads(self, url: str) -> dict:
        """Analyze Threads post using ScrapeCreators API."""
        data = await self._make_request("/threads/post", {"url": url})

        # Check for media
        media = data.get("media", []) or []
        has_image = any(m.get("type") == "image" for m in media)
        has_video = any(m.get("type") == "video" for m in media)

        image_url = None
        video_url = None
        for m in media:
            if m.get("type") == "image" and not image_url:
                image_url = m.get("url")
            elif m.get("type") == "video" and not video_url:
                video_url = m.get("url")

        return {
            "success": True,
            "platform": "threads",
            "content_type": "video" if has_video else "post",
            "has_image": has_image,
            "has_video": has_video,
            "post_text": data.get("text", ""),
            "narrative": data.get("text", ""),
            "image_url": image_url,
            "video_url": video_url,
            "likes": data.get("likes", 0),
            "comments": data.get("replies", 0),
            "author": data.get("author", {}).get("username"),
            "source_url": url,
        }


# Platform display names for UI
PLATFORM_NAMES = {
    "instagram": "Instagram",
    "tiktok": "TikTok",
    "youtube": "YouTube",
    "twitter": "Twitter/X",
    "linkedin": "LinkedIn",
    "reddit": "Reddit",
    "facebook": "Facebook",
    "threads": "Threads",
}

# Supported platforms list
SUPPORTED_PLATFORMS = list(PLATFORM_NAMES.keys())


async def analyze_url(url: str) -> dict:
    """Analyze social media URL and return content data.

    Supported platforms:
    - Instagram (posts, reels)
    - TikTok (videos)
    - YouTube (videos, shorts)
    - Twitter/X (tweets)
    - LinkedIn (posts)
    - Reddit (posts)
    - Facebook (posts)
    - Threads (posts)

    Args:
        url: Social media URL

    Returns:
        dict with content data including image_url, video_url, platform, etc.

    Raises:
        ValueError: If platform is not supported
        httpx.HTTPError: If API request fails
    """
    client = ScrapeCreatorsClient()
    platform = client.detect_platform(url)

    if platform == "unknown":
        supported = ", ".join(PLATFORM_NAMES.values())
        raise ValueError(
            f"Unsupported platform. Supported platforms: {supported}"
        )

    # Route to appropriate analyzer
    analyzers = {
        "instagram": client.analyze_instagram,
        "tiktok": client.analyze_tiktok,
        "youtube": client.analyze_youtube,
        "twitter": client.analyze_twitter,
        "linkedin": client.analyze_linkedin,
        "reddit": client.analyze_reddit,
        "facebook": client.analyze_facebook,
        "threads": client.analyze_threads,
    }

    analyzer = analyzers.get(platform)
    if not analyzer:
        raise ValueError(f"No analyzer for platform: {platform}")

    result = await analyzer(url)
    result["platform_name"] = PLATFORM_NAMES.get(platform, platform)
    return result
