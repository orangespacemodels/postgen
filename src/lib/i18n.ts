// Localization strings for post-miniapp
export type Language = 'ru' | 'en';

export const translations = {
  // App header
  appTitle: {
    ru: 'Генератор постов',
    en: 'Post Generator',
  },

  // Loading states
  loading: {
    ru: 'Загрузка...',
    en: 'Loading...',
  },

  // Error messages
  openFromTelegram: {
    ru: 'Откройте приложение из Telegram бота',
    en: 'Please open this app from Telegram bot',
  },
  enterPromptFirst: {
    ru: 'Сначала введите запрос',
    en: 'Please enter a prompt first',
  },

  // Prompt card
  enterPrompt: {
    ru: 'Введите запрос',
    en: 'Enter your prompt',
  },
  promptPlaceholder: {
    ru: 'Опишите, что хотите сгенерировать...',
    en: 'Describe what you want to generate...',
  },

  // Buttons
  improvePrompt: {
    ru: 'Улучшить',
    en: 'Improve',
  },
  generateText: {
    ru: 'Текст',
    en: 'Text',
  },
  generateImage: {
    ru: 'Картинка',
    en: 'Image',
  },
  preparing: {
    ru: 'Подготовка...',
    en: 'Preparing...',
  },

  // Results
  result: {
    ru: 'Результат',
    en: 'Result',
  },
  clear: {
    ru: 'Очистить',
    en: 'Clear',
  },
  generatedText: {
    ru: 'Сгенерированный текст:',
    en: 'Generated Text:',
  },
  generatedImage: {
    ru: 'Сгенерированное изображение:',
    en: 'Generated Image:',
  },
  sentToTelegram: {
    ru: 'Отправлено в Telegram',
    en: 'Sent to Telegram',
  },

  // Voice recording
  recording: {
    ru: 'Запись...',
    en: 'Recording...',
  },

  // Toast messages
  voiceTranscribed: {
    ru: 'Голос распознан',
    en: 'Voice transcribed',
  },
  promptImproved: {
    ru: 'Запрос улучшен!',
    en: 'Prompt improved!',
  },
  contextAdded: {
    ru: 'Контекст добавлен',
    en: 'Context added',
  },

  // Pricing
  pricing: {
    ru: 'Тарифы:',
    en: 'Pricing:',
  },
  textPricing: {
    ru: (price: number) => `Текст: $${price}/1000 слов`,
    en: (price: number) => `Text: $${price}/1000 words`,
  },
  imagePricing: {
    ru: (price: number) => `Изображение: $${price}`,
    en: (price: number) => `Image: $${price}`,
  },
  analysisPricing: {
    ru: (post: number, photo: number, video: number) =>
      `Анализ: пост $${post} • фото $${photo} • видео $${video}/мин`,
    en: (post: number, photo: number, video: number) =>
      `Analysis: post $${post} • photo $${photo} • video $${video}/min`,
  },
} as const;

// Helper function to get translated string
export function t(key: keyof typeof translations, language: Language): string {
  const translation = translations[key];
  if (typeof translation === 'object' && 'ru' in translation && 'en' in translation) {
    const value = translation[language];
    if (typeof value === 'string') {
      return value;
    }
  }
  return key;
}

/**
 * Detect language from text content.
 * Returns 'ru' if text contains significant Cyrillic characters, 'en' otherwise.
 * Uses a threshold of 30% Cyrillic characters to determine Russian.
 */
export function detectLanguage(text: string): Language {
  if (!text || text.trim().length === 0) {
    return 'en'; // Default to English for empty text
  }

  // Count Cyrillic characters (Russian alphabet range)
  const cyrillicRegex = /[\u0400-\u04FF]/g;
  const cyrillicMatches = text.match(cyrillicRegex);
  const cyrillicCount = cyrillicMatches ? cyrillicMatches.length : 0;

  // Count all letter characters (excluding spaces, numbers, punctuation)
  const letterRegex = /[a-zA-Z\u0400-\u04FF]/g;
  const letterMatches = text.match(letterRegex);
  const letterCount = letterMatches ? letterMatches.length : 0;

  if (letterCount === 0) {
    return 'en'; // Default to English for text without letters
  }

  // If more than 30% of letters are Cyrillic, consider it Russian
  const cyrillicRatio = cyrillicCount / letterCount;
  return cyrillicRatio > 0.3 ? 'ru' : 'en';
}
