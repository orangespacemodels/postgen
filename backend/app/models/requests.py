from pydantic import BaseModel, HttpUrl


class AnalyzeUrlRequest(BaseModel):
    """Request model for URL analysis."""
    url: str
    user_id: int
    post_id: int | None = None
    language: str = "ru"  # Language for AI-generated descriptions ('ru' or 'en')
