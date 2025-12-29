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
}

// Pricing constants (in USD)
export const PRICING = {
  POST_ANALYSIS: 0.10,      // $0.10 per post link analysis
  PHOTO_ANALYSIS: 0.05,     // $0.05 per photo analysis
  VIDEO_ANALYSIS: 0.30,     // $0.30 per minute of video
  TEXT_GENERATION: 0.10,    // $0.10 per 1000 words
  IMAGE_GENERATION: 0.10,   // $0.10 per image up to 1024p
} as const;
