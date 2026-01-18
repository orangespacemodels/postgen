"""YouTube transcript extraction service.

Uses the FREE youtube-transcript-api library as the primary method.
Falls back to ScrapeCreators API only when the free method fails.

The youtube-transcript-api library:
- Is completely FREE (no API key needed)
- Works by scraping YouTube's transcript endpoint
- Supports multiple languages with priority selection
- Handles both manual and auto-generated captions
"""

import re
from typing import Optional, Tuple

import httpx

from app.config import get_settings

# Maximum transcript length to return (characters)
MAX_TRANSCRIPT_LENGTH = 15000

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v1"


def _clean_transcript(text: str) -> str:
    """Clean up transcript text.

    - Remove excessive whitespace
    - Remove YouTube auto-caption artifacts like [Music], [Applause]
    - Normalize line breaks
    """
    # Remove common YouTube artifacts
    artifacts = [
        r'\[Music\]',
        r'\[Applause\]',
        r'\[Laughter\]',
        r'\[Background noise\]',
        r'\[Inaudible\]',
        r'\[Foreign\]',
        r'\[музыка\]',
        r'\[аплодисменты\]',
        r'\[смех\]',
    ]

    for artifact in artifacts:
        text = re.sub(artifact, '', text, flags=re.IGNORECASE)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()

    return text


def _extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube URL."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


