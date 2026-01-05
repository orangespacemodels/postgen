import { supabase } from '@/integrations/supabase/client';

// n8n Webhook URLs
const N8N_BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://n8n.orangespace.io/webhook';

// Post-specific webhook for improving prompts with user marketing context
const MAGIC_WAND_URL = `${N8N_BASE_URL}/post-magic-improve`;
// Voice transcription now uses Supabase Edge Function directly (speech-to-text)
// See useVoiceInput.ts hook

// Webhooks for post generation
const GENERATE_TEXT_URL = `${N8N_BASE_URL}/post-generate-text`;
const GENERATE_IMAGE_URL = `${N8N_BASE_URL}/post-generate-image-v2`;

// =====================================================
// Helper to get user_id from Telegram WebApp API
// NOTE: URL params no longer contain user_id for security reasons
// User data should be passed explicitly from useUser() hook
// =====================================================
export function getUserIdFromTelegramWebApp(): number | null {
  // Only fallback: Try to get from Telegram Web App API
  if ((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    const userId = (window as any).Telegram.WebApp.initDataUnsafe.user.id;
    console.log('[getUserIdFromTelegramWebApp] Got from Telegram WebApp:', userId);
    return userId;
  }

  console.warn('[getUserIdFromTelegramWebApp] No user_id available from Telegram WebApp');
  return null;
}

// Content analysis - use local backend API (proxied via nginx)
const BACKEND_API_URL = '/api';
const CONTENT_ANALYZE_URL_BACKEND = `${BACKEND_API_URL}/analyze-url`;

export interface GenerateTextRequest {
  prompt: string;
  user_id: number;
  tg_chat_id: number;
  post_id?: number;
  // Context from content analysis (for rewriting posts)
  narrative?: string;           // Original post narrative to rewrite
  format_description?: string;  // Format structure to follow
  // Language for generation (detected from prompt)
  language?: 'ru' | 'en';       // Generate content in this language
  // Note: text_length, emoji_density, formatting, call_to_action
  // are now embedded directly into the prompt text for better AI understanding
}

export interface GenerateImageRequest {
  prompt: string;
  user_id: number;
  tg_chat_id: number;
  post_id?: number;
  generated_text?: string;
  // New parameters for image generation modal
  scene_description?: string;
  captions?: string;
  aspect_ratio?: '16:9' | '1:1' | '9:16';
  style_id?: string;
  style_prompt?: string;
  // Reference image for style transfer (from content analysis)
  reference_image_url?: string;
  use_reference_for_style?: boolean;
  use_reference_for_composition?: boolean;
  // Language for captions and scene description (detected from prompt)
  language?: 'ru' | 'en';
}

export interface ImprovePromptRequest {
  prompt: string;
  user_id: number;
  post_id?: number;
  // Language for improved prompt (detected from original prompt)
  language?: 'ru' | 'en';
}

export interface PrepareImageRequest {
  prompt: string;
  user_id: number;
  generated_text?: string;
  // Language for scene description and captions (detected from prompt)
  language?: 'ru' | 'en';
}

export interface GenerateCtaRequest {
  prompt: string;
  user_id: number;
  language?: 'ru' | 'en';
}

export interface GenerateCtaResponse {
  suggestions: string[];
}

export interface PrepareImageResponse {
  scene_description: string;
  captions: string;
}

// Pricing for Magic Wand
const MAGIC_WAND_PRICE = 0.05; // $0.05 per improvement
// Pricing for CTA suggestions (uses same workflow, cheaper operation)
const CTA_SUGGESTIONS_PRICE = 0.02; // $0.02 per CTA generation
// Pricing for image preparation (scene + captions generation via AI)
const PREPARE_IMAGE_PRICE = 0.02; // $0.02 per preparation

export async function improvePrompt(request: ImprovePromptRequest): Promise<string> {
  // Check balance first via Supabase (same pattern as analyzeContentUrl)
  const spendResult = await spendTokens(
    request.user_id,
    MAGIC_WAND_PRICE,
    'Prompt improvement (Magic Wand)'
  );

  if (!spendResult.success) {
    throw new Error(spendResult.error || 'Insufficient funds for prompt improvement');
  }

  console.log(`💰 Charged $${spendResult.charged} for Magic Wand`);

  const response = await fetch(MAGIC_WAND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to improve prompt');
  }

  const data = await response.json();
  return data.improved_prompt || data.prompt || request.prompt;
}

// Generate CTA suggestions webhook
const GENERATE_CTA_URL = `${N8N_BASE_URL}/post-generate-cta`;

export async function generateCtaSuggestions(request: GenerateCtaRequest): Promise<GenerateCtaResponse> {
  // Check balance first via Supabase
  const spendResult = await spendTokens(
    request.user_id,
    CTA_SUGGESTIONS_PRICE,
    'CTA suggestions generation'
  );

  if (!spendResult.success) {
    throw new Error(spendResult.error || 'Insufficient funds for CTA generation');
  }

  console.log(`💰 Charged $${spendResult.charged} for CTA suggestions`);

  const response = await fetch(GENERATE_CTA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to generate CTA suggestions');
  }

  const data = await response.json();

  // Expect response like { suggestions: ["CTA 1", "CTA 2", "CTA 3"] }
  // or { cta_1: "...", cta_2: "...", cta_3: "..." }
  if (data.suggestions && Array.isArray(data.suggestions)) {
    return { suggestions: data.suggestions.slice(0, 3) };
  }

  // Handle alternative response format
  const suggestions: string[] = [];
  if (data.cta_1) suggestions.push(data.cta_1);
  if (data.cta_2) suggestions.push(data.cta_2);
  if (data.cta_3) suggestions.push(data.cta_3);

  if (suggestions.length > 0) {
    return { suggestions };
  }

  throw new Error('Invalid response format from CTA generation');
}

export async function generateText(request: GenerateTextRequest): Promise<{ text: string }> {
  console.log('[generateText] Sending request with params:', {
    text_length: request.text_length,
    emoji_density: request.emoji_density,
    formatting: request.formatting,
    call_to_action: request.call_to_action,
    language: request.language,
  });

  const response = await fetch(GENERATE_TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to generate text');
  }

  return response.json();
}

// Prepare image generation - generates scene_description and captions via AI
// Uses the same workflow with prepare_only=true flag
export async function prepareImage(request: PrepareImageRequest): Promise<PrepareImageResponse> {
  // user_id should be passed explicitly from useUser() hook
  // Telegram WebApp API is only a fallback
  const telegramUserId = getUserIdFromTelegramWebApp();
  const effectiveUserId = (request.user_id && request.user_id > 0) ? request.user_id : telegramUserId;

  if (!effectiveUserId || effectiveUserId <= 0) {
    throw new Error('User not authenticated. Please reload the app.');
  }

  // Check balance and charge for preparation
  const spendResult = await spendTokens(
    effectiveUserId,
    PREPARE_IMAGE_PRICE,
    'Image preparation (scene + captions)'
  );

  if (!spendResult.success) {
    throw new Error(spendResult.error || 'Insufficient funds for image preparation');
  }

  console.log(`💰 Charged $${spendResult.charged} for image preparation`);

  // Add current date for context
  const now = new Date();
  const currentDate = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const response = await fetch(GENERATE_IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: request.prompt,
      user_id: effectiveUserId,
      generated_text: request.generated_text || '',
      current_date: currentDate,
      prepare_only: true, // This flag tells workflow to return scene + captions without generating image
      language: request.language, // Language for scene description and captions
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[prepareImage] Error response:', errorText);
    throw new Error('Failed to prepare image');
  }

  const data = await response.json();

  return {
    scene_description: data.scene_description || request.prompt,
    captions: data.captions || '',
  };
}

// Pricing for Image Generation
const IMAGE_GENERATION_PRICE = 0.10; // $0.10 per image

export async function generateImage(request: GenerateImageRequest): Promise<{ image_url: string }> {
  // user_id should be passed explicitly from useUser() hook
  // Telegram WebApp API is only a fallback
  const telegramUserId = getUserIdFromTelegramWebApp();

  console.log('[generateImage] Request user_id:', request.user_id, 'telegramUserId:', telegramUserId);

  // Use telegramUserId as fallback if request.user_id is invalid
  const effectiveUserId = (request.user_id && request.user_id > 0) ? request.user_id : telegramUserId;

  if (!effectiveUserId || effectiveUserId <= 0) {
    console.error('[generateImage] No valid user_id found!');
    throw new Error('User not authenticated. Please reload the app.');
  }

  console.log('[generateImage] Using effectiveUserId:', effectiveUserId);

  // Check balance and charge for image generation
  const spendResult = await spendTokens(
    effectiveUserId,
    IMAGE_GENERATION_PRICE,
    'Image generation (Gemini)'
  );

  if (!spendResult.success) {
    throw new Error(spendResult.error || 'Insufficient funds for image generation');
  }

  console.log(`💰 Charged $${spendResult.charged} for image generation`);

  // Add current date/time for image generation context
  const now = new Date();
  const currentDate = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Build request payload with new modal parameters
  const payload: Record<string, unknown> = {
    prompt: request.prompt,
    user_id: effectiveUserId,
    tg_chat_id: request.tg_chat_id || effectiveUserId, // For Telegram photo sending
    generated_text: request.generated_text || '',
    current_date: currentDate,
  };

  // Add optional modal parameters if provided
  if (request.scene_description) {
    payload.scene_description = request.scene_description;
  }
  if (request.captions) {
    payload.captions = request.captions;
  }
  if (request.aspect_ratio) {
    payload.aspect_ratio = request.aspect_ratio;
  }
  if (request.style_id) {
    payload.style_id = request.style_id;
  }
  if (request.style_prompt) {
    payload.style_prompt = request.style_prompt;
  }

  // Add reference image parameters for style transfer
  if (request.reference_image_url) {
    payload.reference_image_url = request.reference_image_url;
    payload.use_reference_for_style = request.use_reference_for_style || false;
    payload.use_reference_for_composition = request.use_reference_for_composition || false;
  }

  // Add language parameter for captions generation
  if (request.language) {
    payload.language = request.language;
  }

  const response = await fetch(GENERATE_IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generateImage] Error response:', errorText);
    throw new Error('Failed to generate image');
  }

  const data = await response.json();
  // Gemini workflow returns: { image_url: "..." }
  const imageUrl = data.image_url || data.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error('No image URL in response');
  }

  return { image_url: imageUrl };
}

