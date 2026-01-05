from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ScrapeCreators API
    scrapecreators_api_key: str = ""

    # Supabase (for balance management)
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # CORS
    cors_origins: str = "*"

    # Pricing
    price_url_analysis: float = 0.10

    class Config:
        # Don't require .env file in production
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
