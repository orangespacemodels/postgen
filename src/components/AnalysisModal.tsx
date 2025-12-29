import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Check } from 'lucide-react';
import type { ContentUsageOption, ContentAnalysisContext, PRICING } from '@/types';
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
}

const OPTIONS: OptionConfig[] = [
  {
    id: 'use_narrative',
    labelRu: 'Использовать тот же нарратив',
    labelEn: 'Use the same narrative',
    descriptionRu: 'Сгенерировать контент с похожей историей и посылом',
    descriptionEn: 'Generate content with similar story and message',
    availableFor: { post: true, image: false, video: false },
  },
  {
    id: 'use_format',
    labelRu: 'Использовать такой же формат',
    labelEn: 'Use the same format',
    descriptionRu: 'Сохранить структуру и тип поста',
    descriptionEn: 'Keep the same structure and post type',
    availableFor: { post: true, image: false, video: false },
  },
  {
    id: 'use_style',
    labelRu: 'Использовать такой же стиль',
    labelEn: 'Use the same style',
    descriptionRu: 'Применить визуальный стиль к генерируемому изображению',
    descriptionEn: 'Apply visual style to generated image',
    availableFor: { post: false, image: true, video: false },
  },
  {
    id: 'use_composition',
    labelRu: 'Использовать такую же композицию',
    labelEn: 'Use the same composition',
    descriptionRu: 'Сохранить расположение элементов и кадрирование',
    descriptionEn: 'Keep element placement and framing',
    availableFor: { post: false, image: true, video: false },
  },
  {
    id: 'use_scene',
    labelRu: 'Использовать описание сцены',
    labelEn: 'Use scene description',
    descriptionRu: 'Добавить описание сцены в контекст генерации',
    descriptionEn: 'Add scene description to generation context',
    availableFor: { post: false, image: true, video: true },
  },
];

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
              {isRussian ? 'Как использовать материал?' : 'How to use this content?'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Content type indicator */}
          <div className="text-sm text-muted-foreground">
            {isRussian ? 'Тип контента: ' : 'Content type: '}
            <span className="font-medium text-foreground">
              {analysisResult.content_type === 'post' && (isRussian ? 'Пост' : 'Post')}
              {analysisResult.content_type === 'image' && (isRussian ? 'Изображение' : 'Image')}
              {analysisResult.content_type === 'video' && (isRussian ? 'Видео' : 'Video')}
              {analysisResult.has_image && ` + ${isRussian ? 'изображение' : 'image'}`}
              {analysisResult.has_video && ` + ${isRussian ? 'видео' : 'video'}`}
            </span>
          </div>

          {/* Options checkboxes */}
          <div className="space-y-3">
            {availableOptions.map((option) => (
              <label
                key={option.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedOptions.includes(option.id)
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
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
            ))}
          </div>

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
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
