import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ContentUsageOption } from '@/types';
import type { AnalysisResult } from '@/lib/api';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedOptions: ContentUsageOption[]) => void;
  analysisResult: AnalysisResult | null;
  sourceType: 'url' | 'file';
  estimatedCost: number;
  userUnits: number;
  language: string;
}

interface OptionConfig {
  id: ContentUsageOption;
  labelRu: string;
  labelEn: string;
  descriptionRu: string;
  descriptionEn: string;
  availableFor: {
    post: boolean;
    image: boolean;
    video: boolean;
  };
  // Function to get the actual content for this option
  getContent?: (result: AnalysisResult, isRussian: boolean) => string | null;
  // Whether this option shows an image preview instead of text
  showsImage?: boolean;
}

const OPTIONS: OptionConfig[] = [
  {
    id: 'use_narrative',
    labelRu: 'Использовать нарратив',
    labelEn: 'Use narrative',
    descriptionRu: 'Текст и посыл оригинального поста',
    descriptionEn: 'Text and message from the original post',
    availableFor: { post: true, image: false, video: false },
    getContent: (result) => result.post_text || result.narrative || null,
  },
  {
    id: 'use_format',
    labelRu: 'Использовать формат',
    labelEn: 'Use format',
    descriptionRu: 'Структура и тип контента',
    descriptionEn: 'Structure and content type',
    availableFor: { post: true, image: false, video: false },
    getContent: (result, isRussian) => {
      const parts: string[] = [];

      if (result.content_type === 'post') {
        parts.push(isRussian ? 'Тип: Текстовый пост' : 'Type: Text post');
      }
      if (result.has_image) {
        parts.push(isRussian ? '+ Изображение' : '+ Image');
      }
      if (result.has_video) {
        parts.push(isRussian ? '+ Видео' : '+ Video');
        if (result.video_duration_minutes) {
          parts.push(`(${result.video_duration_minutes.toFixed(1)} ${isRussian ? 'мин' : 'min'})`);
        }
      }
      if (result.platform_name) {
        parts.push(`\n${isRussian ? 'Платформа' : 'Platform'}: ${result.platform_name}`);
      }

      return parts.join(' ') || null;
    },
  },
  {
    id: 'use_style',
    labelRu: 'Использовать стиль изображения',
    labelEn: 'Use image style',
    descriptionRu: 'Визуальный стиль: цвета, освещение, настроение',
    descriptionEn: 'Visual style: colors, lighting, mood',
    availableFor: { post: false, image: true, video: false },
    showsImage: true,
  },
  {
    id: 'use_composition',
    labelRu: 'Использовать композицию',
    labelEn: 'Use composition',
    descriptionRu: 'Расположение объектов, ракурс, кадрирование',
    descriptionEn: 'Object placement, angle, framing',
    availableFor: { post: false, image: true, video: false },
    showsImage: true,
  },
  {
    id: 'use_scene',
    labelRu: 'Использовать описание сцены',
    labelEn: 'Use scene description',
    descriptionRu: 'Описание того, что происходит на изображении/видео',
    descriptionEn: 'Description of what\'s happening in the image/video',
    availableFor: { post: false, image: true, video: true },
    getContent: (result) => {
      // Use transcription or narrative as scene description
      if (result.transcription?.description) {
        return result.transcription.description;
      }
      if (result.narrative) {
        return result.narrative;
      }
      if (result.post_text) {
        return result.post_text;
      }
      return null;
    },
  },
];

// Collapsible content preview component
function ContentSpoiler({
  content,
  isRussian,
  imageUrl,
  showsImage,
}: {
  content: string | null;
  isRussian: boolean;
  imageUrl?: string;
  showsImage?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // For image options, show the image
  if (showsImage && imageUrl) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {isRussian ? 'Скрыть изображение' : 'Hide image'}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {isRussian ? 'Показать референс' : 'Show reference'}
            </>
          )}
        </button>
        {isExpanded && (
          <div className="mt-2 rounded-lg overflow-hidden border border-border">
            <img
              src={imageUrl}
              alt="Reference"
              className="w-full h-24 object-cover"
            />
          </div>
        )}
      </div>
    );
  }

  // For text content
  if (!content) return null;

  const truncatedContent = content.length > 100
    ? content.substring(0, 100) + '...'
    : content;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            {isRussian ? 'Свернуть' : 'Collapse'}
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            {isRussian ? 'Показать контент' : 'Show content'}
          </>
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs text-muted-foreground max-h-32 overflow-y-auto">
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      )}
      {!isExpanded && content.length > 100 && (
        <p className="mt-1 text-xs text-muted-foreground/70 italic truncate">
          {truncatedContent}
        </p>
      )}
    </div>
  );
}

