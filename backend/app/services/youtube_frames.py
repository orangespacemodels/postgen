"""YouTube frame analysis using Vision AI.

Extracts frames from YouTube videos via free thumbnail URLs and analyzes them
with OpenAI GPT-4V to detect scene content and video style.
"""

import base64
import httpx
from typing import Optional

from app.config import get_settings


# YouTube auto-generated thumbnail URLs
# These are free and don't require any API key
THUMBNAIL_URLS = [
    "https://img.youtube.com/vi/{video_id}/1.jpg",   # ~25% of video
    "https://img.youtube.com/vi/{video_id}/2.jpg",   # ~50% of video
    "https://img.youtube.com/vi/{video_id}/3.jpg",   # ~75% of video
]


async def fetch_thumbnail_as_base64(url: str, timeout: float = 10.0) -> Optional[str]:
    """Fetch a thumbnail image and return as base64 string with retry.

    Args:
        url: Thumbnail URL
        timeout: Request timeout in seconds

    Returns:
        Base64 encoded image string, or None if fetch failed
    """
    from .retry import retry_async

    try:
        async def _fetch():
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url)
                response.raise_for_status()

                # Check if we got a valid image (YouTube returns a small placeholder for missing thumbs)
                content_length = len(response.content)
                if content_length < 1000:  # Placeholder images are typically very small
                    return None

                return base64.b64encode(response.content).decode("utf-8")

        return await retry_async(
            _fetch,
            max_retries=2,
            retry_on=(httpx.TimeoutException, httpx.ConnectError, httpx.HTTPStatusError),
        )
    except Exception as e:
        print(f"[fetch_thumbnail] Failed to fetch {url}: {e}")
        return None


async def analyze_youtube_frames(
    video_id: str,
    language: str = "ru"
) -> dict:
    """Fetch YouTube thumbnails and analyze with Vision AI.

    Uses free YouTube thumbnail URLs (no API key required) and OpenAI GPT-4V
    for vision analysis.

    Args:
        video_id: YouTube video ID (11 characters)
        language: Response language ('ru' or 'en')

    Returns:
        {
            'scene_description': str | None,  # What's happening visually
            'style_description': str | None,  # Video style (live action, animation, etc.)
            'frames_analyzed': int
        }
    """
    settings = get_settings()

    if not settings.openai_api_key:
        print("[analyze_youtube_frames] OpenAI API key not configured, skipping frame analysis")
        return {
            "scene_description": None,
            "style_description": None,
            "frames_analyzed": 0,
        }

    # Fetch thumbnails
    frames_base64 = []
    for url_template in THUMBNAIL_URLS:
        url = url_template.format(video_id=video_id)
        frame_data = await fetch_thumbnail_as_base64(url)
        if frame_data:
            frames_base64.append(frame_data)
            print(f"[analyze_youtube_frames] Fetched frame from {url}")

    if not frames_base64:
        print(f"[analyze_youtube_frames] No frames available for video {video_id}")
        return {
            "scene_description": None,
            "style_description": None,
            "frames_analyzed": 0,
        }

    print(f"[analyze_youtube_frames] Analyzing {len(frames_base64)} frames for video {video_id}")

    # Build the prompt
    lang_instruction = "Respond in Russian." if language == "ru" else "Respond in English."

    prompt = f"""You are analyzing frames from a YouTube video.

Based on these frames, provide:

1. SCENE DESCRIPTION: Describe what's happening visually in the video. What is being shown? What's the setting? What actions are taking place? Be concise but descriptive (2-3 sentences).

2. STYLE: Identify the video production style. Choose the most appropriate:
- Live action (real people/places filmed)
- Animation (2D/3D animated content)
- Screencast (screen recording, software demo)
- Talking head (person speaking directly to camera)
- Presentation/slides (PowerPoint, Keynote style)
- B-roll/stock footage (generic footage, no specific subject)
- Tutorial (hands-on demonstration)
- Vlog (casual personal video)
- Interview (conversation between people)
- Music video
- Gaming (gameplay footage)
- Mixed/hybrid (combination of styles)

{lang_instruction}

Format your response EXACTLY like this:
SCENE: [your scene description here]
STYLE: [single style type from the list above]"""

    # Build message content with images
    content = [{"type": "text", "text": prompt}]
    for frame_b64 in frames_base64:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{frame_b64}",
                "detail": "low"  # Use low detail to reduce cost
            }
        })

    # Call OpenAI Vision API with retry
    try:
        from .retry import retry_async

        async def _call_vision():
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",  # Cost-effective vision model
                        "messages": [
                            {
                                "role": "user",
                                "content": content,
                            }
                        ],
                        "max_tokens": 300,
                    },
                )
                resp.raise_for_status()
                return resp.json()

        result = await retry_async(
            _call_vision,
            max_retries=3,
            retry_on=(httpx.TimeoutException, httpx.ConnectError, httpx.HTTPStatusError),
        )

        # Parse the response
        assistant_message = result["choices"][0]["message"]["content"]
        print(f"[analyze_youtube_frames] GPT response: {assistant_message}")

        # Extract scene and style from response
        scene_description = None
        style_description = None

        for line in assistant_message.strip().split("\n"):
            line = line.strip()
            if line.upper().startswith("SCENE:"):
                scene_description = line[6:].strip()
            elif line.upper().startswith("STYLE:"):
                style_description = line[6:].strip()

        return {
            "scene_description": scene_description,
            "style_description": style_description,
            "frames_analyzed": len(frames_base64),
        }

    except httpx.HTTPStatusError as e:
        print(f"[analyze_youtube_frames] OpenAI API error: {e.response.status_code} - {e.response.text}")
        return {
            "scene_description": None,
            "style_description": None,
            "frames_analyzed": len(frames_base64),
        }
    except Exception as e:
        print(f"[analyze_youtube_frames] Vision analysis failed: {e}")
        return {
            "scene_description": None,
            "style_description": None,
            "frames_analyzed": len(frames_base64),
        }
