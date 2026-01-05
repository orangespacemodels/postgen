"""Post MiniApp Backend - FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import analysis_router, speech_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Post MiniApp Backend",
    description="Backend API for Post Generator MiniApp",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis_router)
app.include_router(speech_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "post-miniapp-backend",
        "version": "1.0.0",
        "docs": "/docs",
    }
