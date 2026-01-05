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


