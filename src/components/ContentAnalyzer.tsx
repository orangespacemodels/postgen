import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, Upload, Loader2, X, CheckCircle, Camera } from 'lucide-react';
import { CameraModal } from './CameraModal';
import type { ContentAnalysisContext } from '@/types';

interface ContentAnalyzerProps {
  isAnalyzing: boolean;
  analysisContext: ContentAnalysisContext | null;
  error: string | null;
  onAnalyzeUrl: (url: string) => void;
  onAnalyzeFile: (file: File) => void;
  onClearContext: () => void;
  language: string;
  disabled?: boolean;
}

export function ContentAnalyzer({
  isAnalyzing,
  analysisContext,
  error,
  onAnalyzeUrl,
  onAnalyzeFile,
  onClearContext,
  language,
  disabled = false,
}: ContentAnalyzerProps) {
  const [url, setUrl] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRussian = language === 'ru';

  const handleAnalyzeClick = () => {
    if (url.trim()) {
      onAnalyzeUrl(url.trim());
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAnalyzeFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = (file: File) => {
    onAnalyzeFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && url.trim() && !isAnalyzing && !disabled) {
      handleAnalyzeClick();
    }
  };

  // If context is already loaded, show summary
  if (analysisContext) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {isRussian ? 'Контекст загружен' : 'Context loaded'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {analysisContext.source_type === 'url'
                    ? analysisContext.source_url
                    : analysisContext.file_name}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {analysisContext.selected_options.map((option) => (
                    <span
                      key={option}
                      className="text-[10px] px-1.5 py-0.5 bg-primary/20 rounded"
                    >
                      {option.replace('use_', '')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-8 w-8"
              onClick={onClearContext}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {isRussian ? 'Анализ контента' : 'Content Analysis'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            {isRussian ? 'Ссылка на пост' : 'Post URL'}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRussian
                    ? 'Instagram, TikTok, LinkedIn...'
                    : 'Instagram, TikTok, LinkedIn...'
                }
                disabled={isAnalyzing || disabled}
                className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <Button
              onClick={handleAnalyzeClick}
              disabled={!url.trim() || isAnalyzing || disabled}
              className="flex-shrink-0"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                isRussian ? 'Анализировать' : 'Analyze'
              )}
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {isRussian ? 'или' : 'or'}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* File Upload / Camera */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            {isRussian ? 'Загрузить файл или снять' : 'Upload file or capture'}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={isAnalyzing || disabled}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleUploadClick}
              disabled={isAnalyzing || disabled}
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isRussian ? 'Выбрать файл' : 'Select file'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsCameraOpen(true)}
              disabled={isAnalyzing || disabled}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isRussian ? 'Камера' : 'Camera'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {isRussian
              ? 'JPG, PNG, GIF, WEBP, MP4, MOV, WEBM до 50 МБ'
              : 'JPG, PNG, GIF, WEBP, MP4, MOV, WEBM up to 50 MB'}
          </p>
        </div>

        {/* Camera Modal */}
        <CameraModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
          language={language}
        />

        {/* Error display */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