async def _get_transcript_free(video_id: str) -> Tuple[Optional[str], Optional[str]]:
    """Get transcript using FREE youtube-transcript-api library.

    Priority order for language selection:
    1. Russian (ru) - manual captions
    2. English (en) - manual captions
    3. Any other manual captions
    4. Russian auto-generated (ru-auto)
    5. English auto-generated (en-auto)
    6. Any auto-generated captions

    Args:
        video_id: YouTube video ID (11 characters)

    Returns:
        Tuple of (transcript_text, language_code) or (None, None)
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import (
            TranscriptsDisabled,
            NoTranscriptFound,
            VideoUnavailable,
        )
    except ImportError:
        print("[youtube_transcript] youtube-transcript-api not installed")
        return None, None

    try:
        # Get list of available transcripts
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Try to find transcripts in priority order
        transcript = None
        language = None

        # Priority 1: Manual Russian
        try:
            transcript = transcript_list.find_manually_created_transcript(['ru'])
            language = 'ru'
            print(f"[youtube_transcript] Found manual Russian transcript")
        except Exception:
            pass

        # Priority 2: Manual English
        if not transcript:
            try:
                transcript = transcript_list.find_manually_created_transcript(['en', 'en-US', 'en-GB'])
                language = 'en'
                print(f"[youtube_transcript] Found manual English transcript")
            except Exception:
                pass

        # Priority 3: Any manual transcript
        if not transcript:
            try:
                for t in transcript_list:
                    if not t.is_generated:
                        transcript = t
                        language = t.language_code
                        print(f"[youtube_transcript] Found manual transcript: {language}")
                        break
            except Exception:
                pass

        # Priority 4: Auto-generated Russian
        if not transcript:
            try:
                transcript = transcript_list.find_generated_transcript(['ru'])
                language = 'ru-auto'
                print(f"[youtube_transcript] Found auto-generated Russian transcript")
            except Exception:
                pass

        # Priority 5: Auto-generated English
        if not transcript:
            try:
                transcript = transcript_list.find_generated_transcript(['en', 'en-US', 'en-GB'])
                language = 'en-auto'
                print(f"[youtube_transcript] Found auto-generated English transcript")
            except Exception:
                pass

        # Priority 6: Any auto-generated transcript
        if not transcript:
            try:
                for t in transcript_list:
                    if t.is_generated:
                        transcript = t
                        language = f"{t.language_code}-auto"
                        print(f"[youtube_transcript] Found auto-generated transcript: {language}")
                        break
            except Exception:
                pass

        if not transcript:
            print(f"[youtube_transcript] No transcript found for video: {video_id}")
            return None, None

        # Fetch the transcript text
        transcript_data = transcript.fetch()

        # Combine all text segments
        text_parts = [entry.get('text', '') for entry in transcript_data]
        full_text = ' '.join(text_parts)

        # Clean the text
        full_text = _clean_transcript(full_text)

        # Truncate if too long
        if len(full_text) > MAX_TRANSCRIPT_LENGTH:
            full_text = full_text[:MAX_TRANSCRIPT_LENGTH].rsplit(' ', 1)[0]
            full_text += '... [transcript truncated]'

        print(f"[youtube_transcript] FREE method: Got transcript ({language}): {len(full_text)} chars")
        return full_text, language

    except (TranscriptsDisabled, NoTranscriptFound) as e:
        print(f"[youtube_transcript] No transcript available: {e}")
        return None, None
    except VideoUnavailable as e:
        print(f"[youtube_transcript] Video unavailable: {e}")
        return None, None
    except Exception as e:
        print(f"[youtube_transcript] FREE method error: {e}")
        return None, None


async def _get_transcript_scrapecreators(url: str) -> Tuple[Optional[str], Optional[str]]:
    """Get transcript using ScrapeCreators API (PAID fallback).

    Only used when the free youtube-transcript-api fails.

    Args:
        url: Full YouTube URL

    Returns:
        Tuple of (transcript_text, language) or (None, None)
    """
    settings = get_settings()

    if not settings.scrapecreators_api_key:
        print("[youtube_transcript] No ScrapeCreators API key configured")
        return None, None

    headers = {"x-api-key": settings.scrapecreators_api_key}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{SCRAPECREATORS_BASE}/youtube/video/transcript",
                params={"url": url},
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        # ScrapeCreators returns transcript_only_text as concatenated string
        transcript_text = data.get("transcript_only_text", "")
        language = data.get("language", "unknown")

        if not transcript_text:
            # Fallback: try to build from transcript segments array
            segments = data.get("transcript", [])
            if segments:
                transcript_text = " ".join(
                    seg.get("text", "").strip()
                    for seg in segments
                    if seg.get("text")
                )

        if not transcript_text:
            print(f"[youtube_transcript] ScrapeCreators: No transcript found for URL: {url}")
            return None, None

        # Clean up the text
        transcript_text = _clean_transcript(transcript_text)

        # Truncate if too long
        if len(transcript_text) > MAX_TRANSCRIPT_LENGTH:
            transcript_text = transcript_text[:MAX_TRANSCRIPT_LENGTH].rsplit(' ', 1)[0]
            transcript_text += '... [transcript truncated]'

        print(f"[youtube_transcript] PAID fallback: Got transcript ({language}): {len(transcript_text)} chars")
        return transcript_text, language

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            print(f"[youtube_transcript] ScrapeCreators: No transcript available for: {url}")
        else:
            print(f"[youtube_transcript] ScrapeCreators API error {e.response.status_code}: {e}")
        return None, None
    except Exception as e:
        print(f"[youtube_transcript] ScrapeCreators error: {e}")
        return None, None


async def get_youtube_transcript(url: str) -> Tuple[Optional[str], Optional[str]]:
    """Fetch YouTube transcript with FREE method first, PAID fallback second.

    Strategy:
    1. Try FREE youtube-transcript-api library (no API key needed)
    2. If fails, try PAID ScrapeCreators API as fallback

    Args:
        url: Full YouTube URL

    Returns:
        Tuple of (transcript_text, language) or (None, None) if unavailable.
    """
    # Extract video ID for the free method
    video_id = _extract_video_id(url)
    if not video_id:
        print(f"[youtube_transcript] Could not extract video ID from URL: {url}")
        # Try ScrapeCreators as fallback (it might handle more URL formats)
        return await _get_transcript_scrapecreators(url)

    # Step 1: Try FREE method
    transcript, language = await _get_transcript_free(video_id)
    if transcript:
        return transcript, language

    # Step 2: Fallback to PAID method
    print(f"[youtube_transcript] Free method failed, trying ScrapeCreators fallback...")
    return await _get_transcript_scrapecreators(url)
