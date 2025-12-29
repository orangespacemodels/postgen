# Plan: Refactoring post-miniapp from n8n to Pydantic AI

## Overview

Replace n8n workflows with a FastAPI + Pydantic AI backend for better debugging, type safety, and development velocity.

**Estimated time:** 2-3 days
**Complexity:** Medium

---

## Phase 1: Backend Setup (Day 1, Morning)

### 1.1 Create Python Backend Structure

```
post-miniapp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Settings with pydantic-settings
│   │   ├── dependencies.py      # Supabase client, etc.
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── requests.py      # Input models
│   │   │   └── responses.py     # Output models
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── scene_agent.py   # Scene description + captions
│   │   │   ├── text_agent.py    # Post text generation
│   │   │   └── improve_agent.py # Magic wand prompt improvement
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── gemini.py        # Gemini image generation
│   │   │   ├── supabase.py      # DB + Storage operations
│   │   │   ├── telegram.py      # Send to Telegram
│   │   │   └── scraper.py       # Content analysis (ScrapeCreators)
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── generation.py    # /generate-text, /generate-image
│   │       ├── preparation.py   # /prepare-image
│   │       └── analysis.py      # /analyze-content
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_agents.py
│   │   ├── test_services.py
│   │   └── conftest.py
│   ├── .env.example
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── docker-compose.yml
├── src/                          # Existing React frontend
└── ...
```

### 1.2 Dependencies (pyproject.toml)

```toml
[project]
name = "post-miniapp-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.6.0",
    "pydantic-ai>=0.0.20",
    "supabase>=2.10.0",
    "httpx>=0.28.0",
    "google-generativeai>=0.8.0",
    "python-telegram-bot>=21.0",
    "python-multipart>=0.0.12",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=6.0.0",
    "ruff>=0.8.0",
]
```

### 1.3 Configuration (app/config.py)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str

    # AI Providers
    openai_api_key: str
    google_api_key: str
    anthropic_api_key: str

    # Telegram
    telegram_bot_token: str

    # External APIs
    scrapecreators_api_key: str

    # Pricing
    price_text_generation: float = 0.05
    price_image_generation: float = 0.10
    price_image_preparation: float = 0.02
    price_magic_wand: float = 0.05
    price_url_analysis: float = 0.10

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Phase 2: Pydantic AI Agents (Day 1, Afternoon)

### 2.1 Scene Description Agent (agents/scene_agent.py)

```python
from pydantic import BaseModel, Field
from pydantic_ai import Agent

class SceneOutput(BaseModel):
    """Structured output for image scene description."""
    scene_description: str = Field(
        description="Detailed visual description of the scene for image generation. "
                    "Include composition, lighting, colors, objects, atmosphere."
    )
    captions: str = Field(
        default="",
        description="Text/captions that should appear ON the image. "
                    "Leave empty if no text needed."
    )

class SceneContext(BaseModel):
    """Context for scene generation."""
    prompt: str
    generated_text: str = ""
    brand_name: str = ""
    target_audience: str = ""
    tone_of_voice: str = ""
    current_date: str = ""

scene_agent = Agent(
    'openai:gpt-4o-mini',
    result_type=SceneOutput,
    system_prompt="""You are a visual scene designer for social media images.

Your task is to create detailed scene descriptions for AI image generation.

Rules:
1. scene_description: Write a vivid, detailed visual description (100-200 words)
   - Include: composition, lighting, colors, main objects, background, atmosphere
   - Be specific about visual elements, not abstract concepts
   - Optimize for AI image generation (Gemini/DALL-E)

2. captions: Text that should appear ON the image
   - Short, impactful phrases (1-5 words max)
   - Leave empty string if no text needed on image
   - Consider brand voice and target audience

Output must be valid JSON matching the schema."""
)

async def generate_scene(context: SceneContext) -> SceneOutput:
    """Generate scene description and captions from context."""
    user_prompt = f"""
Create a scene for this social media post:

Prompt: {context.prompt}
{f'Post text: {context.generated_text}' if context.generated_text else ''}
{f'Brand: {context.brand_name}' if context.brand_name else ''}
{f'Audience: {context.target_audience}' if context.target_audience else ''}
{f'Tone: {context.tone_of_voice}' if context.tone_of_voice else ''}
Date: {context.current_date}
"""
    result = await scene_agent.run(user_prompt)
    return result.data
```

### 2.2 Text Generation Agent (agents/text_agent.py)

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class PostTextOutput(BaseModel):
    """Generated post text."""
    text: str

