import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { X, ChevronDown, Check } from 'lucide-react';
import {
  IMAGE_STYLES,
  ASPECT_RATIOS,
  type AspectRatio,
  type ImageGenerationParams,
} from '@/types';

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: ImageGenerationParams) => void;
  initialSceneDescription: string;
  initialCaptions: string;
  language: string;
  isLoading?: boolean;
  referenceImageUrl?: string;  // Reference image for style transfer
}

export function ImageGenerationModal({
  isOpen,
  onClose,
  onConfirm,
  initialSceneDescription,
  initialCaptions,
  language,
  isLoading = false,
  referenceImageUrl,
}: ImageGenerationModalProps) {
  const [sceneDescription, setSceneDescription] = useState(initialSceneDescription);
  const [captions, setCaptions] = useState(initialCaptions);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [styleId, setStyleId] = useState('realistic');
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);

  const isRussian = language === 'ru';

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setSceneDescription(initialSceneDescription);
      setCaptions(initialCaptions);
    }
  }, [isOpen, initialSceneDescription, initialCaptions]);

  if (!isOpen) return null;

  const selectedStyle = IMAGE_STYLES.find((s) => s.id === styleId) || IMAGE_STYLES[0];

  const handleConfirm = () => {
    onConfirm({
      sceneDescription,
      captions,
      aspectRatio,
      styleId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {isRussian ? 'Настройки изображения' : 'Image Settings'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Reference Image Preview */}
          {referenceImageUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {isRussian ? 'Референс изображение' : 'Reference Image'}
              </label>
              <div className="rounded-lg overflow-hidden border border-border">
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="w-full h-32 object-cover"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isRussian
                  ? 'Стиль и композиция будут взяты из этого изображения'
                  : 'Style and composition will be taken from this image'}
              </p>
            </div>
          )}

          {/* Scene Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Описание сцены' : 'Scene Description'}
            </label>
            <Textarea
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              placeholder={
                isRussian
                  ? 'Опишите, что должно быть изображено...'
                  : 'Describe what should be in the image...'
              }
              className="min-h-[100px] resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {isRussian
                ? 'Основное описание сцены для генерации изображения'
                : 'Main scene description for image generation'}
            </p>
          </div>

          {/* Captions/Text on Image */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Надписи на изображении' : 'Text on Image'}
            </label>
            <Textarea
              value={captions}
              onChange={(e) => setCaptions(e.target.value)}
              placeholder={
                isRussian
                  ? 'Текст, который должен появиться на изображении...'
                  : 'Text that should appear on the image...'
              }
              className="min-h-[60px] resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {isRussian
                ? 'Оставьте пустым, если надписи не нужны'
                : 'Leave empty if no text needed'}
            </p>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Формат изображения' : 'Aspect Ratio'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.value}
                  type="button"
                  onClick={() => setAspectRatio(ratio.value)}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    aspectRatio === ratio.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {/* Visual representation of aspect ratio */}
                  <div
                    className={`bg-foreground/20 rounded ${
                      ratio.value === '16:9'
                        ? 'w-10 h-6'
                        : ratio.value === '1:1'
                        ? 'w-7 h-7'
                        : 'w-5 h-8'
                    }`}
                  />
                  <span className="text-xs font-medium">{ratio.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRussian ? 'Стиль изображения' : 'Image Style'}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
                disabled={isLoading}
                className="w-full p-3 rounded-lg border border-border bg-background flex items-center justify-between hover:border-primary/50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium">
                    {isRussian ? selectedStyle.nameRu : selectedStyle.nameEn}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRussian ? selectedStyle.descriptionRu : selectedStyle.descriptionEn}
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isStyleDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isStyleDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-20 max-h-[200px] overflow-y-auto">
                  {IMAGE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => {
                        setStyleId(style.id);
                        setIsStyleDropdownOpen(false);
                      }}
                      className={`w-full p-3 text-left hover:bg-secondary/50 transition-colors flex items-center justify-between ${
                        styleId === style.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {isRussian ? style.nameRu : style.nameEn}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRussian ? style.descriptionRu : style.descriptionEn}
                        </p>
                      </div>
                      {styleId === style.id && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
              disabled={isLoading || !sceneDescription.trim()}
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