export function AnalysisModal({
  isOpen,
  onClose,
  onConfirm,
  analysisResult,
  sourceType,
  estimatedCost,
  userUnits,
  language,
}: AnalysisModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<ContentUsageOption[]>([]);
  const isRussian = language === 'ru';

  useEffect(() => {
    if (isOpen) {
      setSelectedOptions([]);
    }
  }, [isOpen]);

  if (!isOpen || !analysisResult) return null;

  const getAvailableOptions = () => {
    return OPTIONS.filter((option) => {
      const contentType = analysisResult.content_type;

      // Check if the option has content available
      if (option.getContent) {
        const content = option.getContent(analysisResult, isRussian);
        if (!content && !option.showsImage) {
          return false; // Hide option if no content available
        }
      }

      // Check if image options have an image
      if (option.showsImage && !analysisResult.image_url) {
        return false;
      }

      if (contentType === 'post' && analysisResult.has_image) {
        return option.availableFor.post || option.availableFor.image;
      }
      if (contentType === 'post' && analysisResult.has_video) {
        return option.availableFor.post || option.availableFor.video;
      }
      if (contentType === 'image') {
        return option.availableFor.image;
      }
      if (contentType === 'video') {
        return option.availableFor.video;
      }
      return option.availableFor.post;
    });
  };

  const toggleOption = (optionId: ContentUsageOption) => {
    setSelectedOptions((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleConfirm = () => {
    if (selectedOptions.length > 0) {
      onConfirm(selectedOptions);
    }
  };

  const availableOptions = getAvailableOptions();
  const hasInsufficientBalance = userUnits < estimatedCost;

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
              {isRussian ? 'Что использовать из анализа?' : 'What to use from analysis?'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform and content type indicator */}
          <div className="text-sm text-muted-foreground space-y-1">
            {/* Platform */}
            {analysisResult.platform_name && (
              <div>
                {isRussian ? 'Источник: ' : 'Source: '}
                <span className="font-medium text-foreground">
                  {analysisResult.platform_name}
                  {analysisResult.author && ` (@${analysisResult.author})`}
                </span>
              </div>
            )}
          </div>

          {/* Options checkboxes with content previews */}
          <div className="space-y-3">
            {availableOptions.map((option) => {
              const content = option.getContent
                ? option.getContent(analysisResult, isRussian)
                : null;

              return (
                <div
                  key={option.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedOptions.includes(option.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-0.5 ${
                        selectedOptions.includes(option.id)
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}
                      onClick={() => toggleOption(option.id)}
                    >
                      {selectedOptions.includes(option.id) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => toggleOption(option.id)}>
                      <p className="text-sm font-medium">
                        {isRussian ? option.labelRu : option.labelEn}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRussian ? option.descriptionRu : option.descriptionEn}
                      </p>
                    </div>
                  </label>

                  {/* Collapsible content preview */}
                  <div className="ml-8">
                    <ContentSpoiler
                      content={content}
                      isRussian={isRussian}
                      imageUrl={analysisResult.image_url}
                      showsImage={option.showsImage}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {availableOptions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isRussian
                ? 'Не удалось извлечь данные из контента'
                : 'Could not extract data from content'}
            </p>
          )}

          {/* Cost display */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {isRussian ? 'Стоимость анализа:' : 'Analysis cost:'}
            </span>
            <span className={`text-sm font-medium ${hasInsufficientBalance ? 'text-destructive' : ''}`}>
              ${estimatedCost.toFixed(2)}
            </span>
          </div>

          {hasInsufficientBalance && (
            <p className="text-sm text-destructive">
              {isRussian
                ? 'Недостаточно средств на балансе'
                : 'Insufficient balance'}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {isRussian ? 'Отмена' : 'Cancel'}
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={selectedOptions.length === 0 || hasInsufficientBalance}
            >
              {isRussian ? 'Применить' : 'Apply'}
              {selectedOptions.length > 0 && ` (${selectedOptions.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