class TextContext(BaseModel):
    """Context for text generation."""
    prompt: str
    brand_name: str = ""
    target_audience: str = ""
    tone_of_voice: str = ""
    language: str = "ru"

text_agent = Agent(
    'anthropic:claude-3-5-sonnet-latest',
    result_type=PostTextOutput,
    system_prompt="""You are a social media copywriter.

Create engaging post text based on the user's prompt.

Rules:
1. Match the brand's tone of voice
2. Write for the target audience
3. Keep it concise but impactful
4. Use appropriate emojis sparingly
5. Include call-to-action when relevant
6. Write in the specified language

Return only the post text, ready to publish."""
)

async def generate_text(context: TextContext) -> str:
    """Generate social media post text."""
    user_prompt = f"""
Write a social media post:

Topic/Idea: {context.prompt}
{f'Brand: {context.brand_name}' if context.brand_name else ''}
{f'Audience: {context.target_audience}' if context.target_audience else ''}
{f'Tone: {context.tone_of_voice}' if context.tone_of_voice else ''}
Language: {context.language}
"""
    result = await text_agent.run(user_prompt)
    return result.data.text
```

### 2.3 Prompt Improvement Agent (agents/improve_agent.py)

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class ImprovedPrompt(BaseModel):
    """Improved prompt output."""
    improved_prompt: str

improve_agent = Agent(
    'anthropic:claude-3-5-sonnet-latest',
    result_type=ImprovedPrompt,
    system_prompt="""You are a marketing prompt engineer.

Your task is to improve user prompts for social media content generation.

Rules:
1. Enhance clarity and specificity
2. Add marketing angles and hooks
3. Consider the target audience
4. Keep the original intent
5. Make it more actionable for AI generation
6. Keep same language as input

Return the improved prompt only."""
)

async def improve_prompt(prompt: str, brand_context: dict = None) -> str:
    """Improve a user prompt with marketing expertise."""
    context = ""
    if brand_context:
        context = f"""
Brand: {brand_context.get('brand_name', '')}
Audience: {brand_context.get('target_audience', '')}
Tone: {brand_context.get('tone_of_voice', '')}
"""

    user_prompt = f"""
Improve this prompt for social media content:

Original: {prompt}
{context}
"""
    result = await improve_agent.run(user_prompt)
    return result.data.improved_prompt
```

---

## Phase 3: Services (Day 2, Morning)

### 3.1 Gemini Image Service (services/gemini.py)

```python
import google.generativeai as genai
from app.config import settings
import base64
import httpx

genai.configure(api_key=settings.google_api_key)

ASPECT_RATIO_CONFIGS = {
    "16:9": {"width": 1920, "height": 1080},
    "1:1": {"width": 1024, "height": 1024},
    "9:16": {"width": 1080, "height": 1920},
}

STYLE_PROMPTS = {
    "realistic": "photorealistic, high detail, professional photography",
    "digital-art": "digital art style, vibrant colors, modern illustration",
    "watercolor": "watercolor painting style, soft edges, artistic",
    "minimalist": "minimalist design, clean lines, simple composition",
    "3d-render": "3D rendered, cinema 4D style, volumetric lighting",
    "anime": "anime style illustration, Japanese animation aesthetic",
    "vintage": "vintage photography, film grain, retro colors",
    "neon": "neon lights, cyberpunk aesthetic, glowing effects",
}

async def generate_image(
    scene_description: str,
    aspect_ratio: str = "1:1",
    style_id: str = "realistic",
    max_retries: int = 3
) -> bytes:
    """Generate image using Gemini 2.5 Flash."""

    # Build full prompt with style
    style_prompt = STYLE_PROMPTS.get(style_id, "")
    full_prompt = f"{scene_description}. Style: {style_prompt}"

    model = genai.GenerativeModel('gemini-2.0-flash-exp-image-generation')

    for attempt in range(max_retries):
        try:
            response = await model.generate_content_async(
                full_prompt,
                generation_config={
                    "response_mime_type": "image/png",
                }
            )

            # Extract image bytes from response
            if response.parts:
                for part in response.parts:
                    if hasattr(part, 'inline_data'):
                        return base64.b64decode(part.inline_data.data)

            raise ValueError("No image in response")

        except Exception as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2)  # Wait before retry

    raise RuntimeError("Failed to generate image after retries")
```

### 3.2 Supabase Service (services/supabase.py)