// Voice transcription is now handled directly in useVoiceInput.ts via Supabase Edge Function
// The speech-to-text function uses OpenAI Whisper API for accurate transcription
// This enables better mixed language support (Russian + English)

// =====================================================
// Content Analysis (reused from reelsgen)
// Uses n8n workflow "transactions: spend" for balance deduction
// Uses Supabase Edge Functions: fetch-url-content, transcribe-content
// =====================================================

// n8n webhook for spending balance (Transaction: Spend workflow)
// WARNING: DO NOT CHANGE - Transaction: Spend workflow (ysx2qYK4vaL6wClL) is PROTECTED
const SPEND_WEBHOOK_URL = 'https://n8n.orangespace.io/webhook/597add37-3c97-4b60-a088-071512ded0b6';

export type ContentType = 'post' | 'image' | 'video' | 'unknown';
export type ServiceType = 'url_analysis' | 'photo_analysis' | 'video_analysis' | 'text_generation' | 'image_generation';

export interface AnalysisResult {
  content_type: ContentType;
  has_image: boolean;
  has_video: boolean;
  post_text?: string;
  image_url?: string;
  video_url?: string;
  video_duration_minutes?: number;
  // Platform information from ScrapeCreators
  platform?: string;       // Platform ID: instagram, tiktok, youtube, etc.
  platform_name?: string;  // Display name: Instagram, TikTok, YouTube, etc.
  author?: string;         // Author username/name
  // Transcription data from fetch-url-content
  transcription?: {
    text?: string;
    description?: string;
    hashtags?: string[];
    media_urls?: string[];
  };
  // AI-generated descriptions (will be populated by backend)
  narrative?: string;
  format_description?: string;
  style_description?: string;
  composition_description?: string;
  scene_description?: string;
  source_url?: string;
}

