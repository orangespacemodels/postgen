// Telegram WebApp types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
            last_name?: string;
          };
        };
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

export interface UserData {
  id: number;
  tg_chat_id: number;
  username?: string;
  plan: string;
  units: number;
  language: string;
}

export interface GenerationResult {
  text?: string;
  image_url?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Content analysis options for generation context
export type ContentUsageOption =
  | 'use_narrative'      // Use the same narrative (for posts)
  | 'use_format'         // Use the same format (for posts)
  | 'use_style'          // Use the same style (for images)
  | 'use_composition'    // Use the same composition (for images)
  | 'use_scene'          // Use scene description (for videos/images)

export interface ContentAnalysisContext {
  source_type: 'url' | 'file';
  source_url?: string;
  file_name?: string;
  content_type: 'post' | 'image' | 'video' | 'unknown';
  has_image: boolean;
  has_video: boolean;
  selected_options: ContentUsageOption[];
  narrative?: string;
  format_description?: string;
  style_description?: string;
  composition_description?: string;
  scene_description?: string;
  analysis_cost: number;

  // Reference media for generation (extracted from analyzed content)
  reference_image_url?: string;    // Image URL from analyzed content
  reference_video_url?: string;    // Video URL (for thumbnail extraction)
  use_reference_image?: boolean;   // User opted to use reference for style transfer
}

// Pricing constants (in USD)
export const PRICING = {
  POST_ANALYSIS: 0.10,      // $0.10 per post link analysis
  PHOTO_ANALYSIS: 0.05,     // $0.05 per photo analysis
  VIDEO_ANALYSIS: 0.30,     // $0.30 per minute of video
  TEXT_GENERATION: 0.10,    // $0.10 per 1000 words
  IMAGE_GENERATION: 0.10,   // $0.10 per image up to 1024p
} as const;

// Image aspect ratios
export type AspectRatio = '16:9' | '1:1' | '9:16';

export const ASPECT_RATIOS: { value: AspectRatio; labelRu: string; labelEn: string }[] = [
  { value: '16:9', labelRu: 'Горизонтальный (16:9)', labelEn: 'Landscape (16:9)' },
  { value: '1:1', labelRu: 'Квадратный (1:1)', labelEn: 'Square (1:1)' },
  { value: '9:16', labelRu: 'Вертикальный (9:16)', labelEn: 'Portrait (9:16)' },
];

// Image generation styles
export interface ImageStyle {
  id: string;
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  prompt: string; // Style prompt to append to generation
}

export const IMAGE_STYLES: ImageStyle[] = [
  {
    id: 'realistic',
    nameRu: 'Реалистичный',
    nameEn: 'Realistic',
    descriptionRu: 'Фотореалистичное изображение с естественным освещением',
    descriptionEn: 'Photorealistic image with natural lighting',
    prompt: 'photorealistic, high quality photography, natural lighting, detailed',
  },
  {
    id: 'digital-art',
    nameRu: 'Цифровое искусство',
    nameEn: 'Digital Art',
    descriptionRu: 'Современная цифровая иллюстрация',
    descriptionEn: 'Modern digital illustration',
    prompt: 'digital art, illustration, vibrant colors, modern style',
  },
  {
    id: 'minimalist',
    nameRu: 'Минимализм',
    nameEn: 'Minimalist',
    descriptionRu: 'Чистый минималистичный дизайн',
    descriptionEn: 'Clean minimalist design',
    prompt: 'minimalist, clean design, simple shapes, lots of white space',
  },
  {
    id: '3d-render',
    nameRu: '3D рендер',
    nameEn: '3D Render',
    descriptionRu: 'Трёхмерная графика с объёмом',
    descriptionEn: '3D rendered graphics with depth',
    prompt: '3D render, volumetric lighting, depth of field, professional rendering',
  },
  {
    id: 'watercolor',
    nameRu: 'Акварель',
    nameEn: 'Watercolor',
    descriptionRu: 'Мягкие акварельные текстуры',
    descriptionEn: 'Soft watercolor textures',
    prompt: 'watercolor painting style, soft edges, artistic, fluid colors',
  },
  {
    id: 'cartoon',
    nameRu: 'Мультяшный',
    nameEn: 'Cartoon',
    descriptionRu: 'Яркий мультипликационный стиль',
    descriptionEn: 'Bright cartoon style',
    prompt: 'cartoon style, bold outlines, bright colors, fun and playful',
  },
  {
    id: 'cinematic',
    nameRu: 'Кинематографичный',
    nameEn: 'Cinematic',
    descriptionRu: 'Эпичная кинематографическая атмосфера',
    descriptionEn: 'Epic cinematic atmosphere',
    prompt: 'cinematic, movie still, dramatic lighting, epic composition, film grain',
  },
  {
    id: 'flat-design',
    nameRu: 'Плоский дизайн',
    nameEn: 'Flat Design',
    descriptionRu: 'Современный плоский дизайн для UI/маркетинга',
    descriptionEn: 'Modern flat design for UI/marketing',
    prompt: 'flat design, vector style, simple geometric shapes, modern colors',
  },
];

// Image generation modal parameters
export interface ImageGenerationParams {
  sceneDescription: string;
  captions: string;
  aspectRatio: AspectRatio;
  styleId: string;