```python
from supabase import create_client, Client
from app.config import settings
from datetime import datetime
import uuid

def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)

async def get_user_context(user_id: int) -> dict:
    """Get user's brand context from Supabase."""
    client = get_supabase_client()

    result = client.table("users").select(
        "brand_name, target_audience, tone_of_voice, language, tg_chat_id"
    ).eq("id", user_id).single().execute()

    return result.data or {}

async def check_balance(user_id: int, required_amount: float) -> bool:
    """Check if user has sufficient balance."""
    client = get_supabase_client()

    result = client.table("users").select("units").eq("id", user_id).single().execute()

    if not result.data:
        return False

    return result.data.get("units", 0) >= required_amount

async def spend_tokens(user_id: int, amount: float, description: str) -> bool:
    """Deduct tokens from user balance."""
    client = get_supabase_client()

    # Get current balance
    user = client.table("users").select("units").eq("id", user_id).single().execute()
    if not user.data:
        return False

    current_balance = user.data.get("units", 0)
    if current_balance < amount:
        return False

    # Update balance
    new_balance = current_balance - amount
    client.table("users").update({"units": new_balance}).eq("id", user_id).execute()

    # Log transaction
    client.table("transactions").insert({
        "user_id": user_id,
        "amount": -amount,
        "description": description,
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    return True

async def upload_image(user_id: int, image_bytes: bytes) -> str:
    """Upload image to Supabase Storage and return public URL."""
    client = get_supabase_client()

    filename = f"post-{user_id}-{uuid.uuid4().hex[:8]}.png"
    path = f"posts/{filename}"

    client.storage.from_("carusel").upload(
        path,
        image_bytes,
        {"content-type": "image/png"}
    )

    # Get public URL
    public_url = client.storage.from_("carusel").get_public_url(path)

    return public_url

async def update_post_image(post_id: int, image_url: str):
    """Update post record with generated image URL."""
    if not post_id:
        return

    client = get_supabase_client()
    client.table("posts").update({
        "image_url": image_url,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", post_id).execute()
```

### 3.3 Telegram Service (services/telegram.py)

```python
from telegram import Bot
from app.config import settings

bot = Bot(token=settings.telegram_bot_token)

async def send_image_to_user(chat_id: int, image_url: str, caption: str = None):
    """Send generated image to user's Telegram chat."""
    await bot.send_photo(
        chat_id=chat_id,
        photo=image_url,
        caption=caption,
        parse_mode="HTML"
    )

async def send_text_to_user(chat_id: int, text: str):
    """Send generated text to user's Telegram chat."""
    await bot.send_message(
        chat_id=chat_id,
        text=text,
        parse_mode="HTML"
    )
```

### 3.4 Content Analysis Service (services/scraper.py)

```python
import httpx
from app.config import settings

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v1"

async def analyze_instagram_post(url: str) -> dict:
    """Analyze Instagram post using ScrapeCreators API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SCRAPECREATORS_BASE}/instagram/post",
            params={"url": url},
            headers={"x-api-key": settings.scrapecreators_api_key}
        )
        response.raise_for_status()
        return response.json()

async def analyze_tiktok_post(url: str) -> dict:
    """Analyze TikTok post using ScrapeCreators API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SCRAPECREATORS_BASE}/tiktok/post",
            params={"url": url},
            headers={"x-api-key": settings.scrapecreators_api_key}
        )
        response.raise_for_status()
        return response.json()
```

---

## Phase 4: API Routers (Day 2, Afternoon)

### 4.1 Generation Router (routers/generation.py)