export interface SpendResult {
  success: boolean;
  charged?: number;
  new_balance?: number;
  error?: string;
}

// =====================================================
// Check user balance directly in Supabase
// This is the source of truth - doesn't depend on n8n workflow response
// =====================================================
export async function checkBalance(userId: number): Promise<number> {
  const { data, error } = await supabase
    .from('user_data')
    .select('balance')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[checkBalance] Supabase error:', error);
    throw new Error('Failed to check balance');
  }

  return data?.balance || 0;
}

// =====================================================
// Spend tokens using n8n workflow "transactions: spend"
// FIRE-AND-FORGET: Don't wait for response, just trigger the workflow
// Balance check is done separately via Supabase before calling this
// Uses navigator.sendBeacon for true fire-and-forget (no CORS issues)
// =====================================================
export function spendTokensAsync(
  userId: number,
  amountUsd: number,
  comment: string
): void {
  const payload = JSON.stringify({
    user_id: userId,
    amount_usd: amountUsd,
    comment,
  });

  // Fire-and-forget POST request
  // We don't care about the response - balance was already checked via Supabase
  // Any CORS errors are silently ignored since this is just logging
  fetch(SPEND_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).then(() => {
    console.log('[spendTokensAsync] Spend request completed');
  }).catch((err) => {
    // Silently ignore CORS errors - the request still reaches the server
    console.log('[spendTokensAsync] Spend request sent (response blocked by CORS, but request was sent)');
  });
}

