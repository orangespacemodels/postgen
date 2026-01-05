from pydantic import BaseModel
from typing import Literal


class AnalysisResponse(BaseModel):
    """Response model for content analysis."""
    success: bool = True
    content_type: Literal["post", "image", "video", "unknown"] = "post"
    has_image: bool = False
    has_video: bool = False
    post_text: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    video_duration_minutes: float | None = None
    source_url: str | None = None

    # Platform information
    platform: str | None = None       # Platform ID: instagram, tiktok, youtube, etc.
    platform_name: str | None = None  # Display name: Instagram, TikTok, YouTube, etc.

    # AI-generated descriptions
    narrative: str | None = None
    format_description: str | None = None
    style_description: str | None = None
    composition_description: str | None = None
    scene_description: str | None = None

    # Metadata
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    author: str | None = None

    # Error handling
    error: str | None = None
