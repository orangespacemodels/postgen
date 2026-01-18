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
        """Analyze Instagram post/reel/carousel using ScrapeCreators API."""
        raw_data = await self._make_request("/instagram/post", {"url": url})

        # ScrapeCreators returns nested structure: data.xdt_shortcode_media
        # or sometimes flat structure for legacy compatibility
        data = raw_data.get("xdt_shortcode_media") or raw_data.get("data", {}).get("xdt_shortcode_media") or raw_data

        content_type = self.detect_instagram_type(url)
        is_video = content_type == "reel" or data.get("is_video", False)

        # Detect carousel: XDTGraphSidecar type or presence of edge_sidecar_to_children
        typename = data.get("__typename", "")
        sidecar_children = data.get("edge_sidecar_to_children", {}).get("edges", [])
        is_carousel = typename == "XDTGraphSidecar" or len(sidecar_children) > 0

        # Extract carousel items if present
        carousel_items = []
        if is_carousel and sidecar_children:
            for edge in sidecar_children:
                node = edge.get("node", {})
                node_typename = node.get("__typename", "")
                node_is_video = node.get("is_video", False) or node_typename == "XDTGraphVideo"

                item = {
                    "type": "video" if node_is_video else "image",
                    "display_url": node.get("display_url", ""),
                    "video_url": node.get("video_url") if node_is_video else None,
                    "accessibility_caption": node.get("accessibility_caption"),
                }
                carousel_items.append(item)

        # Extract caption from nested structure
        caption = ""
        caption_edges = data.get("edge_media_to_caption", {}).get("edges", [])
        if caption_edges:
            caption = caption_edges[0].get("node", {}).get("text", "")
        # Fallback to flat structure
        if not caption:
            caption = data.get("caption", "")

        # Extract display URL (cover image for carousel)
        display_url = data.get("display_url") or data.get("thumbnail_src") or data.get("thumbnail_url")

        # Extract video URL (for single videos, not carousels)
        video_url = data.get("video_url") if is_video and not is_carousel else None

        # Extract video duration (in seconds, convert to minutes)
        video_duration = data.get("video_duration", 0)
        video_duration_minutes = video_duration / 60 if video_duration else None

        # Extract owner/author
        owner = data.get("owner", {})
        author = owner.get("username", "")

        # Extract engagement metrics
        likes = data.get("edge_media_preview_like", {}).get("count", 0) or data.get("like_count", 0)
        comments = data.get("edge_media_to_parent_comment", {}).get("count", 0) or data.get("comment_count", 0)

        # Determine content type for response
        if is_carousel:
            response_content_type = "carousel"
            # Check if carousel has any videos
            has_video_in_carousel = any(item["type"] == "video" for item in carousel_items)
            is_video = has_video_in_carousel
        else:
            response_content_type = "video" if is_video else "post"

        return {
            "success": True,
            "platform": "instagram",
            "content_type": response_content_type,
            "has_image": bool(display_url) or any(item["type"] == "image" for item in carousel_items),
            "has_video": is_video,
            "post_text": caption,
            "narrative": caption,
            "image_url": display_url,
            "video_url": video_url,
            "video_duration_minutes": video_duration_minutes,
            "is_carousel": is_carousel,
            "carousel_items": carousel_items if carousel_items else None,
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

    async def analyze_youtube(self, url: str, language: str = "ru") -> dict:
        """Analyze YouTube video/short with FREE methods first, PAID fallback.

        Strategy:
        1. Try FREE YouTube Data API v3 for metadata (if YOUTUBE_API_KEY is set)
        2. Try FREE youtube-transcript-api for transcript (no key needed)
        3. Try FREE thumbnail-based frame analysis with Vision AI
        4. Fallback to PAID ScrapeCreators API if metadata extraction fails

        This significantly reduces API costs while maintaining full functionality.
        """
        from .youtube_transcript import get_youtube_transcript
        from .youtube_api import get_youtube_metadata
        from .youtube_frames import analyze_youtube_frames

        is_short = self.detect_youtube_type(url) == "short"
        metadata_source = "unknown"

        # Step 1: Try FREE YouTube Data API for metadata
        metadata = await get_youtube_metadata(url)

        if metadata:
            # FREE metadata extraction succeeded
            metadata_source = "youtube_api"
            print(f"[analyze_youtube] Using FREE YouTube Data API for metadata")

            title = metadata.title
            description = metadata.description
            thumbnail = metadata.thumbnail_url
            duration_seconds = metadata.duration_seconds
            views = metadata.views
            likes = metadata.likes
            comments = metadata.comments
            author = metadata.channel_name
        else:
            # Fallback to PAID ScrapeCreators API for metadata
            metadata_source = "scrapecreators"
            print(f"[analyze_youtube] Falling back to PAID ScrapeCreators for metadata")

            try:
                data = await self._make_request("/youtube/video", {"url": url})
            except Exception as e:
                print(f"[analyze_youtube] ScrapeCreators failed: {e}")
                # Return minimal response on complete failure
                return {
                    "success": False,
                    "platform": "youtube",
                    "content_type": "video",
                    "error": str(e),
                    "source_url": url,
                }

            title = data.get("title", "")
            description = data.get("description", "")
            thumbnail = data.get("thumbnail", "")
            author = data.get("channelTitle") or data.get("channel", {}).get("name", "")
            views = data.get("views", 0)
            likes = data.get("likes", 0)
            comments = data.get("comments", 0)

            # Duration from ScrapeCreators (may be seconds or ISO 8601)
            duration_raw = data.get("duration", 0)
            if isinstance(duration_raw, str):
                # Parse ISO 8601 if needed
                from .youtube_api import parse_iso8601_duration
                duration_seconds = parse_iso8601_duration(duration_raw)
            else:
                duration_seconds = duration_raw or 0

        duration_minutes = duration_seconds / 60 if duration_seconds else None

        # Step 2: Try FREE transcript extraction (youtube-transcript-api)
        # This is always free, no API key needed
        transcript = None
        transcript_language = None
        try:
            transcript, transcript_language = await get_youtube_transcript(url)
            if transcript:
                print(f"[analyze_youtube] Got transcript ({transcript_language}): {len(transcript)} chars")
        except Exception as e:
            print(f"[analyze_youtube] Transcript extraction failed (non-critical): {e}")

        # Build narrative: combine description with transcript for richer context
        narrative = description
        if transcript:
            # If we have a transcript, use it as the primary narrative
            # (it contains the actual video content, not just description)
            narrative = transcript

        # Step 3: Try frame analysis for scene and style detection
        scene_description = None
        style_description = None
        video_id = self.extract_youtube_video_id(url)
        if video_id:
            try:
                frame_analysis = await analyze_youtube_frames(video_id, language=language)
                scene_description = frame_analysis.get("scene_description")
                style_description = frame_analysis.get("style_description")
                frames_analyzed = frame_analysis.get("frames_analyzed", 0)
                print(f"[analyze_youtube] Frame analysis: {frames_analyzed} frames, scene={'yes' if scene_description else 'no'}, style={'yes' if style_description else 'no'}")
            except Exception as e:
                print(f"[analyze_youtube] Frame analysis failed (non-critical): {e}")

        print(f"[analyze_youtube] Completed: metadata={metadata_source}, transcript={'yes' if transcript else 'no'}, frames={'yes' if scene_description else 'no'}")

        return {
            "success": True,
            "platform": "youtube",
            "content_type": "video",
            "has_image": bool(thumbnail),
            "has_video": True,
            "post_text": description,
            "narrative": narrative,
            "title": title,
            "image_url": thumbnail,
            "video_url": url,  # YouTube doesn't provide direct video URL
            "video_duration_minutes": duration_minutes,
            "likes": likes,
            "comments": comments,
            "views": views,
            "author": author,
            "source_url": url,
            "is_short": is_short,
            # Transcript fields
            "transcript": transcript,
            "transcript_language": transcript_language,
            # Frame analysis fields (Vision AI)
            "scene_description": scene_description,
            "style_description": style_description,
            # Debug info (useful for monitoring)
            "_metadata_source": metadata_source,
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


async def analyze_url(url: str, language: str = "ru") -> dict:
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
        language: Language for AI-generated descriptions ('ru' or 'en')

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
    # Note: YouTube uses language for frame analysis
    if platform == "youtube":
        result = await client.analyze_youtube(url, language=language)
        result["platform_name"] = PLATFORM_NAMES.get(platform, platform)
        return result

    analyzers = {
        "instagram": client.analyze_instagram,
        "tiktok": client.analyze_tiktok,
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
