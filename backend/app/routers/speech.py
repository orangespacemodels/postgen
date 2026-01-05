"""Speech-to-text router using OpenAI Whisper API."""

import httpx
from fastapi import APIRouter, File, UploadFile, HTTPException
from app.config import get_settings

router = APIRouter(prefix="/api", tags=["speech"])

settings = get_settings()


@router.post("/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """
    Transcribe audio file using OpenAI Whisper API.
    Supports mixed Russian and English speech.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    # Read audio file
    audio_content = await audio.read()

    if len(audio_content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Prepare multipart form data for Whisper API
    files = {
        "file": (audio.filename or "recording.webm", audio_content, audio.content_type or "audio/webm"),
        "model": (None, "whisper-1"),
        # Prompt helps with mixed Russian-English speech recognition
        "prompt": (None, "This is a mixed Russian and English speech. Привет, Hello, как дела, how are you."),
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files=files,
            )

        if response.status_code != 200:
            error_text = response.text
            print(f"[speech-to-text] OpenAI API error: {error_text}")
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {response.status_code}")

        result = response.json()
        transcript = result.get("text", "")

        if not transcript:
            raise HTTPException(status_code=400, detail="No transcription in response")

        print(f"[speech-to-text] Transcribed: {transcript[:100]}...")

        return {
            "transcript": transcript,
            "language": result.get("language", "unknown"),
        }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="OpenAI API timeout")
    except Exception as e:
        print(f"[speech-to-text] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