// Legacy function kept for compatibility - now just wraps async version
export async function spendTokens(
  userId: number,
  amountUsd: number,
  comment: string
): Promise<SpendResult> {
  // Check balance first via Supabase
  const balance = await checkBalance(userId);

  if (balance < amountUsd) {
    return {
      success: false,
      error: 'Insufficient funds',
    };
  }

  // Fire-and-forget the spend workflow
  spendTokensAsync(userId, amountUsd, comment);

  // Return success immediately (balance was checked)
  return {
    success: true,
    charged: amountUsd,
    new_balance: balance - amountUsd, // Approximate, actual deduction happens in workflow
  };
}

// Pricing constants (in USD)
const PRICING = {
  URL_ANALYSIS: 0.10,
  PHOTO_ANALYSIS: 0.05,
  VIDEO_ANALYSIS_PER_MIN: 0.30,
};

// Analyze content from URL (Instagram, TikTok, YouTube, LinkedIn, etc.)
// Uses backend API with ScrapeCreators
export async function analyzeContentUrl(
  url: string,
  userId: number,
  postId?: number
): Promise<AnalysisResult> {
  console.log('[analyzeContentUrl] Calling backend API...');

  const response = await fetch(CONTENT_ANALYZE_URL_BACKEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, user_id: userId, post_id: postId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.error || `Analysis failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('[analyzeContentUrl] Backend API success');

  return {
    content_type: data.content_type || 'post',
    has_image: data.has_image || false,
    has_video: data.has_video || false,
    post_text: data.post_text || data.narrative,
    image_url: data.image_url,
    video_url: data.video_url,
    video_duration_minutes: data.video_duration_minutes,
    platform: data.platform,
    platform_name: data.platform_name,
    author: data.author,
    source_url: data.source_url || url,
    narrative: data.narrative || data.post_text,
    format_description: data.format_description,
    style_description: data.style_description,
    composition_description: data.composition_description,
    scene_description: data.scene_description,
  };
}

// Analyze uploaded file (image or video)
// Creates local object URL for preview and charges for analysis
export async function analyzeFile(
  file: File,
  userId: number,
  postId?: number
): Promise<AnalysisResult> {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    throw new Error('Unsupported file type. Please upload an image or video.');
  }

  // Charge for file analysis using n8n workflow
  if (isImage) {
    const spendResult = await spendTokens(
      userId,
      PRICING.PHOTO_ANALYSIS,
      `Photo analysis: ${file.name}`
    );
    if (!spendResult.success) {
      throw new Error(spendResult.error || 'Insufficient funds for photo analysis');
    }
    console.log(`💰 Charged $${spendResult.charged} for photo analysis`);
  } else if (isVideo) {
    // For video, we charge per minute (assume 1 minute for now)
    const spendResult = await spendTokens(
      userId,
      PRICING.VIDEO_ANALYSIS_PER_MIN,
      `Video analysis: ${file.name}`
    );
    if (!spendResult.success) {
      throw new Error(spendResult.error || 'Insufficient funds for video analysis');
    }
    console.log(`💰 Charged $${spendResult.charged} for video analysis`);
  }

  // Create local object URL for preview
  const localUrl = URL.createObjectURL(file);

  // For now, return basic file info
  // TODO: Add n8n workflow for file analysis with OpenAI Vision
  return {
    content_type: isVideo ? 'video' : 'image',
    has_image: isImage,
    has_video: isVideo,
    image_url: isImage ? localUrl : undefined,
    video_url: isVideo ? localUrl : undefined,
    // File analysis will be added in future via n8n workflow
    narrative: `Uploaded ${isImage ? 'image' : 'video'}: ${file.name}`,
    scene_description: undefined,
    style_description: undefined,
    composition_description: undefined,
  };
}