  // Reference image for style transfer (from content analysis)
  referenceImageUrl?: string;
  useReferenceForStyle?: boolean;      // Apply style from reference
  useReferenceForComposition?: boolean; // Apply composition from reference
}

// Text generation formatting options
export type TextFormatting = 'none' | 'simple' | 'markdown';

// Text length presets
export type TextLength = 'short' | 'medium' | 'long';

export const TEXT_LENGTH_PRESETS: { value: TextLength; wordsRu: string; wordsEn: string; range: [number, number] }[] = [
  { value: 'short', wordsRu: '50-100 слов', wordsEn: '50-100 words', range: [50, 100] },
  { value: 'medium', wordsRu: '150-250 слов', wordsEn: '150-250 words', range: [150, 250] },
  { value: 'long', wordsRu: '300-500 слов', wordsEn: '300-500 words', range: [300, 500] },
];

// Emoji density presets
export type EmojiDensity = 'none' | 'few' | 'moderate' | 'many';

export const EMOJI_DENSITY_PRESETS: { value: EmojiDensity; labelRu: string; labelEn: string; description: string }[] = [
  { value: 'none', labelRu: 'Без эмодзи', labelEn: 'No emojis', description: '0' },
  { value: 'few', labelRu: 'Немного', labelEn: 'Few', description: '1-2' },
  { value: 'moderate', labelRu: 'Умеренно', labelEn: 'Moderate', description: '3-5' },
  { value: 'many', labelRu: 'Много', labelEn: 'Many', description: '6+' },
];

export const TEXT_FORMATTING_OPTIONS: { value: TextFormatting; labelRu: string; labelEn: string; descriptionRu: string; descriptionEn: string }[] = [
  { value: 'none', labelRu: 'Без форматирования', labelEn: 'No formatting', descriptionRu: 'Простой текст', descriptionEn: 'Plain text' },
  { value: 'simple', labelRu: 'Простое', labelEn: 'Simple', descriptionRu: 'Telegram-совместимое (жирный, курсив)', descriptionEn: 'Telegram-compatible (bold, italic)' },
  { value: 'markdown', labelRu: 'Маркдаун', labelEn: 'Markdown', descriptionRu: 'Полное MD-форматирование', descriptionEn: 'Full markdown formatting' },
];

// Text generation modal parameters
export interface TextGenerationParams {
  textLength: TextLength;
  emojiDensity: EmojiDensity;
  formatting: TextFormatting;
  language: 'ru' | 'en';
  callToAction: string;  // Empty string means auto-generate from context
}