```python
from fastapi import APIRouter, HTTPException
from app.models.requests import GenerateTextRequest, GenerateImageRequest
from app.models.responses import TextResponse, ImageResponse
from app.agents.text_agent import generate_text, TextContext
from app.agents.scene_agent import generate_scene, SceneContext
from app.services.gemini import generate_image
from app.services.supabase import (
    get_user_context, check_balance, spend_tokens,
    upload_image, update_post_image
)
from app.services.telegram import send_image_to_user, send_text_to_user
from app.config import settings
from datetime import datetime

router = APIRouter(prefix="/api", tags=["generation"])

@router.post("/generate-text", response_model=TextResponse)
async def api_generate_text(request: GenerateTextRequest):
    """Generate social media post text."""

    # Check balance
    if not await check_balance(request.user_id, settings.price_text_generation):
        raise HTTPException(402, "Insufficient balance")

    # Get user context
    user_ctx = await get_user_context(request.user_id)

    # Generate text
    context = TextContext(
        prompt=request.prompt,
        brand_name=user_ctx.get("brand_name", ""),
        target_audience=user_ctx.get("target_audience", ""),
        tone_of_voice=user_ctx.get("tone_of_voice", ""),
        language=user_ctx.get("language", "ru"),
    )

    text = await generate_text(context)

    # Spend tokens
    await spend_tokens(
        request.user_id,
        settings.price_text_generation,
        "Text generation"
    )

    # Send to Telegram
    if user_ctx.get("tg_chat_id"):
        await send_text_to_user(user_ctx["tg_chat_id"], text)

    return TextResponse(text=text)

@router.post("/generate-image", response_model=ImageResponse)
async def api_generate_image(request: GenerateImageRequest):
    """Generate image from scene description."""

    # Check balance
    if not await check_balance(request.user_id, settings.price_image_generation):
        raise HTTPException(402, "Insufficient balance")

    # Get user context
    user_ctx = await get_user_context(request.user_id)

    # Use provided scene or generate new one
    if request.scene_description:
        scene_description = request.scene_description
    else:
        # Generate scene first
        context = SceneContext(
            prompt=request.prompt,
            generated_text=request.generated_text or "",
            brand_name=user_ctx.get("brand_name", ""),
            target_audience=user_ctx.get("target_audience", ""),
            tone_of_voice=user_ctx.get("tone_of_voice", ""),
            current_date=datetime.now().strftime("%d %B %Y"),
        )
        scene = await generate_scene(context)
        scene_description = scene.scene_description

    # Generate image
    image_bytes = await generate_image(
        scene_description=scene_description,
        aspect_ratio=request.aspect_ratio or "1:1",
        style_id=request.style_id or "realistic",
    )

    # Upload to Supabase
    image_url = await upload_image(request.user_id, image_bytes)

    # Spend tokens
    await spend_tokens(
        request.user_id,
        settings.price_image_generation,
        "Image generation"
    )

    # Update post record if provided
    if request.post_id:
        await update_post_image(request.post_id, image_url)

    # Send to Telegram
    if user_ctx.get("tg_chat_id"):
        await send_image_to_user(
            user_ctx["tg_chat_id"],
            image_url,
            caption=request.captions or None
        )

    return ImageResponse(
        image_url=image_url,
        scene_description=scene_description
    )
```

### 4.2 Preparation Router (routers/preparation.py)

```python
from fastapi import APIRouter, HTTPException
from app.models.requests import PrepareImageRequest
from app.models.responses import PrepareImageResponse
from app.agents.scene_agent import generate_scene, SceneContext
from app.agents.improve_agent import improve_prompt
from app.services.supabase import get_user_context, check_balance, spend_tokens
from app.config import settings
from datetime import datetime

router = APIRouter(prefix="/api", tags=["preparation"])

@router.post("/prepare-image", response_model=PrepareImageResponse)
async def api_prepare_image(request: PrepareImageRequest):
    """Prepare image generation - returns scene description and captions."""

    # Check balance
    if not await check_balance(request.user_id, settings.price_image_preparation):
        raise HTTPException(402, "Insufficient balance")

    # Get user context
    user_ctx = await get_user_context(request.user_id)

    # Generate scene and captions
    context = SceneContext(
        prompt=request.prompt,
        generated_text=request.generated_text or "",
        brand_name=user_ctx.get("brand_name", ""),
        target_audience=user_ctx.get("target_audience", ""),
        tone_of_voice=user_ctx.get("tone_of_voice", ""),
        current_date=datetime.now().strftime("%d %B %Y"),
    )

    scene = await generate_scene(context)

    # Spend tokens
    await spend_tokens(
        request.user_id,
        settings.price_image_preparation,
        "Image preparation"
    )

    return PrepareImageResponse(
        scene_description=scene.scene_description,
        captions=scene.captions
    )

@router.post("/improve-prompt")
async def api_improve_prompt(request: dict):
    """Improve user prompt with marketing expertise."""

    user_id = request.get("user_id")
    prompt = request.get("prompt")

    if not user_id or not prompt:
        raise HTTPException(400, "user_id and prompt required")

    # Check balance
    if not await check_balance(user_id, settings.price_magic_wand):
        raise HTTPException(402, "Insufficient balance")

    # Get user context for brand info
    user_ctx = await get_user_context(user_id)

    # Improve prompt
    improved = await improve_prompt(prompt, user_ctx)

    # Spend tokens
    await spend_tokens(
        user_id,
        settings.price_magic_wand,
        "Prompt improvement (Magic Wand)"
    )

    return {"improved_prompt": improved}
```

