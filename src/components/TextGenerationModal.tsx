import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Check, Loader2 } from 'lucide-react';
import {
  TEXT_LENGTH_PRESETS,
  EMOJI_DENSITY_PRESETS,
  TEXT_FORMATTING_OPTIONS,
  type TextLength,
  type EmojiDensity,
  type TextFormatting,
  type TextGenerationParams,
} from '@/types';
import { detectLanguage, type Language } from '@/lib/i18n';
import { generateCtaSuggestions } from '@/lib/api';

interface TextGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: TextGenerationParams) => void;
  prompt: string;
  language: Language;
  isLoading?: boolean;
  userId: number;
}

type CtaSelection = 0 | 1 | 2 | 'custom';

export function TextGenerationModal({
  isOpen,
  onClose,
  onConfirm,
  prompt,
  language,
  isLoading = false,
  userId,
}: TextGenerationModalProps) {
  const [textLength, setTextLength] = useState<TextLength>('medium');
  const [emojiDensity, setEmojiDensity] = useState<EmojiDensity>('few');
  const [formatting, setFormatting] = useState<TextFormatting>('simple');
  const [genLanguage, setGenLanguage] = useState<Language>(language);

  // CTA state
  const [ctaSuggestions, setCtaSuggestions] = useState<string[]>([]);
  const [isLoadingCta, setIsLoadingCta] = useState(false);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [selectedCta, setSelectedCta] = useState<CtaSelection>('custom');
  const [customCta, setCustomCta] = useState('');

  const isRussian = language === 'ru';

  // Load CTA suggestions when modal opens
  useEffect(() => {
    if (isOpen && prompt.trim() && userId > 0) {
      const detectedLang = detectLanguage(prompt);
      setGenLanguage(detectedLang);

      // Reset CTA state
      setCtaSuggestions([]);
      setCtaError(null);
      setSelectedCta('custom');
      setCustomCta('');

      // Generate CTA suggestions
      setIsLoadingCta(true);
      generateCtaSuggestions({
        prompt,
        user_id: userId,
        language: detectedLang,
      })
        .then((response) => {
          setCtaSuggestions(response.suggestions);
          // Auto-select first suggestion if available
          if (response.suggestions.length > 0) {
            setSelectedCta(0);
          }
        })
        .catch((err) => {
          console.error('[TextGenerationModal] CTA generation error:', err);
          setCtaError(err.message || 'Failed to generate CTA suggestions');
        })
        .finally(() => {
          setIsLoadingCta(false);
        });
    }
  }, [isOpen, prompt, userId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Determine final CTA value
    let finalCta = '';
    if (selectedCta === 'custom') {
      finalCta = customCta;
    } else if (typeof selectedCta === 'number' && ctaSuggestions[selectedCta]) {
      finalCta = ctaSuggestions[selectedCta];
    }

    onConfirm({
      textLength,
      emojiDensity,
      formatting,
      language: genLanguage,
      callToAction: finalCta,
    });
  };

  const isCtaLoading = isLoadingCta;
  const canGenerate = !isLoading && !isCtaLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <Card className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {isRussian ? 'Настройки текста' : 'Text Settings'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Text Length */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Объём текста' : 'Text Length'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TEXT_LENGTH_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setTextLength(preset.value)}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    textLength === preset.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-sm font-medium capitalize">
                    {preset.value === 'short'
                      ? isRussian ? 'Кратко' : 'Short'
                      : preset.value === 'medium'
                      ? isRussian ? 'Средне' : 'Medium'
                      : isRussian ? 'Подробно' : 'Long'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isRussian ? preset.wordsRu : preset.wordsEn}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Density */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Количество эмодзи' : 'Emoji Amount'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {EMOJI_DENSITY_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setEmojiDensity(preset.value)}
                  disabled={isLoading}
                  className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-0.5 ${
                    emojiDensity === preset.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-xs font-medium">
                    {isRussian ? preset.labelRu : preset.labelEn}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Formatting */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Форматирование' : 'Formatting'}
            </label>
            <div className="space-y-2">
              {TEXT_FORMATTING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormatting(option.value)}
                  disabled={isLoading}
                  className={`w-full p-3 rounded-lg border-2 transition-all flex items-center justify-between ${
                    formatting === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      {isRussian ? option.labelRu : option.labelEn}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isRussian ? option.descriptionRu : option.descriptionEn}
                    </p>
                  </div>
                  {formatting === option.value && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Language Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Язык генерации' : 'Generation Language'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGenLanguage('ru')}
                disabled={isLoading}
                className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  genLanguage === 'ru'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-lg">🇷🇺</span>
                <span className="text-sm font-medium">Русский</span>
              </button>
              <button
                type="button"
                onClick={() => setGenLanguage('en')}
                disabled={isLoading}
                className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  genLanguage === 'en'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-lg">🇬🇧</span>
                <span className="text-sm font-medium">English</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isRussian
                ? 'Определено автоматически по тексту запроса'
                : 'Auto-detected from prompt language'}
            </p>
          </div>

          {/* Call to Action with Radio Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Призыв к действию (CTA)' : 'Call to Action (CTA)'}
            </label>

            {/* Loading state */}
            {isCtaLoading && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {isRussian ? 'Генерация вариантов...' : 'Generating suggestions...'}
                </span>
              </div>
            )}

            {/* Error state */}
            {ctaError && !isCtaLoading && (
              <p className="text-xs text-destructive">{ctaError}</p>
            )}

            {/* CTA suggestions as radio buttons */}
            {!isCtaLoading && ctaSuggestions.length > 0 && (
              <div className="space-y-2">
                {ctaSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedCta(index as 0 | 1 | 2)}
                    disabled={isLoading}
                    className={`w-full p-3 rounded-lg border-2 transition-all flex items-start gap-3 text-left ${
                      selectedCta === index
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        selectedCta === index
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {selectedCta === index && (
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <span className="text-sm">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Custom CTA option */}
            {!isCtaLoading && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedCta('custom')}
                  disabled={isLoading}
                  className={`w-full p-3 rounded-lg border-2 transition-all flex items-start gap-3 text-left ${
                    selectedCta === 'custom'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      selectedCta === 'custom'
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {selectedCta === 'custom' && (
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm">
                    {isRussian ? 'Свой вариант' : 'Custom'}
                  </span>
                </button>

                {/* Custom CTA input - only show when custom is selected */}
                {selectedCta === 'custom' && (
                  <input
                    type="text"
                    value={customCta}
                    onChange={(e) => setCustomCta(e.target.value)}
                    placeholder={
                      isRussian
                        ? 'Введите свой призыв к действию...'
                        : 'Enter your call to action...'
                    }
                    disabled={isLoading}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {isRussian
                ? 'Если пусто — сгенерируется из контекста и профиля'
                : 'If empty — will be generated from context and profile'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              {isRussian ? 'Отмена' : 'Cancel'}
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={!canGenerate}
            >
              {isLoading
                ? isRussian
                  ? 'Генерация...'
                  : 'Generating...'
                : isRussian
                ? 'Сгенерировать'
                : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
