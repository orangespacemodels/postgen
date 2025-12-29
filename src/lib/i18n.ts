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