### 4.3 Main App (app/main.py)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import generation, preparation, analysis

app = FastAPI(
    title="Post MiniApp Backend",
    description="AI-powered social media content generation",
    version="1.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generation.router)
app.include_router(preparation.router)
# app.include_router(analysis.router)  # Add when ready

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

---

## Phase 5: Frontend Updates (Day 2, Evening)

### 5.1 Update API URLs (src/lib/api.ts)

```typescript
// Replace n8n webhook URLs with backend API
const API_BASE = import.meta.env.VITE_API_URL || 'https://post-api.orangespace.io';

// Old: const GENERATE_TEXT_URL = 'https://n8n.orangespace.io/webhook/post-generate-text';
// New:
const GENERATE_TEXT_URL = `${API_BASE}/api/generate-text`;
const GENERATE_IMAGE_URL = `${API_BASE}/api/generate-image`;
const PREPARE_IMAGE_URL = `${API_BASE}/api/prepare-image`;
const IMPROVE_PROMPT_URL = `${API_BASE}/api/improve-prompt`;
const ANALYZE_CONTENT_URL = `${API_BASE}/api/analyze-content`;
```

### 5.2 Remove Fire-and-Forget Balance Spending

Backend now handles balance spending internally, so remove:
- `spendTokens()` function calls from frontend
- Fire-and-forget webhook calls

### 5.3 Simplify API Functions

```typescript
export async function generateText(request: GenerateTextRequest): Promise<{ text: string }> {
  const response = await fetch(GENERATE_TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 402) {
      throw new Error('Insufficient balance');
    }
    throw new Error('Failed to generate text');
  }

  return response.json();
}
```

---

## Phase 6: Deployment (Day 3)

### 6.1 Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy application
COPY app/ ./app/

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.2 docker-compose.yml

```yaml
services:
  post-api:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 6.3 Deploy to Server

```bash
# On server (via devops-deployment-specialist agent)
cd /opt/post-miniapp
docker compose up -d post-api

# Configure Nginx reverse proxy
# post-api.orangespace.io -> localhost:8000
```

---

## Phase 7: Testing & Migration (Day 3)

### 7.1 Test Checklist

- [ ] `/api/generate-text` - generates text, sends to Telegram
- [ ] `/api/prepare-image` - returns scene_description + captions
- [ ] `/api/generate-image` - generates image, uploads to Supabase, sends to Telegram
- [ ] `/api/improve-prompt` - improves prompt with brand context
- [ ] Balance checking works (402 on insufficient funds)
- [ ] Transactions logged in Supabase
- [ ] Frontend connects to new API

### 7.2 Migration Steps

1. Deploy backend alongside n8n (both running)
2. Update frontend to use new API URLs
3. Test all flows in staging
4. Switch production frontend to new API
5. Monitor for errors
6. Deactivate n8n workflows (keep for reference)

---

## What Stays in n8n

Only keep n8n for:
- **Nothing** - all functionality moved to Python backend

Or optionally:
- Complex integrations that benefit from visual workflow (e.g., multi-step automations with many services)
- Legacy workflows from other projects

---

## Benefits After Refactoring

| Aspect | Before (n8n) | After (Pydantic AI) |
|--------|--------------|---------------------|
| Debugging | n8n execution logs | Local breakpoints, pytest |
| Type Safety | None | Full Pydantic models |
| Testing | Manual | pytest, mocking |
| Versioning | n8n export JSON | Git, code review |
| Deployment | n8n cloud | Docker, any server |
| Development Speed | UI-based | Code-based, faster |
| Structured Output | Manual JSON parsing | Native Pydantic AI |
| Error Handling | n8n error workflow | try/except, custom exceptions |

---

## Timeline Summary

| Day | Morning | Afternoon | Evening |
|-----|---------|-----------|---------|
| **Day 1** | Backend setup, config | Pydantic AI agents | Testing agents |
| **Day 2** | Services (Gemini, Supabase, Telegram) | API routers | Frontend updates |
| **Day 3** | Docker, deployment | Testing | Migration |

---

## Next Steps

1. Create `backend/` folder structure
2. Implement agents one by one with tests
3. Implement services
4. Wire up routers
5. Test locally
6. Deploy and migrate
