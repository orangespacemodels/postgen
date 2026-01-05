"""Content analysis router."""

from fastapi import APIRouter, HTTPException
from app.models import AnalyzeUrlRequest, AnalysisResponse
from app.services import analyze_url, spend_tokens
from app.config import get_settings
import httpx

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyze-url", response_model=AnalysisResponse)
async def api_analyze_url(request: AnalyzeUrlRequest) -> AnalysisResponse:
    """Analyze social media URL (Instagram/TikTok).

    Extracts content data including:
    - Post text/caption
    - Image URL
    - Video URL
    - Metadata (likes, comments, author)

    Charges $0.10 for URL analysis.
    """
    import traceback

    try:
        settings = get_settings()

        # Charge for URL analysis
        spend_result = await spend_tokens(
            request.user_id,
            settings.price_url_analysis,
            f"URL analysis: {request.url}",
        )

        if not spend_result.get("success"):
            raise HTTPException(
                status_code=402,
                detail=spend_result.get("error", "Insufficient balance"),
            )

        # Analyze URL using ScrapeCreators
        data = await analyze_url(request.url)

        return AnalysisResponse(
            success=True,
            content_type=data.get("content_type", "post"),
            has_image=data.get("has_image", False),
            has_video=data.get("has_video", False),
            post_text=data.get("post_text"),
            narrative=data.get("narrative"),
            image_url=data.get("image_url"),
            video_url=data.get("video_url"),
            video_duration_minutes=data.get("video_duration_minutes"),
            platform=data.get("platform"),
            platform_name=data.get("platform_name"),
            source_url=request.url,
            likes=data.get("likes"),
            comments=data.get("comments"),
            shares=data.get("shares"),
            author=data.get("author"),
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ScrapeCreators API error: {str(e)}")
    except Exception as e:
        # Log full traceback
        tb = traceback.format_exc()
        print(f"[analyze-url] Error: {str(e)}\n{tb}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {type(e).__name__}: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "post-miniapp-backend"}


@router.get("/debug/config")
async def debug_config():
    """Debug: Check if environment variables are loaded."""
    import os
    settings = get_settings()
    return {
        "scrapecreators_api_key_set": bool(settings.scrapecreators_api_key),
        "scrapecreators_api_key_len": len(settings.scrapecreators_api_key) if settings.scrapecreators_api_key else 0,
        "supabase_url_set": bool(settings.supabase_url),
        "supabase_url_value": settings.supabase_url[:50] if settings.supabase_url else None,
        "supabase_anon_key_set": bool(settings.supabase_anon_key),
        "supabase_anon_key_len": len(settings.supabase_anon_key) if settings.supabase_anon_key else 0,
    }


@router.get("/debug/supabase/{user_id}")
async def debug_supabase(user_id: int):
    """Debug: Test Supabase connection."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {settings.supabase_anon_key}",
        }

        # Test the exact URL format (column is 'id', not 'user_id')
        url = f"{settings.supabase_url}/rest/v1/user_data?select=balance&id=eq.{user_id}"
        response = await client.get(url, headers=headers)

        return {
            "url": url,
            "status_code": response.status_code,
            "response_text": response.text[:500] if response.text else None,
            "headers_sent": str(dict(headers))[:100],
        }


@router.get("/debug/scrapecreators")
async def debug_scrapecreators():
    """Debug: Test ScrapeCreators API connection with YouTube."""
    import urllib.parse
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test YouTube endpoint - uses 'url' parameter
        test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        headers = {"x-api-key": settings.scrapecreators_api_key}
        api_url = f"https://api.scrapecreators.com/v1/youtube/video?url={urllib.parse.quote(test_url)}"

        try:
            response = await client.get(api_url, headers=headers)
            return {
                "api_url": api_url,
                "status_code": response.status_code,
                "response_text": response.text[:1000] if response.text else None,
                "api_key_len": len(settings.scrapecreators_api_key),
            }
        except Exception as e:
            return {
                "error": str(e),
                "error_type": type(e).__name__,
            }
